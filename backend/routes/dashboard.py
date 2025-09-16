from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from sqlalchemy import func
from models.user import User, db
from models.content import Content
from models.campaign import Campaign
from models.player import Player
from models.schedule import Schedule
from models.editorial import Editorial
from models.location import Location

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    try:
        # Estatísticas gerais
        total_content = Content.query.filter(Content.is_active == True).count()
        total_campaigns = Campaign.query.filter(Campaign.is_active == True).count()
        total_players = Player.query.count()
        online_players = Player.query.filter(Player.is_online == True).count()
        total_schedules = Schedule.query.filter(Schedule.is_active == True).count()
        total_editorials = Editorial.query.filter(Editorial.is_active == True).count()
        
        # Estatísticas de conteúdo por tipo
        content_by_type = db.session.query(
            Content.content_type,
            func.count(Content.id).label('count')
        ).filter(Content.is_active == True).group_by(Content.content_type).all()
        
        # Estatísticas de players por localização
        players_by_location = db.session.query(
            Location.name,
            func.count(Player.id).label('count')
        ).join(Player, Location.id == Player.location_id).group_by(Location.name).all()
        
        # Campanhas ativas hoje
        today = datetime.utcnow().date()
        active_campaigns_today = Campaign.query.filter(
            Campaign.is_active == True,
            Campaign.start_date <= datetime.utcnow(),
            Campaign.end_date >= datetime.utcnow()
        ).count()
        
        # Uso de armazenamento
        total_storage_used = db.session.query(
            func.sum(Player.storage_used_gb)
        ).scalar() or 0
        
        total_storage_capacity = db.session.query(
            func.sum(Player.storage_capacity_gb)
        ).scalar() or 1
        
        storage_percentage = (total_storage_used / total_storage_capacity * 100) if total_storage_capacity > 0 else 0
        
        return jsonify({
            'overview': {
                'total_content': total_content,
                'total_campaigns': total_campaigns,
                'total_players': total_players,
                'online_players': online_players,
                'offline_players': total_players - online_players,
                'total_schedules': total_schedules,
                'total_editorials': total_editorials,
                'active_campaigns_today': active_campaigns_today
            },
            'content_by_type': {stat[0]: stat[1] for stat in content_by_type},
            'players_by_location': {stat[0]: stat[1] for stat in players_by_location},
            'storage': {
                'used_gb': round(total_storage_used, 2),
                'capacity_gb': round(total_storage_capacity, 2),
                'percentage': round(storage_percentage, 2)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/activity', methods=['GET'])
@jwt_required()
def get_recent_activity():
    try:
        days = request.args.get('days', 7, type=int)
        since_date = datetime.utcnow() - timedelta(days=days)
        
        # Conteúdo recente
        recent_content = Content.query.filter(
            Content.created_at >= since_date
        ).order_by(Content.created_at.desc()).limit(10).all()
        
        # Campanhas recentes
        recent_campaigns = Campaign.query.filter(
            Campaign.created_at >= since_date
        ).order_by(Campaign.created_at.desc()).limit(10).all()
        
        # Players recentemente online
        recent_players = Player.query.filter(
            Player.last_ping >= since_date
        ).order_by(Player.last_ping.desc()).limit(10).all()
        
        # Agendamentos recentes
        recent_schedules = Schedule.query.filter(
            Schedule.created_at >= since_date
        ).order_by(Schedule.created_at.desc()).limit(10).all()
        
        return jsonify({
            'recent_content': [content.to_dict() for content in recent_content],
            'recent_campaigns': [campaign.to_dict() for campaign in recent_campaigns],
            'recent_players': [player.to_dict() for player in recent_players],
            'recent_schedules': [schedule.to_dict() for schedule in recent_schedules]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/alerts', methods=['GET'])
@jwt_required()
def get_system_alerts():
    try:
        alerts = []
        
        # Players offline há mais de 1 hora
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        offline_players = Player.query.filter(
            Player.is_active == True,
            Player.last_ping < one_hour_ago
        ).all()
        
        for player in offline_players:
            alerts.append({
                'type': 'warning',
                'title': 'Player Offline',
                'message': f'Player "{player.name}" está offline há mais de 1 hora',
                'data': {'player_id': player.id},
                'timestamp': player.last_ping.isoformat() if player.last_ping else None
            })
        
        # Campanhas expirando em 24 horas
        tomorrow = datetime.utcnow() + timedelta(days=1)
        expiring_campaigns = Campaign.query.filter(
            Campaign.is_active == True,
            Campaign.end_date <= tomorrow,
            Campaign.end_date >= datetime.utcnow()
        ).all()
        
        for campaign in expiring_campaigns:
            alerts.append({
                'type': 'info',
                'title': 'Campanha Expirando',
                'message': f'Campanha "{campaign.name}" expira em breve',
                'data': {'campaign_id': campaign.id},
                'timestamp': campaign.end_date.isoformat()
            })
        
        # Armazenamento alto (>80%)
        high_storage_players = Player.query.filter(
            Player.storage_used_gb > Player.storage_capacity_gb * 0.8,
            Player.storage_capacity_gb > 0
        ).all()
        
        for player in high_storage_players:
            percentage = (player.storage_used_gb / player.storage_capacity_gb * 100)
            alerts.append({
                'type': 'warning',
                'title': 'Armazenamento Alto',
                'message': f'Player "{player.name}" está com {percentage:.1f}% do armazenamento usado',
                'data': {'player_id': player.id},
                'timestamp': datetime.utcnow().isoformat()
            })
        
        # Editorias com erro
        error_editorials = Editorial.query.filter(
            Editorial.is_active == True,
            Editorial.last_error.isnot(None)
        ).all()
        
        for editorial in error_editorials:
            alerts.append({
                'type': 'error',
                'title': 'Erro na Editoria',
                'message': f'Editoria "{editorial.name}" apresentou erro: {editorial.last_error[:100]}...',
                'data': {'editorial_id': editorial.id},
                'timestamp': editorial.last_update.isoformat() if editorial.last_update else None
            })
        
        # Ordenar por timestamp (mais recentes primeiro)
        alerts.sort(key=lambda x: x['timestamp'] or '', reverse=True)
        
        return jsonify({
            'alerts': alerts[:20],  # Limitar a 20 alertas
            'total_alerts': len(alerts)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/performance', methods=['GET'])
@jwt_required()
def get_performance_metrics():
    try:
        days = request.args.get('days', 7, type=int)
        since_date = datetime.utcnow() - timedelta(days=days)
        
        # Conteúdo criado por dia
        content_per_day = db.session.query(
            func.date(Content.created_at).label('date'),
            func.count(Content.id).label('count')
        ).filter(
            Content.created_at >= since_date
        ).group_by(func.date(Content.created_at)).all()
        
        # Campanhas criadas por dia
        campaigns_per_day = db.session.query(
            func.date(Campaign.created_at).label('date'),
            func.count(Campaign.id).label('count')
        ).filter(
            Campaign.created_at >= since_date
        ).group_by(func.date(Campaign.created_at)).all()
        
        # Players online por dia (baseado no último ping)
        players_online_per_day = db.session.query(
            func.date(Player.last_ping).label('date'),
            func.count(func.distinct(Player.id)).label('count')
        ).filter(
            Player.last_ping >= since_date
        ).group_by(func.date(Player.last_ping)).all()
        
        return jsonify({
            'content_per_day': [{'date': str(stat[0]), 'count': stat[1]} for stat in content_per_day],
            'campaigns_per_day': [{'date': str(stat[0]), 'count': stat[1]} for stat in campaigns_per_day],
            'players_online_per_day': [{'date': str(stat[0]), 'count': stat[1]} for stat in players_online_per_day]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/health', methods=['GET'])
@jwt_required()
def get_system_health():
    try:
        # Status do sistema
        total_players = Player.query.count()
        online_players = Player.query.filter(Player.is_online == True).count()
        
        # Calcular uptime dos players (% de players online)
        uptime_percentage = (online_players / total_players * 100) if total_players > 0 else 0
        
        # Status das editorias
        total_editorials = Editorial.query.filter(Editorial.is_active == True).count()
        error_editorials = Editorial.query.filter(
            Editorial.is_active == True,
            Editorial.last_error.isnot(None)
        ).count()
        
        editorial_health = ((total_editorials - error_editorials) / total_editorials * 100) if total_editorials > 0 else 100
        
        # Status geral do sistema
        overall_health = (uptime_percentage + editorial_health) / 2
        
        # Determinar status
        if overall_health >= 90:
            status = 'healthy'
        elif overall_health >= 70:
            status = 'warning'
        else:
            status = 'critical'
        
        return jsonify({
            'status': status,
            'overall_health': round(overall_health, 2),
            'metrics': {
                'player_uptime': round(uptime_percentage, 2),
                'editorial_health': round(editorial_health, 2),
                'online_players': online_players,
                'total_players': total_players,
                'error_editorials': error_editorials,
                'total_editorials': total_editorials
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
