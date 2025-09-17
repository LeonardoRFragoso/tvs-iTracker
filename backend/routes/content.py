from flask import Blueprint, request, jsonify, current_app, make_response, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from PIL import Image
import os
import uuid
import subprocess
from datetime import datetime
from models.content import Content, db
from models.user import User

content_bp = Blueprint('content', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'html', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_content_type(filename):
    ext = filename.rsplit('.', 1)[1].lower()
    if ext in ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']:
        return 'image'
    elif ext in ['mp4', 'avi', 'mov', 'wmv', 'flv']:
        return 'video'
    elif ext in ['html']:
        return 'html'
    elif ext in ['txt']:
        return 'text'
    return 'unknown'

def generate_video_thumbnail(video_path, thumbnail_path):
    """Gera thumbnail de vídeo usando FFmpeg"""
    try:
        # Comando FFmpeg para gerar thumbnail no segundo 1 do vídeo
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-ss', '00:00:01.000',
            '-vframes', '1',
            '-q:v', '2',
            '-y',  # Sobrescrever arquivo existente
            thumbnail_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            return True
        else:
            print(f"FFmpeg error: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("FFmpeg timeout - vídeo muito longo ou corrompido")
        return False
    except FileNotFoundError:
        print("FFmpeg não encontrado. Instale FFmpeg para gerar thumbnails de vídeo.")
        return False
    except Exception as e:
        print(f"Erro ao gerar thumbnail: {str(e)}")
        return False

def generate_image_thumbnail(image_path, thumbnail_path, size=(300, 200)):
    """Gera thumbnail de imagem usando PIL"""
    try:
        with Image.open(image_path) as img:
            # Converter para RGB se necessário
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Redimensionar mantendo proporção
            img.thumbnail(size, Image.Resampling.LANCZOS)
            
            # Salvar thumbnail
            img.save(thumbnail_path, 'JPEG', quality=85)
            return True
            
    except Exception as e:
        print(f"Erro ao gerar thumbnail de imagem: {str(e)}")
        return False

# Endpoint para servir arquivos de mídia
@content_bp.route('/media/<filename>')
def serve_media(filename):
    """Serve arquivos de mídia do diretório de uploads"""
    try:
        return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)
    except FileNotFoundError:
        return jsonify({'error': 'Arquivo não encontrado'}), 404

# Alias com prefixo /api para compatibilidade com o frontend
@content_bp.route('/api/content/media/<filename>')
def serve_media_api(filename):
    return serve_media(filename)

# Endpoint para servir thumbnails
@content_bp.route('/content/thumbnails/<filename>')
def serve_thumbnail(filename):
    """Serve thumbnails do diretório de thumbnails"""
    try:
        thumbnail_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'thumbnails')
        return send_from_directory(thumbnail_dir, filename)
    except FileNotFoundError:
        return jsonify({'error': 'Thumbnail não encontrado'}), 404

# Alias com prefixo /api para compatibilidade com o frontend
@content_bp.route('/api/content/thumbnails/<filename>')
def serve_thumbnail_api(filename):
    return serve_thumbnail(filename)

# Add route without trailing slash to avoid 308 redirects
@content_bp.route('/api/content', methods=['GET', 'POST'])
@content_bp.route('/api/content/', methods=['GET', 'POST'])
@jwt_required()
def handle_content():
    if request.method == 'GET':
        return list_content()
    else:
        return create_content()

@content_bp.route('/api/content/<content_id>', methods=['GET'])
@jwt_required()
def get_content(content_id):
    try:
        content = Content.query.get(content_id)
        
        if not content:
            return jsonify({'error': 'Conteúdo não encontrado'}), 404
        
        return jsonify({'content': content.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error getting content: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@content_bp.route('/api/content/<content_id>', methods=['PUT'])
@jwt_required()
def update_content(content_id):
    try:
        user_id = get_jwt_identity()
        content = Content.query.get(content_id)
        
        if not content:
            return jsonify({'error': 'Conteúdo não encontrado'}), 404
        
        # Verificar permissão
        user = User.query.get(user_id)
        if content.user_id != user_id and user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para editar este conteúdo'}), 403
        
        # Atualização pode vir como multipart/form-data (com arquivo) ou JSON
        is_multipart = 'file' in request.files or request.content_type and 'multipart/form-data' in request.content_type
        
        if is_multipart:
            # Campos de formulário
            form = request.form
            file = request.files.get('file')
            
            # Atualizar campos textuais
            if 'title' in form:
                content.title = form.get('title', content.title)
            if 'description' in form:
                content.description = form.get('description', content.description)
            if 'category' in form:
                content.category = form.get('category', content.category)
            if 'tags' in form:
                content.tags = form.get('tags', content.tags)
            if 'duration' in form and form.get('duration') not in (None, ''):
                try:
                    content.duration = int(float(form.get('duration')))
                except ValueError:
                    pass
            if 'is_active' in form:
                content.is_active = form.get('is_active') in ['true', 'True', True]
            
            # Atualizar arquivo, se enviado
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                unique_filename = f"{uuid.uuid4()}_{filename}"
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(file_path)
                
                # Atualizar metadados do arquivo
                content.file_path = unique_filename
                content.file_size = os.path.getsize(file_path)
                content.mime_type = file.mimetype
                
                # Atualizar content_type inferindo pela extensão
                content.content_type = get_content_type(filename)
                
                # Regenerar thumbnail
                thumbnails_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'thumbnails')
                os.makedirs(thumbnails_dir, exist_ok=True)
                thumbnail_path = os.path.join(thumbnails_dir, f"{uuid.uuid4()}.jpg")
                if content.content_type == 'video':
                    generate_video_thumbnail(file_path, thumbnail_path)
                elif content.content_type == 'image':
                    generate_image_thumbnail(file_path, thumbnail_path)
                # Para outros tipos, thumbnail é opcional
                if os.path.exists(thumbnail_path):
                    content.thumbnail_path = os.path.basename(thumbnail_path)
        else:
            # JSON puro
            data = request.get_json(force=True, silent=False)
            
            if 'title' in data:
                content.title = data['title']
            if 'description' in data:
                content.description = data['description']
            if 'duration' in data:
                content.duration = data['duration']
            if 'tags' in data:
                content.tags = data['tags']
            if 'category' in data:
                content.category = data['category']
            if 'is_active' in data:
                content.is_active = data['is_active']
        
        content.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Conteúdo atualizado com sucesso',
            'content': content.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating content: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@content_bp.route('/api/content/<content_id>', methods=['DELETE'])
@jwt_required()
def delete_content(content_id):
    try:
        user_id = get_jwt_identity()
        content = Content.query.get(content_id)
        
        if not content:
            return jsonify({'error': 'Conteúdo não encontrado'}), 404
        
        # Verificar permissão
        user = User.query.get(user_id)
        if content.user_id != user_id and user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão para deletar este conteúdo'}), 403
        
        # Importar CampaignContent e ContentDistribution aqui para evitar imports circulares
        from models.campaign import CampaignContent
        from models.content_distribution import ContentDistribution
        
        # Usar SQL direto para evitar problemas de relacionamento do SQLAlchemy
        # Remover dependências em CampaignContent primeiro
        db.session.execute(
            db.text("DELETE FROM campaign_contents WHERE content_id = :content_id"),
            {"content_id": content_id}
        )
        
        # Remover dependências em ContentDistribution
        db.session.execute(
            db.text("DELETE FROM content_distributions WHERE content_id = :content_id"),
            {"content_id": content_id}
        )
        
        # Remover arquivo físico
        if content.file_path:
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], content.file_path)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError as e:
                    print(f"Erro ao remover arquivo: {e}")
        
        # Remover thumbnail se existir
        if content.thumbnail_path:
            thumbnail_path = os.path.join(current_app.config['UPLOAD_FOLDER'], 'thumbnails', content.thumbnail_path)
            if os.path.exists(thumbnail_path):
                try:
                    os.remove(thumbnail_path)
                except OSError as e:
                    print(f"Erro ao remover thumbnail: {e}")
        
        # Deletar o conteúdo usando SQL direto
        db.session.execute(
            db.text("DELETE FROM contents WHERE id = :content_id"),
            {"content_id": content_id}
        )
        
        db.session.commit()
        
        return jsonify({'message': 'Conteúdo deletado com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting content: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@content_bp.route('/api/content/categories', methods=['GET'])
@jwt_required()
def get_categories():
    try:
        categories = db.session.query(Content.category).distinct().all()
        categories = [cat[0] for cat in categories if cat[0]]
        
        return jsonify({'categories': categories}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error getting categories: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@content_bp.route('/api/content/stats', methods=['GET'])
@jwt_required()
def get_content_stats():
    try:
        total_content = Content.query.filter(Content.is_active == True).count()
        
        stats_by_type = db.session.query(
            Content.content_type,
            db.func.count(Content.id).label('count')
        ).filter(Content.is_active == True).group_by(Content.content_type).all()
        
        total_size = db.session.query(
            db.func.sum(Content.file_size)
        ).filter(Content.is_active == True).scalar() or 0
        
        return jsonify({
            'total_content': total_content,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'by_type': {stat[0]: stat[1] for stat in stats_by_type}
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error getting content stats: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def list_content():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        category = request.args.get('category')
        content_type = request.args.get('type')
        search = request.args.get('search')
        
        query = Content.query
        
        if category:
            query = query.filter(Content.category == category)
        
        if content_type:
            query = query.filter(Content.content_type == content_type)
        
        if search:
            query = query.filter(Content.title.contains(search))
        
        query = query.filter(Content.is_active == True)
        query = query.order_by(Content.created_at.desc())
        
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'contents': [content.to_dict() for content in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error listing content: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def create_content():
    try:
        user_id = get_jwt_identity()
        
        # Verificar se é upload de arquivo
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
            
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                unique_filename = f"{uuid.uuid4()}_{filename}"
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                
                file.save(file_path)
                
                # Obter informações do arquivo
                file_size = os.path.getsize(file_path)
                content_type = get_content_type(filename)
                
                # Para imagens, obter dimensões
                duration = 10  # padrão
                if content_type == 'image':
                    try:
                        with Image.open(file_path) as img:
                            width, height = img.size
                    except:
                        pass
                
                # Gerar thumbnail
                thumbnails_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'thumbnails')
                os.makedirs(thumbnails_dir, exist_ok=True)
                thumbnail_path = os.path.join(thumbnails_dir, f"{uuid.uuid4()}.jpg")
                
                if content_type == 'video':
                    generate_video_thumbnail(file_path, thumbnail_path)
                elif content_type == 'image':
                    generate_image_thumbnail(file_path, thumbnail_path)
                
                content = Content(
                    title=request.form.get('title', filename),
                    description=request.form.get('description', ''),
                    content_type=content_type,
                    file_path=unique_filename,
                    file_size=file_size,
                    mime_type=file.mimetype,
                    duration=int(float(request.form.get('duration', duration))),
                    tags=request.form.get('tags', ''),
                    category=request.form.get('category', 'default'),
                    user_id=user_id,
                    thumbnail_path=os.path.basename(thumbnail_path)
                )
                
        else:
            # Conteúdo texto/HTML
            data = request.get_json()
            
            if not data.get('title'):
                return jsonify({'error': 'Título é obrigatório'}), 400
            
            content = Content(
                title=data['title'],
                description=data.get('description', ''),
                content_type=data.get('content_type', 'text'),
                duration=data.get('duration', 10),
                tags=data.get('tags', ''),
                category=data.get('category', 'default'),
                user_id=user_id
            )
            
            # Para conteúdo HTML/texto, salvar em arquivo
            if data.get('content'):
                unique_filename = f"{uuid.uuid4()}.html"
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(data['content'])
                
                content.file_path = unique_filename
                content.file_size = os.path.getsize(file_path)
        
        db.session.add(content)
        db.session.commit()
        
        return jsonify({
            'message': 'Conteúdo criado com sucesso',
            'content': content.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating content: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
