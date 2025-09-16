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
        print(f"[DEBUG] Schedule creation started")
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        print(f"[DEBUG] User: {user.username if user else 'None'}, Role: {user.role if user else 'None'}")
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Apenas administradores e gerentes podem criar agendamentos'}), 403
        
        data = request.get_json()
        print(f"[DEBUG] Received data: {data}")
        
        required_fields = ['name', 'campaign_id', 'player_id', 'start_date', 'end_date']
        for field in required_fields:
            if not data.get(field):
                print(f"[DEBUG] Missing required field: {field}")
                return jsonify({'error': f'{field} é obrigatório'}), 400
        
        # Verificar se campanha e player existem
        campaign = Campaign.query.get(data['campaign_id'])
        if not campaign:
            print(f"[DEBUG] Campaign not found: {data['campaign_id']}")
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        player = Player.query.get(data['player_id'])
        if not player:
            print(f"[DEBUG] Player not found: {data['player_id']}")
            return jsonify({'error': 'Player não encontrado'}), 404
        
        print(f"[DEBUG] Campaign: {campaign.name}, Player: {player.name}")
        
        # Converter datas
        try:
            start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
            print(f"[DEBUG] Dates converted - Start: {start_date}, End: {end_date}")
        except Exception as e:
            print(f"[DEBUG] Date conversion error: {e}")
            return jsonify({'error': f'Erro na conversão de datas: {str(e)}'}), 400
        
        if start_date >= end_date:
            return jsonify({'error': 'Data de início deve ser anterior à data de fim'}), 400
        
        # Converter horários se fornecidos
        start_time = None
        end_time = None
        
        try:
            if data.get('start_time'):
                time_str = data['start_time']
                print(f"[DEBUG] Original start_time string: {time_str}")
                # Handle both datetime format and time format
                if 'T' in time_str:
                    # Extract time from datetime string without timezone conversion
                    # Parse the datetime string and extract only the time part
                    dt_str = time_str.replace('Z', '').split('T')[1]  # Get time part only
                    print(f"[DEBUG] Extracted time part: {dt_str}")
                    if '.' in dt_str:
                        dt_str = dt_str.split('.')[0]  # Remove milliseconds
                        print(f"[DEBUG] After removing milliseconds: {dt_str}")
                    start_time = datetime.strptime(dt_str, '%H:%M:%S').time()
                else:
                    # Handle direct time format (e.g., '15:45')
                    start_time = datetime.strptime(time_str, '%H:%M').time()
                print(f"[DEBUG] Final start_time object: {start_time}")
            
            if data.get('end_time'):
                time_str = data['end_time']
                print(f"[DEBUG] Original end_time string: {time_str}")
                # Handle both datetime format and time format
                if 'T' in time_str:
                    # Extract time from datetime string without timezone conversion
                    # Parse the datetime string and extract only the time part
                    dt_str = time_str.replace('Z', '').split('T')[1]  # Get time part only
                    print(f"[DEBUG] Extracted time part: {dt_str}")
                    if '.' in dt_str:
                        dt_str = dt_str.split('.')[0]  # Remove milliseconds
                        print(f"[DEBUG] After removing milliseconds: {dt_str}")
                    end_time = datetime.strptime(dt_str, '%H:%M:%S').time()
                else:
                    # Handle direct time format (e.g., '03:00')
                    end_time = datetime.strptime(time_str, '%H:%M').time()
                print(f"[DEBUG] Final end_time object: {end_time}")
        except Exception as e:
            print(f"[DEBUG] Time conversion error: {e}")
            return jsonify({'error': f'Erro na conversão de horários: {str(e)}'}), 400
        
        print(f"[DEBUG] Creating schedule object...")
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
        
        print(f"[DEBUG] Schedule object created, adding to session...")
        db.session.add(schedule)
        
        print(f"[DEBUG] Committing to database...")
        db.session.commit()
        
        print(f"[DEBUG] Schedule created successfully: {schedule.id}")
        return jsonify({
            'message': 'Agendamento criado com sucesso',
            'schedule': schedule.to_dict()
        }), 201
        
    except Exception as e:
        print(f"[DEBUG] Exception in create_schedule: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
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
                time_str = data['start_time']
                # Handle both datetime format and time format
                if 'T' in time_str:
                    # Extract time from datetime string
                    dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                    schedule.start_time = dt.time()
                else:
                    # Handle direct time format
                    schedule.start_time = datetime.strptime(time_str, '%H:%M').time()
            else:
                schedule.start_time = None
        
        if 'end_time' in data:
            if data['end_time']:
                time_str = data['end_time']
                # Handle both datetime format and time format
                if 'T' in time_str:
                    # Extract time from datetime string
                    dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                    schedule.end_time = dt.time()
                else:
                    # Handle direct time format
                    schedule.end_time = datetime.strptime(time_str, '%H:%M').time()
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
        print(f"[DEBUG] Conflict detection started")
        data = request.get_json()
        print(f"[DEBUG] Received data: {data}")
        
        player_id = data.get('player_id')
        campaign_id = data.get('campaign_id')
        start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        start_time = None
        end_time = None
        
        try:
            if data.get('start_time'):
                time_str = data['start_time']
                print(f"[DEBUG] Original start_time string: {time_str}")
                # Handle both datetime format and time format
                if 'T' in time_str:
                    # Extract time from datetime string without timezone conversion
                    # Parse the datetime string and extract only the time part
                    dt_str = time_str.replace('Z', '').split('T')[1]  # Get time part only
                    print(f"[DEBUG] Extracted time part: {dt_str}")
                    if '.' in dt_str:
                        dt_str = dt_str.split('.')[0]  # Remove milliseconds
                        print(f"[DEBUG] After removing milliseconds: {dt_str}")
                    start_time = datetime.strptime(dt_str, '%H:%M:%S').time()
                else:
                    # Handle direct time format
                    start_time = datetime.strptime(time_str, '%H:%M').time()
                print(f"[DEBUG] Final start_time object: {start_time}")
        
            if data.get('end_time'):
                time_str = data['end_time']
                print(f"[DEBUG] Original end_time string: {time_str}")
                # Handle both datetime format and time format
                if 'T' in time_str:
                    # Extract time from datetime string without timezone conversion
                    # Parse the datetime string and extract only the time part
                    dt_str = time_str.replace('Z', '').split('T')[1]  # Get time part only
                    print(f"[DEBUG] Extracted time part: {dt_str}")
                    if '.' in dt_str:
                        dt_str = dt_str.split('.')[0]  # Remove milliseconds
                        print(f"[DEBUG] After removing milliseconds: {dt_str}")
                    end_time = datetime.strptime(dt_str, '%H:%M:%S').time()
                else:
                    # Handle direct time format
                    end_time = datetime.strptime(time_str, '%H:%M').time()
                print(f"[DEBUG] Final end_time object: {end_time}")
        except Exception as e:
            print(f"[DEBUG] Time conversion error: {e}")
            return jsonify({'error': f'Erro na conversão de horários: {str(e)}'}), 400
        
        days_of_week = data.get('days_of_week', '1,2,3,4,5')
        exclude_schedule_id = data.get('exclude_schedule_id')
        
        # Determinar tipo de conteúdo do novo agendamento
        new_content_type = _get_schedule_content_type(campaign_id)
        print(f"[DEBUG] New content type: {new_content_type}")
        
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
        print(f"[DEBUG] Existing schedules: {[schedule.id for schedule in existing_schedules]}")
        
        conflicts = []
        
        for schedule in existing_schedules:
            # Determinar tipo de conteúdo do agendamento existente
            existing_content_type = _get_schedule_content_type(schedule.campaign_id)
            print(f"[DEBUG] Existing content type: {existing_content_type}")
            
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
        
        print(f"[DEBUG] Conflicts found: {[conflict['id'] for conflict in conflicts]}")
        return jsonify({
            'has_conflicts': len(conflicts) > 0,
            'conflicts': conflicts
        }), 200
        
    except Exception as e:
        print(f"[DEBUG] Exception in check_schedule_conflicts: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
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
