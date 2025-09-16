from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json
from models.campaign import Campaign, CampaignContent, db
from models.content import Content
from models.user import User

campaign_bp = Blueprint('campaign', __name__)

@campaign_bp.route('/', methods=['GET'])
@jwt_required()
def list_campaigns():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_active = request.args.get('is_active')
        search = request.args.get('search')
        
        query = Campaign.query
        
        if is_active is not None:
            query = query.filter(Campaign.is_active == (is_active.lower() == 'true'))
        
        if search:
            query = query.filter(Campaign.name.contains(search))
        
        query = query.order_by(Campaign.created_at.desc())
        
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'campaigns': [campaign.to_dict() for campaign in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@campaign_bp.route('/', methods=['POST'])
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
        
        # Converter datas
        start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        if start_date >= end_date:
            return jsonify({'error': 'Data de início deve ser anterior à data de fim'}), 400
        
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
            user_id=user_id
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
        
        if 'name' in data:
            campaign.name = data['name']
        if 'description' in data:
            campaign.description = data['description']
        if 'start_date' in data:
            campaign.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        if 'end_date' in data:
            campaign.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
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
        
        campaign.updated_at = datetime.utcnow()
        db.session.commit()
        
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
        db.session.commit()
        
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
        db.session.commit()
        
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
        
        return jsonify({'message': 'Ordem dos conteúdos atualizada'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
