from flask import Blueprint, request, jsonify
from database import db
from models.campaign import Campaign, CampaignContent
from models.content import Content
from models.user import User
from flask_jwt_extended import jwt_required, get_jwt_identity
import uuid
import json

campaign_content_bp = Blueprint('campaign_content', __name__)

@campaign_content_bp.route('/api/campaigns/<campaign_id>/contents', methods=['GET'])
@jwt_required()
def get_campaign_contents(campaign_id):
    """Lista todos os conteúdos de uma campanha"""
    try:
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Buscar conteúdos ordenados
        campaign_contents = CampaignContent.query.filter_by(
            campaign_id=campaign_id
        ).order_by(CampaignContent.order_index).all()
        
        contents_data = []
        for cc in campaign_contents:
            content_data = cc.to_dict()
            # Adicionar informações extras do conteúdo
            if cc.content:
                content_data['content']['file_url'] = f"/uploads/{cc.content.file_path.split('/')[-1]}" if cc.content.file_path else None
                content_data['content']['thumbnail_url'] = f"/content/thumbnails/{cc.content.thumbnail_path.split('/')[-1]}" if cc.content.thumbnail_path else None
            contents_data.append(content_data)
        
        return jsonify({
            'campaign_contents': contents_data,
            'campaign': campaign.to_dict(),
            'total_count': len(contents_data),
            'active_count': len([c for c in contents_data if c['is_active']])
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar conteúdos: {str(e)}'}), 500

@campaign_content_bp.route('/api/campaigns/<campaign_id>/contents', methods=['POST'])
@jwt_required()
def add_content_to_campaign(campaign_id):
    """Adiciona conteúdo à campanha"""
    try:
        data = request.get_json()
        
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Permissão: somente dono da campanha ou admin/manager
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if campaign.user_id != user_id and (not user or user.role not in ['admin', 'manager']):
            return jsonify({'error': 'Sem permissão para editar esta campanha'}), 403
        
        content_id = data.get('content_id')
        if not content_id:
            return jsonify({'error': 'ID do conteúdo é obrigatório'}), 400
        
        content = Content.query.get(content_id)
        if not content:
            return jsonify({'error': 'Conteúdo não encontrado'}), 404
        
        # Verificar se conteúdo já está na campanha
        existing = CampaignContent.query.filter_by(
            campaign_id=campaign_id,
            content_id=content_id
        ).first()
        
        if existing:
            return jsonify({'error': 'Conteúdo já está na campanha'}), 400
        
        # Obter próximo order_index
        max_order = db.session.query(db.func.max(CampaignContent.order_index))\
                             .filter_by(campaign_id=campaign_id).scalar() or 0
        
        # Criar novo campaign_content
        campaign_content = CampaignContent(
            id=str(uuid.uuid4()),
            campaign_id=campaign_id,
            content_id=content_id,
            order_index=data.get('order_index', max_order + 1),
            duration_override=data.get('duration_override'),
            location_filter=json.dumps(data.get('location_filter')) if data.get('location_filter') else None,
            schedule_filter=json.dumps(data.get('schedule_filter')) if data.get('schedule_filter') else None,
            playback_settings=json.dumps(data.get('playback_settings')) if data.get('playback_settings') else None,
            is_active=data.get('is_active', True)
        )
        
        db.session.add(campaign_content)
        # Marcar compilado como stale
        try:
            campaign.compiled_stale = True
            campaign.compiled_video_status = 'stale'
        except Exception:
            pass
        db.session.commit()
        
        return jsonify({
            'message': 'Conteúdo adicionado à campanha com sucesso',
            'campaign_content': campaign_content.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro ao adicionar conteúdo: {str(e)}'}), 500

@campaign_content_bp.route('/api/campaigns/<campaign_id>/contents/<content_id>', methods=['DELETE'])
@jwt_required()
def remove_content_from_campaign(campaign_id, content_id):
    """Remove conteúdo específico da campanha"""
    try:
        # Verificar campanha e permissão
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if campaign.user_id != user_id and (not user or user.role not in ['admin', 'manager']):
            return jsonify({'error': 'Sem permissão para editar esta campanha'}), 403
        
        campaign_content = CampaignContent.query.filter_by(
            campaign_id=campaign_id,
            content_id=content_id
        ).first()
        
        if not campaign_content:
            return jsonify({'error': 'Conteúdo não encontrado na campanha'}), 404
        
        db.session.delete(campaign_content)
        try:
            if campaign:
                campaign.compiled_stale = True
                campaign.compiled_video_status = 'stale'
        except Exception:
            pass
        db.session.commit()
        
        return jsonify({'message': 'Conteúdo removido da campanha com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro ao remover conteúdo: {str(e)}'}), 500

@campaign_content_bp.route('/api/campaigns/<campaign_id>/contents/<content_id>', methods=['PUT'])
@jwt_required()
def update_campaign_content(campaign_id, content_id):
    """Atualiza configurações de um conteúdo na campanha"""
    try:
        data = request.get_json()
        
        # Verificar campanha e permissão
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if campaign.user_id != user_id and (not user or user.role not in ['admin', 'manager']):
            return jsonify({'error': 'Sem permissão para editar esta campanha'}), 403
        
        campaign_content = CampaignContent.query.filter_by(
            campaign_id=campaign_id,
            content_id=content_id
        ).first()
        
        if not campaign_content:
            return jsonify({'error': 'Conteúdo não encontrado na campanha'}), 404
        
        # Atualizar campos permitidos
        if 'order_index' in data:
            campaign_content.order_index = data['order_index']
        
        if 'is_active' in data:
            campaign_content.is_active = data['is_active']
        
        if 'duration_override' in data:
            campaign_content.duration_override = data['duration_override']
        
        if 'location_filter' in data:
            campaign_content.location_filter = json.dumps(data['location_filter']) if data['location_filter'] else None
        
        if 'schedule_filter' in data:
            campaign_content.schedule_filter = json.dumps(data['schedule_filter']) if data['schedule_filter'] else None
        
        if 'playback_settings' in data:
            campaign_content.playback_settings = json.dumps(data['playback_settings']) if data['playback_settings'] else None
        
        # Marcar compilado como stale
        try:
            if campaign:
                campaign.compiled_stale = True
                campaign.compiled_video_status = 'stale'
        except Exception:
            pass
        db.session.commit()
        
        return jsonify({
            'message': 'Conteúdo atualizado com sucesso',
            'campaign_content': campaign_content.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro ao atualizar conteúdo: {str(e)}'}), 500

@campaign_content_bp.route('/api/campaigns/<campaign_id>/contents/reorder', methods=['PUT'])
@jwt_required()
def reorder_campaign_contents(campaign_id):
    """Reordena conteúdos da campanha"""
    try:
        data = request.get_json()
        content_orders = data.get('content_orders', [])
        
        if not content_orders:
            return jsonify({'error': 'Lista de ordenação é obrigatória'}), 400
        
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Permissão: somente dono da campanha ou admin/manager
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if campaign.user_id != user_id and (not user or user.role not in ['admin', 'manager']):
            return jsonify({'error': 'Sem permissão para editar esta campanha'}), 403
        
        # Atualizar order_index para cada conteúdo
        for item in content_orders:
            content_id = item.get('content_id')
            order_index = item.get('order_index')
            
            if not content_id or order_index is None:
                continue
            
            campaign_content = CampaignContent.query.filter_by(
                campaign_id=campaign_id,
                content_id=content_id
            ).first()
            
            if campaign_content:
                campaign_content.order_index = order_index
        
        # Marcar compilado como stale após reordenar
        try:
            if campaign:
                campaign.compiled_stale = True
                campaign.compiled_video_status = 'stale'
                db.session.commit()
        except Exception:
            db.session.rollback()
        
        return jsonify({'message': 'Conteúdos reordenados com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro ao reordenar conteúdos: {str(e)}'}), 500

@campaign_content_bp.route('/api/campaigns/<campaign_id>/contents/bulk-update', methods=['PUT'])
@jwt_required()
def bulk_update_campaign_contents(campaign_id):
    """Atualização em lote de conteúdos da campanha"""
    try:
        data = request.get_json()
        updates = data.get('updates', [])
        
        if not updates:
            return jsonify({'error': 'Lista de atualizações é obrigatória'}), 400
        
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Permissão: somente dono da campanha ou admin/manager
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if campaign.user_id != user_id and (not user or user.role not in ['admin', 'manager']):
            return jsonify({'error': 'Sem permissão para editar esta campanha'}), 403
        
        updated_count = 0
        
        for update in updates:
            content_id = update.get('content_id')
            if not content_id:
                continue
            
            campaign_content = CampaignContent.query.filter_by(
                campaign_id=campaign_id,
                content_id=content_id
            ).first()
            
            if not campaign_content:
                continue
            
            # Aplicar atualizações
            if 'is_active' in update:
                campaign_content.is_active = update['is_active']
            
            if 'duration_override' in update:
                campaign_content.duration_override = update['duration_override']
            
            if 'location_filter' in update:
                campaign_content.location_filter = json.dumps(update['location_filter']) if update['location_filter'] else None
            
            updated_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'{updated_count} conteúdos atualizados com sucesso',
            'updated_count': updated_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro na atualização em lote: {str(e)}'}), 500

@campaign_content_bp.route('/api/campaigns/<campaign_id>/contents/preview', methods=['GET'])
@jwt_required()
def preview_campaign_playback(campaign_id):
    """Preview da sequência de reprodução da campanha"""
    try:
        campaign = Campaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campanha não encontrada'}), 404
        
        # Obter parâmetros de filtro
        content_filter = request.args.get('content_filter')
        location_filter = request.args.get('location_filter')
        
        # Obter conteúdos filtrados
        contents = campaign.get_contents_for_playback(
            content_filter=content_filter,
            location_filter=location_filter
        )
        
        preview_data = []
        total_duration = 0
        
        for i, cc in enumerate(contents):
            duration = cc.get_effective_duration()
            total_duration += duration
            
            preview_data.append({
                'order': i + 1,
                'content': cc.content.to_dict() if cc.content else None,
                'duration': duration,
                'is_active': cc.is_active,
                'location_filter': json.loads(cc.location_filter) if cc.location_filter else None
            })
        
        # Compiled metadata
        compiled = {
            'status': getattr(campaign, 'compiled_video_status', 'none'),
            'url': (f"/uploads/{campaign.compiled_video_path}" if getattr(campaign, 'compiled_video_path', None) else None),
            'duration': getattr(campaign, 'compiled_video_duration', None),
            'stale': getattr(campaign, 'compiled_stale', True),
            'updated_at': getattr(campaign, 'compiled_video_updated_at', None).strftime('%d/%m/%Y %H:%M:%S') if getattr(campaign, 'compiled_video_updated_at', None) else None,
            'resolution': getattr(campaign, 'compiled_video_resolution', None),
            'fps': getattr(campaign, 'compiled_video_fps', None)
        }
        
        return jsonify({
            'preview': preview_data,
            'total_contents': len(preview_data),
            'total_duration': total_duration,
            'playback_mode': campaign.playback_mode,
            'loop_enabled': campaign.loop_enabled,
            'shuffle_enabled': campaign.shuffle_enabled,
            'compiled': compiled
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao gerar preview: {str(e)}'}), 500
