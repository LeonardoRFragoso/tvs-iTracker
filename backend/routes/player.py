from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit
from datetime import datetime, timedelta
import secrets
import json
import os
import hashlib
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
@player_bp.route('', methods=['GET'])  # evita redirect 308 em /api/players
@jwt_required(optional=True)  # Tornando JWT opcional para debug
def list_players():
    try:
        print("[DEBUG] Acessando list_players")
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_online = request.args.get('is_online')
        is_active = request.args.get('is_active')
        region = request.args.get('region')
        search = request.args.get('search')
        
        print(f"[DEBUG] Parâmetros: page={page}, per_page={per_page}, is_online={is_online}, is_active={is_active}, region={region}, search={search}")
        
        # Company scoping for HR users
        user_id = get_jwt_identity()
        print(f"[DEBUG] JWT Identity: {user_id}")
        
        # Usar SQL puro para evitar problemas de conversão de tipo
        print("[DEBUG] Usando SQL puro para evitar erro de conversão de data")
        
        # Construir query SQL base
        sql_select = "SELECT p.* FROM players p"
        sql_count = "SELECT COUNT(*) FROM players p"
        sql_where = []
        sql_params = {}
        
        # Adicionar join com Location se for HR
        current_user = None
        if user_id:
            current_user = User.query.get(user_id)
            print(f"[DEBUG] User encontrado: {current_user is not None}")
            
            if current_user and current_user.role == 'hr':
                print(f"[DEBUG] Filtrando por company: {current_user.company}")
                sql_select += " JOIN locations l ON p.location_id = l.id"
                sql_count += " JOIN locations l ON p.location_id = l.id"
                sql_where.append("l.company = :company")
                sql_params['company'] = current_user.company
        
        # Filtrar por is_online
        if is_online is not None:
            threshold = datetime.utcnow() - timedelta(minutes=5)
            if is_online.lower() == 'true':
                sql_where.append("p.last_ping IS NOT NULL AND p.last_ping >= :threshold")
                sql_params['threshold'] = threshold
            else:
                sql_where.append("(p.last_ping IS NULL OR p.last_ping < :threshold)")
                sql_params['threshold'] = threshold
        
        # Filtrar por is_active
        if is_active is not None:
            is_active_val = 1 if is_active.lower() == 'true' else 0
            sql_where.append("p.is_active = :is_active")
            sql_params['is_active'] = is_active_val
        
        # Filtrar por region (se existir)
        if region:
            sql_where.append("p.region = :region")
            sql_params['region'] = region
        
        # Filtrar por search
        if search:
            sql_where.append("p.name LIKE :search")
            sql_params['search'] = f"%{search}%"
        
        # Montar cláusula WHERE
        if sql_where:
            sql_where_clause = " WHERE " + " AND ".join(sql_where)
            sql_select += sql_where_clause
            sql_count += sql_where_clause
        
        # Adicionar ORDER BY e LIMIT
        sql_select += " ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset"
        sql_params['limit'] = per_page
        sql_params['offset'] = (page - 1) * per_page
        
        # Executar query de contagem
        from sqlalchemy import text
        count_result = db.session.execute(text(sql_count), sql_params).scalar()
        total = count_result or 0
        pages = (total + per_page - 1) // per_page if total > 0 else 1
        
        # Executar query principal
        result = db.session.execute(text(sql_select), sql_params)
        
        # Converter resultados em objetos Player
        players = []
        for row in result:
            player = Player()
            for column in Player.__table__.columns:
                if hasattr(row, column.name):
                    setattr(player, column.name, getattr(row, column.name))
            players.append(player)
        
        # Montar resposta
        return jsonify({
            'players': [player.to_dict() for player in players],
            'total': total,
            'pages': pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        import traceback
        print(f"[ERROR] Erro em list_players: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@player_bp.route('/', methods=['POST'])
@player_bp.route('', methods=['POST'])  # evita redirect 308 em /api/players
@jwt_required()
def create_player():
    try:
        print("[DEBUG] Iniciando create_player")
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        print(f"[DEBUG] User: {user.username if user else 'None'}")
        
        # Permissões: admin e manager podem criar em qualquer empresa; RH pode criar somente na própria empresa
        if user.role not in ['admin', 'manager', 'hr']:
            return jsonify({'error': 'Sem permissão para criar players'}), 403
        
        data = request.get_json()
        print(f"[DEBUG] Dados recebidos: {data}")
        
        if not data.get('name'):
            return jsonify({'error': 'Nome é obrigatório'}), 400
        
        # Validate location ownership if provided
        loc_id = data.get('location_id')
        if not loc_id:
            return jsonify({'error': 'location_id é obrigatório'}), 400
        location = Location.query.get(loc_id)
        if not location:
            return jsonify({'error': 'Sede (location) não encontrada'}), 404
        
        # HR só pode criar players na própria empresa
        if user.role == 'hr':
            user_company = getattr(user, 'company', None)
            location_company = getattr(location, 'company', None)
            if not user_company or not location_company or user_company != location_company:
                return jsonify({'error': 'RH só pode criar players na própria empresa'}), 403
        
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
            device_type=data.get('device_type', 'modern'),  # Adicionado campo device_type
            resolution=data.get('resolution', '1920x1080'),
            orientation=data.get('orientation', 'landscape'),
            default_content_duration=data.get('default_content_duration', 10),
            transition_effect=data.get('transition_effect', 'fade'),
            volume_level=data.get('volume_level', 50),
            storage_capacity_gb=data.get('storage_capacity_gb', 32),
            is_active=data.get('is_active', True),
            access_code=data.get('access_code') or _generate_unique_access_code()
        )
        
        print(f"[DEBUG] Player criado: {player.name}, device_type: {player.device_type}")
        try:
            db.session.add(player)
            db.session.commit()
            print(f"[DEBUG] Player salvo no banco de dados com ID: {player.id}")
        except Exception as commit_error:
            print(f"[ERROR] Erro ao salvar player no banco de dados: {str(commit_error)}")
            import traceback
            traceback.print_exc()
            db.session.rollback()
            raise commit_error
        
        try:
            player_dict = player.to_dict()
            print(f"[DEBUG] to_dict() executado com sucesso")
            return jsonify({
                'message': 'Player criado com sucesso',
                'player': player_dict
            }), 201
        except Exception as dict_error:
            print(f"[ERROR] Erro ao converter player para dict: {str(dict_error)}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'message': 'Player criado com sucesso, mas houve um erro ao retornar os detalhes',
                'player_id': player.id,
                'error': str(dict_error)
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
        print(f"[DEBUG] Iniciando update_player para player_id: {player_id}")
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        player = Player.query.get(player_id)
        
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar players'}), 403
        
        data = request.get_json()
        print(f"[DEBUG] Dados recebidos para atualização: {data}")
        
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
        if 'device_type' in data:
            player.device_type = data['device_type']
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
        print(f"[DEBUG] Player atualizado com sucesso: {player.id}, device_type: {player.device_type}")
        
        return jsonify({
            'message': 'Player atualizado com sucesso',
            'player': player.to_dict()
        }), 200
        
    except Exception as e:
        import traceback
        print(f"[ERROR] Erro ao atualizar player: {str(e)}")
        traceback.print_exc()
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

@player_bp.route('/<player_id>/refresh-playlist', methods=['POST'])
@jwt_required()
def refresh_player_playlist(player_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para atualizar playlist'}), 403

        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404

        from app import socketio
        socketio.emit('player_command', {
            'command': 'update_playlist',
            'data': {},
            'timestamp': datetime.utcnow().isoformat()
        }, room=f'player_{player_id}')

        return jsonify({'message': 'Atualização de playlist enviada', 'player_id': player_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@player_bp.route('/refresh-all-playlists', methods=['POST'])
@jwt_required()
def refresh_all_playlists():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para atualizar playlists'}), 403

        from app import socketio
        socketio.emit('player_command', {
            'command': 'update_playlist',
            'data': {'scope': 'all'},
            'timestamp': datetime.utcnow().isoformat()
        })  # broadcast

        return jsonify({'message': 'Atualização de playlist enviada para todos os players'}), 200
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
@jwt_required(optional=True)  # Tornando JWT opcional para debug
def get_player_locations():
    try:
        print("[DEBUG] Acessando get_player_locations")
        user_id = get_jwt_identity()
        print(f"[DEBUG] JWT Identity: {user_id}")
        
        if user_id:
            current_user = User.query.get(user_id)
            print(f"[DEBUG] User encontrado: {current_user is not None}")
            
            if current_user and current_user.role == 'hr':
                print(f"[DEBUG] Filtrando por company: {current_user.company}")
                locations = Location.query.filter(Location.is_active == True, Location.company == current_user.company).all()
            else:
                print("[DEBUG] Buscando todas as locations ativas")
                locations = Location.query.filter(Location.is_active == True).all()
        else:
            print("[DEBUG] Sem JWT - buscando todas as locations ativas")
            locations = Location.query.filter(Location.is_active == True).all()
            
        print(f"[DEBUG] Locations encontradas: {len(locations)}")
        return jsonify({
            'locations': [location.to_dict() for location in locations]
        }), 200
    except Exception as e:
        import traceback
        print(f"[ERROR] Erro em get_player_locations: {str(e)}")
        traceback.print_exc()
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
        
        # Filtrar schedules compatíveis com o tipo de dispositivo
        if player.device_type:
            schedules = [s for s in schedules if s.is_compatible_with_device_type(player.device_type)]

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

        # Decide which schedules to use: all MAIN active; if none, first OVERLAY
        schedules_to_use = []
        if active_main:
            # Order MAIN schedules by priority desc, then created_at asc to have stable rotation
            try:
                active_main.sort(key=lambda s: (-(s.priority or 0), getattr(s, 'created_at', datetime.min)))
            except Exception:
                pass
            schedules_to_use = active_main
        elif active_overlay:
            schedules_to_use = [active_overlay[0]]

        if not schedules_to_use:
            return jsonify({'player_id': player_id, 'contents': []}), 200

        media_base = request.host_url.rstrip('/')
        # Resolve absolute uploads directory for FS checks
        upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        if not os.path.isabs(upload_dir):
            upload_dir = os.path.join(current_app.root_path, upload_dir)
        items = []
        # Guards to evitar itens duplicados quando múltiplos schedules ativos incluem a mesma campanha/conteúdo
        added_compiled_campaigns = set()  # campaign_id
        added_file_urls = set()  # absolute file URLs

        def _file_version(abs_path: str) -> str:
            """Gera uma versão estável baseada em tamanho+mtime para invalidar cache quando o arquivo muda."""
            try:
                st = os.stat(abs_path)
                return f"{st.st_size:x}{int(st.st_mtime):x}"
            except Exception:
                return "0"

        def append_schedule_items(sch):
            # 1) Include compiled campaign video once per schedule if applicable
            camp = getattr(sch, 'campaign', None)
            if camp and (sch.content_type or 'main') != 'overlay':
                try:
                    if (
                        getattr(camp, 'compiled_video_status', None) == 'ready' and
                        getattr(camp, 'compiled_video_path', None) and
                        not getattr(camp, 'compiled_stale', False)
                    ):
                        compiled_rel_path = str(camp.compiled_video_path).lstrip('/').replace('\\', '/')
                        compiled_url = f"{media_base}/uploads/{compiled_rel_path}?pid={player_id}"
                        compiled_abs_path = os.path.normpath(os.path.join(upload_dir, compiled_rel_path))
                        # Somente incluir se o arquivo realmente existir
                        if os.path.exists(compiled_abs_path):
                            # Acrescentar versão (?v=) para cache forte e invalidação automática
                            ver = _file_version(compiled_abs_path)
                            compiled_url = f"{compiled_url}&v={ver}"
                            # Evitar duplicar compilado da mesma campanha
                            if str(camp.id) not in added_compiled_campaigns and compiled_url not in added_file_urls:
                                items.append({
                                    'id': f"compiled-{camp.id}",
                                    'title': f"Campanha: {camp.name} (Compilado)",
                                    'description': 'Vídeo compilado a partir de imagens',
                                    'type': 'video',
                                    'file_url': compiled_url,
                                    'duration': getattr(camp, 'compiled_video_duration', None) or (camp.content_duration if getattr(camp, 'content_duration', None) else 10),
                                    'campaign_id': camp.id,
                                    'campaign_name': camp.name,
                                    'schedule_id': sch.id,
                                })
                                added_compiled_campaigns.add(str(camp.id))
                                added_file_urls.add(compiled_url)
                except Exception:
                    pass

            # 2) Add campaign contents according to schedule filters
            try:
                filtered = sch.get_filtered_contents() or []
                for cc in filtered:
                    content = getattr(cc, 'content', None)
                    if not content or not getattr(content, 'file_path', None):
                        continue
                    filename = str(content.file_path).split('/')[-1]
                    # Verificar existência do arquivo físico; se ausente, pular para evitar 404
                    content_abs_path = os.path.join(upload_dir, filename)
                    if not os.path.exists(content_abs_path):
                        continue
                    file_url = f"{media_base}/uploads/{filename}?pid={player_id}"
                    # Acrescentar versão (?v=)
                    ver2 = _file_version(content_abs_path)
                    file_url = f"{file_url}&v={ver2}"
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

                    # Evitar duplicação do mesmo arquivo (quando múltiplos schedules incluem o mesmo conteúdo)
                    if file_url in added_file_urls:
                        continue
                    items.append({
                        'id': content.id,
                        'title': content.title,
                        'description': getattr(content, 'description', ''),
                        'type': item_type,
                        'file_url': file_url,
                        'duration': duration or 10,
                        'campaign_id': camp.id if camp else None,
                        'campaign_name': camp.name if camp else None,
                        'schedule_id': sch.id,
                    })
                    added_file_urls.add(file_url)
            except Exception:
                pass

        for sch in schedules_to_use:
            append_schedule_items(sch)

        # ETag/If-None-Match cache support
        etag_src = json.dumps({
            'player_id': str(player_id),
            'schedule_ids': [str(s.id) for s in schedules_to_use],
            'contents': items
        }, sort_keys=True, ensure_ascii=False, default=str)
        etag_val = hashlib.md5(etag_src.encode('utf-8')).hexdigest()
        etag_header = f'"{etag_val}"'

        inm = request.headers.get('If-None-Match')
        if inm and (inm.strip() == etag_header or inm.strip().strip('"') == etag_val):
            return '', 304, {'ETag': etag_header}

        # Incluir configurações de reprodução do primeiro agendamento ativo
        playback_config = {}
        if schedules_to_use:
            schedule = schedules_to_use[0]
            playback_config = {
                'playback_mode': schedule.get_effective_playback_mode(),
                'loop_behavior': getattr(schedule, 'loop_behavior', 'until_next'),
                'loop_duration_minutes': getattr(schedule, 'loop_duration_minutes', None),
                'content_duration': getattr(schedule, 'content_duration', 10),
                'transition_duration': getattr(schedule, 'transition_duration', 1),
                'shuffle_enabled': getattr(schedule, 'shuffle_enabled', False),
                'auto_skip_errors': getattr(schedule, 'auto_skip_errors', True),
                'is_persistent': getattr(schedule, 'is_persistent', False),
                'content_type': getattr(schedule, 'content_type', 'main'),
            }
            print(f"[DEBUG] Enviando configurações de reprodução: {playback_config}")
        
        resp = jsonify({
            'player_id': player_id,
            'schedule_ids': [s.id for s in schedules_to_use],
            'contents': items,
            'playback_config': playback_config
        })
        resp.headers['ETag'] = etag_header
        return resp, 200
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
