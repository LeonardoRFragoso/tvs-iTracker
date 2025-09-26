from flask import Blueprint, request, jsonify
import json
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from sqlalchemy import func, text
from collections import defaultdict
from models.campaign import Campaign, CampaignContent, db, PlaybackEvent
from models.content import Content
from models.player import Player
from models.user import User
from models.system_config import SystemConfig
import os

# New: video compiler
from services.video_compiler import video_compiler

campaign_bp = Blueprint('campaign', __name__)

# Brazilian datetime helpers
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
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        s = value.strip()
        if '/' in s:
            if ' ' in s:
                for fmt in (BR_DATETIME_FORMAT, '%d/%m/%Y %H:%M'):
                    try:
                        return datetime.strptime(s, fmt)
                    except Exception:
                        pass
            try:
                d = datetime.strptime(s, '%d/%m/%Y')
                if end_of_day:
                    return d.replace(hour=23, minute=59, second=59)
                return d.replace(hour=0, minute=0, second=0)
            except Exception:
                pass
        try:
            return datetime.fromisoformat(s.replace('Z', '+00:00'))
        except Exception:
            pass
    raise ValueError(f'Formato de data inválido: {value}')

@campaign_bp.route('/', methods=['GET'])
@campaign_bp.route('', methods=['GET'])  # evita redirect 308 em /api/campaigns
@jwt_required()
def list_campaigns():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_active = request.args.get('is_active')
        search = request.args.get('search')
        company = request.args.get('company')
        
        query = Campaign.query
        
        if is_active is not None:
            query = query.filter(Campaign.is_active == (is_active.lower() == 'true'))
        
        if search:
            query = query.filter(Campaign.name.contains(search))
        
        # Optional filter by creator's company (keeps campaigns global by default)
        if company:
            query = query.join(User, Campaign.user_id == User.id).filter(User.company == company)
        
        query = query.order_by(Campaign.created_at.desc())
        
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        # Enriquecer cada campanha com 'thumbnail' e 'contents' (mínimo para length)
        enriched = []
        for c in pagination.items:
            cdict = c.to_dict()
            # Incluir empresa de criação e nome do criador (para filtros/UX)
            try:
                cdict['company'] = getattr(c.user, 'company', None)
                cdict['creator_name'] = getattr(c.user, 'username', None)
            except Exception:
                cdict['company'] = None
                cdict['creator_name'] = None
            try:
                # Primeiro conteúdo ativo ordenado para thumbnail
                first_cc = CampaignContent.query.filter_by(
                    campaign_id=c.id,
                    is_active=True
                ).order_by(CampaignContent.order_index).first()
                thumb_path = None
                if first_cc and first_cc.content:
                    content = first_cc.content
                    if content.thumbnail_path:
                        # Não incluir '/api' aqui; o frontend prefixa API_BASE_URL
                        thumb_path = f"/content/thumbnails/{content.thumbnail_path}"
                    elif content.file_path and content.content_type == 'image':
                        thumb_path = f"/content/media/{content.file_path}"
                cdict['thumbnail'] = thumb_path
                
                # Lista mínima de contents para que CampaignList use length com segurança
                active_cc_list = CampaignContent.query.filter_by(
                    campaign_id=c.id,
                    is_active=True
                ).order_by(CampaignContent.order_index).all()
                cdict['contents'] = [{'id': cc.content_id} for cc in active_cc_list]
                
                # Calcular duração total dos vídeos na campanha
                total_duration = 0
                for cc in active_cc_list:
                    if cc.content and cc.content.content_type == 'video':
                        # Usar duração personalizada se disponível, senão usar duração do conteúdo
                        duration = cc.duration_override or cc.content.duration or 0
                        total_duration += duration
                cdict['total_video_duration'] = total_duration
            except Exception:
                cdict['thumbnail'] = None
                cdict['contents'] = []
            enriched.append(cdict)
        
        return jsonify({
            'campaigns': enriched,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/', methods=['POST'])
@campaign_bp.route('', methods=['POST'])  # evita redirect 308 em /api/campaigns
@jwt_required()
def create_campaign():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        print(f"[DEBUG] Campaign creation data received: {data}")
        print(f"[DEBUG] User ID: {user_id}")
        
        required_fields = ['name', 'start_date', 'end_date']
        for field in required_fields:
            if not data.get(field):
                print(f"[ERROR] Missing required field: {field}")
                return jsonify({'error': f'{field} é obrigatório'}), 400
        
        # Converter datas (aceita BR e ISO). Considera fim do dia para end_date sem horário
        start_date = parse_flexible_datetime(data['start_date'], end_of_day=False)
        end_date = parse_flexible_datetime(data['end_date'], end_of_day=True)
        
        if start_date >= end_date:
            return jsonify({'error': 'Data de início deve ser anterior à data de fim'}), 400
        
        # Converter tipos com segurança
        def to_int(value, default=None):
            try:
                return int(value)
            except Exception:
                return default
        def to_bool(value, default=False):
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ['true', '1', 'yes', 'on']
            if isinstance(value, (int, float)):
                return bool(value)
            return default
        
        campaign = Campaign(
            name=data['name'],
            description=data.get('description', ''),
            start_date=start_date,
            end_date=end_date,
            is_active=data.get('is_active', True),
            priority=data.get('priority', 1),
            regions=json.dumps(data.get('regions', [])),
            time_slots=json.dumps(data.get('time_slots', [])),
            days_of_week=json.dumps(data.get('days_of_week', [])),
            user_id=user_id,
            # REMOVIDO: Configurações de reprodução movidas para Schedule
        )
        
        db.session.add(campaign)
        db.session.flush()  # Para obter o ID
        
        # Adicionar conteúdos se fornecidos
        if data.get('content_ids'):
            for i, content_id in enumerate(data['content_ids']):
                content = Content.query.get(content_id)
                if content:
                    campaign_content = CampaignContent(
                        campaign_id=campaign.id,
                        content_id=content_id,
                        order_index=i
                    )
                    db.session.add(campaign_content)
        
        db.session.commit()

        # Auto-compile if enabled
        try:
            enabled = SystemConfig.get_value('general.auto_update')
            if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True:
                # Marca como stale e dispara compilação assíncrona
                try:
                    campaign.compiled_stale = True
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                video_compiler.start_async_compile(campaign.id)
        except Exception:
            pass
        
        return jsonify({
            'message': 'Campanha criada com sucesso',
            'campaign': campaign.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>', methods=['GET'])
@jwt_required()
def get_campaign(campaign_id):
    try:
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Incluir conteúdos da campanha
        campaign_dict = campaign.to_dict()
        campaign_dict['contents'] = [cc.to_dict() for cc in campaign.contents]
        
        return jsonify({'campaign': campaign_dict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>', methods=['PUT'])
@jwt_required()
def update_campaign(campaign_id):
    try:
        user_id = get_jwt_identity()
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Verificar permissão
        user = User.query.get(user_id)
        if campaign.user_id != user_id and user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar esta campanha'}), 403
        
        data = request.get_json()
        
        # Helpers de conversão
        def to_int(value, default=None):
            try:
                return int(value)
            except Exception:
                return default
        def to_bool(value, default=False):
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ['true', '1', 'yes', 'on']
            if isinstance(value, (int, float)):
                return bool(value)
            return default
        
        if 'name' in data:
            campaign.name = data['name']
        if 'description' in data:
            campaign.description = data['description']
        if 'start_date' in data and data['start_date']:
            campaign.start_date = parse_flexible_datetime(data['start_date'], end_of_day=False)
        if 'end_date' in data and data['end_date']:
            campaign.end_date = parse_flexible_datetime(data['end_date'], end_of_day=True)
        if 'priority' in data:
            campaign.priority = data['priority']
        if 'regions' in data:
            campaign.regions = json.dumps(data['regions'])
        if 'time_slots' in data:
            campaign.time_slots = json.dumps(data['time_slots'])
        if 'days_of_week' in data:
            campaign.days_of_week = json.dumps(data['days_of_week'])
        if 'is_active' in data:
            campaign.is_active = data['is_active']
        # Novos campos de reprodução
        if 'playback_mode' in data:
            campaign.playback_mode = data['playback_mode'] or 'sequential'
        if 'content_duration' in data:
            campaign.content_duration = to_int(data.get('content_duration'), default=10)
        if 'loop_enabled' in data:
            campaign.loop_enabled = to_bool(data.get('loop_enabled'), default=False)
        if 'shuffle_enabled' in data:
            campaign.shuffle_enabled = to_bool(data.get('shuffle_enabled'), default=False)
        
        campaign.updated_at = datetime.utcnow()
        db.session.commit()

        # Auto-compile if enabled and campaign stale or playback changed
        try:
            enabled = SystemConfig.get_value('general.auto_update')
            if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True:
                if getattr(campaign, 'compiled_stale', False) or True:
                    video_compiler.start_async_compile(campaign.id)
        except Exception:
            pass
        
        return jsonify({
            'message': 'Campanha atualizada com sucesso',
            'campaign': campaign.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>', methods=['DELETE'])
@jwt_required()
def delete_campaign(campaign_id):
    try:
        user_id = get_jwt_identity()
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Verificar permissão
        user = User.query.get(user_id)
        if campaign.user_id != user_id and user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para deletar esta campanha'}), 403
        
        db.session.delete(campaign)
        db.session.commit()
        
        return jsonify({'message': 'Campanha deletada com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>/contents', methods=['GET'])
@jwt_required()
def get_campaign_contents(campaign_id):
    try:
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Buscar conteúdos da campanha ordenados por order_index
        campaign_contents = CampaignContent.query.filter_by(
            campaign_id=campaign_id
        ).order_by(CampaignContent.order_index).all()
        
        contents = []
        for cc in campaign_contents:
            content_dict = cc.to_dict()
            # Incluir dados do conteúdo
            if cc.content:
                content_dict['content'] = cc.content.to_dict()
            contents.append(content_dict)
        
        return jsonify({
            'contents': contents,
            'total': len(contents)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>/contents', methods=['POST'])
@jwt_required()
def add_content_to_campaign(campaign_id):
    try:
        user_id = get_jwt_identity()
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Verificar permissão
        user = User.query.get(user_id)
        if campaign.user_id != user_id and user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar esta campanha'}), 403
        
        data = request.get_json()
        content_id = data.get('content_id')
        
        if not content_id:
            return jsonify({'error': 'content_id é obrigatório'}), 400
        
        content = Content.query.get(content_id)
        if not content:
            return jsonify({'error': 'Conteúdo não encontrado'}), 404
        
        # Verificar se já existe
        existing = CampaignContent.query.filter_by(
            campaign_id=campaign_id,
            content_id=content_id
        ).first()
        
        if existing:
            return jsonify({'error': 'Conteúdo já está na campanha'}), 409
        
        # Obter próximo índice
        max_order = db.session.query(db.func.max(CampaignContent.order_index)).filter_by(
            campaign_id=campaign_id
        ).scalar() or -1
        
        campaign_content = CampaignContent(
            campaign_id=campaign_id,
            content_id=content_id,
            order_index=max_order + 1,
            duration_override=data.get('duration_override')
        )
        
        db.session.add(campaign_content)
        # Mark compiled video stale
        try:
            campaign.compiled_stale = True
            campaign.compiled_video_status = 'stale'
        except Exception:
            pass
        db.session.commit()

        # Auto-compile if enabled
        try:
            enabled = SystemConfig.get_value('general.auto_update')
            if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True:
                video_compiler.start_async_compile(campaign.id)
        except Exception:
            pass
        
        return jsonify({
            'message': 'Conteúdo adicionado à campanha',
            'campaign_content': campaign_content.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>/contents/<content_id>', methods=['DELETE'])
@jwt_required()
def remove_content_from_campaign(campaign_id, content_id):
    try:
        user_id = get_jwt_identity()
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Verificar permissão
        user = User.query.get(user_id)
        if campaign.user_id != user_id and user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar esta campanha'}), 403
        
        campaign_content = CampaignContent.query.filter_by(
            campaign_id=campaign_id,
            content_id=content_id
        ).first()
        
        if not campaign_content:
            return jsonify({'error': 'Conteúdo não encontrado na campanha'}), 404
        
        db.session.delete(campaign_content)
        try:
            campaign.compiled_stale = True
            campaign.compiled_video_status = 'stale'
        except Exception:
            pass
        db.session.commit()

        # Auto-compile if enabled
        try:
            enabled = SystemConfig.get_value('general.auto_update')
            if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True:
                video_compiler.start_async_compile(campaign.id)
        except Exception:
            pass
        
        return jsonify({'message': 'Conteúdo removido da campanha'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>/contents/reorder', methods=['PUT'])
@jwt_required()
def reorder_campaign_contents(campaign_id):
    try:
        user_id = get_jwt_identity()
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Verificar permissão
        user = User.query.get(user_id)
        if campaign.user_id != user_id and user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar esta campanha'}), 403
        
        data = request.get_json()
        content_order = data.get('content_order', [])
        
        for i, content_id in enumerate(content_order):
            campaign_content = CampaignContent.query.filter_by(
                campaign_id=campaign_id,
                content_id=content_id
            ).first()
            
            if campaign_content:
                campaign_content.order_index = i
        
        db.session.commit()
        # Mark compiled stale after reorder
        try:
            campaign.compiled_stale = True
            campaign.compiled_video_status = 'stale'
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Auto-compile if enabled
        try:
            enabled = SystemConfig.get_value('general.auto_update')
            if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True:
                video_compiler.start_async_compile(campaign.id)
        except Exception:
            pass
        
        return jsonify({'message': 'Ordem dos conteúdos atualizada'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>/analytics', methods=['GET'])
@jwt_required()
def get_campaign_analytics(campaign_id):
    """Retorna métricas de analytics da campanha para a aba Analytics do frontend.
    Query params:
      - range: 1d | 7d | 30d | 90d (default: 7d)
    """
    try:
        # Validar campanha
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404

        # Intervalo de tempo
        time_range = (request.args.get('range') or '7d').lower()
        days_map = {'1d': 1, '7d': 7, '30d': 30, '90d': 90}
        days = days_map.get(time_range, 7)
        now = datetime.utcnow()
        since = now - timedelta(days=days)

        # Buscar eventos
        events = PlaybackEvent.query.filter(
            PlaybackEvent.campaign_id == campaign_id,
            PlaybackEvent.started_at >= since
        ).all()

        total = len(events)
        success_count = sum(1 for e in events if getattr(e, 'success', False))
        unique_players = len({e.player_id for e in events if e.player_id})
        total_duration_sec = sum(int(e.duration_seconds or 0) for e in events)
        avg_content_duration_sec = int(total_duration_sec / total) if total > 0 else 0

        summary = {
            'total_executions': total,
            # Em minutos para combinar com o frontend (formatDuration espera minutos)
            'total_duration': int(total_duration_sec / 60),
            'unique_players': unique_players,
            'success_rate': round((success_count / total) * 100, 1) if total > 0 else 0.0,
            # Em segundos para combinar com o frontend que exibe "Xs"
            'avg_content_duration': avg_content_duration_sec,
        }

        # Performance por conteúdo
        by_content = defaultdict(lambda: {'executions': 0, 'success': 0, 'duration_total': 0})
        content_ids = set()
        for e in events:
            if not e.content_id:
                continue
            stats = by_content[e.content_id]
            stats['executions'] += 1
            if getattr(e, 'success', False):
                stats['success'] += 1
            stats['duration_total'] += int(e.duration_seconds or 0)
            content_ids.add(e.content_id)

        content_map = {c.id: c for c in (Content.query.filter(Content.id.in_(list(content_ids))).all() if content_ids else [])}
        content_performance = []
        for cid, stats in by_content.items():
            c = content_map.get(cid)
            name = c.title if c else 'Conteúdo'
            ctype = getattr(c, 'content_type', 'unknown')
            executions = stats['executions']
            success_rate = round(stats['success'] / executions * 100, 1) if executions > 0 else 0.0
            avg_duration = int(stats['duration_total'] / executions) if executions > 0 else 0
            content_performance.append({
                'name': name,
                'executions': executions,
                'success_rate': success_rate,
                'avg_duration': avg_duration,
                'type': ctype
            })

        # Distribuição por tipo
        type_execs = defaultdict(int)
        type_unique = defaultdict(set)
        for cid, stats in by_content.items():
            c = content_map.get(cid)
            ctype = getattr(c, 'content_type', 'unknown')
            type_execs[ctype] += stats['executions']
            type_unique[ctype].add(cid)

        type_label = {'video': 'Vídeos', 'image': 'Imagens', 'audio': 'Áudios'}
        content_type_distribution = [{
            'name': type_label.get(ctype, ctype.title()),
            'value': execs,
            'count': len(type_unique[ctype])
        } for ctype, execs in type_execs.items()]

        # Timeline por dia
        timeline_map = {}
        for i in range(days):
            d = (since + timedelta(days=i)).date()
            key = str(d)
            timeline_map[key] = {'date': key, 'executions': 0, 'success': 0}
        for e in events:
            key = str(e.started_at.date())
            if key in timeline_map:
                timeline_map[key]['executions'] += 1
                if getattr(e, 'success', False):
                    timeline_map[key]['success'] += 1
        execution_timeline = list(timeline_map.values())

        # Performance por player
        player_stats = defaultdict(lambda: {'executions': 0, 'success': 0})
        for e in events:
            if e.player_id:
                player_stats[e.player_id]['executions'] += 1
                if getattr(e, 'success', False):
                    player_stats[e.player_id]['success'] += 1
        player_ids = list(player_stats.keys())
        player_map = {p.id: p for p in (Player.query.filter(Player.id.in_(player_ids)).all() if player_ids else [])}
        player_performance = []
        for pid, stats in player_stats.items():
            p = player_map.get(pid)
            name = getattr(p, 'name', 'Player')
            executions = stats['executions']
            success_rate = round(stats['success'] / executions * 100, 1) if executions > 0 else 0.0
            player_performance.append({'name': name, 'executions': executions, 'success_rate': success_rate})

        # Horários de pico
        hour_stats = defaultdict(int)
        for e in events:
            if e.started_at:
                h = e.started_at.hour
                key = f"{h:02d}:00"
                hour_stats[key] += 1
        peak_hours = [{'hour': k, 'executions': v} for k, v in sorted(hour_stats.items(), key=lambda x: x[0])]

        return jsonify({
            'summary': summary,
            'content_performance': content_performance,
            'content_type_distribution': content_type_distribution,
            'execution_timeline': execution_timeline,
            'player_performance': player_performance,
            'peak_hours': peak_hours
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>/analytics/debug', methods=['GET'])
@jwt_required()
def debug_campaign_analytics(campaign_id):
    """Diagnóstico da base de dados para Analytics da campanha.
    Retorna: caminho do DB, existência e colunas de playback_events, contagem de eventos (total/sucesso/falha) e amostra dos últimos eventos.
    """
    try:
        # Arquivo do banco em uso
        engine = db.engine
        db_file = engine.url.database
        db_abspath = os.path.abspath(db_file) if db_file else None

        # Verificar tabela playback_events e suas colunas (SQLite)
        columns = []
        has_table = False
        try:
            with engine.connect() as conn:
                result = conn.execute(text("PRAGMA table_info(playback_events)"))
                rows = result.fetchall()
                if rows:
                    has_table = True
                    for r in rows:
                        # PRAGMA columns: cid, name, type, notnull, dflt_value, pk
                        columns.append({
                            'cid': r[0],
                            'name': r[1],
                            'type': r[2],
                            'notnull': r[3],
                            'default': r[4],
                            'pk': r[5],
                        })
        except Exception as e:
            # Falha ao executar PRAGMA
            columns = [{'error': f'PRAGMA failed: {str(e)}'}]

        totals = {
            'total_events': 0,
            'total_success': 0,
            'total_failed': 0,
        }
        latest_events = []

        # Se tabela existe, coletar métricas
        if has_table:
            try:
                from models.campaign import PlaybackEvent
                q = PlaybackEvent.query.filter(PlaybackEvent.campaign_id == campaign_id)
                totals['total_events'] = q.count()
                totals['total_success'] = q.filter(PlaybackEvent.success == True).count()
                totals['total_failed'] = q.filter(PlaybackEvent.success == False).count()
                latest = q.order_by(PlaybackEvent.started_at.desc()).limit(10).all()
                latest_events = [
                    {
                        'id': e.id,
                        'started_at': fmt_br_datetime(e.started_at),
                        'duration_seconds': e.duration_seconds,
                        'success': e.success,
                        'player_id': e.player_id,
                        'content_id': e.content_id,
                        'schedule_id': e.schedule_id,
                        'error_message': e.error_message,
                    }
                    for e in latest
                ]
            except Exception as e:
                latest_events = [{'error': f'Query failed: {str(e)}'}]

        return jsonify({
            'db': {
                'db_file': db_file,
                'db_abspath': db_abspath,
            },
            'playback_events': {
                'has_table': has_table,
                'columns': columns,
                'totals': totals,
                'latest_events': latest_events,
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>/compile', methods=['POST'])
@jwt_required()
def compile_campaign(campaign_id):
    """Dispara compilação assíncrona do vídeo da campanha."""
    try:
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404

        data = request.get_json(silent=True) or {}
        preset = (data.get('preset') or '').lower().strip()
        resolution = data.get('resolution')
        fps = data.get('fps')

        # Presets mapping
        preset_map = {
            '360p': ('640x360', 30),
            '720p': ('1280x720', 30),
            '1080p': ('1920x1080', 30),
        }
        if preset in preset_map:
            resolution, fps = preset_map[preset]
        # Defaults if not provided
        resolution = resolution or '1920x1080'
        try:
            fps = int(fps) if fps is not None else 30
        except Exception:
            fps = 30

        # Cache: if ready and not stale and matches resolution/fps, return ready
        if (campaign.compiled_video_status == 'ready' and
            not getattr(campaign, 'compiled_stale', False) and
            getattr(campaign, 'compiled_video_resolution', None) == resolution and
            int(getattr(campaign, 'compiled_video_fps', 0) or 0) == int(fps)):
            return jsonify({
                'message': 'Compilação já está pronta para os parâmetros solicitados',
                'status': 'ready',
                'compiled_video_url': f"/uploads/{campaign.compiled_video_path}" if campaign.compiled_video_path else None,
                'compiled_video_duration': campaign.compiled_video_duration,
                'compiled_video_resolution': campaign.compiled_video_resolution,
                'compiled_video_fps': campaign.compiled_video_fps,
                'compiled_video_updated_at': fmt_br_datetime(campaign.compiled_video_updated_at),
            }), 200

        # Se acabou de alterar conteúdos, marcar stale (se não marcado)
        if campaign.compiled_stale is None:
            campaign.compiled_stale = True

        ok = video_compiler.start_async_compile(campaign_id, resolution=resolution, fps=fps)
        if not ok:
            return jsonify({'error': 'Não foi possível iniciar a compilação. Verifique se já não está em processamento.'}), 400

        return jsonify({'message': 'Compilação iniciada', 'status': 'processing'}), 202
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/<campaign_id>/compile/status', methods=['GET'])
@jwt_required()
def compile_status(campaign_id):
    """Retorna status e metadados do vídeo compilado."""
    try:
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        c = campaign.to_dict()
        return jsonify({
            'compiled_video_path': c.get('compiled_video_path'),
            'compiled_video_url': c.get('compiled_video_url'),
            'compiled_video_duration': c.get('compiled_video_duration'),
            'compiled_video_status': c.get('compiled_video_status'),
            'compiled_video_error': c.get('compiled_video_error'),
            'compiled_video_updated_at': c.get('compiled_video_updated_at'),
            'compiled_stale': c.get('compiled_stale'),
            'compiled_video_resolution': c.get('compiled_video_resolution'),
            'compiled_video_fps': c.get('compiled_video_fps'),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
