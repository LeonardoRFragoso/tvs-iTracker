from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models.content_distribution import ContentDistribution, db
from models.content import Content
from models.player import Player
from models.location import Location
from models.user import User
from services.distribution_manager import ContentDistributionManager

content_distribution_bp = Blueprint('content_distribution', __name__)

@content_distribution_bp.route('/', methods=['GET'])
@content_distribution_bp.route('', methods=['GET'])  # evita redirect 308
@jwt_required()
def list_distributions():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        location_id = request.args.get('location_id')
        player_id = request.args.get('player_id')
        content_id = request.args.get('content_id')
        
        query = ContentDistribution.query
        
        if status:
            query = query.filter(ContentDistribution.status == status)
        
        if location_id:
            query = query.join(Player).filter(Player.location_id == location_id)
        
        if player_id:
            query = query.filter(ContentDistribution.player_id == player_id)
        
        if content_id:
            query = query.filter(ContentDistribution.content_id == content_id)
        
        query = query.order_by(ContentDistribution.created_at.desc())
        
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        distributions = []
        for dist in pagination.items:
            dist_dict = dist.to_dict()
            # Adicionar informações do player e content
            if dist.player:
                dist_dict['player'] = {
                    'id': dist.player.id,
                    'name': dist.player.name,
                    'location': dist.player.location.name if dist.player.location else None
                }
            if dist.content:
                dist_dict['content'] = {
                    'id': dist.content.id,
                    'title': dist.content.title,
                    'file_size_mb': dist.content.file_size_mb
                }
            distributions.append(dist_dict)
        
        return jsonify({
            'distributions': distributions,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@content_distribution_bp.route('/distribute', methods=['POST'])
@jwt_required()
def distribute_content():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para distribuir conteúdo'}), 403
        
        data = request.get_json()
        
        content_id = data.get('content_id')
        location_ids = data.get('location_ids', [])
        player_ids = data.get('player_ids', [])
        priority = data.get('priority', 'normal')
        
        if not content_id:
            return jsonify({'error': 'content_id é obrigatório'}), 400
        
        content = Content.query.get(content_id)
        if not content:
            return jsonify({'error': 'Conteúdo não encontrado'}), 404
        
        # Validar prioridade
        if priority not in ['low', 'normal', 'high', 'urgent']:
            return jsonify({'error': 'Prioridade inválida'}), 400
        
        manager = ContentDistributionManager()
        
        # Distribuir para locations específicas
        if location_ids:
            for location_id in location_ids:
                location = Location.query.get(location_id)
                if location:
                    manager.distribute_to_location(content_id, location_id, priority)
        
        # Distribuir para players específicos
        if player_ids:
            for player_id in player_ids:
                player = Player.query.get(player_id)
                if player:
                    manager.distribute_to_player(content_id, player_id, priority)
        
        # Se não especificou nem location nem players, distribuir para todas as locations ativas
        if not location_ids and not player_ids:
            active_locations = Location.query.filter(Location.is_active == True).all()
            for location in active_locations:
                manager.distribute_to_location(content_id, location.id, priority)
        
        return jsonify({
            'message': 'Distribuição iniciada com sucesso',
            'content_id': content_id,
            'locations': location_ids,
            'players': player_ids,
            'priority': priority
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@content_distribution_bp.route('/<distribution_id>', methods=['GET'])
@jwt_required()
def get_distribution(distribution_id):
    try:
        distribution = ContentDistribution.query.get(distribution_id)
        
        if not distribution:
            return jsonify({'error': 'Distribuição não encontrada'}), 404
        
        dist_dict = distribution.to_dict()
        
        # Adicionar informações detalhadas
        if distribution.player:
            dist_dict['player'] = distribution.player.to_dict()
        
        if distribution.content:
            dist_dict['content'] = distribution.content.to_dict()
        
        return jsonify({'distribution': dist_dict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@content_distribution_bp.route('/<distribution_id>/retry', methods=['POST'])
@jwt_required()
def retry_distribution(distribution_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para retentar distribuição'}), 403
        
        distribution = ContentDistribution.query.get(distribution_id)
        
        if not distribution:
            return jsonify({'error': 'Distribuição não encontrada'}), 404
        
        if distribution.status not in ['failed', 'cancelled']:
            return jsonify({'error': 'Apenas distribuições falhadas ou canceladas podem ser retentadas'}), 400
        
        # Reset status para retry
        distribution.status = 'pending'
        distribution.retry_count = 0
        distribution.error_message = None
        distribution.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Reagendar distribuição
        manager = ContentDistributionManager()
        manager.schedule_distribution(distribution.id)
        
        return jsonify({
            'message': 'Distribuição reagendada com sucesso',
            'distribution': distribution.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@content_distribution_bp.route('/<distribution_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_distribution(distribution_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para cancelar distribuição'}), 403
        
        distribution = ContentDistribution.query.get(distribution_id)
        
        if not distribution:
            return jsonify({'error': 'Distribuição não encontrada'}), 404
        
        if distribution.status in ['completed', 'cancelled']:
            return jsonify({'error': 'Distribuição já finalizada'}), 400
        
        distribution.status = 'cancelled'
        distribution.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Distribuição cancelada com sucesso',
            'distribution': distribution.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@content_distribution_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_distribution_stats():
    try:
        location_id = request.args.get('location_id')
        
        query = ContentDistribution.query
        
        if location_id:
            query = query.join(Player).filter(Player.location_id == location_id)
        
        distributions = query.all()
        
        total = len(distributions)
        pending = len([d for d in distributions if d.status == 'pending'])
        downloading = len([d for d in distributions if d.status == 'downloading'])
        completed = len([d for d in distributions if d.status == 'completed'])
        failed = len([d for d in distributions if d.status == 'failed'])
        cancelled = len([d for d in distributions if d.status == 'cancelled'])
        
        # Estatísticas de tamanho
        total_size_mb = sum(d.content.file_size_mb for d in distributions if d.content)
        completed_size_mb = sum(d.content.file_size_mb for d in distributions if d.content and d.status == 'completed')
        
        # Estatísticas de tempo
        avg_download_time = 0
        completed_dists = [d for d in distributions if d.status == 'completed' and d.completed_at and d.started_at]
        if completed_dists:
            total_time = sum((d.completed_at - d.started_at).total_seconds() for d in completed_dists)
            avg_download_time = total_time / len(completed_dists)
        
        return jsonify({
            'total_distributions': total,
            'status_breakdown': {
                'pending': pending,
                'downloading': downloading,
                'completed': completed,
                'failed': failed,
                'cancelled': cancelled
            },
            'success_rate': round((completed / total * 100), 2) if total > 0 else 0,
            'size_stats': {
                'total_size_mb': round(total_size_mb, 2),
                'completed_size_mb': round(completed_size_mb, 2),
                'completion_percentage': round((completed_size_mb / total_size_mb * 100), 2) if total_size_mb > 0 else 0
            },
            'performance': {
                'avg_download_time_seconds': round(avg_download_time, 2)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@content_distribution_bp.route('/cleanup', methods=['POST'])
@jwt_required()
def cleanup_distributions():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem executar limpeza'}), 403
        
        data = request.get_json()
        days_old = data.get('days_old', 30)
        
        manager = ContentDistributionManager()
        cleaned_count = manager.cleanup_old_distributions(days_old)
        
        return jsonify({
            'message': f'Limpeza concluída: {cleaned_count} distribuições removidas',
            'cleaned_count': cleaned_count,
            'days_old': days_old
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@content_distribution_bp.route('/player/<player_id>/content', methods=['GET'])
@jwt_required()
def get_player_content_list(player_id):
    try:
        player = Player.query.get(player_id)
        
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        manager = ContentDistributionManager()
        content_list = manager.get_player_content_list(player_id)
        
        return jsonify({
            'player_id': player_id,
            'content_list': content_list,
            'total_content': len(content_list)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@content_distribution_bp.route('/location/<location_id>/sync', methods=['POST'])
@jwt_required()
def sync_location_content(location_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para sincronizar conteúdo'}), 403
        
        location = Location.query.get(location_id)
        
        if not location:
            return jsonify({'error': 'Empresa não encontrada'}), 404
        
        data = request.get_json()
        force_sync = data.get('force_sync', False)
        
        manager = ContentDistributionManager()
        
        # Obter todos os conteúdos ativos
        active_contents = Content.query.filter(Content.is_active == True).all()
        
        synced_count = 0
        for content in active_contents:
            # Verificar se já existe distribuição para esta location
            existing_dist = ContentDistribution.query.join(Player).filter(
                Player.location_id == location_id,
                ContentDistribution.content_id == content.id,
                ContentDistribution.status.in_(['completed', 'downloading', 'pending'])
            ).first()
            
            if not existing_dist or force_sync:
                manager.distribute_to_location(content.id, location_id, 'normal')
                synced_count += 1
        
        return jsonify({
            'message': f'Sincronização iniciada para {synced_count} conteúdos',
            'location_id': location_id,
            'synced_count': synced_count,
            'force_sync': force_sync
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
