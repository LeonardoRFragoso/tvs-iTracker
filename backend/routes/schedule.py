from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, time
from models.schedule import Schedule, db
from models.campaign import Campaign
from models.player import Player
from models.user import User

schedule_bp = Blueprint('schedule', __name__)

@schedule_bp.route('/', methods=['GET'])
@jwt_required()
def list_schedules():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        campaign_id = request.args.get('campaign_id')
        player_id = request.args.get('player_id')
        is_active = request.args.get('is_active')
        
        query = Schedule.query
        
        if campaign_id:
            query = query.filter(Schedule.campaign_id == campaign_id)
        
        if player_id:
            query = query.filter(Schedule.player_id == player_id)
        
        if is_active is not None:
            query = query.filter(Schedule.is_active == (is_active.lower() == 'true'))
        
        query = query.order_by(Schedule.created_at.desc())
        
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'schedules': [schedule.to_dict() for schedule in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/', methods=['POST'])
@jwt_required()
def create_schedule():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Apenas administradores e gerentes podem criar agendamentos'}), 403
        
        data = request.get_json()
        
        required_fields = ['name', 'campaign_id', 'player_id', 'start_date', 'end_date']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} é obrigatório'}), 400
        
        # Verificar se campanha e player existem
        campaign = Campaign.query.get(data['campaign_id'])
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        player = Player.query.get(data['player_id'])
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        # Converter datas
        start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        if start_date >= end_date:
            return jsonify({'error': 'Data de início deve ser anterior à data de fim'}), 400
        
        # Converter horários se fornecidos
        start_time = None
        end_time = None
        
        if data.get('start_time'):
            start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        
        if data.get('end_time'):
            end_time = datetime.strptime(data['end_time'], '%H:%M').time()
        
        schedule = Schedule(
            name=data['name'],
            campaign_id=data['campaign_id'],
            player_id=data['player_id'],
            start_date=start_date,
            end_date=end_date,
            start_time=start_time,
            end_time=end_time,
            days_of_week=data.get('days_of_week', '1,2,3,4,5'),
            repeat_type=data.get('repeat_type', 'daily'),
            repeat_interval=data.get('repeat_interval', 1),
            priority=data.get('priority', 1),
            is_persistent=data.get('is_persistent', False),
            content_type=data.get('content_type', 'main'),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(schedule)
        db.session.commit()
        
        return jsonify({
            'message': 'Agendamento criado com sucesso',
            'schedule': schedule.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/<schedule_id>', methods=['GET'])
@jwt_required()
def get_schedule(schedule_id):
    try:
        schedule = Schedule.query.get(schedule_id)
        
        if not schedule:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        return jsonify({'schedule': schedule.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/<schedule_id>', methods=['PUT'])
@jwt_required()
def update_schedule(schedule_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        schedule = Schedule.query.get(schedule_id)
        
        if not schedule:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar agendamentos'}), 403
        
        data = request.get_json()
        
        if 'name' in data:
            schedule.name = data['name']
        
        if 'start_date' in data:
            schedule.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        
        if 'end_date' in data:
            schedule.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        if 'start_time' in data:
            if data['start_time']:
                schedule.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
            else:
                schedule.start_time = None
        
        if 'end_time' in data:
            if data['end_time']:
                schedule.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
            else:
                schedule.end_time = None
        
        if 'days_of_week' in data:
            schedule.days_of_week = data['days_of_week']
        
        if 'repeat_type' in data:
            schedule.repeat_type = data['repeat_type']
        
        if 'repeat_interval' in data:
            schedule.repeat_interval = data['repeat_interval']
        
        if 'priority' in data:
            schedule.priority = data['priority']
        
        if 'is_persistent' in data:
            schedule.is_persistent = data['is_persistent']
        
        if 'content_type' in data:
            schedule.content_type = data['content_type']
        
        if 'is_active' in data:
            schedule.is_active = data['is_active']
        
        schedule.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Agendamento atualizado com sucesso',
            'schedule': schedule.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/<schedule_id>', methods=['DELETE'])
@jwt_required()
def delete_schedule(schedule_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        schedule = Schedule.query.get(schedule_id)
        
        if not schedule:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para deletar agendamentos'}), 403
        
        db.session.delete(schedule)
        db.session.commit()
        
        return jsonify({'message': 'Agendamento deletado com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/player/<player_id>/active', methods=['GET'])
def get_active_schedules_for_player(player_id):
    """Obter agendamentos ativos para um player específico"""
    try:
        now = datetime.utcnow()
        current_time = now.time()
        current_weekday = now.weekday() + 1  # 1=segunda, 7=domingo
        
        # Buscar agendamentos ativos para o player
        schedules = Schedule.query.filter(
            Schedule.player_id == player_id,
            Schedule.is_active == True,
            Schedule.start_date <= now,
            Schedule.end_date >= now
        ).all()
        
        active_schedules = []
        
        for schedule in schedules:
            # Verificar dia da semana
            days_of_week = [int(d) for d in schedule.days_of_week.split(',') if d.strip()]
            if current_weekday not in days_of_week:
                continue
            
            # Verificar horário se definido
            if schedule.start_time and schedule.end_time:
                if not (schedule.start_time <= current_time <= schedule.end_time):
                    continue
            
            active_schedules.append(schedule.to_dict())
        
        return jsonify({
            'schedules': active_schedules,
            'player_id': player_id,
            'current_time': now.isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/campaign/<campaign_id>', methods=['GET'])
@jwt_required()
def get_schedules_by_campaign(campaign_id):
    """Obter agendamentos para uma campanha específica"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_active = request.args.get('is_active')
        
        query = Schedule.query.filter(Schedule.campaign_id == campaign_id)
        
        if is_active is not None:
            query = query.filter(Schedule.is_active == (is_active.lower() == 'true'))
        
        query = query.order_by(Schedule.created_at.desc())
        
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'schedules': [schedule.to_dict() for schedule in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page,
            'campaign_id': campaign_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/conflicts', methods=['POST'])
@jwt_required()
def check_schedule_conflicts():
    """Verificar conflitos de agendamento"""
    try:
        data = request.get_json()
        player_id = data.get('player_id')
        campaign_id = data.get('campaign_id')
        start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        start_time = None
        end_time = None
        
        if data.get('start_time'):
            start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        
        if data.get('end_time'):
            end_time = datetime.strptime(data['end_time'], '%H:%M').time()
        
        days_of_week = data.get('days_of_week', '1,2,3,4,5')
        exclude_schedule_id = data.get('exclude_schedule_id')
        
        # Determinar tipo de conteúdo do novo agendamento
        new_content_type = _get_schedule_content_type(campaign_id)
        
        # Buscar agendamentos que podem conflitar
        query = Schedule.query.filter(
            Schedule.player_id == player_id,
            Schedule.is_active == True,
            Schedule.start_date <= end_date,
            Schedule.end_date >= start_date
        )
        
        if exclude_schedule_id:
            query = query.filter(Schedule.id != exclude_schedule_id)
        
        existing_schedules = query.all()
        
        conflicts = []
        
        for schedule in existing_schedules:
            # Determinar tipo de conteúdo do agendamento existente
            existing_content_type = _get_schedule_content_type(schedule.campaign_id)
            
            # Se são tipos diferentes (overlay + main), não há conflito
            if new_content_type != existing_content_type:
                continue
            
            # Verificar sobreposição de dias da semana
            existing_days = set(int(d) for d in schedule.days_of_week.split(',') if d.strip())
            new_days = set(int(d) for d in days_of_week.split(',') if d.strip())
            
            if not existing_days.intersection(new_days):
                continue
            
            # Verificar sobreposição de horários
            if start_time and end_time and schedule.start_time and schedule.end_time:
                if not (start_time < schedule.end_time and end_time > schedule.start_time):
                    continue
            
            conflicts.append(schedule.to_dict())
        
        return jsonify({
            'has_conflicts': len(conflicts) > 0,
            'conflicts': conflicts
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _get_schedule_content_type(campaign_id):
    """Determina o tipo de conteúdo de um agendamento baseado na campanha"""
    try:
        from models.campaign import Campaign, CampaignContent
        from models.content import Content
        
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return 'main'
        
        # Buscar primeiro conteúdo da campanha para determinar tipo
        campaign_content = CampaignContent.query.filter_by(
            campaign_id=campaign.id
        ).order_by(CampaignContent.order_index).first()
        
        if campaign_content:
            content = Content.query.get(campaign_content.content_id)
            if content:
                # Considerar imagens como overlay se o nome contém "logo" ou se é do tipo image
                if ('logo' in content.title.lower() or 
                    'overlay' in content.title.lower() or 
                    content.content_type == 'image'):
                    return 'overlay'
        
        return 'main'
    except Exception as e:
        print(f"[ERROR] Erro ao determinar tipo de conteúdo: {e}")
        return 'main'

@schedule_bp.route('/<schedule_id>/execute', methods=['POST'])
@jwt_required()
def force_execute_schedule(schedule_id):
    """Força execução imediata de um agendamento para teste"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para executar agendamentos'}), 403
        
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        # Importar executor
        from services.schedule_executor import schedule_executor
        
        # Forçar execução
        success = schedule_executor.force_execute_schedule(schedule_id)
        
        if success:
            return jsonify({
                'message': 'Agendamento executado com sucesso',
                'schedule_id': schedule_id
            }), 200
        else:
            return jsonify({'error': 'Falha ao executar agendamento'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
