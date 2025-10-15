from threading import Lock
from collections import deque
from models.schedule import fmt_br_datetime
from datetime import datetime

# Memória de tráfego acumulada (não persiste em restart)
TRAFFIC_STATS = {
    'since': fmt_br_datetime(datetime.now()),
    'total_bytes': 0,
    'players': {}
}

# Buckets por minuto, por player
TRAFFIC_MINUTE = {}
TRAFFIC_LOCK = Lock()

# Métricas de uploads (latência e contadores HTTP)
UPLOAD_METRICS = {
    'status_counts': {'200': 0, '206': 0, '304': 0, '4xx': 0, '5xx': 0},
    'latencies_ms': deque(maxlen=2000)
}

# Snapshot anterior de rede para cálculo de taxa (bytes/s)
SYSTEM_NET_LAST = {'ts': None, 'bytes_sent': 0, 'bytes_recv': 0}
