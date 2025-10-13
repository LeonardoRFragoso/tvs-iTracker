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

def _detect_schedule_conflicts(target_schedule, all_schedules):
    """Detecta conflitos de horário entre agendamentos do mesmo player"""
    if not target_schedule.player_id or not target_schedule.start_date or not target_schedule.end_date:
        return False
        
    # Buscar outros agendamentos ativos do mesmo player no mesmo período
    conflicting_schedules = [
        s for s in all_schedules 
        if (s.id != target_schedule.id and 
            s.player_id == target_schedule.player_id and 
            s.is_active == True and
            s.start_date <= target_schedule.end_date and
            s.end_date >= target_schedule.start_date)
    ]
    
    if not conflicting_schedules:
        return False
        
    # Verificar conflitos de horário e dias da semana
    target_days = set(map(int, target_schedule.days_of_week.split(','))) if target_schedule.days_of_week else set()
    
    for other_schedule in conflicting_schedules:
        other_days = set(map(int, other_schedule.days_of_week.split(','))) if other_schedule.days_of_week else set()
        
        # Se há dias em comum
        if target_days.intersection(other_days):
            # Verificar conflito de horário
            if _has_time_conflict(target_schedule, other_schedule):
                return True
                
    return False

def _has_time_conflict(schedule1, schedule2):
    """Verifica se há conflito de horário entre dois agendamentos"""
    # Verificar se os horários são válidos
    if not schedule1.start_time or not schedule1.end_time or not schedule2.start_time or not schedule2.end_time:
        return False
        
    # Converter horários para minutos para facilitar comparação
    s1_start_min = schedule1.start_time.hour * 60 + schedule1.start_time.minute
    s1_end_min = schedule1.end_time.hour * 60 + schedule1.end_time.minute
    s2_start_min = schedule2.start_time.hour * 60 + schedule2.start_time.minute
    s2_end_min = schedule2.end_time.hour * 60 + schedule2.end_time.minute
    
    # Verificar se são dia inteiro
    schedule1_all_day = (s1_start_min == 0 and s1_end_min == 1439)  # 23:59 = 1439 minutos
    schedule2_all_day = (s2_start_min == 0 and s2_end_min == 1439)
    
    # Se ambos são dia inteiro, há conflito
    if schedule1_all_day and schedule2_all_day:
        return True
        
    # Se um é dia inteiro e o outro não, há conflito
    if schedule1_all_day or schedule2_all_day:
        return True
        
    # Verificar sobreposição de horários específicos
    # Dois intervalos se sobrepõem se: start1 < end2 AND start2 < end1
    return s1_start_min < s2_end_min and s2_start_min < s1_end_min

def _determine_conflict_type(target_schedule, all_schedules):
    """Determina o tipo de conflito para cores inteligentes no calendário"""
    # Se é overlay, sempre mostrar como overlay (roxo)
    if target_schedule.content_type == 'overlay':
        return 'overlay'
    
    # Buscar outros agendamentos ativos do mesmo player no mesmo período
    conflicting_schedules = [
        s for s in all_schedules 
        if (s.id != target_schedule.id and 
            s.player_id == target_schedule.player_id and 
            s.is_active == True and
            s.start_date <= target_schedule.end_date and
            s.end_date >= target_schedule.start_date)
    ]
    
    if not conflicting_schedules:
        return 'normal'
    
    # Verificar conflitos de horário e dias da semana
    target_days = set(map(int, target_schedule.days_of_week.split(','))) if target_schedule.days_of_week else set()
    
    # Contar tipos de conflitos
    overlay_conflicts = 0
    main_conflicts = 0
    
    for other_schedule in conflicting_schedules:
        other_days = set(map(int, other_schedule.days_of_week.split(','))) if other_schedule.days_of_week else set()
        
        # Se há dias em comum
        if target_days.intersection(other_days):
            # Verificar conflito de horário
            if _has_time_conflict(target_schedule, other_schedule):
                if other_schedule.content_type == 'overlay':
                    overlay_conflicts += 1
                else:
                    main_conflicts += 1
    
    # Determinar tipo baseado nos conflitos encontrados
    if overlay_conflicts > 0 and main_conflicts == 0:
        # Conflito apenas com overlays - não é problema crítico
        return 'normal'
    elif main_conflicts > 0:
        # Conflito com outros agendamentos principais - problema crítico
        return 'conflict'
    else:
        return 'normal'

def _determine_overlap_priority(target_schedule, all_schedules):
    """Determina a prioridade visual de um agendamento em caso de sobreposição"""
    # Se é overlay, sempre tem prioridade alta (fica por cima)
    if target_schedule.content_type == 'overlay':
        return 'overlay'
    
    # Buscar outros agendamentos ativos do mesmo player no mesmo período
    overlapping_schedules = [
        s for s in all_schedules 
        if (s.id != target_schedule.id and 
            s.player_id == target_schedule.player_id and 
            s.is_active == True and
            s.start_date <= target_schedule.end_date and
            s.end_date >= target_schedule.start_date)
    ]
    
    if not overlapping_schedules:
        return 'normal'
    
    # Verificar sobreposições de horário e dias da semana
    target_days = set(map(int, target_schedule.days_of_week.split(','))) if target_schedule.days_of_week else set()
    
    # Encontrar agendamentos que se sobrepõem temporalmente
    overlapping_main_schedules = []
    for other_schedule in overlapping_schedules:
        other_days = set(map(int, other_schedule.days_of_week.split(','))) if other_schedule.days_of_week else set()
        
        # Se há dias em comum
        if target_days.intersection(other_days):
            # Verificar conflito de horário
            if _has_time_conflict(target_schedule, other_schedule):
                if other_schedule.content_type == 'main':
                    overlapping_main_schedules.append(other_schedule)
    
    if not overlapping_main_schedules:
        return 'normal'
    
    # Determinar prioridade baseada na ordem de criação
    # Agendamentos mais recentes ficam "por cima" (cores mais vibrantes)
    target_created_at = target_schedule.created_at if target_schedule.created_at else target_schedule.id
    
    # Verificar se este agendamento é o mais recente entre os sobrepostos
    is_most_recent = True
    for other_schedule in overlapping_main_schedules:
        other_created_at = other_schedule.created_at if other_schedule.created_at else other_schedule.id
        if other_created_at > target_created_at:
            is_most_recent = False
            break
    
    if is_most_recent:
        return 'overlap_top'  # Agendamento mais recente - cor mais vibrante
    else:
        return 'overlap_bottom'  # Agendamento mais antigo - cor mais suave

def _assign_overlap_color_index(target_schedule, all_schedules):
    """
    Atribui um índice de cor único para schedules que se sobrepõem.
    Garante que schedules sobrepostos tenham cores diferentes.
    Retorna um inteiro que pode ser usado como índice de cor (0-7).
    """
    # Buscar outros agendamentos ativos do mesmo player no mesmo período
    overlapping_schedules = [
        s for s in all_schedules 
        if (s.id != target_schedule.id and 
            s.player_id == target_schedule.player_id and 
            s.is_active == True and
            s.start_date <= target_schedule.end_date and
            s.end_date >= target_schedule.start_date)
    ]
    
    if not overlapping_schedules:
        return 0  # Sem sobreposição, cor padrão
    
    # Verificar sobreposições de horário e dias da semana
    target_days = set(map(int, target_schedule.days_of_week.split(','))) if target_schedule.days_of_week else set()
    
    # Encontrar agendamentos que se sobrepõem temporalmente
    truly_overlapping = []
    for other_schedule in overlapping_schedules:
        other_days = set(map(int, other_schedule.days_of_week.split(','))) if other_schedule.days_of_week else set()
        
        # Se há dias em comum
        if target_days.intersection(other_days):
            # Verificar conflito de horário
            if _has_time_conflict(target_schedule, other_schedule):
                truly_overlapping.append(other_schedule)
    
    if not truly_overlapping:
        return 0  # Sem sobreposição real, cor padrão
    
    # Ordenar schedules por ID para consistência
    all_overlapping = [target_schedule] + truly_overlapping
    all_overlapping.sort(key=lambda s: s.id)
    
    # Encontrar o índice do schedule atual na lista ordenada
    # Isso garante que cada schedule sobreposto tenha uma cor diferente
    for idx, schedule in enumerate(all_overlapping):
        if schedule.id == target_schedule.id:
            # Retornar índice mod 8 (temos 8 cores disponíveis)
            return (idx + 1) % 8
    
    return 0


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
        
        # RH: restrict to schedules of players in their company
        if current_user and current_user.role == 'rh':
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
        
        if user.role not in ['admin', 'manager', 'rh']:
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
        
        # RH scoping: player must belong to user's company
        if user.role == 'rh':
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
            # Política da aplicação: sem embaralhar e sempre pular conteúdos com erro
            shuffle_enabled=False,
            auto_skip_errors=True
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


@schedule_bp.route('/bulk', methods=['POST'])
@jwt_required()
def create_schedules_bulk():
    """Cria agendamentos em massa para todos os players de uma empresa (location)
    ou para uma lista específica de players.

    Body esperado:
    {
      name, campaign_id, start_date, end_date, start_time?, end_time?, is_all_day?,
      days_of_week?, repeat_type?, repeat_interval?, priority?, is_persistent?,
      content_type?, is_active?, playback_mode?, content_duration?, transition_duration?,
      loop_behavior?, loop_duration_minutes?, content_selection?,
      location_id? (opcional) OU player_ids? (array),
      check_conflicts?: bool (default false)
    }
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user or user.role not in ['admin', 'manager', 'rh']:
            return jsonify({'error': 'Apenas administradores, gerentes e RH podem criar agendamentos'}), 403

        data = request.get_json() or {}

        # Campos obrigatórios comuns
        required_fields = ['name', 'campaign_id', 'start_date', 'end_date']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} é obrigatório'}), 400

        # Precisamos de uma fonte de players: location_id OU player_ids
        location_id = data.get('location_id')
        player_ids = data.get('player_ids') or []
        if not location_id and not player_ids:
            return jsonify({'error': 'Informe location_id ou player_ids'}), 400

        # Validar campanha
        campaign = Campaign.query.get(data['campaign_id'])
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404

        # Resolver lista de players alvo
        target_players = []
        if location_id:
            location = Location.query.get(location_id)
            if not location:
                return jsonify({'error': 'Empresa (location) não encontrada'}), 404
            # Escopo RH: empresa deve ser a mesma
            if user.role == 'rh' and location.company != user.company:
                return jsonify({'error': 'RH só pode agendar para sua empresa'}), 403
            target_players = [p for p in location.players if p and p.is_active]
        else:
            # Buscar players por IDs explicitados
            target_players = Player.query.filter(Player.id.in_(player_ids)).all()
            if not target_players:
                return jsonify({'error': 'Nenhum player encontrado pelos IDs informados'}), 404
            # Escopo RH: todos devem pertencer à mesma empresa do RH
            if user.role == 'rh':
                for p in target_players:
                    loc = Location.query.get(p.location_id) if p else None
                    if not loc or loc.company != user.company:
                        return jsonify({'error': 'RH só pode agendar para players da sua empresa'}), 403

        # Converter datas/horários
        try:
            start_date = parse_flexible_datetime(data['start_date'], end_of_day=False)
            end_date = parse_flexible_datetime(data['end_date'], end_of_day=True)
        except Exception as e:
            return jsonify({'error': f'Erro na conversão de datas: {str(e)}'}), 400

        if start_date >= end_date:
            return jsonify({'error': 'Data de início deve ser anterior à data de fim'}), 400

        try:
            start_time = parse_flexible_time(data.get('start_time')) if data.get('start_time') else None
            end_time = parse_flexible_time(data.get('end_time')) if data.get('end_time') else None
        except Exception as e:
            return jsonify({'error': f'Erro na conversão de horários: {str(e)}'}), 400

        is_all_day = bool(data.get('is_all_day', False))
        if is_all_day:
            start_time = time(0, 0, 0)
            end_time = time(23, 59, 59)
        else:
            if start_time is None and end_time is None:
                start_time = time(0, 0, 0)
                end_time = time(23, 59, 59)
            elif start_time is None or end_time is None:
                return jsonify({'error': 'start_time e end_time são obrigatórios (ou marque Dia inteiro 24/7)'}), 400

        days_of_week = data.get('days_of_week', '1,2,3,4,5')
        check_conflicts = bool(data.get('check_conflicts', False))

        # Função utilitária local para checar conflito com lógica alinhada ao endpoint /conflicts
        def has_conflict_for_player(player_id):
            new_content_type = _get_schedule_content_type(campaign.id)
            query = Schedule.query.filter(
                Schedule.player_id == player_id,
                Schedule.is_active == True,
                Schedule.start_date <= end_date,
                Schedule.end_date >= start_date
            )
            existing = query.all()
            # Sobreposição de horários (com overnight)
            def overlaps(a_start, a_end, b_start, b_end):
                if a_start <= a_end and b_start <= b_end:
                    return a_start < b_end and a_end > b_start
                if a_start > a_end and b_start <= b_end:
                    return a_start <= b_end or a_end >= b_start
                if a_start <= a_end and b_start > b_end:
                    return b_start <= a_end or b_end >= a_start
                return True
            for sch in existing:
                existing_content_type = _get_schedule_content_type(sch.campaign_id)
                if existing_content_type != new_content_type:
                    continue
                existing_days = set(int(d) for d in sch.days_of_week.split(',') if d.strip()) if sch.days_of_week else set()
                new_days = set(int(d) for d in days_of_week.split(',') if d.strip()) if days_of_week else set()
                if existing_days and new_days and not existing_days.intersection(new_days):
                    continue
                if sch.start_time and sch.end_time and start_time and end_time:
                    if not overlaps(start_time, end_time, sch.start_time, sch.end_time):
                        continue
                return True
            return False

        created = []
        skipped = []
        errors = []

        for player in target_players:
            try:
                if check_conflicts and has_conflict_for_player(player.id):
                    skipped.append({'player_id': player.id, 'reason': 'Conflito detectado'})
                    continue

                schedule = Schedule(
                    name=data['name'],
                    campaign_id=campaign.id,
                    player_id=player.id,
                    start_date=start_date,
                    end_date=end_date,
                    start_time=start_time,
                    end_time=end_time,
                    days_of_week=days_of_week,
                    repeat_type=data.get('repeat_type', 'daily'),
                    repeat_interval=data.get('repeat_interval', 1),
                    priority=data.get('priority', 1),
                    is_persistent=data.get('is_persistent', False),
                    content_type=data.get('content_type', 'main'),
                    is_active=data.get('is_active', True),
                    playback_mode=data.get('playback_mode', 'sequential'),
                    content_duration=data.get('content_duration', 10),
                    transition_duration=data.get('transition_duration', 1),
                    loop_behavior=data.get('loop_behavior', 'until_next'),
                    loop_duration_minutes=data.get('loop_duration_minutes'),
                    content_selection=data.get('content_selection', 'all'),
                    shuffle_enabled=False,
                    auto_skip_errors=True
                )
                db.session.add(schedule)
                created.append(schedule)
            except Exception as item_error:
                errors.append({'player_id': getattr(player, 'id', None), 'error': str(item_error)})

        # Se nada foi criado, abortar cedo
        if not created and skipped and not errors:
            return jsonify({'message': 'Nenhum agendamento criado devido a conflitos', 'created': 0, 'skipped': len(skipped), 'errors': []}), 200

        # Commit em lote
        try:
            db.session.commit()
        except Exception as commit_error:
            db.session.rollback()
            return jsonify({'error': f'Falha ao salvar agendamentos: {str(commit_error)}'}), 500

        return jsonify({
            'message': 'Agendamentos criados com sucesso',
            'created': len(created),
            'skipped': len(skipped),
            'errors': errors,
            'schedules': [s.to_dict() for s in created],
        }), 201

    except Exception as e:
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
        
        if current_user and current_user.role == 'rh':
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
        
        if user.role not in ['admin', 'manager', 'rh']:
            return jsonify({'error': 'Sem permissão para editar agendamentos'}), 403
        
        # HR scoping: schedule's player must be in same company
        if user.role == 'rh':
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
            if user.role == 'rh':
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
        # Política da aplicação: reforçar flags independentemente do payload
        schedule.shuffle_enabled = False
        schedule.auto_skip_errors = True
        
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
        
        if user.role not in ['admin', 'manager', 'rh']:
            return jsonify({'error': 'Sem permissão para deletar agendamentos'}), 403
        
        # HR scoping
        if user.role == 'rh':
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

@schedule_bp.route('/range', methods=['GET'])
@jwt_required()
def get_schedules_in_range():
    """Lista agendamentos de todos os players dentro de um intervalo de datas (inclusive).
    Query params:
      - start: data inicial (BR dd/mm/yyyy[ HH:MM[:SS]] ou ISO)
      - end: data final (BR dd/mm/yyyy[ HH:MM[:SS]] ou ISO)
      - is_active: (opcional) filtra por ativos true|false
      - player_id: (opcional) filtra por player específico
    """
    try:
        print(f"[SCHEDULE] Global range endpoint called")
        current_user = User.query.get(get_jwt_identity())
        start_raw = request.args.get('start')
        end_raw = request.args.get('end')
        is_active = request.args.get('is_active')
        player_id = request.args.get('player_id')

        print(f"[SCHEDULE] Query params: start={start_raw}, end={end_raw}, is_active={is_active}, player_id={player_id}")

        if not start_raw or not end_raw:
            return jsonify({'error': 'Parâmetros start e end são obrigatórios'}), 400

        # Converter datas (usar end_of_day True para end)
        try:
            start_dt = parse_flexible_datetime(start_raw, end_of_day=False)
            end_dt = parse_flexible_datetime(end_raw, end_of_day=True)
            print(f"[SCHEDULE] Parsed dates: start={start_dt}, end={end_dt}")
        except Exception as e:
            print(f"[SCHEDULE] Date parsing error: {e}")
            return jsonify({'error': f'Erro na conversão de datas: {str(e)}'}), 400

        if start_dt > end_dt:
            return jsonify({'error': 'start deve ser anterior ou igual a end'}), 400

        # Construir query base
        query = Schedule.query.filter(
            Schedule.start_date <= end_dt,
            Schedule.end_date >= start_dt
        )

        # Filtrar por player específico se fornecido
        if player_id:
            print(f"[SCHEDULE] Aplicando filtro por player_id: {player_id}")
            query = query.filter(Schedule.player_id == player_id)
        else:
            print(f"[SCHEDULE] Nenhum filtro de player aplicado (player_id vazio ou None)")

        # Filtrar por status ativo se fornecido
        if is_active is not None:
            query = query.filter(Schedule.is_active == (str(is_active).lower() == 'true'))

        # HR scoping: garantir que só vê agendamentos de players da sua empresa
        if current_user and current_user.role == 'rh':
            query = query.join(Player, Schedule.player_id == Player.id) \
                         .join(Location, Player.location_id == Location.id) \
                         .filter(Location.company == current_user.company)

        query = query.order_by(Schedule.start_date.asc())
        schedules = query.all()
        
        print(f"[SCHEDULE] Found {len(schedules)} schedules in range")
        for s in schedules:
            try:
                player_name = s.player.name if s.player else "N/A"
                print(f"[SCHEDULE] - {s.name}: Player {player_name} (ID: {s.player_id}), {s.start_date} to {s.end_date}, days: {s.days_of_week}, time: {s.start_time}-{s.end_time}")
            except Exception as e:
                print(f"[SCHEDULE] - {s.name}: Error accessing player info - {str(e)}")
            
        # Debug: verificar se o filtro foi aplicado corretamente
        if player_id:
            filtered_schedules = [s for s in schedules if s.player_id == player_id]
            print(f"[SCHEDULE] DEBUG: Após filtro manual por player_id {player_id}: {len(filtered_schedules)} schedules")
            if len(schedules) != len(filtered_schedules):
                print(f"[SCHEDULE] PROBLEMA: Query retornou {len(schedules)} mas deveria retornar {len(filtered_schedules)}")
                print(f"[SCHEDULE] Schedules que não deveriam estar na resposta:")
                for s in schedules:
                    if s.player_id != player_id:
                        print(f"[SCHEDULE] - {s.name}: Player {s.player_name} (ID: {s.player_id})")

        # Calcular conflitos em tempo real para cada agendamento
        schedules_with_conflicts = []
        for schedule in schedules:
            schedule_dict = schedule.to_dict()
            
            # Detectar conflitos em tempo real
            has_conflicts = _detect_schedule_conflicts(schedule, schedules)
            schedule_dict['has_conflicts'] = has_conflicts
            
            # Determinar tipo de conflito para cores inteligentes
            conflict_type = _determine_conflict_type(schedule, schedules)
            schedule_dict['conflict_type'] = conflict_type
            
            # Determinar prioridade de sobreposição para cores diferenciadas
            overlap_priority = _determine_overlap_priority(schedule, schedules)
            schedule_dict['overlap_priority'] = overlap_priority
            
            # NOVO: Atribuir índice de cor para diferenciar schedules sobrepostos
            color_index = _assign_overlap_color_index(schedule, schedules)
            schedule_dict['color_index'] = color_index
            
            schedules_with_conflicts.append(schedule_dict)
        
        return jsonify({
            'schedules': schedules_with_conflicts,
            'start': fmt_br_datetime(start_dt),
            'end': fmt_br_datetime(end_dt)
        }), 200
    except Exception as e:
        print(f"[SCHEDULE] Error in global range endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/player/<player_id>/range', methods=['GET'])
@jwt_required()
def get_schedules_for_player_in_range(player_id):
    """Lista agendamentos de um player dentro de um intervalo de datas (inclusive).
    Query params:
      - start: data inicial (BR dd/mm/yyyy[ HH:MM[:SS]] ou ISO)
      - end: data final (BR dd/mm/yyyy[ HH:MM[:SS]] ou ISO)
      - is_active: (opcional) filtra por ativos true|false
    """
    try:
        print(f"[SCHEDULE] Range endpoint called for player {player_id}")
        current_user = User.query.get(get_jwt_identity())
        start_raw = request.args.get('start')
        end_raw = request.args.get('end')
        is_active = request.args.get('is_active')

        print(f"[SCHEDULE] Query params: start={start_raw}, end={end_raw}, is_active={is_active}")

        if not start_raw or not end_raw:
            return jsonify({'error': 'Parâmetros start e end são obrigatórios'}), 400

        # Converter datas (usar end_of_day True para end)
        try:
            start_dt = parse_flexible_datetime(start_raw, end_of_day=False)
            end_dt = parse_flexible_datetime(end_raw, end_of_day=True)
            print(f"[SCHEDULE] Parsed dates: start={start_dt}, end={end_dt}")
        except Exception as e:
            print(f"[SCHEDULE] Date parsing error: {e}")
            return jsonify({'error': f'Erro na conversão de datas: {str(e)}'}), 400

        if start_dt > end_dt:
            return jsonify({'error': 'start deve ser anterior ou igual a end'}), 400

        # HR scoping: garantir que o player pertence à empresa do usuário HR
        if current_user and current_user.role == 'rh':
            player = Player.query.get(player_id)
            loc = Location.query.get(player.location_id) if player else None
            if not loc or loc.company != current_user.company:
                return jsonify({'error': 'Acesso negado a players de outra empresa'}), 403

        query = Schedule.query.filter(
            Schedule.player_id == player_id,
            Schedule.start_date <= end_dt,
            Schedule.end_date >= start_dt
        )
        if is_active is not None:
            query = query.filter(Schedule.is_active == (str(is_active).lower() == 'true'))

        query = query.order_by(Schedule.start_date.asc())
        schedules = query.all()
        
        print(f"[SCHEDULE] Found {len(schedules)} schedules for player {player_id}")
        for s in schedules:
            print(f"[SCHEDULE] - {s.name}: {s.start_date} to {s.end_date}, days: {s.days_of_week}, time: {s.start_time}-{s.end_time}")

        # Calcular conflitos em tempo real para cada agendamento
        schedules_with_conflicts = []
        for schedule in schedules:
            schedule_dict = schedule.to_dict()
            
            # Detectar conflitos em tempo real
            has_conflicts = _detect_schedule_conflicts(schedule, schedules)
            schedule_dict['has_conflicts'] = has_conflicts
            
            # Determinar tipo de conflito para cores inteligentes
            conflict_type = _determine_conflict_type(schedule, schedules)
            schedule_dict['conflict_type'] = conflict_type
            
            # Determinar prioridade de sobreposição para cores diferenciadas
            overlap_priority = _determine_overlap_priority(schedule, schedules)
            schedule_dict['overlap_priority'] = overlap_priority
            
            # NOVO: Atribuir índice de cor para diferenciar schedules sobrepostos
            color_index = _assign_overlap_color_index(schedule, schedules)
            schedule_dict['color_index'] = color_index
            
            schedules_with_conflicts.append(schedule_dict)
        
        return jsonify({
            'schedules': schedules_with_conflicts,
            'player_id': player_id,
            'start': fmt_br_datetime(start_dt),
            'end': fmt_br_datetime(end_dt)
        }), 200
    except Exception as e:
        print(f"[SCHEDULE] Error in range endpoint: {e}")
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
        
        if current_user and current_user.role == 'rh':
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
        if current_user and current_user.role == 'rh':
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
        
        if user.role not in ['admin', 'manager', 'rh']:
            return jsonify({'error': 'Sem permissão para executar agendamentos'}), 403
        
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        # HR scoping
        if user.role == 'rh':
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