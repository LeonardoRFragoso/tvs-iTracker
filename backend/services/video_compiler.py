import os
import shutil
import subprocess
import threading
from datetime import datetime
from typing import List, Optional

from database import db
from flask import current_app
from models.campaign import Campaign, CampaignContent
from models.content import Content


class VideoCompiler:
    def __init__(self, uploads_dir: str = 'uploads'):
        self.uploads_dir = uploads_dir
        self.compiled_dir = os.path.join(self.uploads_dir, 'compiled')
        os.makedirs(self.compiled_dir, exist_ok=True)

    # -------------------- Public API --------------------
    def start_async_compile(self, campaign_id: str, resolution: str = '1920x1080', fps: int = 30) -> bool:
        try:
            # Validate campaign exists
            campaign = Campaign.query.get(campaign_id)
            if not campaign:
                return False

            # If already processing, do not start another
            if campaign.compiled_video_status == 'processing':
                return True

            # Mark as processing
            campaign.compiled_video_status = 'processing'
            campaign.compiled_video_error = None
            campaign.compiled_video_updated_at = datetime.utcnow()
            db.session.commit()

            # Capture Flask app and launch background thread
            app = current_app._get_current_object()
            t = threading.Thread(target=self._compile_campaign_worker, args=(app, campaign_id, resolution, fps), daemon=True)
            t.start()
            # Fire start event
            try:
                self._emit(app, 'campaign_compile_progress', {
                    'campaign_id': campaign_id,
                    'status': 'processing',
                    'progress': 1,
                    'message': 'Iniciando compilação'
                })
            except Exception:
                pass
            return True
        except Exception as e:
            try:
                db.session.rollback()
            except Exception:
                pass
            return False

    # -------------------- Worker --------------------
    def _compile_campaign_worker(self, app, campaign_id: str, resolution: str, fps: int):
        # Ensure app context for DB/session access
        with app.app_context():
            campaign = Campaign.query.get(campaign_id)
            if not campaign:
                return

            ts = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            work_dir = os.path.join(self.compiled_dir, 'tmp', str(campaign_id), ts)
            os.makedirs(work_dir, exist_ok=True)

            try:
                self._ensure_ffmpeg_available()

                # Build list of active ordered contents
                contents: List[CampaignContent] = campaign.get_active_contents(order_by_index=True)
                if not contents:
                    raise RuntimeError('Campaign has no active contents to compile')

                # Prepare segments
                seg_paths: List[str] = []
                width, height = self._parse_resolution(resolution)

                total = len(contents)
                # Preparation done
                self._emit(app, 'campaign_compile_progress', {
                    'campaign_id': campaign_id,
                    'status': 'processing',
                    'progress': 5,
                    'message': f'{total} conteúdos para processar'
                })

                for idx, cc in enumerate(contents):
                    content: Optional[Content] = cc.content
                    if not content or not content.file_path:
                        # Skip invalid content
                        continue
                    src = os.path.join(self.uploads_dir, os.path.basename(content.file_path))
                    if not os.path.exists(src):
                        # Try original path as-is if stored differently
                        alt = content.file_path
                        if alt and os.path.exists(alt):
                            src = alt
                        else:
                            raise FileNotFoundError(f'Content file not found: {content.file_path}')

                    seg_out = os.path.join(work_dir, f'seg_{idx:04d}.mp4')
                    if (content.content_type or '').lower() == 'image':
                        duration = int(cc.get_effective_duration() or campaign.content_duration or 10)
                        self._build_image_segment(src, seg_out, width, height, fps, duration)
                        step = 'image'
                    else:
                        self._transcode_video_segment(src, seg_out, width, height, fps)
                        step = 'video'
                    seg_paths.append(seg_out)

                    # Emit per-segment progress (up to 80%)
                    pct = 5 + int(((idx + 1) / total) * 75)
                    self._emit(app, 'campaign_compile_progress', {
                        'campaign_id': campaign_id,
                        'status': 'processing',
                        'progress': pct,
                        'message': f'Segmento {idx + 1}/{total} ({step}) gerado'
                    })

                if not seg_paths:
                    raise RuntimeError('No valid segments were generated')

                # Concat segments
                self._emit(app, 'campaign_compile_progress', {
                    'campaign_id': campaign_id,
                    'status': 'processing',
                    'progress': 85,
                    'message': 'Concatenando segmentos'
                })
                list_path = os.path.join(work_dir, 'list.txt')
                with open(list_path, 'w', encoding='utf-8') as f:
                    for p in seg_paths:
                        f.write(f"file '{os.path.abspath(p).replace('\\\\', '/')}'\n")

                out_name = f"campaign_{campaign_id}_{ts}.mp4"
                out_full = os.path.join(self.compiled_dir, out_name)
                self._concat_segments(list_path, out_full)

                # Probe duration
                self._emit(app, 'campaign_compile_progress', {
                    'campaign_id': campaign_id,
                    'status': 'processing',
                    'progress': 92,
                    'message': 'Analisando duração'
                })
                duration_sec = self._probe_duration(out_full)

                # Persist compiled metadata
                campaign.compiled_video_path = os.path.join('compiled', out_name).replace('\\', '/')
                campaign.compiled_video_duration = int(duration_sec) if duration_sec is not None else None
                campaign.compiled_video_status = 'ready'
                campaign.compiled_video_error = None
                campaign.compiled_video_updated_at = datetime.utcnow()
                campaign.compiled_stale = False
                campaign.compiled_video_resolution = f"{width}x{height}"
                campaign.compiled_video_fps = int(fps)
                db.session.commit()

                # Emit completion event
                self._emit(app, 'campaign_compile_complete', {
                    'campaign_id': campaign_id,
                    'status': 'ready',
                    'progress': 100,
                    'message': 'Compilação concluída',
                    'compiled_video_url': f"/uploads/{campaign.compiled_video_path}",
                    'duration': campaign.compiled_video_duration,
                    'resolution': campaign.compiled_video_resolution,
                    'fps': campaign.compiled_video_fps
                })
            except Exception as e:
                try:
                    campaign.compiled_video_status = 'failed'
                    campaign.compiled_video_error = str(e)
                    campaign.compiled_video_updated_at = datetime.utcnow()
                    campaign.compiled_stale = True
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                # Emit failure event
                try:
                    self._emit(app, 'campaign_compile_complete', {
                        'campaign_id': campaign_id,
                        'status': 'failed',
                        'progress': 100,
                        'message': f'Compilação falhou: {str(e)}'
                    })
                except Exception:
                    pass
            finally:
                # Cleanup workspace
                try:
                    shutil.rmtree(work_dir, ignore_errors=True)
                except Exception:
                    pass

    # -------------------- Helpers --------------------
    def _emit(self, app, event: str, payload: dict):
        try:
            if hasattr(app, 'socketio') and app.socketio:
                app.socketio.emit(event, payload)
        except Exception:
            pass

    def _ensure_ffmpeg_available(self):
        try:
            subprocess.run(['ffmpeg', '-version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            subprocess.run(['ffprobe', '-version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        except Exception:
            raise RuntimeError('FFmpeg/FFprobe not found in PATH. Please install FFmpeg and ensure ffmpeg and ffprobe are available.')

    def _parse_resolution(self, res: str):
        try:
            w, h = res.lower().split('x')
            return int(w), int(h)
        except Exception:
            return 1920, 1080

    def _build_image_segment(self, src: str, out: str, width: int, height: int, fps: int, duration: int):
        # Scale with aspect ratio preserved and pad to target
        vf = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p"
        dur = str(max(1, duration))
        cmd = [
            'ffmpeg', '-y',
            # Video (image) input
            '-loop', '1', '-i', src,
            # Audio: generate silent stereo at 44.1kHz with same duration
            '-f', 'lavfi', '-t', dur, '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            # Output timing / filters
            '-t', dur,
            '-r', str(int(fps)),
            '-vf', vf,
            # Explicit stream mapping to combine video+audio
            '-map', '0:v:0', '-map', '1:a:0',
            # Codecs and formats
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k',
            '-ar', '44100', '-ac', '2',
            # Ensure we stop at the shortest stream just in case
            '-shortest',
            out
        ]
        self._run(cmd, 'image-segment')

    def _transcode_video_segment(self, src: str, out: str, width: int, height: int, fps: int):
        vf = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p"
        cmd = [
            'ffmpeg', '-y',
            '-i', src,
            '-r', str(int(fps)),
            '-vf', vf,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            # Normalize audio params to match image segments
            '-c:a', 'aac', '-b:a', '128k',
            '-ar', '44100', '-ac', '2',
            out
        ]
        self._run(cmd, 'video-segment')

    def _concat_segments(self, list_file: str, out_path: str):
        cmd = [
            'ffmpeg', '-y',
            '-f', 'concat', '-safe', '0',
            '-i', list_file,
            '-c:v', 'libx264',
            '-c:a', 'aac', '-b:a', '128k',
            '-movflags', '+faststart',
            out_path
        ]
        self._run(cmd, 'concat')

    def _probe_duration(self, file_path: str) -> Optional[float]:
        try:
            cmd = [
                'ffprobe', '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                file_path
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, text=True)
            s = res.stdout.strip()
            return float(s) if s else None
        except Exception:
            return None

    def _run(self, cmd: List[str], step: str):
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg step '{step}' failed: {proc.stderr[-500:]}\nCmd: {' '.join(cmd)}")


video_compiler = VideoCompiler()
