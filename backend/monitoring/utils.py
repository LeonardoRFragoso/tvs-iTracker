import os
import math
from datetime import datetime, timezone
import psutil
from flask import request, g

from .state import UPLOAD_METRICS, SYSTEM_NET_LAST


def categorize_content_type(path: str, mimetype: str) -> str:
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


def percentile(p: float, values: list[float]) -> float:
    if not values:
        return 0.0
    arr = sorted(values)
    k = (len(arr) - 1) * p
    f = int(math.floor(k))
    c = int(math.ceil(k))
    if f == c:
        return float(arr[f])
    return float(arr[f] + (arr[c] - arr[f]) * (k - f))


def collect_system_stats():
    try:
        cpu = psutil.cpu_percent(interval=None)
        vm = psutil.virtual_memory()
        du = psutil.disk_usage(os.path.abspath(os.sep))

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

        lats = list(UPLOAD_METRICS['latencies_ms'])
        latency_avg = float(sum(lats) / len(lats)) if lats else 0.0
        latency_p95 = percentile(0.95, lats) if lats else 0.0

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
