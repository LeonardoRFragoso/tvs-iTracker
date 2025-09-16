from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit
from datetime import datetime
import json
from models.player import Player, db
from models.user import User
from models.location import Location

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
            location=data.get('location', ''),
            region=data.get('region', ''),
            platform=data.get('platform', 'web'),
            resolution=data.get('resolution', '1920x1080'),
            orientation=data.get('orientation', 'landscape'),
            default_content_duration=data.get('default_content_duration', 10),
            transition_effect=data.get('transition_effect', 'fade'),
            volume_level=data.get('volume_level', 50),
            storage_limit=data.get('storage_limit', 1024)
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
        
        if 'name' in data:
            player.name = data['name']
        if 'description' in data:
            player.description = data['description']
        if 'location' in data:
            player.location = data['location']
        if 'region' in data:
            player.region = data['region']
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
        if 'storage_limit' in data:
            player.storage_limit = data['storage_limit']
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
def sync_content(player_id):
    """Sincronizar conteúdo offline do player"""
    try:
        player = Player.query.get(player_id)
        
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        player.last_content_sync = datetime.utcnow()
        db.session.commit()
        
        # Aqui você implementaria a lógica para determinar qual conteúdo
        # deve ser sincronizado baseado nos agendamentos ativos
        
        return jsonify({
            'message': 'Sincronização iniciada',
            'player_id': player_id,
            'sync_time': player.last_content_sync.isoformat()
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
