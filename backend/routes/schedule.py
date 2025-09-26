from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, time
from models.schedule import Schedule, db
from models.campaign import Campaign
from models.player import Player
from models.user import User
from models.location import Location

schedule_bp = Blueprint('schedule', __name__)

# Brazilian datetime formatting/parsing helpers
BR_DATETIME_FORMAT = '%d/%m/%Y %H:%M:%S'


def fmt_br_datetime(dt):
    try:
        # Se dt for uma string, retorná-la diretamente
        if isinstance(dt, str):
            return dt
        # Se for um datetime, formatá-lo
        return dt.strftime(BR_DATETIME_FORMAT) if dt else None
    except Exception as e:
        print(f"[WARN] Erro ao formatar datetime: {dt} - {str(e)}")
        return str(dt) if dt else None


def parse_flexible_datetime(value, end_of_day=False):
    """Parses a datetime from either BR format (DD/MM/YYYY [HH:MM:SS]) or ISO.
    If only a date is provided (BR), sets time to 00:00:00 or 23:59:59 when end_of_day=True.
    """
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        s = value.strip()
        # BR format
        if '/' in s:
            # Has time component?
            if ' ' in s:
                try:
                    return datetime.strptime(s, BR_DATETIME_FORMAT)
                except Exception:
                    # Try without seconds (HH:MM)
                    try:
                        return datetime.strptime(s, '%d/%m/%Y %H:%M')
                    except Exception:
                        pass
            # Date-only
            try:
                d = datetime.strptime(s, '%d/%m/%Y')
                if end_of_day:
                    return d.replace(hour=23, minute=59, second=59)
                return d.replace(hour=0, minute=0, second=0)
            except Exception:
                pass
        # ISO fallback
        try:
            return datetime.fromisoformat(s.replace('Z', '+00:00'))
        except Exception:
            pass
    raise ValueError(f'Formato de data inválido: {value}')


def parse_flexible_time(value):
    """Parses time from 'HH:MM[:SS]' or from ISO datetime string."""
    if not value:
        return None
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        s = value.strip()
        if 'T' in s:
            # Extract time part
            s = s.replace('Z', '').split('T')[1]
            if '.' in s:
                s = s.split('.')[0]
        # Now s is expected HH:MM or HH:MM:SS
        try:
            return datetime.strptime(s, '%H:%M:%S').time()
        except ValueError:
            return datetime.strptime(s, '%H:%M').time()
    raise ValueError(f'Formato de horário inválido: {value}')


schedule_bp = Blueprint('schedule', __name__)

@schedule_bp.route('/', methods=['GET'])
@schedule_bp.route('', methods=['GET'])  # evita redirect 308 em /api/schedules
@jwt_required()
def list_schedules():
    try:
        print("[DEBUG] Iniciando list_schedules")
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        campaign_id = request.args.get('campaign_id')
        player_id = request.args.get('player_id')
        is_active = request.args.get('is_active')
        
        print(f"[DEBUG] Parâmetros: page={page}, per_page={per_page}, campaign_id={campaign_id}, player_id={player_id}, is_active={is_active}")
        
        user_id = get_jwt_identity()
        print(f"[DEBUG] JWT Identity: {user_id}")
        
        current_user = User.query.get(user_id)
        print(f"[DEBUG] User encontrado: {current_user is not None}")
        
        query = Schedule.query
        print("[DEBUG] Query base criada")
        
        if campaign_id:
            query = query.filter(Schedule.campaign_id == campaign_id)
            print(f"[DEBUG] Filtro por campaign_id: {campaign_id}")
        
        if player_id:
            query = query.filter(Schedule.player_id == player_id)
            print(f"[DEBUG] Filtro por player_id: {player_id}")
        
        if is_active is not None:
            query = query.filter(Schedule.is_active == (is_active.lower() == 'true'))
            print(f"[DEBUG] Filtro por is_active: {is_active}")
        
        # HR: restrict to schedules of players in their company
        if current_user and current_user.role == 'hr':
            print(f"[DEBUG] Aplicando filtro de company para HR: {current_user.company}")
            query = query.join(Player, Schedule.player_id == Player.id) \
                         .join(Location, Player.location_id == Location.id) \
                         .filter(Location.company == current_user.company)
        
        query = query.order_by(Schedule.created_at.desc())
        print("[DEBUG] Query ordenada")
        
        # Verificar se há schedules antes de paginar
        try:
            count = query.count()
            print(f"[DEBUG] Total de schedules encontrados: {count}")
        except Exception as count_error:
            print(f"[ERROR] Erro ao contar schedules: {count_error}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
        
        try:
            print("[DEBUG] Tentando paginar resultados")
            pagination = query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            print(f"[DEBUG] Paginação bem-sucedida: {pagination.total} itens, {pagination.pages} páginas")
            
            # Processar cada item individualmente para identificar problemas
            schedules_dict = []
            for i, schedule in enumerate(pagination.items):
                try:
                    print(f"[DEBUG] Processando schedule {i+1}/{len(pagination.items)}: {schedule.id}")
                    schedule_dict = schedule.to_dict()
                    schedules_dict.append(schedule_dict)
                    print(f"[DEBUG] Schedule {schedule.id} processado com sucesso")
                except Exception as item_error:
                    print(f"[ERROR] Erro ao processar schedule {schedule.id}: {item_error}")
                    import traceback
                    print(f"[ERROR] Traceback: {traceback.format_exc()}")
            
            return jsonify({
                'schedules': schedules_dict,
                'total': pagination.total,
                'pages': pagination.pages,
                'current_page': page,
                'per_page': per_page
            }), 200
            
        except Exception as pagination_error:
            print(f"[ERROR] Erro ao paginar: {pagination_error}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
            return jsonify({'error': f'Erro ao paginar: {str(pagination_error)}'}), 500
        
    except Exception as e:
        print(f"[ERROR] Erro em list_schedules: {e}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/', methods=['POST'])
@schedule_bp.route('', methods=['POST'])  # evita redirect 308 em /api/schedules
@jwt_required()
def create_schedule():
    try:
        print(f"[DEBUG] Schedule creation started")
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        print(f"[DEBUG] User: {user.username if user else 'None'}, Role: {user.role if user else 'None'}")
        
        if user.role not in ['admin', 'manager', 'hr']:
            return jsonify({'error': 'Apenas administradores, gerentes e RH podem criar agendamentos'}), 403
        
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
        
        # HR scoping: player must belong to user's company
        if user.role == 'hr':
            loc = Location.query.get(player.location_id)
            if not loc or loc.company != user.company:
                return jsonify({'error': 'RH só pode agendar para players da sua empresa'}), 403
        
        print(f"[DEBUG] Campaign: {campaign.name}, Player: {player.name}")
        
        # Converter datas (aceita BR e ISO). Para end_date, assumir fim do dia quando vier sem horário.
        try:
            start_date = parse_flexible_datetime(data['start_date'], end_of_day=False)
            end_date = parse_flexible_datetime(data['end_date'], end_of_day=True)
            print(f"[DEBUG] Dates converted - Start: {start_date}, End: {end_date}")
        except Exception as e:
            print(f"[DEBUG] Date conversion error: {e}")
            return jsonify({'error': f'Erro na conversão de datas: {str(e)}'}), 400
        
        if start_date >= end_date:
            return jsonify({'error': 'Data de início deve ser anterior à data de fim'}), 400
        
        # Converter horários se fornecidos (aceita HH:MM[:SS] e ISO)
        start_time = None
        end_time = None
        try:
            if data.get('start_time'):
                start_time = parse_flexible_time(data['start_time'])
            if data.get('end_time'):
                end_time = parse_flexible_time(data['end_time'])
        except Exception as e:
            print(f"[DEBUG] Time conversion error: {e}")
            return jsonify({'error': f'Erro na conversão de horários: {str(e)}'}), 400
        
        # Suporte a dia inteiro (24/7)
        is_all_day = bool(data.get('is_all_day', False))
        if is_all_day:
            start_time = time(0, 0, 0)
            end_time = time(23, 59, 59)
        else:
            # Garantir que horários estejam definidos (modelo não permite NULL)
            if start_time is None and end_time is None:
                # Default amigável: considerar 24/7
                start_time = time(0, 0, 0)
                end_time = time(23, 59, 59)
            elif start_time is None or end_time is None:
                return jsonify({'error': 'start_time e end_time são obrigatórios (ou marque Dia inteiro 24/7)'}), 400
        
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
            is_active=data.get('is_active', True),
            # CONFIGURAÇÕES UNIFICADAS DE REPRODUÇÃO
            playback_mode=data.get('playback_mode', 'sequential'),
            content_duration=data.get('content_duration', 10),
            transition_duration=data.get('transition_duration', 1),
            loop_behavior=data.get('loop_behavior', 'until_next'),
            loop_duration_minutes=data.get('loop_duration_minutes'),
            content_selection=data.get('content_selection', 'all'),
            shuffle_enabled=data.get('shuffle_enabled', False),
            auto_skip_errors=data.get('auto_skip_errors', True)
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
        current_user = User.query.get(get_jwt_identity())
        schedule = Schedule.query.get(schedule_id)
        
        if not schedule:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        if current_user and current_user.role == 'hr':
            player = Player.query.get(schedule.player_id)
            loc = Location.query.get(player.location_id) if player else None
            if not loc or loc.company != current_user.company:
                return jsonify({'error': 'Acesso negado a agendamento de outra empresa'}), 403
        
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
        
        if user.role not in ['admin', 'manager', 'hr']:
            return jsonify({'error': 'Sem permissão para editar agendamentos'}), 403
        
        # HR scoping: schedule's player must be in same company
        if user.role == 'hr':
            player = Player.query.get(schedule.player_id)
            loc = Location.query.get(player.location_id) if player else None
            if not loc or loc.company != user.company:
                return jsonify({'error': 'Acesso negado a agendamento de outra empresa'}), 403
        
        data = request.get_json()

        # Atualização de campanha e player (com validações)
        if 'campaign_id' in data and data['campaign_id']:
            new_campaign = Campaign.query.get(data['campaign_id'])
            if not new_campaign:
                return jsonify({'error': 'Campanha não encontrada'}), 404
            schedule.campaign_id = data['campaign_id']

        if 'player_id' in data and data['player_id']:
            new_player = Player.query.get(data['player_id'])
            if not new_player:
                return jsonify({'error': 'Player não encontrado'}), 404
            
            # HR scoping for new player
            if user.role == 'hr':
                loc = Location.query.get(new_player.location_id)
                if not loc or loc.company != user.company:
                    return jsonify({'error': 'RH só pode agendar para players da sua empresa'}), 403
            
            schedule.player_id = data['player_id']
        
        # ATUALIZAR CONFIGURAÇÕES UNIFICADAS DE REPRODUÇÃO
        if 'playback_mode' in data:
            schedule.playback_mode = data['playback_mode']
        if 'content_duration' in data:
            schedule.content_duration = int(data['content_duration']) if data['content_duration'] else 10
        if 'transition_duration' in data:
            schedule.transition_duration = int(data['transition_duration']) if data['transition_duration'] else 1
        if 'loop_behavior' in data:
            schedule.loop_behavior = data['loop_behavior']
        if 'loop_duration_minutes' in data:
            schedule.loop_duration_minutes = int(data['loop_duration_minutes']) if data['loop_duration_minutes'] else None
        if 'content_selection' in data:
            schedule.content_selection = data['content_selection']
        if 'shuffle_enabled' in data:
            schedule.shuffle_enabled = bool(data['shuffle_enabled'])
        if 'auto_skip_errors' in data:
            schedule.auto_skip_errors = bool(data['auto_skip_errors'])
        
        if 'name' in data:
            schedule.name = data['name']
        
        if 'start_date' in data and data['start_date']:
            schedule.start_date = parse_flexible_datetime(data['start_date'], end_of_day=False)
        
        if 'end_date' in data and data['end_date']:
            schedule.end_date = parse_flexible_datetime(data['end_date'], end_of_day=True)
        
        if 'start_time' in data:
            if data['start_time'] is not None and data['start_time'] != '':
                try:
                    schedule.start_time = parse_flexible_time(data['start_time'])
                except Exception as e:
                    return jsonify({'error': f'Erro na conversão de horários (start_time): {str(e)}'}), 400
        
        if 'end_time' in data:
            if data['end_time'] is not None and data['end_time'] != '':
                try:
                    schedule.end_time = parse_flexible_time(data['end_time'])
                except Exception as e:
                    return jsonify({'error': f'Erro na conversão de horários (end_time): {str(e)}'}), 400
        
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
        
        # Suporte a dia inteiro (24/7) em update
        if 'is_all_day' in data:
            if bool(data['is_all_day']):
                schedule.start_time = time(0, 0, 0)
                schedule.end_time = time(23, 59, 59)
            else:
                # Se remover is_all_day, garantir que horários estejam definidos
                if schedule.start_time is None or schedule.end_time is None:
                    return jsonify({'error': 'Defina start_time e end_time ao desmarcar Dia inteiro (24/7)'}), 400
        
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
        
        if user.role not in ['admin', 'manager', 'hr']:
            return jsonify({'error': 'Sem permissão para deletar agendamentos'}), 403
        
        # HR scoping
        if user.role == 'hr':
            player = Player.query.get(schedule.player_id)
            loc = Location.query.get(player.location_id) if player else None
            if not loc or loc.company != user.company:
                return jsonify({'error': 'Acesso negado a agendamento de outra empresa'}), 403
        
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
        now = datetime.now()  # usar horário local para consistência
        # Buscar agendamentos do player cujo período de datas engloba o now
        schedules = Schedule.query.filter(
            Schedule.player_id == player_id,
            Schedule.is_active == True,
            Schedule.start_date <= now,
            Schedule.end_date >= now
        ).all()
        
        # Delegar a lógica de horário/dia para o model (is_active_now)
        active_schedules = [s.to_dict() for s in schedules if s.is_active_now()]
        
        return jsonify({
            'schedules': active_schedules,
            'player_id': player_id,
            'current_time': fmt_br_datetime(now)
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
        
        current_user = User.query.get(get_jwt_identity())
        
        query = Schedule.query.filter(Schedule.campaign_id == campaign_id)
        
        if is_active is not None:
            query = query.filter(Schedule.is_active == (is_active.lower() == 'true'))
        
        if current_user and current_user.role == 'hr':
            query = query.join(Player, Schedule.player_id == Player.id) \
                         .join(Location, Player.location_id == Location.id) \
                         .filter(Location.company == current_user.company)
        
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
        
        current_user = User.query.get(get_jwt_identity())
        
        player_id = data.get('player_id')
        campaign_id = data.get('campaign_id')
        start_date = parse_flexible_datetime(data['start_date'], end_of_day=False)
        end_date = parse_flexible_datetime(data['end_date'], end_of_day=True)
        
        # HR scoping: ensure player belongs to user's company
        if current_user and current_user.role == 'hr':
            player = Player.query.get(player_id)
            loc = Location.query.get(player.location_id) if player else None
            if not loc or loc.company != current_user.company:
                return jsonify({'error': 'Acesso negado a players de outra empresa'}), 403
        
        start_time = None
        end_time = None
        
        try:
            if data.get('start_time'):
                start_time = parse_flexible_time(data['start_time'])
            if data.get('end_time'):
                end_time = parse_flexible_time(data['end_time'])
        except Exception as e:
            print(f"[DEBUG] Time conversion error: {e}")
            return jsonify({'error': f'Erro na conversão de horários: {str(e)}'}), 400
        
        # Suporte a dia inteiro (24/7) em verificação de conflitos
        if bool(data.get('is_all_day', False)):
            start_time = time(0, 0, 0)
            end_time = time(23, 59, 59)
        
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
                # Considera overnight nos dois intervalos
                def overlaps(a_start, a_end, b_start, b_end):
                    if a_start <= a_end and b_start <= b_end:
                        return a_start < b_end and a_end > b_start
                    if a_start > a_end and b_start <= b_end:
                        return a_start <= b_end or a_end >= b_start
                    if a_start <= a_end and b_start > b_end:
                        return b_start <= a_end or b_end >= a_start
                    # ambos overnight
                    return True
                if not overlaps(start_time, end_time, schedule.start_time, schedule.end_time):
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
        
        if user.role not in ['admin', 'manager', 'hr']:
            return jsonify({'error': 'Sem permissão para executar agendamentos'}), 403
        
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        # HR scoping
        if user.role == 'hr':
            player = Player.query.get(schedule.player_id)
            loc = Location.query.get(player.location_id) if player else None
            if not loc or loc.company != user.company:
                return jsonify({'error': 'Acesso negado a agendamento de outra empresa'}), 403
        
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
