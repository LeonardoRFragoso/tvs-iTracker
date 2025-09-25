from flask_socketio import SocketIO, emit

playback_monitor_bp = Blueprint('playback_monitor', __name__)

# Mapa global para rastrear status de reprodução em tempo real
PLAYER_PLAYBACK_STATUS = {}

def handle_playback_telemetry(data):
    """Processar eventos de telemetria de reprodução via Socket.IO"""
    try:
        player_id = data.get('player_id')
        event_type = data.get('event_type')
        
        if not player_id or not event_type:
            return
        
        print(f"[PlaybackMonitor] {event_type} para player {player_id}")
        
        if event_type == 'playback_start':
            # Iniciar nova sessão de reprodução
            PLAYER_PLAYBACK_STATUS[player_id] = {
                'status': 'playing',
                'session_id': data.get('session_id'),
                'content_id': data.get('content_id'),
                'content_title': data.get('content_title'),
                'content_type': data.get('content_type'),
                'campaign_id': data.get('campaign_id'),
                'campaign_name': data.get('campaign_name'),
                'start_time': datetime.utcnow(),
                'uptime_seconds': 0,
                'last_update': datetime.utcnow()
            }
            
        elif event_type == 'playback_end':
            # Finalizar sessão de reprodução
            if player_id in PLAYER_PLAYBACK_STATUS:
                PLAYER_PLAYBACK_STATUS[player_id]['status'] = 'idle'
                PLAYER_PLAYBACK_STATUS[player_id]['last_update'] = datetime.utcnow()
            
        elif event_type == 'heartbeat':
            # Atualizar heartbeat de reprodução
            if player_id in PLAYER_PLAYBACK_STATUS:
                PLAYER_PLAYBACK_STATUS[player_id]['uptime_seconds'] = data.get('uptime_seconds', 0)
                PLAYER_PLAYBACK_STATUS[player_id]['last_update'] = datetime.utcnow()
            
        elif event_type == 'content_change':
            # Mudança de conteúdo
            if player_id in PLAYER_PLAYBACK_STATUS:
                PLAYER_PLAYBACK_STATUS[player_id].update({
                    'content_id': data.get('next_content_id'),
                    'campaign_id': data.get('campaign_id'),
                    'campaign_name': data.get('campaign_name'),
                    'last_update': datetime.utcnow()
                })
            
        elif event_type == 'error':
            # Erro de reprodução
            if player_id in PLAYER_PLAYBACK_STATUS:
                PLAYER_PLAYBACK_STATUS[player_id]['status'] = 'error'
                PLAYER_PLAYBACK_STATUS[player_id]['last_update'] = datetime.utcnow()
        
        elif event_type == 'playback_paused':
            # Reprodução pausada
            if player_id in PLAYER_PLAYBACK_STATUS:
                PLAYER_PLAYBACK_STATUS[player_id]['status'] = 'paused'
                PLAYER_PLAYBACK_STATUS[player_id]['last_update'] = datetime.utcnow()
                
    except Exception as e:
        print(f"[PlaybackMonitor] Erro ao processar telemetria: {e}")

@socketio.on('playback_telemetry')
def handle_playback_telemetry_socketio(data):
    """Processar eventos de telemetria de reprodução via Socket.IO"""
    handle_playback_telemetry(data)
    emit('playback_telemetry', data, broadcast=True)
