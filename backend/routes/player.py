from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit
from datetime import datetime, timedelta
import secrets
import json
from models.player import Player, db
from models.user import User
from models.location import Location
from models.schedule import Schedule
from services.auto_sync_service import auto_sync_service

player_bp = Blueprint('player', __name__)

# Helper: generate unique, friendly access code for kiosk URLs
def _generate_access_code(length: int = 6) -> str:
    # Somente dígitos não ambíguos para facilitar digitação no controle remoto
    alphabet = '23456789'
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def _generate_unique_access_code(max_attempts: int = 10) -> str:
    for _ in range(max_attempts):
        code = _generate_access_code(6)
        if not Player.query.filter_by(access_code=code).first():
            return code
    # fallback com 8 chars caso esteja muito colidido
    for _ in range(max_attempts):
        code = _generate_access_code(8)
        if not Player.query.filter_by(access_code=code).first():
            return code
    # em último caso, usa parte do UUID do player (será substituído na primeira atualização)
    return _generate_access_code(8)

@player_bp.route('/', methods=['GET'])
@jwt_required()
def list_players():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_online = request.args.get('is_online')
        is_active = request.args.get('is_active')
        region = request.args.get('region')
        search = request.args.get('search')
        
        # Company scoping for HR users
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        query = Player.query
        
        if current_user and current_user.role == 'hr':
            query = query.join(Location, Player.location_id == Location.id).filter(Location.company == current_user.company)
        
        if is_online is not None:
            threshold = datetime.utcnow() - timedelta(minutes=5)
            if is_online.lower() == 'true':
                query = query.filter(Player.last_ping != None, Player.last_ping >= threshold)
            else:
                query = query.filter((Player.last_ping == None) | (Player.last_ping < threshold))
        
        if is_active is not None:
            query = query.filter(Player.is_active == (is_active.lower() == 'true'))
        
        if region:
            # Note: region not present on Player model; keeping for backward compat if added later
            try:
                query = query.filter(Player.region == region)  # type: ignore[attr-defined]
            except Exception:
                pass
        
        if search:
            query = query.filter(Player.name.contains(search))
        
        query = query.order_by(Player.created_at.desc())
        
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'players': [player.to_dict() for player in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/', methods=['POST'])
@jwt_required()
def create_player():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Apenas administradores e gerentes podem criar players'}), 403
        
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'Nome é obrigatório'}), 400
        
        # Validate location ownership if provided
        loc_id = data.get('location_id')
        if not loc_id:
            return jsonify({'error': 'location_id é obrigatório'}), 400
        location = Location.query.get(loc_id)
        if not location:
            return jsonify({'error': 'Sede (location) não encontrada'}), 404
        
        # Even admins/managers can create across companies; HR is not allowed to create
        player = Player(
            name=data['name'],
            description=data.get('description', ''),
            location_id=loc_id,
            room_name=data.get('room_name', ''),
            mac_address=data.get('mac_address', ''),
            ip_address=data.get('ip_address', ''),
            chromecast_id=data.get('chromecast_id', ''),
            chromecast_name=data.get('chromecast_name', ''),
            platform=data.get('platform', 'web'),
            resolution=data.get('resolution', '1920x1080'),
            orientation=data.get('orientation', 'landscape'),
            default_content_duration=data.get('default_content_duration', 10),
            transition_effect=data.get('transition_effect', 'fade'),
            volume_level=data.get('volume_level', 50),
            storage_capacity_gb=data.get('storage_capacity_gb', 32),
            is_active=data.get('is_active', True),
            access_code=data.get('access_code') or _generate_unique_access_code()
        )
        
        db.session.add(player)
        db.session.commit()
        
        return jsonify({
            'message': 'Player criado com sucesso',
            'player': player.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@player_bp.route('/<player_id>', methods=['GET'])
@jwt_required()
def get_player(player_id):
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        player = Player.query.get(player_id)
        
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        # HR can only access players from their company
        if current_user and current_user.role == 'hr':
            location = Location.query.get(player.location_id)
            if not location or location.company != current_user.company:
                return jsonify({'error': 'Acesso negado a players de outra empresa'}), 403
        
        return jsonify(player.to_dict()), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/<player_id>', methods=['PUT'])
@jwt_required()
def update_player(player_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        player = Player.query.get(player_id)
        
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar players'}), 403
        
        data = request.get_json()
        
        # If changing location, ensure it's valid
        if 'location_id' in data and data['location_id']:
            new_loc = Location.query.get(data['location_id'])
            if not new_loc:
                return jsonify({'error': 'Sede (location) não encontrada'}), 404
        
        # Atualizar campos do player
        if 'name' in data:
            player.name = data['name']
        if 'description' in data:
            player.description = data['description']
        if 'location_id' in data:
            player.location_id = data['location_id']
        if 'room_name' in data:
            player.room_name = data['room_name']
        if 'mac_address' in data:
            player.mac_address = data['mac_address']
        if 'ip_address' in data:
            player.ip_address = data['ip_address']
        if 'chromecast_id' in data:
            player.chromecast_id = data['chromecast_id']
        if 'chromecast_name' in data:
            player.chromecast_name = data['chromecast_name']
        if 'chromecast_model' in data:
            player.chromecast_model = data['chromecast_model']
        if 'chromecast_firmware' in data:
            player.chromecast_firmware = data['chromecast_firmware']
        if 'platform' in data:
            player.platform = data['platform']
        if 'resolution' in data:
            player.resolution = data['resolution']
        if 'orientation' in data:
            player.orientation = data['orientation']
        if 'default_content_duration' in data:
            player.default_content_duration = data['default_content_duration']
        if 'transition_effect' in data:
            player.transition_effect = data['transition_effect']
        if 'volume_level' in data:
            player.volume_level = data['volume_level']
        if 'storage_capacity_gb' in data:
            player.storage_capacity_gb = data['storage_capacity_gb']
        if 'is_active' in data:
            player.is_active = data['is_active']
        
        player.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Player atualizado com sucesso',
            'player': player.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@player_bp.route('/<player_id>', methods=['DELETE'])
@jwt_required()
def delete_player(player_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        player = Player.query.get(player_id)
        
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        if user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem deletar players'}), 403
        
        db.session.delete(player)
        db.session.commit()
        
        return jsonify({'message': 'Player deletado com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@player_bp.route('/<player_id>/ping', methods=['POST'])
def player_ping(player_id):
    """Endpoint para players enviarem ping de status"""
    try:
        player = Player.query.get(player_id)
        
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        data = request.get_json() or {}
        
        # Atualiza status com base no ping
        player.status = 'online'
        player.last_ping = datetime.utcnow()
        
        if 'storage_used' in data:
            player.storage_used = data['storage_used']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Ping recebido',
            'player_id': player_id,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@player_bp.route('/<player_id>/command', methods=['POST'])
@jwt_required()
def send_command_to_player(player_id):
    """Enviar comando remoto para player"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        player = Player.query.get(player_id)
        
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para enviar comandos'}), 403
        
        data = request.get_json()
        command = data.get('command')
        
        if not command:
            return jsonify({'error': 'Comando é obrigatório'}), 400
        
        # Enviar comando via WebSocket
        from app import socketio
        socketio.emit('player_command', {
            'command': command,
            'data': data.get('data', {}),
            'timestamp': datetime.utcnow().isoformat()
        }, room=f'player_{player_id}')
        
        return jsonify({
            'message': 'Comando enviado',
            'command': command,
            'player_id': player_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/<player_id>/sync', methods=['POST'])
@jwt_required()
def sync_player(player_id):
    """Sincroniza player e verifica status do Chromecast se aplicável"""
    try:
        print(f"[SYNC] Iniciando sincronização para player: {player_id}")
        
        # Company scoping for HR
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        player = Player.query.get(player_id)
        if not player:
            print(f"[SYNC] Player {player_id} não encontrado")
            return jsonify({'error': 'Player não encontrado'}), 404
        
        if current_user and current_user.role == 'hr':
            location = Location.query.get(player.location_id)
            if not location or location.company != current_user.company:
                return jsonify({'error': 'Acesso negado a players de outra empresa'}), 403
        
        print(f"[SYNC] Player encontrado: {player.name}, Chromecast ID: {player.chromecast_id}")
        
        # Se (e somente se) for Chromecast, verificar status real via descoberta
        if (player.platform or '').lower() == 'chromecast' and player.chromecast_id:
            print(f"[SYNC] Importando chromecast_service...")
            from services.chromecast_service import chromecast_service
            
            print(f"[SYNC] Iniciando descoberta de dispositivos...")
            # Tentar descobrir dispositivos na rede
            discovered_devices = chromecast_service.discover_devices(timeout=5)
            print(f"[SYNC] Dispositivos descobertos: {len(discovered_devices)}")
            
            # Log detalhado dos dispositivos descobertos
            for i, device in enumerate(discovered_devices):
                print(f"[SYNC] Device {i+1}: ID={device.get('id')}, Name={device.get('name')}, IP={device.get('ip')}")
            
            # Verificar se o Chromecast está disponível
            chromecast_found = False
            for device in discovered_devices:
                print(f"[SYNC] Verificando device: {device.get('id')} vs {player.chromecast_id}")
                
                # Debug detalhado das comparações
                device_name = device.get('name', '')
                print(f"[SYNC] Device name: '{device_name}' (lower: '{device_name.lower()}')")
                print(f"[SYNC] Player chromecast_id: '{player.chromecast_id}'")
                
                # Estratégia de identificação mais flexível:
                # 1. Por UUID exato (se já foi descoberto antes)
                # 2. Por nome do dispositivo (mais confiável)
                # 3. Por MAC address (se foi configurado manualmente)
                uuid_match = device['id'] == player.chromecast_id
                name_exact = device_name.lower() == 'escritório'
                name_alt = device_name.lower() == 'escritório teste'
                name_normalized = device_name.lower().replace(' ', '') == 'escritório'
                name_contains = 'escritório' in device_name.lower()
                is_mac_address = len(player.chromecast_id) == 17 and ':' in player.chromecast_id
                
                print(f"[SYNC] UUID match: {uuid_match}")
                print(f"[SYNC] Name exact ('escritório'): {name_exact}")
                print(f"[SYNC] Name alt ('escritório teste'): {name_alt}")
                print(f"[SYNC] Name normalized: {name_normalized}")
                print(f"[SYNC] Name contains 'escritório': {name_contains}")
                print(f"[SYNC] Is MAC address: {is_mac_address}")
                
                device_matches = (
                    uuid_match or
                    name_exact or
                    name_alt or
                    name_normalized or
                    name_contains or
                    is_mac_address
                )
                
                print(f"[SYNC] Final device_matches: {device_matches}")
                
                if device_matches:
                    print(f"[SYNC] Chromecast encontrado! Device: {device.get('name')} (ID: {device['id']})")
                    chromecast_found = True
                    
                    # Sempre atualizar com o UUID correto para futuras sincronizações
                    if device['id'] != player.chromecast_id:
                        print(f"[SYNC] Atualizando chromecast_id de '{player.chromecast_id}' para '{device['id']}'")
                        player.chromecast_id = str(device['id'])  # Converter para string
                    
                    # Tentar conectar para verificar se está realmente disponível
                    if chromecast_service.connect_to_device(device['id']):
                        print(f"[SYNC] Conexão bem-sucedida! Atualizando status para online")
                        player.status = 'online'
                        player.last_ping = datetime.utcnow()
                        player.ip_address = device.get('ip', player.ip_address)
                    else:
                        print(f"[SYNC] Falha na conexão. Status offline")
                        player.status = 'offline'
                    break
            
            if not chromecast_found:
                print(f"[SYNC] Chromecast {player.chromecast_id} não encontrado na rede")
                player.status = 'offline'
            
            db.session.commit()
            print(f"[SYNC] Status atualizado no banco: {player.status}")
            
            return jsonify({
                'message': 'Sincronização concluída',
                'player_status': player.status,
                'chromecast_status': 'found' if chromecast_found else 'not_found',
                'discovered_devices': len(discovered_devices)
            })
        else:
            print(f"[SYNC] Player não tem Chromecast associado")
            # Player sem Chromecast - apenas atualizar ping
            player.last_ping = datetime.utcnow()
            player.status = 'online'
            db.session.commit()
            
            return jsonify({
                'message': 'Player sincronizado (sem Chromecast)',
                'player_status': player.status
            })
        
    except Exception as e:
        print(f"[SYNC] Erro durante sincronização: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@player_bp.route('/sync-all', methods=['POST'])
@jwt_required()
def sync_all_players():
    """Sincroniza todos os players automaticamente"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para sincronizar players'}), 403
        
        print("[SYNC_ALL] Iniciando sincronização manual de todos os players...")
        
        # Executar sincronização
        result = auto_sync_service.sync_all_players()
        
        if result:
            return jsonify({
                'message': 'Sincronização de todos os players concluída',
                'synced_players': result['synced_players'],
                'online_players': result['online_players'],
                'total_players': result['total_players'],
                'discovered_devices': result['discovered_devices']
            }), 200
        else:
            return jsonify({'error': 'Falha na sincronização'}), 500
        
    except Exception as e:
        print(f"[SYNC_ALL] Erro durante sincronização: {e}")
        return jsonify({'error': str(e)}), 500

@player_bp.route('/<player_id>/force-online', methods=['POST'])
@jwt_required()
def force_player_online(player_id):
    """Force a player to be online for testing purposes"""
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        if current_user and current_user.role == 'hr':
            location = Location.query.get(player.location_id)
            if not location or location.company != current_user.company:
                return jsonify({'error': 'Acesso negado a players de outra empresa'}), 403
        
        # Force update last_ping to make player appear online
        player.last_ping = datetime.utcnow()
        player.status = 'online'
        db.session.commit()
        
        return jsonify({
            'message': 'Player forçado para online',
            'player_id': player_id,
            'last_ping': player.last_ping.isoformat(),
            'status': player.status
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@player_bp.route('/locations', methods=['GET'])
@jwt_required()
def get_player_locations():
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        if current_user and current_user.role == 'hr':
            locations = Location.query.filter(Location.is_active == True, Location.company == current_user.company).all()
        else:
            locations = Location.query.filter(Location.is_active == True).all()
        return jsonify({
            'locations': [location.to_dict() for location in locations]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/regions', methods=['GET'])
@jwt_required()
def get_regions():
    try:
        regions = db.session.query(Player.region).distinct().all()
        regions = [region[0] for region in regions if region[0]]
        
        return jsonify({'regions': regions}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_player_stats():
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        # Base queries
        q_all = Player.query
        if current_user and current_user.role == 'hr':
            q_all = q_all.join(Location, Player.location_id == Location.id).filter(Location.company == current_user.company)
        
        threshold = datetime.utcnow() - timedelta(minutes=5)
        q_online = q_all.filter(Player.last_ping != None, Player.last_ping >= threshold)
        q_active = q_all.filter(Player.is_active == True)
        
        total_players = q_all.count()
        online_players = q_online.count()
        active_players = q_active.count()
        
        stats_by_platform_q = db.session.query(
            Player.platform,
            db.func.count(Player.id).label('count')
        )
        if current_user and current_user.role == 'hr':
            stats_by_platform_q = stats_by_platform_q.join(Location, Player.location_id == Location.id).filter(Location.company == current_user.company)
        stats_by_platform = stats_by_platform_q.group_by(Player.platform).all()
        
        stats_by_region_q = db.session.query(
            Player.region,
            db.func.count(Player.id).label('count')
        ).filter(Player.region != '')
        if current_user and current_user.role == 'hr':
            stats_by_region_q = stats_by_region_q.join(Location, Player.location_id == Location.id).filter(Location.company == current_user.company)
        stats_by_region = stats_by_region_q.group_by(Player.region).all()
        
        return jsonify({
            'total_players': total_players,
            'online_players': online_players,
            'active_players': active_players,
            'offline_players': total_players - online_players,
            'by_platform': {stat[0]: stat[1] for stat in stats_by_platform},
            'by_region': {stat[0]: stat[1] for stat in stats_by_region}
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/<player_id>/connect', methods=['POST'])
def connect_player(player_id):
    """Public endpoint for Web/Android players to announce presence and mark online.
    Updates last_ping, status and optionally records IP address.
    """
    try:
        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404

        # Update status
        player.status = 'online'
        player.last_ping = datetime.utcnow()
        # Best-effort capture of IP
        try:
            remote_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            if remote_ip:
                player.ip_address = remote_ip
        except Exception:
            pass

        db.session.commit()

        # Notify admins of status update (optional)
        try:
            from app import socketio
            socketio.emit('player_status_update', {
                'player_id': player_id,
                'is_online': True,
                'last_seen': datetime.utcnow().isoformat()
            }, room='admin')
        except Exception:
            pass

        return jsonify({'message': 'Player conectado', 'player_id': player_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@player_bp.route('/<player_id>/info', methods=['GET'])
def get_player_info_public(player_id):
    """Public endpoint for Web/Android players to get basic player information.
    Returns only essential information needed for kiosk mode without authentication.
    """
    try:
        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404

        # Return only basic, safe information
        player_info = {
            'id': player.id,
            'name': player.name or 'Player',
            'status': player.status or 'offline',
            'is_active': bool(player.is_active),
            'access_code': player.access_code or ''
        }

        # Add optional fields safely
        if hasattr(player, 'platform') and player.platform:
            player_info['platform'] = player.platform
            
        if hasattr(player, 'last_ping') and player.last_ping:
            try:
                player_info['last_ping'] = player.last_ping.isoformat()
            except:
                pass
                
        if hasattr(player, 'created_at') and player.created_at:
            try:
                player_info['created_at'] = player.created_at.isoformat()
            except:
                pass

        return jsonify(player_info), 200
    except Exception as e:
        print(f"[ERROR] get_player_info_public: {str(e)}")  # Debug log
        return jsonify({'error': 'Erro interno do servidor'}), 500


@player_bp.route('/<player_id>/playlist', methods=['GET'])
def get_player_playlist(player_id):
    """Public endpoint to provide the current playlist for a Web/Android player.
    Chooses the active MAIN schedule for the player (if any) and returns a list of items
    normalized for the WebPlayer (type, file_url, title, description, duration).
    """
    try:
        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404

        now = datetime.now()
        # Find schedules in date window and active flag
        schedules = Schedule.query.filter(
            Schedule.player_id == player_id,
            Schedule.is_active == True,
            Schedule.start_date <= now,
            Schedule.end_date >= now
        ).all()

        # Filter those active in time window (hours/days) and separate by content type
        active_main = []
        active_overlay = []
        for s in schedules:
            try:
                if s.is_active_now():
                    if (s.content_type or 'main') == 'overlay':
                        active_overlay.append(s)
                    else:
                        active_main.append(s)
            except Exception:
                continue

        chosen = (active_main[0] if active_main else (active_overlay[0] if active_overlay else None))
        if not chosen:
            return jsonify({'player_id': player_id, 'contents': []}), 200

        # Build playlist items from schedule filtered contents
        media_base = request.host_url.rstrip('/')
        items = []
        try:
            filtered = chosen.get_filtered_contents() or []
            for cc in filtered:
                content = getattr(cc, 'content', None)
                if not content or not getattr(content, 'file_path', None):
                    continue
                filename = str(content.file_path).split('/')[-1]
                file_url = f"{media_base}/uploads/{filename}"
                ctype = (content.content_type or '').lower()
                if ctype.startswith('img') or ctype == 'image':
                    item_type = 'image'
                elif ctype.startswith('aud') or ctype == 'audio':
                    item_type = 'audio'
                else:
                    item_type = 'video'

                duration = None
                try:
                    duration = cc.get_effective_duration()
                except Exception:
                    duration = getattr(content, 'duration', None)

                items.append({
                    'id': content.id,
                    'title': content.title,
                    'description': getattr(content, 'description', ''),
                    'type': item_type,
                    'file_url': file_url,
                    'duration': duration or 10
                })
        except Exception:
            items = []

        return jsonify({'player_id': player_id, 'schedule_id': chosen.id, 'contents': items}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/resolve-code/<code>', methods=['GET'])
def resolve_code(code):
    """Public endpoint: resolve a friendly access code to a player id."""
    try:
        if not code:
            return jsonify({'error': 'Código não fornecido'}), 400
        player = Player.query.filter(Player.access_code == code.upper()).first()
        if not player:
            return jsonify({'error': 'Código não encontrado'}), 404
        return jsonify({'player_id': player.id, 'access_code': player.access_code}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/list-codes', methods=['GET'])
def list_access_codes():
    """Endpoint temporário para listar códigos de acesso disponíveis (para debug)"""
    try:
        players = Player.query.filter(Player.access_code != None).all()
        codes = []
        for player in players:
            codes.append({
                'player_id': player.id,
                'player_name': player.name,
                'access_code': player.access_code,
                'is_active': player.is_active
            })
        return jsonify({'codes': codes, 'total': len(codes)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/<player_id>/regenerate-code', methods=['POST'])
@jwt_required()
def regenerate_access_code(player_id):
    """Regenerate a new access_code for the player (admin/manager only)."""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para regenerar código'}), 403

        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404

        player.access_code = _generate_unique_access_code()
        player.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'message': 'Código regenerado', 'access_code': player.access_code}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
