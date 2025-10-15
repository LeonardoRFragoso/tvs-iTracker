from datetime import datetime, timezone
from flask import request
from flask_socketio import emit, join_room, leave_room

from database import db
from models.schedule import fmt_br_datetime
from models.player import Player
from models.content import Content
from models.content_distribution import ContentDistribution

from services.distribution_manager import ContentDistributionManager

from .state import CONNECTED_PLAYERS, SOCKET_SID_TO_PLAYER, SOCKET_SID_TO_USER, PLAYER_PLAYBACK_STATUS
from .utils import _authenticate_websocket_user
from monitoring.utils import collect_system_stats


def register_socketio_handlers(socketio, app):
    @socketio.on('connect', namespace='/')
    def handle_connect(auth=None):  # noqa: F401
        try:
            info = _authenticate_websocket_user(auth)
            SOCKET_SID_TO_USER[request.sid] = info
        except Exception:
            SOCKET_SID_TO_USER[request.sid] = {}

    @socketio.on('disconnect')
    def handle_disconnect():  # noqa: F401
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
    def handle_join_player(data):  # noqa: F401
        player_id = data.get('player_id')
        if player_id:
            join_room(f'player_{player_id}')
            emit('joined_player', {'player_id': player_id})
            try:
                CONNECTED_PLAYERS[player_id] = {
                    'sid': request.sid,
                    'last_seen': fmt_br_datetime(datetime.now())
                }
                SOCKET_SID_TO_PLAYER[request.sid] = player_id
            except Exception:
                pass

    @socketio.on('join_admin')
    def handle_join_admin():  # noqa: F401
        try:
            info = SOCKET_SID_TO_USER.get(request.sid)
            role = info.get('role') if info else None
            if role == 'admin':
                join_room('admin')
                emit('joined_admin', {'ok': True})
                try:
                    from models.system_config import SystemConfig
                    enabled = SystemConfig.get_value('monitor.enable_system_stats', True)
                    if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True:
                        socketio.emit('system_stats', collect_system_stats(), room=request.sid)
                except Exception:
                    pass
            else:
                emit('joined_admin', {'ok': False, 'error': 'not_authorized'})
        except Exception as e:
            emit('joined_admin', {'ok': False, 'error': str(e)})

    @socketio.on('player_sync_request')
    def handle_player_sync_request(data):  # noqa: F401
        try:
            player_id = data.get('player_id')
            if not player_id:
                emit('error', {'message': 'player_id é obrigatório'})
                return

            manager = ContentDistributionManager()
            content_list = manager.get_player_content_list(player_id)

            emit('sync_response', {
                'player_id': player_id,
                'content_list': content_list,
                'timestamp': fmt_br_datetime(datetime.now())
            })
        except Exception as e:
            emit('error', {'message': str(e)})

    @socketio.on('distribution_status_update')
    def handle_distribution_status_update(data):  # noqa: F401
        try:
            distribution_id = data.get('distribution_id')
            status = data.get('status')
            progress = data.get('progress', 0)
            error_message = data.get('error_message')

            if not distribution_id or not status:
                emit('error', {'message': 'distribution_id e status são obrigatórios'})
                return

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
    def handle_player_heartbeat(data):  # noqa: F401
        try:
            player_id = data.get('player_id')
            storage_info = data.get('storage_info', {})
            network_info = data.get('network_info', {})

            if not player_id:
                emit('error', {'message': 'player_id é obrigatório'})
                return

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
                'timestamp': fmt_br_datetime(datetime.now())
            })
        except Exception as e:
            db.session.rollback()
            emit('error', {'message': str(e)})

    @socketio.on('request_content_download')
    def handle_content_download_request(data):  # noqa: F401
        try:
            player_id = data.get('player_id')
            content_id = data.get('content_id')

            if not player_id or not content_id:
                emit('error', {'message': 'player_id e content_id são obrigatórios'})
                return

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
    def handle_playback_event(data):  # noqa: F401
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

            current_time = datetime.now(timezone.utc)

            if event_type == 'playback_start':
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

            socketio.emit('playback_status_update', {
                'player_id': player_id,
                'event_type': event_type,
                'status': PLAYER_PLAYBACK_STATUS.get(player_id, {}),
                'timestamp': current_time.isoformat()
            }, room='admin')
        except Exception as e:
            print(f"[Playback] Erro ao processar evento: {e}")
            emit('error', {'message': str(e)})

    @socketio.on('player_command')
    def handle_player_command(data):  # noqa: F401
        try:
            print(f"[PlayerCommand] Comando recebido: {data}")
            player_id = data.get('player_id')
            command = data.get('command')
            command_data = data.get('data', {})

            if not player_id or not command:
                print(f"[PlayerCommand] Erro: player_id ou command ausente")
                emit('error', {'message': 'player_id e command são obrigatórios'})
                return

            print(f"[PlayerCommand] Processando comando '{command}' para player {player_id}")
            player = Player.query.get(player_id)
            if not player:
                print(f"[PlayerCommand] Erro: Player {player_id} não encontrado")
                emit('error', {'message': f'Player {player_id} não encontrado'})
                return

            if command == 'stop':
                print(f"[PlayerCommand] Processando comando STOP para player {player_id}")
                if player.chromecast_id:
                    print(f"[PlayerCommand] Usando Chromecast service para enviar comando stop")
                    from services.chromecast_service import chromecast_service
                    if player.chromecast_id not in chromecast_service.active_connections:
                        print(f"[PlayerCommand] Dispositivo não conectado, tentando conectar...")
                        success_connect, actual_id = chromecast_service.connect_to_device(player.chromecast_id, player.chromecast_name)
                        if not success_connect:
                            print(f"[PlayerCommand] Falha ao conectar ao dispositivo {player.chromecast_id}")
                            emit('error', {'message': 'Falha ao conectar ao Chromecast'})
                            return
                    success = chromecast_service.send_command(player.chromecast_id, 'stop')
                    print(f"[PlayerCommand] Resultado do comando stop: {success}")
                    if success:
                        player.is_playing = False
                        player.current_content_id = None
                        player.current_content_title = None
                        player.current_content_type = None
                        player.current_campaign_id = None
                        player.current_campaign_name = None
                        player.playback_start_time = None
                        db.session.commit()
                        emit('player_command_response', {
                            'player_id': player_id,
                            'command': command,
                            'success': True,
                            'message': 'Reprodução parada com sucesso'
                        })
                        socketio.emit('playback_status_update', {
                            'player_id': player_id,
                            'event_type': 'playback_stop',
                            'status': {'is_playing': False},
                            'timestamp': datetime.now(timezone.utc).isoformat()
                        }, room='admin')
                    else:
                        emit('error', {'message': 'Falha ao parar reprodução no Chromecast'})
                else:
                    player.is_playing = False
                    player.current_content_id = None
                    player.current_content_title = None
                    player.current_content_type = None
                    player.current_campaign_id = None
                    player.current_campaign_name = None
                    player.playback_start_time = None
                    player.status = 'online'
                    db.session.commit()
                    socketio.emit('remote_command', {
                        'command': command,
                        'data': command_data,
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }, room=f'player_{player_id}')
                    emit('player_command_response', {
                        'player_id': player_id,
                        'command': command,
                        'success': True,
                        'message': 'Reprodução parada com sucesso'
                    })
                    socketio.emit('playback_status_update', {
                        'player_id': player_id,
                        'event_type': 'playback_stop',
                        'status': {'is_playing': False},
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }, room='admin')
                    socketio.emit('player_status_update', {
                        'player_id': player_id,
                        'status': 'online',
                        'is_playing': False,
                        'current_content': None,
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }, room='admin')
            elif command in ['start', 'pause', 'restart']:
                if player.chromecast_id and command in ['pause']:
                    from services.chromecast_service import chromecast_service
                    success = chromecast_service.send_command(player.chromecast_id, command)
                    if success:
                        emit('player_command_response', {
                            'player_id': player_id,
                            'command': command,
                            'success': True,
                            'message': f'Comando {command} executado com sucesso'
                        })
                    else:
                        emit('error', {'message': f'Falha ao executar comando {command} no Chromecast'})
                else:
                    socketio.emit('remote_command', {
                        'command': command,
                        'data': command_data,
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }, room=f'player_{player_id}')
                    emit('player_command_response', {
                        'player_id': player_id,
                        'command': command,
                        'success': True,
                        'message': f'Comando {command} enviado para o player'
                    })
            else:
                emit('error', {'message': f'Comando não suportado: {command}'})
        except Exception as e:
            import traceback
            traceback.print_exc()
            emit('error', {'message': str(e)})

    @socketio.on('join_admin_room')
    def handle_join_admin_room():  # noqa: F401
        try:
            token = request.args.get('token')
            if token:
                try:
                    from flask_jwt_extended import decode_token
                    decoded = decode_token(token)
                    user_id = decoded['sub']
                    from models.user import User
                    u = db.session.get(User, user_id)
                    role = getattr(u, 'role', None)
                    if u and role == 'admin':
                        join_room('admin')
                        emit('joined_admin_room', {'message': 'Conectado à sala de administração'})
                    else:
                        emit('error', {'message': 'Sem permissão para sala de administração'})
                except Exception:
                    emit('error', {'message': 'Token inválido'})
            else:
                emit('error', {'message': 'Token não fornecido'})
        except Exception as e:
            emit('error', {'message': str(e)})

    @socketio.on('leave_admin_room')
    def handle_leave_admin_room():  # noqa: F401
        leave_room('admin')
        emit('left_admin_room', {'message': 'Desconectado da sala de administração'})
