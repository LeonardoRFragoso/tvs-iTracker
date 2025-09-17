from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import os
import uuid
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

# Importar instância do banco
from database import db

# Carregar variáveis de ambiente
load_dotenv()

# Configuração da aplicação
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///tvs_platform.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 24)))
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', 104857600))  # 100MB

# Criar diretório de uploads se não existir
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Inicializar extensões
db.init_app(app)
migrate = Migrate(app, db)

# Configurar CORS de forma mais específica
cors = CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True,
        "expose_headers": ["Content-Range", "X-Content-Range"]
    },
    r"/socket.io/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# Add explicit OPTIONS handler for all API routes
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "*")
        response.headers.add('Access-Control-Allow-Methods', "*")
        return response

jwt = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"], 
                  async_mode='threading', logger=False, engineio_logger=False, 
                  ping_timeout=60, ping_interval=25)

# Importar modelos
from models.user import User
from models.content import Content
from models.content_distribution import ContentDistribution
from models.campaign import Campaign
from models.player import Player
from models.schedule import Schedule
from models.editorial import Editorial

# Importar rotas
from routes.auth import auth_bp
from routes.location import location_bp
from routes.content import content_bp
from routes.campaign import campaign_bp
from routes.campaign_content import campaign_content_bp
from routes.player import player_bp
from routes.schedule import schedule_bp
from routes.dashboard import dashboard_bp

# Registrar blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(location_bp, url_prefix='/api/locations')
app.register_blueprint(content_bp)  
app.register_blueprint(campaign_bp, url_prefix='/api/campaigns')
app.register_blueprint(campaign_content_bp)  
app.register_blueprint(player_bp, url_prefix='/api/players')
app.register_blueprint(schedule_bp, url_prefix='/api/schedules')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')

# Configurar scheduler para tarefas automáticas
scheduler = BackgroundScheduler()

# Adicionar job para verificar agendamentos a cada minuto
def check_schedules_with_context():
    """Wrapper para executar verificação de agendamentos com contexto da aplicação"""
    print(f"[{datetime.now()}] Executando verificação de agendamentos...")
    with app.app_context():
        from services.schedule_executor import schedule_executor
        schedule_executor.check_and_execute_schedules()

scheduler.add_job(
    func=check_schedules_with_context,
    trigger="interval",
    minutes=1,
    id='schedule_checker',
    name='Verificar e executar agendamentos'
)

# Iniciar o scheduler
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
    print("Iniciando scheduler...")
    scheduler.start()
    print("Scheduler iniciado com sucesso!")

# Importar e configurar executor de agendamentos
from services.schedule_executor import schedule_executor

# Configurar WebSocket no executor
@socketio.on('connect')
def handle_connect(auth):
    # Configurar socketio no executor quando houver conexão
    schedule_executor.socketio = socketio
    print(f"WebSocket connection attempt with auth: {auth}")
    
    if auth and 'token' in auth:
        try:
            # Verificar token JWT
            from flask_jwt_extended import decode_token
            decode_token(auth['token'])
            print("WebSocket connection successful")
            return True
        except Exception as e:
            print(f"WebSocket authentication failed: {e}")
            return False
    return False

# WebSocket events
@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")

@socketio.on('join_player')
def handle_join_player(data):
    player_id = data.get('player_id')
    if player_id:
        join_room(f'player_{player_id}')
        emit('joined_player', {'player_id': player_id})

@socketio.on('player_sync_request')
def handle_player_sync_request(data):
    try:
        player_id = data.get('player_id')
        if not player_id:
            emit('error', {'message': 'player_id é obrigatório'})
            return
        
        from services.distribution_manager import ContentDistributionManager
        manager = ContentDistributionManager()
        
        # Obter lista de conteúdo para o player
        content_list = manager.get_player_content_list(player_id)
        
        emit('sync_response', {
            'player_id': player_id,
            'content_list': content_list,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('distribution_status_update')
def handle_distribution_status_update(data):
    try:
        distribution_id = data.get('distribution_id')
        status = data.get('status')
        progress = data.get('progress', 0)
        error_message = data.get('error_message')
        
        if not distribution_id or not status:
            emit('error', {'message': 'distribution_id e status são obrigatórios'})
            return
        
        from models.content_distribution import ContentDistribution, db
        
        distribution = ContentDistribution.query.get(distribution_id)
        if not distribution:
            emit('error', {'message': 'Distribuição não encontrada'})
            return
        
        # Atualizar status da distribuição
        distribution.status = status
        distribution.progress_percentage = progress
        distribution.updated_at = datetime.utcnow()
        
        if status == 'downloading' and not distribution.started_at:
            distribution.started_at = datetime.utcnow()
        elif status == 'completed':
            distribution.completed_at = datetime.utcnow()
            distribution.progress_percentage = 100
        elif status == 'failed':
            distribution.error_message = error_message
            distribution.retry_count += 1
        
        db.session.commit()
        
        # Notificar outros clientes sobre a atualização
        socketio.emit('distribution_updated', {
            'distribution_id': distribution_id,
            'status': status,
            'progress': progress,
            'player_id': distribution.player_id,
            'content_id': distribution.content_id
        }, room='admin')
        
        emit('status_update_confirmed', {
            'distribution_id': distribution_id,
            'status': status
        })
        
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})

@socketio.on('join_admin_room')
def handle_join_admin_room():
    """Permite que administradores se juntem à sala para receber notificações"""
    try:
        # Verificar se o usuário tem permissão de admin
        token = request.args.get('token')
        if token:
            from flask_jwt_extended import decode_token
            from models.user import User
            
            try:
                decoded = decode_token(token)
                user_id = decoded['sub']
                user = User.query.get(user_id)
                
                if user and user.role in ['admin', 'manager']:
                    join_room('admin')
                    emit('joined_admin_room', {'message': 'Conectado à sala de administração'})
                else:
                    emit('error', {'message': 'Sem permissão para sala de administração'})
            except:
                emit('error', {'message': 'Token inválido'})
        else:
            emit('error', {'message': 'Token não fornecido'})
            
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('leave_admin_room')
def handle_leave_admin_room():
    """Permite que usuários saiam da sala de administração"""
    leave_room('admin')
    emit('left_admin_room', {'message': 'Desconectado da sala de administração'})

@socketio.on('player_heartbeat')
def handle_player_heartbeat(data):
    """Recebe heartbeat dos players para atualizar status online"""
    try:
        player_id = data.get('player_id')
        storage_info = data.get('storage_info', {})
        network_info = data.get('network_info', {})
        
        if not player_id:
            emit('error', {'message': 'player_id é obrigatório'})
            return
        
        from models.player import Player, db
        
        player = Player.query.get(player_id)
        if not player:
            emit('error', {'message': 'Player não encontrado'})
            return
        
        # Atualizar informações do player
        player.last_seen = datetime.utcnow()
        player.is_online = True
        
        if storage_info:
            player.storage_used_gb = storage_info.get('used_gb', player.storage_used_gb)
            player.storage_capacity_gb = storage_info.get('capacity_gb', player.storage_capacity_gb)
        
        if network_info:
            player.network_speed_mbps = network_info.get('speed_mbps', player.network_speed_mbps)
        
        db.session.commit()
        
        # Notificar administradores sobre o status do player
        socketio.emit('player_status_update', {
            'player_id': player_id,
            'is_online': True,
            'last_seen': player.last_seen.isoformat(),
            'storage_used_gb': player.storage_used_gb,
            'storage_capacity_gb': player.storage_capacity_gb
        }, room='admin')
        
        emit('heartbeat_confirmed', {
            'player_id': player_id,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})

@socketio.on('request_content_download')
def handle_content_download_request(data):
    """Player solicita download de conteúdo específico"""
    try:
        player_id = data.get('player_id')
        content_id = data.get('content_id')
        
        if not player_id or not content_id:
            emit('error', {'message': 'player_id e content_id são obrigatórios'})
            return
        
        from models.content import Content
        from models.player import Player
        from services.distribution_manager import ContentDistributionManager
        
        player = Player.query.get(player_id)
        content = Content.query.get(content_id)
        
        if not player:
            emit('error', {'message': 'Player não encontrado'})
            return
        
        if not content:
            emit('error', {'message': 'Conteúdo não encontrado'})
            return
        
        # Criar distribuição se não existir
        manager = ContentDistributionManager()
        distribution_id = manager.distribute_to_player(content_id, player_id, 'high')
        
        emit('download_authorized', {
            'distribution_id': distribution_id,
            'content_id': content_id,
            'download_url': f"/api/content/{content_id}/download",
            'file_size_mb': content.file_size_mb,
            'checksum': content.checksum
        })
        
    except Exception as e:
        emit('error', {'message': str(e)})

# Rota para servir arquivos de upload
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Inicializar banco de dados
def create_tables():
    with app.app_context():
        db.create_all()
        
        # Criar usuário admin padrão
        admin = User.query.filter_by(email='admin@tvs.com').first()
        if not admin:
            admin = User(
                username='admin',
                email='admin@tvs.com',
                password_hash=generate_password_hash('admin123'),
                role='admin'
            )
            db.session.add(admin)
            db.session.commit()

if __name__ == '__main__':
    create_tables()
    atexit.register(lambda: scheduler.shutdown())
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
