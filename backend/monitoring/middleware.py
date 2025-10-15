from flask import request, g
from time import perf_counter
from datetime import datetime

from models.schedule import fmt_br_datetime
from .state import TRAFFIC_STATS, TRAFFIC_MINUTE, TRAFFIC_LOCK, UPLOAD_METRICS
from .utils import categorize_content_type
from models.system_config import SystemConfig


def register_monitoring_middleware(app):
    @app.before_request
    def _measure_upload_latency_start():  # noqa: F401
        try:
            if request.path.startswith('/uploads/'):
                g._upload_start = perf_counter()
        except Exception:
            pass

    @app.after_request
    def _track_upload_traffic(response):  # noqa: F401
        try:
            if request.path.startswith('/uploads/'):
                pid = request.args.get('pid') or 'unknown'
                content_length = response.headers.get('Content-Length')
                try:
                    bytes_sent = int(content_length) if content_length and str(content_length).isdigit() else 0
                except Exception:
                    bytes_sent = 0
                category = categorize_content_type(request.path, getattr(response, 'mimetype', '') or '')
                ts = fmt_br_datetime(datetime.now())

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

                    minute_key = fmt_br_datetime(datetime.now().replace(second=0, microsecond=0))
                    pminute = TRAFFIC_MINUTE.setdefault(pid, {})
                    bucket = pminute.setdefault(minute_key, {
                        'bytes': 0, 'requests': 0,
                        'by_type': {'video': 0, 'image': 0, 'audio': 0, 'other': 0}
                    })
                    bucket['bytes'] += bytes_sent
                    bucket['requests'] += 1
                    bucket['by_type'][category] = bucket['by_type'].get(category, 0) + bytes_sent

                try:
                    status = getattr(response, 'status_code', 200)
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
                    if sc_key:
                        with TRAFFIC_LOCK:
                            p = TRAFFIC_STATS['players'].setdefault(pid, {})
                            pc = p.setdefault('status_counts', {'200': 0, '206': 0, '304': 0, '4xx': 0, '5xx': 0})
                            pc[sc_key] = pc.get(sc_key, 0) + 1
                except Exception:
                    pass

                try:
                    if hasattr(g, '_upload_start'):
                        latency_ms = (perf_counter() - g._upload_start) * 1000.0
                        UPLOAD_METRICS['latencies_ms'].append(latency_ms)
                except Exception:
                    pass

                try:
                    if SystemConfig.get_value('general.debug_mode', False):
                        print(f"[Traffic] /uploads hit pid={pid} bytes={bytes_sent} status={status}")
                except Exception:
                    pass
        except Exception as e:
            print(f"[Traffic] Falha ao registrar tráfego: {e}")
        return response
