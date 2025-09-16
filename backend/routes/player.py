from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit
from datetime import datetime
import json
from models.player import Player, db
from models.user import User
from models.location import Location
from services.auto_sync_service import auto_sync_service

player_bp = Blueprint('player', __name__)

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
        
        query = Player.query
        
        if is_online is not None:
            query = query.filter(Player.is_online == (is_online.lower() == 'true'))
        
        if is_active is not None:
            query = query.filter(Player.is_active == (is_active.lower() == 'true'))
        
        if region:
            query = query.filter(Player.region == region)
        
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
        
        player = Player(
            name=data['name'],
            description=data.get('description', ''),
            location_id=data.get('location_id'),
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
            is_active=data.get('is_active', True)
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
        player = Player.query.get(player_id)
        
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
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
        
        player.is_online = True
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
        
        player = Player.query.get(player_id)
        if not player:
            print(f"[SYNC] Player {player_id} não encontrado")
            return jsonify({'error': 'Player não encontrado'}), 404
        
        print(f"[SYNC] Player encontrado: {player.name}, Chromecast ID: {player.chromecast_id}")
        
        # Se o player tem Chromecast associado, verificar status real
        if player.chromecast_id:
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
        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
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
        total_players = Player.query.count()
        online_players = Player.query.filter(Player.is_online == True).count()
        active_players = Player.query.filter(Player.is_active == True).count()
        
        stats_by_platform = db.session.query(
            Player.platform,
            db.func.count(Player.id).label('count')
        ).group_by(Player.platform).all()
        
        stats_by_region = db.session.query(
            Player.region,
            db.func.count(Player.id).label('count')
        ).filter(Player.region != '').group_by(Player.region).all()
        
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
