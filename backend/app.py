from flask import Flask, request, jsonify, send_from_directory, make_response, redirect, g
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv
import os
import uuid
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.base import SchedulerNotRunningError, SchedulerAlreadyRunningError
import atexit
from sqlalchemy import text
from threading import Lock
import psutil
from collections import deque
from time import perf_counter
import math

# Importar instância do banco
from database import db

# Carregar variáveis de ambiente
load_dotenv()

# Configuração da aplicação
app = Flask(__name__, static_folder=None)
app.url_map.strict_slashes = False  # Permitir rotas com e sem barra final sem redirecionar (evita 308 no preflight CORS)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///tvs_platform.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 24)))
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', 104857600))  # 100MB

# Criar diretório de uploads se não existir
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Inicializar extensões
db.init_app(app)
migrate = Migrate(app, db)

# Configurar CORS (unificado)
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True,
        "expose_headers": ["Content-Range", "X-Content-Range", "ETag"]
    },
    r"/socket.io/*": {
        "origins": "*",
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    },
    r"/uploads/*": {
        "origins": "*",
        "methods": ["GET", "OPTIONS"],
        "allow_headers": ["Range", "Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True,
        "expose_headers": ["Content-Length", "Content-Range", "Accept-Ranges"]
    }
})

jwt = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins="*", 
                  async_mode='threading', logger=False, engineio_logger=False, 
                  ping_timeout=60, ping_interval=30)
app.socketio = socketio

# Importar modelos
from models.user import User
from models.content import Content
from models.content_distribution import ContentDistribution
from models.campaign import Campaign
from models.player import Player
from models.schedule import Schedule
from models.editorial import Editorial
from models.location import Location
from models.system_config import SystemConfig

# Importar rotas
from routes.auth import auth_bp
from routes.location import location_bp
from routes.content import content_bp
from routes.campaign import campaign_bp
from routes.campaign_content import campaign_content_bp
from routes.player import player_bp
from routes.schedule import schedule_bp
from routes.dashboard import dashboard_bp
from routes.cast import cast_bp
from routes.settings import settings_bp

# Registrar blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(location_bp, url_prefix='/api/locations')
app.register_blueprint(content_bp)  
app.register_blueprint(campaign_bp, url_prefix='/api/campaigns')
app.register_blueprint(campaign_content_bp)  
app.register_blueprint(player_bp, url_prefix='/api/players')
app.register_blueprint(schedule_bp, url_prefix='/api/schedules')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
app.register_blueprint(cast_bp, url_prefix='/api/cast')
app.register_blueprint(settings_bp)

# =========================
# Traffic monitoring memory
# =========================
TRAFFIC_STATS = {
    'since': datetime.now(timezone.utc).isoformat(),
    'total_bytes': 0,
    'players': {}
}
TRAFFIC_MINUTE = {}
TRAFFIC_LOCK = Lock()

# Mapas para conexões Socket.IO
CONNECTED_PLAYERS = {}
SOCKET_SID_TO_PLAYER = {}
SOCKET_SID_TO_USER = {}

# Mapa para rastrear reprodução ativa dos players
if 'PLAYER_PLAYBACK_STATUS' not in globals():
    PLAYER_PLAYBACK_STATUS = {}

# Métricas de uploads (latência e contadores HTTP)
UPLOAD_METRICS = {
    'status_counts': {'200': 0, '206': 0, '304': 0, '4xx': 0, '5xx': 0},
    'latencies_ms': deque(maxlen=2000)
}

# Snapshot anterior de rede para taxas (bytes/s)
SYSTEM_NET_LAST = {'ts': None, 'bytes_sent': 0, 'bytes_recv': 0}

# =========================
# Utilitários consolidados
# =========================

def _categorize_content_type(path: str, mimetype: str) -> str:
    """Categoriza tipo de conteúdo baseado no path e mimetype"""
    try:
        ext = os.path.splitext(path)[1].lower()
        if ('video' in (mimetype or '')) or ext in ['.mp4', '.mkv', '.mov', '.avi', '.wmv']:
            return 'video'
        if ('image' in (mimetype or '')) or ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            return 'image'
        if ('audio' in (mimetype or '')) or ext in ['.mp3', '.aac', '.wav', '.ogg']:
            return 'audio'
        return 'other'
    except Exception:
        return 'other'

def _traffic_snapshot():
    """Retorna snapshot atual do tráfego"""
    with TRAFFIC_LOCK:
        return {
            'since': TRAFFIC_STATS.get('since'),
            'total_bytes': TRAFFIC_STATS.get('total_bytes', 0),
            'players': TRAFFIC_STATS.get('players', {})
        }

def _react_build_dir() -> str:
    """Diretório do build React"""
    return os.path.join(os.path.dirname(__file__), 'build')

def _has_react_build() -> bool:
    """Verifica se build React existe"""
    try:
        return os.path.exists(os.path.join(_react_build_dir(), 'index.html'))
    except Exception:
        return False

def _serve_react_file(filename: str):
    """Serve arquivo do build React"""
    try:
        return send_from_directory(_react_build_dir(), filename)
    except Exception:
        return jsonify({'error': f'Arquivo {filename} não encontrado'}), 404

def _authenticate_websocket_user(auth=None, token=None):
    """Autentica usuário WebSocket e retorna informações"""
    info = {}
    # Token pode vir via auth handshake, query ou Authorization header
    if not token:
        if isinstance(auth, dict):
            token = auth.get('token') or auth.get('access_token')
        token = token or request.args.get('token')
        token = token or (request.headers.get('Authorization') or '').replace('Bearer ', '').strip()
    
    if token:
        try:
            from flask_jwt_extended import decode_token
            decoded = decode_token(token)
            uid = decoded.get('sub')
            u = db.session.get(User, uid) if uid else None
            if u:
                info = {
                    'user_id': str(uid),
                    'role': getattr(u, 'role', None),
                    'company': getattr(u, 'company', None)
                }
        except Exception:
            pass  # Token inválido não deve derrubar a conexão
    return info

def _kiosk_landing_html(prefill_code: str = ''):
    """Gera HTML da página de entrada para TVs/kiosks"""
    html = f"""
    <!DOCTYPE html>
    <html lang="pt-br">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <title>TVs iTracker - Entrar no Player</title>
        <style>
          html, body {{ height: 100%; margin: 0; }}
          body {{ background: #000; color: #fff; font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; }}
          .card {{ width: 92%; max-width: 520px; background: #111; padding: 28px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.6); }}
          h1 {{ margin: 0 0 12px; font-size: 22px; }}
          p {{ margin: 6px 0 18px; color: #aaa; }}
          .row {{ display: flex; gap: 10px; }}
          input {{ flex: 1; padding: 14px 16px; font-size: 22px; border-radius: 8px; border: 1px solid #333; background: #000; color: #fff; text-align: center; letter-spacing: 2px; }}
          button {{ padding: 14px 18px; font-size: 18px; border-radius: 8px; border: 0; background: #0d6efd; color: #fff; cursor: pointer; }}
          button:disabled {{ opacity: .7; cursor: not-allowed; }}
          .hint {{ font-size: 14px; color: #888; margin-top: 12px; }}
          .error {{ color: #ff6b6b; margin-top: 12px; }}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>TVs iTracker</h1>
          <p>Digite o código do player (6 a 8 dígitos) para iniciar.</p>
          <div class="row">
            <input id="code" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="one-time-code" placeholder="Ex: 386342" value="{prefill_code}" autofocus />
            <button id="go">Entrar</button>
          </div>
          <div class="hint">Dica: abra apenas <strong>http://{request.host}/</strong> no navegador da TV/celular.</div>
          <div id="msg" class="error" role="alert" aria-live="polite"></div>
        </div>
        <script>
          const input = document.getElementById('code');
          const btn = document.getElementById('go');
          const msg = document.getElementById('msg');

          async function resolveAndGo(code) {{
            msg.textContent = '';
            if (!code) {{ msg.textContent = 'Informe o código do player.'; return; }}
            try {{
              btn.disabled = true;
              const res = await fetch(`/api/players/resolve-code/${{code}}`);
              const data = await res.json();
              if (res.ok && data.player_id) {{
                window.location.href = `/kiosk/player/${{data.player_id}}?fullscreen=true`;
              }} else {{
                msg.textContent = data.error || 'Código inválido';
              }}
            }} catch (e) {{
              msg.textContent = 'Falha de rede. Verifique se o celular/TV está na mesma rede.';
            }} finally {{
              btn.disabled = false;
            }}
          }}

          btn.addEventListener('click', () => resolveAndGo(input.value.trim()));
          input.addEventListener('keydown', (e) => {{ if (e.key === 'Enter') resolveAndGo(input.value.trim()); }});

          const params = new URLSearchParams(window.location.search);
          const q = params.get('code');
          if (q && !input.value) {{ input.value = q; resolveAndGo(q); }}
        </script>
      </body>
    </html>
    """
    resp = make_response(html)
    resp.headers['Content-Type'] = 'text/html; charset=utf-8'
    return resp

# =========================
# Configurar scheduler
# =========================
scheduler = BackgroundScheduler()

def check_schedules_with_context():
    """Verifica e executa agendamentos"""
    print(f"[{datetime.now(timezone.utc)}] Executando verificação de agendamentos...")
    with app.app_context():
        from services.schedule_executor import schedule_executor
        schedule_executor.check_and_execute_schedules()

def emit_traffic_stats_job():
    """Emite estatísticas de tráfego para admins"""
    try:
        socketio.emit('traffic_stats', _traffic_snapshot(), room='admin')
    except Exception as e:
        print(f"[Traffic] Falha ao emitir estatísticas: {e}")

def sync_player_statuses_job():
    """Sincroniza status dos players"""
    try:
        with app.app_context():
            enabled = SystemConfig.get_value('general.auto_sync')
            if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True or enabled is None:
                from services.auto_sync_service import auto_sync_service
                auto_sync_service.sync_all_players()
            else:
                print("[AutoSync] Ignorado (general.auto_sync = false)")
    except Exception as e:
        print(f"[AutoSync] Falha ao sincronizar players: {e}")

# Jobs do scheduler serão configurados depois dentro do contexto da aplicação

# =========================
# Traffic monitoring
# =========================

@app.before_request
def _measure_upload_latency_start():
    """Marca início para medir latência de /uploads."""
    try:
        if request.path.startswith('/uploads/'):
            g._upload_start = perf_counter()
    except Exception:
        pass

@app.after_request
def _track_upload_traffic(response):
    """Rastreia tráfego de uploads"""
    try:
        if request.path.startswith('/uploads/'):
            pid = request.args.get('pid') or 'unknown'
            content_length = response.headers.get('Content-Length')
            try:
                bytes_sent = int(content_length) if content_length and str(content_length).isdigit() else 0
            except Exception:
                bytes_sent = 0
            category = _categorize_content_type(request.path, getattr(response, 'mimetype', '') or '')
            ts = datetime.now(timezone.utc).isoformat()
            
            with TRAFFIC_LOCK:
                pstats = TRAFFIC_STATS['players'].setdefault(pid, {
                    'bytes': 0,
                    'requests': 0,
                    'by_type': {'video': 0, 'image': 0, 'audio': 0, 'other': 0},
                    'status_counts': {'200': 0, '206': 0, '304': 0, '4xx': 0, '5xx': 0},
                    'last_seen': None
                })
                pstats['bytes'] += bytes_sent
                pstats['requests'] += 1
                pstats['by_type'][category] = pstats['by_type'].get(category, 0) + bytes_sent
                pstats['last_seen'] = ts
                TRAFFIC_STATS['total_bytes'] += bytes_sent

                # Bucket por minuto
                minute_key = datetime.now(timezone.utc).replace(second=0, microsecond=0).isoformat()
                pminute = TRAFFIC_MINUTE.setdefault(pid, {})
                bucket = pminute.setdefault(minute_key, {
                    'bytes': 0, 'requests': 0, 
                    'by_type': {'video': 0, 'image': 0, 'audio': 0, 'other': 0}
                })
                bucket['bytes'] += bytes_sent
                bucket['requests'] += 1
                bucket['by_type'][category] = bucket['by_type'].get(category, 0) + bytes_sent

            # Medir latência e classificar status HTTP
            try:
                status = getattr(response, 'status_code', 200)
                # Incremento global
                if status == 200:
                    UPLOAD_METRICS['status_counts']['200'] += 1
                    sc_key = '200'
                elif status == 206:
                    UPLOAD_METRICS['status_counts']['206'] += 1
                    sc_key = '206'
                elif status == 304:
                    UPLOAD_METRICS['status_counts']['304'] += 1
                    sc_key = '304'
                elif 400 <= status < 500:
                    UPLOAD_METRICS['status_counts']['4xx'] += 1
                    sc_key = '4xx'
                elif status >= 500:
                    UPLOAD_METRICS['status_counts']['5xx'] += 1
                    sc_key = '5xx'
                else:
                    sc_key = None
                # Incremento por player
                if sc_key:
                    with TRAFFIC_LOCK:
                        p = TRAFFIC_STATS['players'].setdefault(pid, {})
                        pc = p.setdefault('status_counts', {'200': 0, '206': 0, '304': 0, '4xx': 0, '5xx': 0})
                        pc[sc_key] = pc.get(sc_key, 0) + 1
            except Exception:
                status = None

            try:
                if hasattr(g, '_upload_start'):
                    latency_ms = (perf_counter() - g._upload_start) * 1000.0
                    UPLOAD_METRICS['latencies_ms'].append(latency_ms)
            except Exception:
                pass

            # Debug opcional
            try:
                if SystemConfig.get_value('general.debug_mode', False):
                    print(f"[Traffic] /uploads hit pid={pid} bytes={bytes_sent} status={status}")
            except Exception:
                pass
    except Exception as e:
        print(f"[Traffic] Falha ao registrar tráfego: {e}")
    return response

# =========================
# WebSocket events
# =========================

@socketio.on('connect', namespace='/')
def handle_connect(auth=None):
    """Rastreia conexão e autentica usuário"""
    try:
        info = _authenticate_websocket_user(auth)
        SOCKET_SID_TO_USER[request.sid] = info
    except Exception:
        SOCKET_SID_TO_USER[request.sid] = {}

@socketio.on('disconnect')
def handle_disconnect():
    """Limpa mapeamentos quando socket é desconectado"""
    try:
        sid = request.sid
        pid = SOCKET_SID_TO_PLAYER.pop(sid, None)
        if pid:
            try:
                if CONNECTED_PLAYERS.get(pid, {}).get('sid') == sid:
                    CONNECTED_PLAYERS.pop(pid, None)
            except Exception:
                CONNECTED_PLAYERS.pop(pid, None)
        SOCKET_SID_TO_USER.pop(sid, None)
    except Exception:
        pass

@socketio.on('join_player')
def handle_join_player(data):
    """Player se junta à sala"""
    player_id = data.get('player_id')
    if player_id:
        join_room(f'player_{player_id}')
        emit('joined_player', {'player_id': player_id})
        try:
            CONNECTED_PLAYERS[player_id] = {
                'sid': request.sid, 
                'last_seen': datetime.now(timezone.utc).isoformat()
            }
            SOCKET_SID_TO_PLAYER[request.sid] = player_id
        except Exception:
            pass

@socketio.on('join_admin')
def handle_join_admin():
    """Admin se junta à sala"""
    try:
        info = SOCKET_SID_TO_USER.get(request.sid)
        role = info.get('role') if info else None
        if role == 'admin':
            join_room('admin')
            emit('joined_admin', {'ok': True})
            # Emitir uma leitura imediata de métricas do sistema para este admin
            try:
                enabled = SystemConfig.get_value('monitor.enable_system_stats', True)
                if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True:
                    socketio.emit('system_stats', _collect_system_stats(), room=request.sid)
            except Exception:
                pass
        else:
            emit('joined_admin', {'ok': False, 'error': 'not_authorized'})
    except Exception as e:
        emit('joined_admin', {'ok': False, 'error': str(e)})

@socketio.on('player_sync_request')
def handle_player_sync_request(data):
    """Player solicita sincronização"""
    try:
        player_id = data.get('player_id')
        if not player_id:
            emit('error', {'message': 'player_id é obrigatório'})
            return
        
        from services.distribution_manager import ContentDistributionManager
        manager = ContentDistributionManager()
        content_list = manager.get_player_content_list(player_id)
        
        emit('sync_response', {
            'player_id': player_id,
            'content_list': content_list,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('distribution_status_update')
def handle_distribution_status_update(data):
    """Atualiza status da distribuição de conteúdo"""
    try:
        distribution_id = data.get('distribution_id')
        status = data.get('status')
        progress = data.get('progress', 0)
        error_message = data.get('error_message')
        
        if not distribution_id or not status:
            emit('error', {'message': 'distribution_id e status são obrigatórios'})
            return
        
        from models.content_distribution import ContentDistribution, db
        
        distribution = ContentDistribution.query.get(distribution_id)
        if not distribution:
            emit('error', {'message': 'Distribuição não encontrada'})
            return
        
        distribution.status = status
        distribution.progress_percentage = progress
        distribution.updated_at = datetime.now(timezone.utc)
        
        if status == 'downloading' and not distribution.started_at:
            distribution.started_at = datetime.now(timezone.utc)
        elif status == 'completed':
            distribution.completed_at = datetime.now(timezone.utc)
            distribution.progress_percentage = 100
        elif status == 'failed':
            distribution.error_message = error_message
            distribution.retry_count += 1
        
        db.session.commit()
        
        socketio.emit('distribution_updated', {
            'distribution_id': distribution_id,
            'status': status,
            'progress': progress,
            'player_id': distribution.player_id,
            'content_id': distribution.content_id
        }, room='admin')
        
        emit('status_update_confirmed', {
            'distribution_id': distribution_id,
            'status': status
        })
        
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})

@socketio.on('player_heartbeat')
def handle_player_heartbeat(data):
    """Recebe heartbeat dos players"""
    try:
        player_id = data.get('player_id')
        storage_info = data.get('storage_info', {})
        network_info = data.get('network_info', {})
        
        if not player_id:
            emit('error', {'message': 'player_id é obrigatório'})
            return
        
        from models.player import Player, db
        
        player = Player.query.get(player_id)
        if not player:
            emit('error', {'message': 'Player não encontrado'})
            return
        
        player.last_seen = datetime.now(timezone.utc)
        player.is_online = True
        
        if storage_info:
            player.storage_used_gb = storage_info.get('used_gb', player.storage_used_gb)
            player.storage_capacity_gb = storage_info.get('capacity_gb', player.storage_capacity_gb)
        
        if network_info:
            player.network_speed_mbps = network_info.get('speed_mbps', player.network_speed_mbps)
        
        db.session.commit()
        
        socketio.emit('player_status_update', {
            'player_id': player_id,
            'is_online': True,
            'last_seen': player.last_seen.isoformat(),
            'storage_used_gb': player.storage_used_gb,
            'storage_capacity_gb': player.storage_capacity_gb
        }, room='admin')
        
        emit('heartbeat_confirmed', {
            'player_id': player_id,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})

@socketio.on('request_content_download')
def handle_content_download_request(data):
    """Player solicita download de conteúdo"""
    try:
        player_id = data.get('player_id')
        content_id = data.get('content_id')
        
        if not player_id or not content_id:
            emit('error', {'message': 'player_id e content_id são obrigatórios'})
            return
        
        from models.content import Content
        from models.player import Player
        from services.distribution_manager import ContentDistributionManager
        
        player = Player.query.get(player_id)
        content = Content.query.get(content_id)
        
        if not player:
            emit('error', {'message': 'Player não encontrado'})
            return
        
        if not content:
            emit('error', {'message': 'Conteúdo não encontrado'})
            return
        
        manager = ContentDistributionManager()
        distribution_id = manager.distribute_to_player(content_id, player_id, 'high')
        
        emit('download_authorized', {
            'distribution_id': distribution_id,
            'content_id': content_id,
            'download_url': f"/api/content/{content_id}/download",
            'file_size_mb': content.file_size_mb,
            'checksum': content.checksum
        })
        
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('playback_event')
def handle_playback_event(data):
    """Recebe eventos de telemetria de reprodução dos players"""
    try:
        print(f"[Playback] Evento recebido: {data}")
        event_type = data.get('type')
        event_data = data.get('data', {})
        player_id = event_data.get('player_id')
        
        print(f"[Playback] Processando evento: {event_type} para player {player_id}")
        
        if not player_id or not event_type:
            print(f"[Playback] Erro: player_id ou type ausente")
            emit('error', {'message': 'player_id e type são obrigatórios'})
            return
        
        # Atualizar status de reprodução do player
        current_time = datetime.now(timezone.utc)
        
        if event_type == 'playback_start':
            # Salvar no banco de dados em vez de memória
            from models.player import Player
            player = Player.query.get(player_id)
            if player:
                player.is_playing = True
                player.current_content_id = event_data.get('content_id')
                player.current_content_title = event_data.get('content_title')
                player.current_content_type = event_data.get('content_type')
                player.current_campaign_id = event_data.get('campaign_id')
                player.current_campaign_name = event_data.get('campaign_name')
                player.playback_start_time = current_time
                player.last_playback_heartbeat = current_time
                db.session.commit()
                
                print(f"[Playback] Player {player_id} iniciou reprodução: {event_data.get('content_title')}")
                print(f"[Playback] Status salvo no banco de dados")
            
            # Manter também em memória para compatibilidade
            PLAYER_PLAYBACK_STATUS[player_id] = {
                'is_playing': True,
                'content_id': event_data.get('content_id'),
                'content_title': event_data.get('content_title'),
                'content_type': event_data.get('content_type'),
                'campaign_id': event_data.get('campaign_id'),
                'campaign_name': event_data.get('campaign_name'),
                'start_time': current_time.isoformat(),
                'last_heartbeat': current_time.isoformat(),
                'playlist_index': event_data.get('playlist_index', 0),
                'playlist_total': event_data.get('playlist_total', 1),
                'duration_expected': event_data.get('duration_expected', 0)
            }
            
        elif event_type == 'playback_end':
            if player_id in PLAYER_PLAYBACK_STATUS:
                PLAYER_PLAYBACK_STATUS[player_id]['is_playing'] = False
                PLAYER_PLAYBACK_STATUS[player_id]['end_time'] = current_time.isoformat()
                PLAYER_PLAYBACK_STATUS[player_id]['duration_actual'] = event_data.get('duration_actual', 0)
            print(f"[Playback] Player {player_id} finalizou reprodução")
            
        elif event_type == 'playback_heartbeat':
            if player_id in PLAYER_PLAYBACK_STATUS:
                PLAYER_PLAYBACK_STATUS[player_id]['last_heartbeat'] = current_time.isoformat()
                PLAYER_PLAYBACK_STATUS[player_id]['is_playing'] = event_data.get('is_playing', True)
            
        elif event_type == 'content_change':
            if player_id in PLAYER_PLAYBACK_STATUS:
                PLAYER_PLAYBACK_STATUS[player_id]['content_id'] = event_data.get('next_content_id')
                PLAYER_PLAYBACK_STATUS[player_id]['content_title'] = event_data.get('next_content_title')
                PLAYER_PLAYBACK_STATUS[player_id]['content_type'] = event_data.get('next_content_type')
                PLAYER_PLAYBACK_STATUS[player_id]['playlist_index'] = event_data.get('playlist_index', 0)
            print(f"[Playback] Player {player_id} mudou conteúdo para: {event_data.get('next_content_title')}")
        
        # Emitir atualização para admins
        socketio.emit('playback_status_update', {
            'player_id': player_id,
            'event_type': event_type,
            'status': PLAYER_PLAYBACK_STATUS.get(player_id, {}),
            'timestamp': current_time.isoformat()
        }, room='admin')
        
    except Exception as e:
        print(f"[Playback] Erro ao processar evento: {e}")
        emit('error', {'message': str(e)})

# =========================
# Rotas HTTP consolidadas
# =========================

# CORS preflight handler for all API routes (prevents redirects on OPTIONS)
@app.route('/api/<path:any_path>', methods=['OPTIONS'])
def api_cors_preflight(any_path):
    return make_response('', 204)

# Servir arquivos de upload
@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """Serve uploaded files"""
    upload_dir = app.config['UPLOAD_FOLDER']
    if not os.path.isabs(upload_dir):
        upload_dir = os.path.join(app.root_path, upload_dir)

    # Enviar arquivo de forma eficiente; Flask cuidará de If-Modified-Since/Range quando aplicável
    resp = send_from_directory(upload_dir, filename, conditional=True)

    # Cabeçalhos de cache forte para permitir offline-first no cliente
    try:
        abs_path = os.path.normpath(os.path.join(upload_dir, filename))
        st = os.stat(abs_path)
        # ETag simples e estável: tamanho + mtime (hex)
        etag = f"\"{st.st_size:x}-{int(st.st_mtime):x}\""
        resp.headers['ETag'] = etag
    except Exception:
        pass

    # Cache longo e imutável (invalidado via parâmetro ?v= na playlist)
    resp.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    # Garantir indicação de suporte a faixas
    resp.headers['Accept-Ranges'] = 'bytes'
    return resp

# Servir arquivos do player Tizen
@app.route('/tizen-player/<path:filename>')
def serve_tizen_player(filename):
    """Serve Tizen player files"""
    tizen_dir = os.path.join(app.root_path, '..', 'tizen-player')
    return send_from_directory(tizen_dir, filename)

# Service Worker para cache offline de mídias
@app.route('/sw.js')
@app.route('/app/sw.js')
def service_worker_js():
    """Entrega um Service Worker que implementa cache-first para /uploads e suporte a Range a partir de cache completo.
    A URL precisa estar na raiz para controlar todo o escopo.
    """
    sw_code = r"""
    const CACHE_NAME = 'uploads-cache-v1';

    self.addEventListener('install', (event) => {
      self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
      event.waitUntil(self.clients.claim());
    });

    async function cachePut(url, resp) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, resp.clone());
    }

    self.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type === 'prefetch' && Array.isArray(data.urls)) {
        event.waitUntil((async () => {
          const cache = await caches.open(CACHE_NAME);
          for (const url of data.urls) {
            try {
              const u = new URL(url, self.location.origin);
              if (u.origin !== self.location.origin) continue;
              if (!u.pathname.startsWith('/uploads/')) continue;
              const exists = await cache.match(u.toString());
              if (!exists) {
                const resp = await fetch(u.toString(), { credentials: 'same-origin' });
                if (resp && resp.ok) await cache.put(u.toString(), resp.clone());
              }
            } catch (e) { /* ignore */ }
          }
        })());
      }
    });

    self.addEventListener('fetch', (event) => {
      const req = event.request;
      if (req.method !== 'GET') return;
      const url = new URL(req.url);
      if (url.origin !== self.location.origin) return;
      if (!url.pathname.startsWith('/uploads/')) return;

      const rangeHeader = req.headers.get('range') || req.headers.get('Range');
      if (rangeHeader) {
        event.respondWith(handleRangeRequest(req, rangeHeader));
        return;
      }
      event.respondWith(cacheFirst(req));
    });

    async function cacheFirst(req) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req.url);
      if (cached) return cached;
      const resp = await fetch(req);
      if (resp && resp.ok) {
        try { await cache.put(req.url, resp.clone()); } catch (e) {}
      }
      return resp;
    }

    async function handleRangeRequest(req, rangeHeader) {
      try {
        const url = req.url;
        const cache = await caches.open(CACHE_NAME);
        let full = await cache.match(url);
        if (!full) {
          // Sem cópia completa no cache: atender via rede.
          // Evitar prefetch completo para vídeos grandes; manter prefetch apenas para imagens/arquivos pequenos.
          const netResp = await fetch(req);
          try {
            const u = new URL(url);
            const isVideo = /\.(mp4|mkv|mov|avi|wmv)$/i.test(u.pathname);
            if (!isVideo) {
              fetch(url).then(r => { if (r && r.ok) cache.put(url, r.clone()); }).catch(() => {});
            }
          } catch (e) { /* ignore */ }
          return netResp;
        }

        const buf = await full.arrayBuffer();
        const size = buf.byteLength;
        const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
        if (!m) return full;
        let start = Number(m[1]);
        let end = m[2] ? Number(m[2]) : (size - 1);
        if (isNaN(start) || isNaN(end) || start > end || end >= size) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        }
        const chunk = buf.slice(start, end + 1);
        const headers = new Headers(full.headers);
        headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
        headers.set('Content-Length', String(chunk.byteLength));
        headers.set('Accept-Ranges', 'bytes');
        return new Response(chunk, { status: 206, statusText: 'Partial Content', headers });
      } catch (e) {
        return fetch(req);
      }
    }
    """
    resp = make_response(sw_code)
    resp.headers['Content-Type'] = 'application/javascript'
    # Não cachear o SW para permitir atualizações rápidas
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return resp

# Network info endpoint
@app.route('/api/system/network-info')
def get_network_info():
    """Retorna informações de rede para configuração automática"""
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        return jsonify({
            'local_ip': local_ip,
            'suggested_frontend_url': f'http://{local_ip}:3000',
            'suggested_backend_url': f'http://{local_ip}:5000',
            'kiosk_base_url': f'http://{local_ip}:3000/k/',
            'current_detected_ip': local_ip
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Public companies endpoint
@app.route('/api/public/companies', methods=['GET'])
def public_companies():
    """Lista empresas conhecidas (sem autenticação)"""
    try:
        user_companies = [row[0] for row in db.session.query(db.func.distinct(User.company)).all()]
        location_companies = [row[0] for row in db.session.query(db.func.distinct(Location.company)).all()]
        companies = sorted({str(c).strip() for c in (user_companies + location_companies) if c and str(c).strip()})
        if not companies:
            companies = ['iTracker', 'Rio Brasil Terminal - RBT', 'CLIA']
        return jsonify({'companies': companies}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =========================
# Rotas SPA/Admin consolidadas
# =========================

# Short-link público /k/<code>
@app.route('/k/<code>')
def short_link_kiosk(code):
    """Link curto para player por código com detecção de dispositivo"""
    try:
        player = Player.query.filter(Player.access_code == code.upper()).first()
        if not player:
            return _kiosk_landing_html(prefill_code=code)
        
        # Detectar tipo de dispositivo baseado no User-Agent
        user_agent = request.headers.get('User-Agent', '').lower()
        
        # Detectar Samsung Tizen
        if 'tizen' in user_agent:
            # Se o player já está configurado como tizen, manter
            if player.device_type != 'tizen':
                print(f"[INFO] Detectado dispositivo Tizen acessando player {player.id}")
                # Atualizar o tipo de dispositivo para tizen se ainda não estiver configurado
                if player.device_type == 'modern':
                    player.device_type = 'tizen'
                    db.session.commit()
                    print(f"[INFO] Player {player.id} atualizado para tipo 'tizen'")
            
            # Redirecionar para o player Tizen
            return redirect(f"/tizen-player/index.html?id={player.id}")
        
        # Detectar dispositivos legados (navegadores antigos)
        elif ('msie' in user_agent or 'trident' in user_agent or 
              'edge/' in user_agent and 'edg/' not in user_agent):
            # Se o player já está configurado como legacy, manter
            if player.device_type != 'legacy':
                print(f"[INFO] Detectado dispositivo legado acessando player {player.id}")
                # Atualizar o tipo de dispositivo para legacy se ainda não estiver configurado
                if player.device_type == 'modern':
                    player.device_type = 'legacy'
                    db.session.commit()
                    print(f"[INFO] Player {player.id} atualizado para tipo 'legacy'")
            
            # Redirecionar para o player legado (ainda não implementado, usar Tizen por enquanto)
            return redirect(f"/tizen-player/index.html?id={player.id}")
        
        # Dispositivos modernos (padrão - React)
        else:
            # Redirecionar para o player React padrão
            return redirect(f"/kiosk/player/{player.id}?fullscreen=true")
    
    except Exception as e:
        print(f"[ERROR] Erro ao processar short_link_kiosk: {str(e)}")
        return _kiosk_landing_html(prefill_code=code)

# Rota raiz: kiosk landing
@app.route('/')
def root_index():
    return _kiosk_landing_html()

# Admin SPA
@app.route('/app')
@app.route('/app/<path:path>')
def serve_admin_app(path=''):
    if _has_react_build():
        return _serve_react_file('index.html')
    return redirect('/')

# TV landing dedicada
@app.route('/tv')
def tv_landing():
    return _kiosk_landing_html()

# Player page no SPA
@app.route('/kiosk/player/<player_id>')
def kiosk_player_page(player_id):
    if _has_react_build():
        return _serve_react_file('index.html')
    return _kiosk_landing_html()

# Redirects para rotas admin (consolidado)
@app.route('/<path:admin_route>')
def redirect_admin_routes(admin_route):
    """Redireciona rotas admin para /app/<rota>"""
    admin_routes = ['login', 'register', 'forgot-password', 'change-password', 
                   'dashboard', 'content', 'campaigns', 'players', 'schedules', 'settings']
    if admin_route in admin_routes:
        return redirect(f'/app/{admin_route}')
    return jsonify({'error': 'Rota não encontrada'}), 404

# Servir assets estáticos (consolidado)
@app.route('/static/<path:filename>')
@app.route('/app/static/<path:filename>')
def serve_static_assets(filename):
    """Serve arquivos estáticos do build React"""
    try:
        return send_from_directory(os.path.join(_react_build_dir(), 'static'), filename)
    except Exception:
        return jsonify({'error': 'Arquivo não encontrado'}), 404

# Servir arquivos especiais do React (consolidado)
@app.route('/manifest.json')
@app.route('/app/manifest.json')
def serve_manifest():
    return _serve_react_file('manifest.json')

@app.route('/favicon.ico')
@app.route('/app/favicon.ico')
def serve_favicon():
    return _serve_react_file('favicon.ico')

@app.route('/app/asset-manifest.json')
def serve_asset_manifest():
    return _serve_react_file('asset-manifest.json')

# =========================
# Monitoramento consolidado
# =========================

@app.route('/api/monitor/traffic', methods=['GET'])
@jwt_required()
def monitor_traffic():
    """Monitora tráfego de rede"""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Sem permissão'}), 403
        
        window_min = int(SystemConfig.get_value('monitor.overuse_window_min', 1) or 1)
        try:
            overuse_bpm_mb = float(SystemConfig.get_value('monitor.overuse_bpm_mb', 100) or 100)
            overuse_bpm_bytes = int(overuse_bpm_mb * 1024 * 1024)
        except Exception:
            overuse_bpm_bytes = 100 * 1024 * 1024
        try:
            overuse_rpm = int(SystemConfig.get_value('monitor.overuse_rpm', 300) or 300)
        except Exception:
            overuse_rpm = 300

        snapshot = _traffic_snapshot()

        # Calcular taxa recente
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        minute_keys = [(now - timedelta(minutes=i)).isoformat() for i in range(window_min)]
        overuse_players = []
        recent_players = {}
        
        with TRAFFIC_LOCK:
            for pid, buckets in TRAFFIC_MINUTE.items():
                sum_bytes = sum(buckets.get(mk, {}).get('bytes', 0) for mk in minute_keys)
                sum_requests = sum(buckets.get(mk, {}).get('requests', 0) for mk in minute_keys)
                bpm = sum_bytes / max(1, window_min)
                rpm = sum_requests / max(1, window_min)
                recent_players[pid] = {
                    'bytes': sum_bytes, 'requests': sum_requests,
                    'bytes_per_min': bpm, 'rpm': rpm
                }
                if bpm > overuse_bpm_bytes or rpm > overuse_rpm:
                    overuse_players.append({
                        'player_id': pid, 'bytes_per_min': bpm, 'rpm': rpm,
                        'bytes': sum_bytes, 'requests': sum_requests
                    })

        snapshot.update({
            'recent_window_min': window_min,
            'thresholds': {'overuse_bpm_bytes': overuse_bpm_bytes, 'overuse_rpm': overuse_rpm},
            'recent': {'players': recent_players},
            'overuse_players': overuse_players
        })

        if request.args.get('reset') == 'true':
            with TRAFFIC_LOCK:
                TRAFFIC_STATS.update({
                    'players': {}, 'total_bytes': 0,
                    'since': datetime.now(timezone.utc).isoformat()
                })
                TRAFFIC_MINUTE.clear()
        
        return jsonify(snapshot), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/players', methods=['GET'])
@jwt_required()
def monitor_players():
    """Monitora status dos players"""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Sem permissão'}), 403
        
        try:
            players = Player.query.order_by(Player.created_at.desc()).all()
        except Exception:
            players = Player.query.all()
        
        items = [{
            'id': str(p.id),
            'name': p.name,
            'status': getattr(p, 'status', None) or 'offline',
            'last_ping': (p.last_ping.isoformat() if getattr(p, 'last_ping', None) else None),
            'socket_connected': str(p.id) in CONNECTED_PLAYERS,
            'socket_last_seen': CONNECTED_PLAYERS.get(str(p.id), {}).get('last_seen')
        } for p in players]
        
        return jsonify({
            'players': items, 
            'connected_count': len(CONNECTED_PLAYERS)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =========================
# Database utilities consolidadas
# =========================

def _ensure_network_tables():
    """Garante existência das tabelas de monitoramento"""
    try:
        engine = db.engine
        with engine.connect() as conn:
            # Criar tabelas de samples
            for table, ts_col in [
                ('network_samples_minute', 'ts_minute'),
                ('network_samples_hour', 'ts_hour'),
                ('network_samples_day', 'ts_day')
            ]:
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS {table} (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        player_id TEXT NOT NULL,
                        {ts_col} TEXT NOT NULL,
                        bytes INTEGER DEFAULT 0,
                        requests INTEGER DEFAULT 0,
                        video INTEGER DEFAULT 0,
                        image INTEGER DEFAULT 0,
                        audio INTEGER DEFAULT 0,
                        other INTEGER DEFAULT 0,
                        ip TEXT,
                        company TEXT,
                        location_id TEXT
                    )
                '''))
                # Criar índices
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS idx_{table[17:]}_ts ON {table}({ts_col})'))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS idx_{table[17:]}_player_ts ON {table}(player_id, {ts_col})'))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS idx_{table[17:]}_company_ts ON {table}(company, {ts_col})'))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS idx_{table[17:]}_location_ts ON {table}(location_id, {ts_col})'))
    except Exception as e:
        print(f"[Monitor] Falha ao garantir tabelas de samples: {e}")

def _ensure_schema_columns():
    """Garante colunas necessárias no schema"""
    try:
        engine = db.engine
        with engine.connect() as conn:
            # Tabelas e colunas a verificar
            table_columns = {
                'users': [
                    ('company', 'VARCHAR(100)', 'iTracker'),
                    ('status', 'VARCHAR(20)', 'active'),
                    ('must_change_password', 'BOOLEAN', '0')
                ],
                'locations': [('company', 'VARCHAR(100)', 'iTracker')],
                'location': [('company', 'VARCHAR(100)', 'iTracker')],  # fallback
                'players': [
                    # Colunas de telemetria de reprodução para KPIs em tempo real
                    ('current_content_id', 'VARCHAR(36)', None),
                    ('current_content_title', 'VARCHAR(255)', None),
                    ('current_content_type', 'VARCHAR(50)', None),
                    ('current_campaign_id', 'VARCHAR(36)', None),
                    ('current_campaign_name', 'VARCHAR(255)', None),
                    ('is_playing', 'BOOLEAN', '0'),
                    ('playback_start_time', 'DATETIME', None),
                    ('last_playback_heartbeat', 'DATETIME', None)
                ]
            }
            
            for table, columns in table_columns.items():
                try:
                    result = conn.execute(text(f"PRAGMA table_info({table})"))
                    rows = result.fetchall()
                    if rows:
                        existing_cols = [r[1] for r in rows]
                        for col_name, col_type, default_val in columns:
                            if col_name not in existing_cols:
                                print(f"[DB] Adicionando coluna '{col_name}' à tabela {table}...")
                                if default_val is None:
                                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
                                else:
                                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT '{default_val}'"))
                except Exception as te:
                    print(f"[DB] Erro ao processar tabela {table}: {te}")
            
            # Garantir access_code em players
            for table in ['players', 'player']:
                try:
                    result = conn.execute(text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"))
                    if result.fetchone():
                        info = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
                        colnames = [r[1] for r in info]
                        if 'access_code' not in colnames:
                            print(f"[DB] Adicionando coluna 'access_code' à tabela {table}...")
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN access_code VARCHAR(12)"))
                            try:
                                conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{table}_access_code ON {table} (access_code)"))
                            except Exception:
                                pass
                            # Backfill códigos
                            import random
                            ALPHABET = '23456789'
                            def gen_code(n=6):
                                return ''.join(random.choice(ALPHABET) for _ in range(n))
                            
                            ids = conn.execute(text(f"SELECT id FROM {table} WHERE access_code IS NULL OR access_code = ''")).fetchall()
                            for (pid,) in ids:
                                attempts = 0
                                while attempts < 20:
                                    code = gen_code(6)
                                    try:
                                        conn.execute(text(f"UPDATE {table} SET access_code = :code WHERE id = :pid"), {'code': code, 'pid': pid})
                                        break
                                    except Exception:
                                        attempts += 1
                        break  # só processar uma tabela de players
                except Exception:
                    continue
                    
    except Exception as e:
        print(f"[DB] Erro ao garantir schema: {e}")

# Jobs de persistência e agregação
def _flush_traffic_minute_job():
    """Persiste buckets TRAFFIC_MINUTE em network_samples_minute"""
    try:
        with TRAFFIC_LOCK:
            snapshot = {}
            for pid, buckets in TRAFFIC_MINUTE.items():
                snapshot[pid] = dict(buckets)
            TRAFFIC_MINUTE.clear()
        
        if not snapshot:
            return

        enabled = SystemConfig.get_value('monitor.enable_persist', True)
        if str(enabled).lower() not in ['1', 'true', 'yes']:
            return

        _ensure_network_tables()

        for pid, buckets in snapshot.items():
            try:
                player = db.session.get(Player, pid)
                company = getattr(player, 'company', None)
                location_id = getattr(player, 'location_id', None)
            except Exception:
                player = None
                company = None
                location_id = None

            for ts_minute, data in buckets.items():
                try:
                    db.session.execute(text('''
                        INSERT INTO network_samples_minute (
                            player_id, ts_minute, bytes, requests, video, image, audio, other, ip, company, location_id
                        ) VALUES (:player_id, :ts_minute, :bytes, :requests, :video, :image, :audio, :other, :ip, :company, :location_id)
                    '''), {
                        'player_id': str(pid),
                        'ts_minute': ts_minute,
                        'bytes': int(data.get('bytes', 0)),
                        'requests': int(data.get('requests', 0)),
                        'video': int(data.get('by_type', {}).get('video', 0)),
                        'image': int(data.get('by_type', {}).get('image', 0)),
                        'audio': int(data.get('by_type', {}).get('audio', 0)),
                        'other': int(data.get('by_type', {}).get('other', 0)),
                        'ip': getattr(player, 'ip_address', None) if player else None,
                        'company': company,
                        'location_id': str(location_id) if location_id else None
                    })
                except Exception as ie:
                    print(f"[Monitor] Falha ao inserir sample minuto para pid={pid}: {ie}")
        
        try:
            db.session.commit()
        except Exception as ce:
            print(f"[Monitor] Commit falhou nos samples minuto: {ce}")
            db.session.rollback()
    except Exception as e:
        print(f"[Monitor] Flush minuto falhou: {e}")

def _aggregate_minute_to_hour_job():
    """Agrega samples de minuto para hora"""
    try:
        _ensure_network_tables()
        now = datetime.now(timezone.utc)
        start = (now - timedelta(hours=6)).isoformat()
        
        sql = text('''
            SELECT player_id,
                   SUBSTR(ts_minute, 1, 13) AS hour_key,
                   SUM(bytes) AS bytes, SUM(requests) AS requests,
                   SUM(video) AS video, SUM(image) AS image,
                   SUM(audio) AS audio, SUM(other) AS other,
                   MAX(company) AS company, MAX(location_id) AS location_id, MAX(ip) AS ip
            FROM network_samples_minute
            WHERE ts_minute >= :start
            GROUP BY player_id, hour_key
        ''')
        rows = db.session.execute(sql, {'start': start}).fetchall()
        
        for r in rows:
            player_id, hour_key = r[0], r[1]
            ts_hour = f"{hour_key}:00:00+00:00"
            try:
                db.session.execute(text('DELETE FROM network_samples_hour WHERE player_id = :pid AND ts_hour = :th'),
                                 {'pid': str(player_id), 'th': ts_hour})
                db.session.execute(text('''
                    INSERT INTO network_samples_hour (
                        player_id, ts_hour, bytes, requests, video, image, audio, other, ip, company, location_id
                    ) VALUES (:player_id, :ts_hour, :bytes, :requests, :video, :image, :audio, :other, :ip, :company, :location_id)
                '''), {
                    'player_id': str(player_id), 'ts_hour': ts_hour,
                    'bytes': int(r[2] or 0), 'requests': int(r[3] or 0),
                    'video': int(r[4] or 0), 'image': int(r[5] or 0),
                    'audio': int(r[6] or 0), 'other': int(r[7] or 0),
                    'ip': r[10], 'company': r[8], 'location_id': r[9]
                })
            except Exception as ie:
                print(f"[Agg m2h] Falha ao inserir hour pid={player_id} {ts_hour}: {ie}")
        
        try:
            db.session.commit()
        except Exception as ce:
            print(f"[Agg m2h] Commit falhou: {ce}")
            db.session.rollback()
    except Exception as e:
        print(f"[Agg m2h] Erro: {e}")

def _aggregate_hour_to_day_job():
    """Agrega samples de hora para dia"""
    try:
        _ensure_network_tables()
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=3)).isoformat()
        
        sql = text('''
            SELECT player_id,
                   SUBSTR(ts_hour, 1, 10) AS day_key,
                   SUM(bytes) AS bytes, SUM(requests) AS requests,
                   SUM(video) AS video, SUM(image) AS image,
                   SUM(audio) AS audio, SUM(other) AS other,
                   MAX(company) AS company, MAX(location_id) AS location_id, MAX(ip) AS ip
            FROM network_samples_hour
            WHERE ts_hour >= :start
            GROUP BY player_id, day_key
        ''')
        rows = db.session.execute(sql, {'start': start}).fetchall()
        
        for r in rows:
            player_id, day_key = r[0], r[1]
            ts_day = f"{day_key}T00:00:00+00:00"
            try:
                db.session.execute(text('DELETE FROM network_samples_day WHERE player_id = :pid AND ts_day = :td'),
                                 {'pid': str(player_id), 'td': ts_day})
                db.session.execute(text('''
                    INSERT INTO network_samples_day (
                        player_id, ts_day, bytes, requests, video, image, audio, other, ip, company, location_id
                    ) VALUES (:player_id, :ts_day, :bytes, :requests, :video, :image, :audio, :other, :ip, :company, :location_id)
                '''), {
                    'player_id': str(player_id), 'ts_day': ts_day,
                    'bytes': int(r[2] or 0), 'requests': int(r[3] or 0),
                    'video': int(r[4] or 0), 'image': int(r[5] or 0),
                    'audio': int(r[6] or 0), 'other': int(r[7] or 0),
                    'ip': r[10], 'company': r[8], 'location_id': r[9]
                })
            except Exception as ie:
                print(f"[Agg h2d] Falha ao inserir day pid={player_id} {ts_day}: {ie}")
        
        try:
            db.session.commit()
        except Exception as ce:
            print(f"[Agg h2d] Commit falhou: {ce}")
            db.session.rollback()
    except Exception as e:
        print(f"[Agg h2d] Erro: {e}")

def _retention_cleanup_job():
    """Remove amostras antigas"""
    try:
        days = int(SystemConfig.get_value('monitor.sample_retention_days', 30) or 30)
        now = datetime.now(timezone.utc)
        cutoff = (now - timedelta(days=days)).isoformat()
        
        for table, col in [
            ('network_samples_minute', 'ts_minute'),
            ('network_samples_hour', 'ts_hour'),
            ('network_samples_day', 'ts_day'),
        ]:
            try:
                db.session.execute(text(f"DELETE FROM {table} WHERE {col} < :cutoff"), {'cutoff': cutoff})
            except Exception as de:
                print(f"[Retention] Falha ao limpar {table}: {de}")
        
        try:
            db.session.commit()
        except Exception as ce:
            print(f"[Retention] Commit falhou: {ce}")
            db.session.rollback()
    except Exception as e:
        print(f"[Retention] Erro: {e}")

# =========================
# Rotas de monitoramento avançado
# =========================

@app.route('/api/monitor/traffic/timeseries', methods=['GET'])
@jwt_required()
def monitor_traffic_timeseries():
    """Séries temporais de tráfego"""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role not in ['admin', 'manager', 'hr']:
            return jsonify({'error': 'Sem permissão'}), 403

        try:
            import dateutil.parser as _p
        except Exception:
            _p = None

        q_from = request.args.get('from')
        q_to = request.args.get('to')
        group_by = (request.args.get('group_by') or 'minute').lower()
        player_id = request.args.get('player_id')
        company = request.args.get('company')
        location_id = request.args.get('location_id')

        if group_by == 'hour':
            table, ts_col = 'network_samples_hour', 'ts_hour'
        elif group_by == 'day':
            table, ts_col = 'network_samples_day', 'ts_day'
        else:
            table, ts_col = 'network_samples_minute', 'ts_minute'

        def _iso(dt):
            if not dt:
                return None
            try:
                if _p:
                    return _p.isoparse(dt).isoformat()
            except Exception:
                pass
            try:
                d = dt.replace('Z', '')
                return datetime.fromisoformat(d).isoformat()
            except Exception:
                return dt

        params = {}
        clauses = []
        if q_from:
            clauses.append(f"{ts_col} >= :from"); params['from'] = _iso(q_from)
        if q_to:
            clauses.append(f"{ts_col} <= :to"); params['to'] = _iso(q_to)
        if player_id:
            clauses.append("player_id = :player_id"); params['player_id'] = str(player_id)
        if company:
            clauses.append("company = :company"); params['company'] = company
        if location_id:
            clauses.append("location_id = :location_id"); params['location_id'] = str(location_id)

        where_sql = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        sql = text(f"""
            SELECT {ts_col} AS ts,
                   SUM(bytes) AS bytes, SUM(requests) AS requests,
                   SUM(video) AS video, SUM(image) AS image,
                   SUM(audio) AS audio, SUM(other) AS other
            FROM {table}
            {where_sql}
            GROUP BY {ts_col}
            ORDER BY {ts_col} ASC
        """)
        rows = db.session.execute(sql, params).fetchall()
        series = [{
            'ts': r[0], 'bytes': int(r[1] or 0), 'requests': int(r[2] or 0),
            'video': int(r[3] or 0), 'image': int(r[4] or 0), 
            'audio': int(r[5] or 0), 'other': int(r[6] or 0)
        } for r in rows]
        
        return jsonify({'group_by': group_by, 'series': series}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/traffic/top', methods=['GET'])
@jwt_required()
def monitor_traffic_top():
    """Top players por tráfego com suporte a HR scoping"""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role not in ['admin', 'manager', 'hr']:
            return jsonify({'error': 'Sem permissão'}), 403

        period = (request.args.get('period') or '24h').lower()
        limit = int(request.args.get('limit', 10))
        player_id = request.args.get('player_id')
        company = request.args.get('company')
        location_id = request.args.get('location_id')

        # HR: restringe à própria empresa
        if user.role == 'hr' and getattr(user, 'company', None):
            company = user.company

        now = datetime.now(timezone.utc)
        if period.endswith('h'):
            delta = timedelta(hours=int(period[:-1] or 24))
        elif period.endswith('d'):
            delta = timedelta(days=int(period[:-1] or 1))
        else:
            delta = timedelta(hours=24)
        start = (now - delta).isoformat()

        clauses = ["ts_minute >= :start"]
        params = {'start': start, 'limit': limit}
        if player_id:
            clauses.append("player_id = :player_id"); params['player_id'] = str(player_id)
        if company:
            clauses.append("company = :company"); params['company'] = company
        if location_id:
            clauses.append("location_id = :location_id"); params['location_id'] = str(location_id)

        where_sql = " WHERE " + " AND ".join(clauses)
        sql = text(f'''
            SELECT player_id, SUM(bytes) AS bytes, SUM(requests) AS requests
            FROM network_samples_minute
            {where_sql}
            GROUP BY player_id
            ORDER BY bytes DESC
            LIMIT :limit
        ''')
        rows = db.session.execute(sql, params).fetchall()
        items = [{'player_id': r[0], 'bytes': int(r[1] or 0), 'requests': int(r[2] or 0)} for r in rows]
        
        return jsonify({
            'start': start, 'now': now.isoformat(), 'top': items
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =========================
# WebSocket events adicionais
# =========================

@socketio.on('join_admin_room')
def handle_join_admin_room():
    """Permite que administradores se juntem à sala para notificações"""
    try:
        token = request.args.get('token')
        if token:
            try:
                from flask_jwt_extended import decode_token
                decoded = decode_token(token)
                user_id = decoded['sub']
                u = db.session.get(User, user_id)
                role = getattr(u, 'role', None)
                
                if u and role == 'admin':
                    join_room('admin')
                    emit('joined_admin_room', {'message': 'Conectado à sala de administração'})
                else:
                    emit('error', {'message': 'Sem permissão para sala de administração'})
            except:
                emit('error', {'message': 'Token inválido'})
        else:
            emit('error', {'message': 'Token não fornecido'})
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('leave_admin_room')
def handle_leave_admin_room():
    """Permite que usuários saiam da sala de administração"""
    leave_room('admin')
    emit('left_admin_room', {'message': 'Desconectado da sala de administração'})

# =========================
# Error Handlers Globais
# =========================

@app.errorhandler(404)
def not_found_error(error):
    """Handler para erro 404"""
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Endpoint não encontrado'}), 404
    # Para rotas não-API, tentar servir React SPA
    if _has_react_build():
        return _serve_react_file('index.html')
    return _kiosk_landing_html()

@app.errorhandler(500)
def internal_error(error):
    """Handler para erro 500"""
    db.session.rollback()
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Erro interno do servidor'}), 500
    return jsonify({'error': 'Erro interno do servidor'}), 500

@app.errorhandler(413)
def too_large(error):
    """Handler para arquivo muito grande"""
    return jsonify({'error': 'Arquivo muito grande'}), 413

# Bootstrap único de schema
_schema_bootstrap_done = False

@app.before_request  
def _bootstrap_schema_once():
    """Executa bootstrap de schema apenas uma vez"""
    global _schema_bootstrap_done
    if not _schema_bootstrap_done:
        try:
            _ensure_schema_columns()
            _ensure_network_tables()
        except Exception as e:
            print(f"[DB] Erro no bootstrap de schema: {e}")
        _schema_bootstrap_done = True

# =========================
# Sistema de Shutdown Graceful  
# =========================

def cleanup_resources():
    """Limpa recursos da aplicação"""
    try:
        print("[Shutdown] Limpando recursos...")
        # Limpar conexões WebSocket
        CONNECTED_PLAYERS.clear()
        SOCKET_SID_TO_PLAYER.clear()
        SOCKET_SID_TO_USER.clear()
        
        # Limpar cache de tráfego se necessário
        if len(TRAFFIC_MINUTE) > 1000:  # Evitar usar muita memória
            with TRAFFIC_LOCK:
                TRAFFIC_MINUTE.clear()
                
        print("[Shutdown] Recursos limpos")
    except Exception as e:
        print(f"[Shutdown] Erro na limpeza: {e}")

def _safe_scheduler_shutdown():
    """Para o scheduler de forma segura"""
    try:
        if scheduler.running:
            print("[Scheduler] Parando scheduler...")
            scheduler.shutdown(wait=False)
            print("[Scheduler] Scheduler parado")
    except Exception as e:
        print(f"[Scheduler] Erro ao parar: {e}")

# Registrar cleanup no shutdown
atexit.register(cleanup_resources)
atexit.register(_safe_scheduler_shutdown)

# =========================
# Inicialização Principal
# =========================

def create_tables():
    """Cria tabelas e usuário admin padrão"""
    with app.app_context():
        try:
            db.create_all()
            _ensure_schema_columns()
            
            # Executar migração para adicionar colunas device_type
            try:
                from migrations.add_device_type_columns import run_migration
                migration_result = run_migration()
                if migration_result:
                    print("[Init] Migração add_device_type_columns executada com sucesso")
                else:
                    print("[Init] Migração add_device_type_columns não foi necessária ou falhou")
            except Exception as migration_error:
                print(f"[Init] Erro ao executar migração add_device_type_columns: {migration_error}")
            
            # Criar usuário admin padrão se não existir
            admin = User.query.filter_by(email='admin@tvs.com').first()
            if not admin:
                print("[Init] Criando usuário admin padrão...")
                admin = User(
                    username='admin',
                    email='admin@tvs.com',
                    password_hash=generate_password_hash('admin123'),
                    role='admin',
                    company='iTracker'
                )
                db.session.add(admin)
                db.session.commit()
                print("[Init] Usuário admin criado: admin@tvs.com / admin123")
        except Exception as e:
            print(f"[Init] Erro ao criar tabelas: {e}")
            db.session.rollback()

def setup_scheduler_jobs():
    """Configura todos os jobs do scheduler dentro do contexto da aplicação"""
    # Garantir que estamos dentro do contexto da aplicação
    with app.app_context():
        try:
            print("[Scheduler] Configurando jobs...")
            
            # Job: Verificação de agendamentos (cada minuto)
            if not scheduler.get_job('schedule_checker'):
                scheduler.add_job(
                    func=check_schedules_with_context,
                    trigger="interval",
                    minutes=1,
                    id='schedule_checker',
                    name='Verificar e executar agendamentos',
                    replace_existing=True
                )
            
            # Job: Emissão de estatísticas de tráfego (configurável, com fallback)
            try:
                emit_interval = int(SystemConfig.get_value('monitor.emit_interval_sec', 30) or 30)
            except Exception:
                emit_interval = 30  # fallback se SystemConfig não estiver disponível
                
            if not scheduler.get_job('traffic_stats_emitter'):
                scheduler.add_job(
                    func=emit_traffic_stats_job,
                    trigger="interval",
                    seconds=emit_interval,
                    id='traffic_stats_emitter',
                    name='Emitir estatísticas de tráfego para admins',
                    replace_existing=True
                )
            
            # Job: Sincronização de players (cada minuto)  
            if not scheduler.get_job('player_status_sync'):
                scheduler.add_job(
                    func=sync_player_statuses_job,
                    trigger="interval",
                    minutes=1,
                    id='player_status_sync',
                    name='Sincronizar status dos players',
                    replace_existing=True
                )
            
            # Job: Persistir buckets de tráfego (cada 60 segundos)
            if not scheduler.get_job('traffic_minute_flush'):
                scheduler.add_job(
                    func=_flush_traffic_minute_job,
                    trigger='interval',
                    seconds=60,
                    id='traffic_minute_flush',
                    name='Persistir buckets de tráfego por minuto',
                    replace_existing=True
                )
            
            # Job: Agregação minute->hour (cada 5 minutos)
            if not scheduler.get_job('agg_minute_hour'):
                scheduler.add_job(
                    func=_aggregate_minute_to_hour_job,
                    trigger='interval',
                    minutes=5,
                    id='agg_minute_hour',
                    name='Agregação minute->hour (lookback 6h)',
                    replace_existing=True
                )
            
            # Job: Agregação hour->day (cada hora)
            if not scheduler.get_job('agg_hour_day'):
                scheduler.add_job(
                    func=_aggregate_hour_to_day_job,
                    trigger='interval',
                    hours=1,
                    id='agg_hour_day',
                    name='Agregação hour->day (lookback 3d)',
                    replace_existing=True
                )
            
            # Job: Limpeza por retenção (diário às 03:15)
            if not scheduler.get_job('retention_cleanup'):
                scheduler.add_job(
                    func=_retention_cleanup_job,
                    trigger='cron',
                    hour=3,
                    minute=15,
                    id='retention_cleanup',
                    name='Limpeza por retenção (samples antigas)',
                    replace_existing=True
                )
            
            # Job: Emissão de métricas do sistema
            if not scheduler.get_job('system_stats_emitter'):
                scheduler.add_job(
                    func=emit_system_stats_job,
                    trigger='interval',
                    seconds=int(SystemConfig.get_value('monitor.emit_interval_sec', 30) or 30),
                    id='system_stats_emitter',
                    name='Emitir métricas do sistema para admins',
                    replace_existing=True
                )
            
            print(f"[Scheduler] {len(scheduler.get_jobs())} jobs configurados")
            
        except Exception as e:
            print(f"[Scheduler] Erro ao configurar jobs: {e}")

def start_application():
    """Inicia a aplicação completa"""
    print("="*60)
    print(" TVS Platform - Sistema de Gestão de TVs Corporativas")
    print("="*60)
    
    # Detectar modo TV
    tv_mode = os.getenv('TV_MODE', 'false').lower() == 'true'
    port = 80 if tv_mode else 5000
    host = '0.0.0.0'
    
    print(f"[Configuração]")
    print(f"├─ Modo TV: {'Ativado' if tv_mode else 'Desativado'}")
    print(f"├─ Host: {host}")
    print(f"├─ Porta: {port}")
    print(f"├─ Debug: {'Ativado' if app.debug else 'Desativado'}")
    print(f"├─ Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"├─ Uploads: {app.config['UPLOAD_FOLDER']}")
    print(f"├─ Strict Slashes: {'Desativado'}")
    
    if tv_mode:
        # Detectar IP local dinamicamente para exibir URLs corretas
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            local_ip = "127.0.0.1"
        print("\n[ATENÇÃO] Executando na porta 80 - requer privilégios de administrador")
        print("URLs importantes para TVs:")
        print(f"├─ Landing: http://{local_ip}/")
        print(f"├─ Short link: http://{local_ip}/k/CODIGO")
        print(f"├─ Admin: http://{local_ip}/app/")
        print(f"└─ API: http://{local_ip}/api/...")
    else:
        print("\n[URLs de Desenvolvimento]")
        print("├─ Landing: http://localhost:5000/")
        print("├─ Admin: http://localhost:5000/app/")  
        print("├─ TV Mode: http://localhost:5000/tv/")
        print("└─ API: http://localhost:5000/api/...")
    
    # Inicializar database
    create_tables()
    
    # Inicializar scheduler
    try:
        if not scheduler.running:
            scheduler.start()
            print("[Scheduler] Iniciado com sucesso")
        setup_scheduler_jobs()
    except Exception as e:
        print(f"[Scheduler] Erro ao iniciar: {e}")
    
    print("\n[Status] Aplicação configurada e pronta para iniciar")
    print("="*60)
    
    # Iniciar servidor
    try:
        socketio.run(
            app, 
            debug=True, 
            host=host, 
            port=port, 
            allow_unsafe_werkzeug=True,
            use_reloader=False  # Evita problemas com scheduler no reload
        )
    except PermissionError:
        print(f"\n[ERRO] Porta {port} requer privilégios de administrador")
        if port == 80:
            print("Tentando porta padrão 5000...")
            socketio.run(
                app, 
                debug=True, 
                host=host, 
                port=5000, 
                allow_unsafe_werkzeug=True,
                use_reloader=False
            )
    except OSError as e:
        print(f"\n[ERRO] Não foi possível iniciar na porta {port}: {e}")
        if port == 80:
            print("Tentando porta padrão 5000...")
            try:
                socketio.run(
                    app, 
                    debug=True, 
                    host=host, 
                    port=5000, 
                    allow_unsafe_werkzeug=True,
                    use_reloader=False
                )
            except Exception as fallback_e:
                print(f"[ERRO CRÍTICO] Falha total na inicialização: {fallback_e}")
    except KeyboardInterrupt:
        print("\n[Shutdown] Interrompido pelo usuário")
    except Exception as e:
        print(f"\n[ERRO CRÍTICO] Falha na inicialização: {e}")
    finally:
        cleanup_resources()

# NOTE: main entry moved to end of file to ensure all routes are registered before server starts.
# if __name__ == '__main__':
#     start_application()

def _percentile(p: float, values: list[float]) -> float:
    if not values:
        return 0.0
    arr = sorted(values)
    k = (len(arr) - 1) * p
    f = int(math.floor(k))
    c = int(math.ceil(k))
    if f == c:
        return float(arr[f])
    return float(arr[f] + (arr[c] - arr[f]) * (k - f))

def _collect_system_stats():
    """Coleta snapshot de CPU, memória, disco, rede e métricas de uploads."""
    try:
        # CPU/mem/disk
        cpu = psutil.cpu_percent(interval=None)
        vm = psutil.virtual_memory()
        du = psutil.disk_usage(os.path.abspath(os.sep))
        
        # Net cumulativo e taxa
        nio = psutil.net_io_counters()
        now = datetime.now(timezone.utc)
        sent_rate = recv_rate = None
        if SYSTEM_NET_LAST['ts'] is not None:
            dt = (now - SYSTEM_NET_LAST['ts']).total_seconds() or 1.0
            sent_rate = max(0.0, (nio.bytes_sent - SYSTEM_NET_LAST['bytes_sent']) / dt)
            recv_rate = max(0.0, (nio.bytes_recv - SYSTEM_NET_LAST['bytes_recv']) / dt)
        SYSTEM_NET_LAST['ts'] = now
        SYSTEM_NET_LAST['bytes_sent'] = nio.bytes_sent
        SYSTEM_NET_LAST['bytes_recv'] = nio.bytes_recv
        
        # Uploads metrics
        lats = list(UPLOAD_METRICS['latencies_ms'])
        latency_avg = float(sum(lats) / len(lats)) if lats else 0.0
        latency_p95 = _percentile(0.95, lats) if lats else 0.0
        
        return {
            'cpu_percent': cpu,
            'memory': {
                'total': vm.total,
                'available': vm.available,
                'percent': vm.percent,
                'used': vm.used,
                'free': vm.free,
            },
            'disk': {
                'total': du.total,
                'used': du.used,
                'free': du.free,
                'percent': du.percent,
            },
            'net': {
                'bytes_sent': nio.bytes_sent,
                'bytes_recv': nio.bytes_recv,
                'send_rate_bps': sent_rate,
                'recv_rate_bps': recv_rate,
            },
            'uploads': {
                'status_counts': UPLOAD_METRICS['status_counts'],
                'latency_avg_ms': latency_avg,
                'latency_p95_ms': latency_p95,
                'window_size': len(lats)
            },
            'ts': now.isoformat()
        }
    except Exception as e:
        return {'error': str(e)}

@app.route('/api/system', methods=['GET'])
@app.route('/api/monitor/system', methods=['GET'])
@jwt_required()
def api_monitor_system():
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão'}), 403
        return jsonify(_collect_system_stats()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def emit_system_stats_job():
    try:
        enabled = SystemConfig.get_value('monitor.enable_system_stats', True)
        if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True:
            socketio.emit('system_stats', _collect_system_stats(), room='admin')
    except Exception as e:
        print(f"[System] Falha ao emitir métricas: {e}")

@app.route('/api/monitor/traffic/accumulated', methods=['GET'])
@jwt_required()
def monitor_traffic_accumulated():
    """Acumulado por player no período, persistido no banco (sobrevive a restart)."""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role not in ['admin', 'manager', 'hr']:
            return jsonify({'error': 'Sem permissão'}), 403

        period = (request.args.get('period') or '24h').lower()
        player_id = request.args.get('player_id')
        company = request.args.get('company')
        location_id = request.args.get('location_id')

        now = datetime.now(timezone.utc)
        if period == '1h':
            start = (now - timedelta(hours=1)).isoformat()
        elif period == '7d':
            start = (now - timedelta(days=7)).isoformat()
        else:
            start = (now - timedelta(days=1)).isoformat()

        where_sql = 'WHERE ts_minute >= :start'
        params = {'start': start}

        # HR: restringe à própria empresa
        if user.role == 'hr' and getattr(user, 'company', None):
            company = user.company

        if player_id:
            where_sql += ' AND player_id = :pid'
            params['pid'] = str(player_id)
        if company:
            where_sql += ' AND company = :company'
            params['company'] = company
        if location_id:
            where_sql += ' AND location_id = :loc'
            params['loc'] = str(location_id)

        sql = text(f'''
            SELECT player_id,
                   MAX(ts_minute) AS last_seen,
                   SUM(bytes) AS bytes,
                   SUM(requests) AS requests,
                   SUM(video) AS video,
                   SUM(image) AS image,
                   SUM(audio) AS audio,
                   SUM(other) AS other
            FROM network_samples_minute
            {where_sql}
            GROUP BY player_id
            ORDER BY bytes DESC
        ''')
        rows = db.session.execute(sql, params).fetchall()
        items = [{
            'player_id': r[0],
            'last_seen': r[1],
            'bytes': int(r[2] or 0),
            'requests': int(r[3] or 0),
            'video': int(r[4] or 0),
            'image': int(r[5] or 0),
            'audio': int(r[6] or 0),
            'other': int(r[7] or 0),
        } for r in rows]
        return jsonify({'start': start, 'now': now.isoformat(), 'items': items}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/traffic/flush-now', methods=['POST'])
@jwt_required()
def monitor_traffic_flush_now():
    """Força a persistência dos buckets de minuto agora (admin/manager)."""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão'}), 403
        _flush_traffic_minute_job()
        return jsonify({'ok': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    start_application()