from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import feedparser
import requests
import json
from models.editorial import Editorial, EditorialItem, db
from models.user import User

editorial_bp = Blueprint('editorial', __name__)

@editorial_bp.route('/', methods=['GET'])
@editorial_bp.route('', methods=['GET'])  # evita redirect 308 em /api/editorials
@jwt_required()
def list_editorials():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        editorial_type = request.args.get('type')
        is_active = request.args.get('is_active')
        
        query = Editorial.query
        
        if editorial_type:
            query = query.filter(Editorial.editorial_type == editorial_type)
        
        if is_active is not None:
            query = query.filter(Editorial.is_active == (is_active.lower() == 'true'))
        
        query = query.order_by(Editorial.created_at.desc())
        
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'editorials': [editorial.to_dict() for editorial in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@editorial_bp.route('/', methods=['POST'])
@editorial_bp.route('', methods=['POST'])  # evita redirect 308 em /api/editorials
@jwt_required()
def create_editorial():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Apenas administradores e gerentes podem criar editorias'}), 403
        
        data = request.get_json()
        
        required_fields = ['name', 'editorial_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} é obrigatório'}), 400
        
        editorial = Editorial(
            name=data['name'],
            description=data.get('description', ''),
            editorial_type=data['editorial_type'],
            feed_url=data.get('feed_url', ''),
            api_key=data.get('api_key', ''),
            refresh_interval=data.get('refresh_interval', 3600),
            max_items=data.get('max_items', 10),
            template=data.get('template', ''),
            duration_per_item=data.get('duration_per_item', 15),
            keywords=json.dumps(data.get('keywords', [])),
            categories=json.dumps(data.get('categories', [])),
            language=data.get('language', 'pt-BR')
        )
        
        db.session.add(editorial)
        db.session.commit()
        
        return jsonify({
            'message': 'Editoria criada com sucesso',
            'editorial': editorial.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@editorial_bp.route('/<editorial_id>', methods=['GET'])
@jwt_required()
def get_editorial(editorial_id):
    try:
        editorial = Editorial.query.get(editorial_id)
        
        if not editorial:
            return jsonify({'error': 'Editoria não encontrada'}), 404
        
        return jsonify({'editorial': editorial.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@editorial_bp.route('/<editorial_id>', methods=['PUT'])
@jwt_required()
def update_editorial(editorial_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        editorial = Editorial.query.get(editorial_id)
        
        if not editorial:
            return jsonify({'error': 'Editoria não encontrada'}), 404
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar editorias'}), 403
        
        data = request.get_json()
        
        if 'name' in data:
            editorial.name = data['name']
        if 'description' in data:
            editorial.description = data['description']
        if 'feed_url' in data:
            editorial.feed_url = data['feed_url']
        if 'api_key' in data:
            editorial.api_key = data['api_key']
        if 'refresh_interval' in data:
            editorial.refresh_interval = data['refresh_interval']
        if 'max_items' in data:
            editorial.max_items = data['max_items']
        if 'template' in data:
            editorial.template = data['template']
        if 'duration_per_item' in data:
            editorial.duration_per_item = data['duration_per_item']
        if 'keywords' in data:
            editorial.keywords = json.dumps(data['keywords'])
        if 'categories' in data:
            editorial.categories = json.dumps(data['categories'])
        if 'language' in data:
            editorial.language = data['language']
        if 'is_active' in data:
            editorial.is_active = data['is_active']
        
        editorial.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Editoria atualizada com sucesso',
            'editorial': editorial.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@editorial_bp.route('/<editorial_id>', methods=['DELETE'])
@jwt_required()
def delete_editorial(editorial_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        editorial = Editorial.query.get(editorial_id)
        
        if not editorial:
            return jsonify({'error': 'Editoria não encontrada'}), 404
        
        if user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem deletar editorias'}), 403
        
        db.session.delete(editorial)
        db.session.commit()
        
        return jsonify({'message': 'Editoria deletada com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@editorial_bp.route('/<editorial_id>/refresh', methods=['POST'])
@jwt_required()
def refresh_editorial(editorial_id):
    """Atualizar conteúdo da editoria manualmente"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        editorial = Editorial.query.get(editorial_id)
        
        if not editorial:
            return jsonify({'error': 'Editoria não encontrada'}), 404
        
        if user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para atualizar editorias'}), 403
        
        try:
            if editorial.editorial_type == 'rss' and editorial.feed_url:
                # Processar feed RSS
                feed = feedparser.parse(editorial.feed_url)
                
                # Limpar itens antigos
                EditorialItem.query.filter_by(editorial_id=editorial_id).delete()
                
                # Adicionar novos itens
                for entry in feed.entries[:editorial.max_items]:
                    item = EditorialItem(
                        editorial_id=editorial_id,
                        title=entry.get('title', ''),
                        description=entry.get('summary', ''),
                        content=entry.get('content', [{}])[0].get('value', '') if entry.get('content') else '',
                        source_url=entry.get('link', ''),
                        author=entry.get('author', ''),
                        published_at=datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') and entry.published_parsed else datetime.utcnow()
                    )
                    db.session.add(item)
                
                editorial.last_update = datetime.utcnow()
                editorial.last_error = None
                
            elif editorial.editorial_type == 'news':
                # Implementar integração com API de notícias
                # Exemplo usando NewsAPI (requer API key)
                pass
                
            elif editorial.editorial_type == 'weather':
                # Implementar integração com API de clima
                # Exemplo usando OpenWeatherMap (requer API key)
                pass
            
            db.session.commit()
            
            return jsonify({
                'message': 'Editoria atualizada com sucesso',
                'items_count': len(editorial.items),
                'last_update': editorial.last_update.isoformat()
            }), 200
            
        except Exception as refresh_error:
            editorial.last_error = str(refresh_error)
            editorial.last_update = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'error': f'Erro ao atualizar editoria: {str(refresh_error)}'
            }), 500
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@editorial_bp.route('/<editorial_id>/items', methods=['GET'])
@jwt_required()
def get_editorial_items(editorial_id):
    try:
        editorial = Editorial.query.get(editorial_id)
        
        if not editorial:
            return jsonify({'error': 'Editoria não encontrada'}), 404
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        pagination = EditorialItem.query.filter_by(
            editorial_id=editorial_id
        ).order_by(
            EditorialItem.published_at.desc()
        ).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'items': [item.to_dict() for item in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@editorial_bp.route('/types', methods=['GET'])
@jwt_required()
def get_editorial_types():
    """Listar tipos de editoria disponíveis"""
    try:
        types = [
            {'value': 'rss', 'label': 'Feed RSS', 'description': 'Feed RSS personalizado'},
            {'value': 'news', 'label': 'Notícias', 'description': 'Notícias automáticas via API'},
            {'value': 'weather', 'label': 'Clima', 'description': 'Informações meteorológicas'},
            {'value': 'sports', 'label': 'Esportes', 'description': 'Resultados esportivos'},
            {'value': 'finance', 'label': 'Finanças', 'description': 'Cotações e mercado financeiro'}
        ]
        
        return jsonify({'types': types}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@editorial_bp.route('/templates', methods=['GET'])
@jwt_required()
def get_editorial_templates():
    """Obter templates padrão para editorias"""
    try:
        templates = {
            'news': '''
                <div class="news-item">
                    <h2>{{title}}</h2>
                    <p class="description">{{description}}</p>
                    <div class="meta">
                        <span class="author">{{author}}</span>
                        <span class="date">{{published_at}}</span>
                    </div>
                </div>
            ''',
            'weather': '''
                <div class="weather-item">
                    <h2>{{location}}</h2>
                    <div class="temperature">{{temperature}}°C</div>
                    <div class="condition">{{condition}}</div>
                    <div class="humidity">Umidade: {{humidity}}%</div>
                </div>
            ''',
            'rss': '''
                <div class="rss-item">
                    <h3>{{title}}</h3>
                    <p>{{description}}</p>
                    <small>{{published_at}}</small>
                </div>
            '''
        }
        
        return jsonify({'templates': templates}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
