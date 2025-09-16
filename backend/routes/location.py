from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, time, timedelta
from models.location import Location, db
from models.user import User

location_bp = Blueprint('location', __name__)

@location_bp.route('/', methods=['GET'])
@jwt_required()
def list_locations():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_active = request.args.get('is_active')
        search = request.args.get('search')
        
        query = Location.query
        
        if is_active is not None:
            query = query.filter(Location.is_active == (is_active.lower() == 'true'))
        
        if search:
            query = query.filter(
                Location.name.contains(search) | 
                Location.city.contains(search) |
                Location.state.contains(search)
            )
        
        query = query.order_by(Location.created_at.desc())
        
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'locations': [location.to_dict() for location in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@location_bp.route('/', methods=['POST'])
@jwt_required()
def create_location():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Apenas administradores e gerentes podem criar sedes'}), 403
        
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'Nome é obrigatório'}), 400
        
        if not data.get('city'):
            return jsonify({'error': 'Cidade é obrigatória'}), 400
        
        if not data.get('state'):
            return jsonify({'error': 'Estado é obrigatório'}), 400
        
        # Parse horários de pico
        peak_start = time(8, 0)  # Default 08:00
        peak_end = time(18, 0)   # Default 18:00
        
        if data.get('peak_hours_start'):
            try:
                hour, minute = map(int, data['peak_hours_start'].split(':'))
                peak_start = time(hour, minute)
            except ValueError:
                return jsonify({'error': 'Formato de horário inválido para peak_hours_start'}), 400
        
        if data.get('peak_hours_end'):
            try:
                hour, minute = map(int, data['peak_hours_end'].split(':'))
                peak_end = time(hour, minute)
            except ValueError:
                return jsonify({'error': 'Formato de horário inválido para peak_hours_end'}), 400
        
        location = Location(
            name=data['name'],
            city=data['city'],
            state=data['state'],
            address=data.get('address', ''),
            timezone=data.get('timezone', 'America/Sao_Paulo'),
            network_bandwidth_mbps=data.get('network_bandwidth_mbps', 100),
            peak_hours_start=peak_start,
            peak_hours_end=peak_end
        )
        
        db.session.add(location)
        db.session.commit()
        
        return jsonify({
            'message': 'Sede criada com sucesso',
            'location': location.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@location_bp.route('/<location_id>', methods=['GET'])
@jwt_required()
def get_location(location_id):
    try:
        location = Location.query.get(location_id)
        
        if not location:
            return jsonify({'error': 'Sede não encontrada'}), 404
        
        return jsonify({'location': location.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@location_bp.route('/<location_id>', methods=['PUT'])
@jwt_required()
def update_location(location_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        location = Location.query.get(location_id)
        
        if not location:
            return jsonify({'error': 'Sede não encontrada'}), 404
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar sedes'}), 403
        
        data = request.get_json()
        
        if 'name' in data:
            location.name = data['name']
        if 'city' in data:
            location.city = data['city']
        if 'state' in data:
            location.state = data['state']
        if 'address' in data:
            location.address = data['address']
        if 'timezone' in data:
            location.timezone = data['timezone']
        if 'network_bandwidth_mbps' in data:
            location.network_bandwidth_mbps = data['network_bandwidth_mbps']
        if 'is_active' in data:
            location.is_active = data['is_active']
        
        # Atualiza horários de pico
        if 'peak_hours_start' in data:
            try:
                hour, minute = map(int, data['peak_hours_start'].split(':'))
                location.peak_hours_start = time(hour, minute)
            except ValueError:
                return jsonify({'error': 'Formato de horário inválido para peak_hours_start'}), 400
        
        if 'peak_hours_end' in data:
            try:
                hour, minute = map(int, data['peak_hours_end'].split(':'))
                location.peak_hours_end = time(hour, minute)
            except ValueError:
                return jsonify({'error': 'Formato de horário inválido para peak_hours_end'}), 400
        
        location.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Sede atualizada com sucesso',
            'location': location.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@location_bp.route('/<location_id>', methods=['DELETE'])
@jwt_required()
def delete_location(location_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        location = Location.query.get(location_id)
        
        if not location:
            return jsonify({'error': 'Sede não encontrada'}), 404
        
        if user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem deletar sedes'}), 403
        
        # Verifica se há players associados
        if location.players:
            return jsonify({
                'error': f'Não é possível deletar sede com {len(location.players)} players associados'
            }), 400
        
        db.session.delete(location)
        db.session.commit()
        
        return jsonify({'message': 'Sede deletada com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@location_bp.route('/<location_id>/players', methods=['GET'])
@jwt_required()
def get_location_players(location_id):
    try:
        location = Location.query.get(location_id)
        
        if not location:
            return jsonify({'error': 'Sede não encontrada'}), 404
        
        players = [player.to_dict() for player in location.players]
        
        return jsonify({
            'location': location.to_dict(),
            'players': players,
            'total_players': len(players)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@location_bp.route('/<location_id>/stats', methods=['GET'])
@jwt_required()
def get_location_stats(location_id):
    try:
        location = Location.query.get(location_id)
        
        if not location:
            return jsonify({'error': 'Sede não encontrada'}), 404
        
        players = location.players
        total_players = len(players)
        
        # Fix: Calculate online players based on last_ping within 5 minutes (same logic as Player.is_online property)
        five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
        online_players = len([p for p in players if p.last_ping and p.last_ping >= five_minutes_ago])
        offline_players = total_players - online_players
        
        # Estatísticas de armazenamento
        total_storage_gb = sum(p.storage_capacity_gb for p in players)
        used_storage_gb = sum(p.storage_used_gb for p in players)
        available_storage_gb = total_storage_gb - used_storage_gb
        
        # Estatísticas de distribuição
        from models.content_distribution import ContentDistribution
        from models.player import Player
        
        distributions = ContentDistribution.query.join(Player).filter(
            Player.location_id == location_id
        ).all()
        
        pending_distributions = len([d for d in distributions if d.status == 'pending'])
        downloading_distributions = len([d for d in distributions if d.status == 'downloading'])
        completed_distributions = len([d for d in distributions if d.status == 'completed'])
        failed_distributions = len([d for d in distributions if d.status == 'failed'])
        
        return jsonify({
            'location': location.to_dict(),
            'player_stats': {
                'total_players': total_players,
                'online_players': online_players,
                'offline_players': offline_players,
                'online_percentage': round((online_players / total_players * 100), 2) if total_players > 0 else 0
            },
            'storage_stats': {
                'total_storage_gb': total_storage_gb,
                'used_storage_gb': round(used_storage_gb, 2),
                'available_storage_gb': round(available_storage_gb, 2),
                'usage_percentage': round((used_storage_gb / total_storage_gb * 100), 2) if total_storage_gb > 0 else 0
            },
            'distribution_stats': {
                'total_distributions': len(distributions),
                'pending': pending_distributions,
                'downloading': downloading_distributions,
                'completed': completed_distributions,
                'failed': failed_distributions,
                'success_rate': round((completed_distributions / len(distributions) * 100), 2) if distributions else 0
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@location_bp.route('/timezones', methods=['GET'])
@jwt_required()
def get_timezones():
    """Retorna lista de timezones disponíveis"""
    timezones = [
        'America/Sao_Paulo',
        'America/Manaus',
        'America/Fortaleza',
        'America/Recife',
        'America/Bahia',
        'America/Campo_Grande',
        'America/Cuiaba'
    ]
    
    return jsonify({'timezones': timezones}), 200

@location_bp.route('/<location_id>/debug/players', methods=['GET'])
@jwt_required()
def debug_location_players(location_id):
    """Debug endpoint to check location player status and last_ping values"""
    try:
        location = Location.query.get(location_id)
        
        if not location:
            return jsonify({'error': 'Sede não encontrada'}), 404
        
        players = location.players
        five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
        
        debug_info = []
        for player in players:
            debug_info.append({
                'id': player.id,
                'name': player.name,
                'platform': player.platform,
                'chromecast_id': player.chromecast_id,
                'last_ping': player.last_ping.isoformat() if player.last_ping else None,
                'last_ping_minutes_ago': (datetime.utcnow() - player.last_ping).total_seconds() / 60 if player.last_ping else None,
                'is_online_property': player.is_online,
                'is_online_calculated': player.last_ping and player.last_ping >= five_minutes_ago,
                'status': player.status
            })
        
        return jsonify({
            'location': location.to_dict(),
            'total_players': len(players),
            'five_minutes_ago': five_minutes_ago.isoformat(),
            'current_time': datetime.utcnow().isoformat(),
            'players': debug_info
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@location_bp.route('/<location_id>/force-players-online', methods=['POST'])
@jwt_required()
def force_location_players_online(location_id):
    """Force all players in a location to be online for testing purposes"""
    try:
        location = Location.query.get(location_id)
        
        if not location:
            return jsonify({'error': 'Sede não encontrada'}), 404
        
        players = location.players
        updated_players = []
        
        for player in players:
            player.last_ping = datetime.utcnow()
            player.status = 'online'
            updated_players.append({
                'id': player.id,
                'name': player.name,
                'last_ping': player.last_ping.isoformat(),
                'status': player.status
            })
        
        db.session.commit()
        
        return jsonify({
            'message': f'Todos os {len(players)} players da sede forçados para online',
            'location': location.name,
            'updated_players': updated_players
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
