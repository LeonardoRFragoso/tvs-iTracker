from flask import Flask, jsonify, redirect, request
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_socketio import SocketIO
from dotenv import load_dotenv
import os
from datetime import timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

# App/DB
from database import db

# Blueprints existentes
from routes.auth import auth_bp
from routes.location import location_bp
from routes.content import content_bp
from routes.campaign import campaign_bp
from routes.campaign_content import campaign_content_bp
from routes.player import player_bp
from routes.schedule import schedule_bp
from routes.dashboard import dashboard_bp
from routes.cast import cast_bp
from routes.settings import settings_bp

# Registros modulares
from public.routes import register_public_routes
from public.service_worker import register_service_worker
from monitoring.middleware import register_monitoring_middleware
from monitoring.routes import register_monitoring_routes
from realtime.handlers import register_socketio_handlers

# Estado para limpeza graciosa
from monitoring.state import TRAFFIC_MINUTE, TRAFFIC_LOCK
from realtime.state import CONNECTED_PLAYERS, SOCKET_SID_TO_PLAYER, SOCKET_SID_TO_USER

# Model para criação de admin default
from models.user import User

load_dotenv()

# Flask app
app = Flask(__name__, static_folder=None)
app.url_map.strict_slashes = False
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# Config
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///tvs_platform.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 24)))
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
if not os.path.isabs(app.config['UPLOAD_FOLDER']):
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), app.config['UPLOAD_FOLDER'])
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', 52428800))  # 50MB

# Extensões
db.init_app(app)
migrate = Migrate(app, db)
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True,
        "expose_headers": ["Content-Range", "X-Content-Range", "ETag"]
    },
    r"/socket.io/*": {
        "origins": "*",
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    },
    r"/uploads/*": {
        "origins": "*",
        "methods": ["GET", "OPTIONS"],
        "allow_headers": ["Range", "Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True,
        "expose_headers": ["Content-Length", "Content-Range", "Accept-Ranges"]
    }
})

jwt = JWTManager(app)

# JWT error handlers (evitam 500)
@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    return jsonify({'msg': 'Token inválido'}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'msg': 'Token expirado'}), 401

@jwt.unauthorized_loader
def missing_token_callback(error_string):
    return jsonify({'msg': 'Token de autorização necessário'}), 401

# Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', logger=False, engineio_logger=False,
                    ping_timeout=60, ping_interval=30)
app.socketio = socketio

# Blueprints REST
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(location_bp, url_prefix='/api/locations')
app.register_blueprint(content_bp, url_prefix='/api/content')
app.register_blueprint(campaign_bp, url_prefix='/api/campaigns')
app.register_blueprint(campaign_content_bp)
app.register_blueprint(player_bp, url_prefix='/api/players')
app.register_blueprint(schedule_bp, url_prefix='/api/schedules')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
app.register_blueprint(cast_bp, url_prefix='/api/cast')
app.register_blueprint(settings_bp)

# Registros modulares
register_public_routes(app)
register_service_worker(app)
register_monitoring_middleware(app)
register_monitoring_routes(app)
register_socketio_handlers(socketio, app)

# Handlers de erro globais
@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Endpoint não encontrado'}), 404
    return redirect('/')

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Erro interno do servidor'}), 500
    return jsonify({'error': 'Erro interno do servidor'}), 500

@app.errorhandler(413)
def too_large(error):
    return jsonify({'error': 'Arquivo muito grande'}), 413

# Scheduler
scheduler = BackgroundScheduler()

def setup_scheduler_jobs():
    """Configura todos os jobs via módulo monitoring.jobs"""
    with app.app_context():
        try:
            from monitoring.jobs import configure_scheduler_jobs
            configure_scheduler_jobs(scheduler, app, socketio)
        except Exception as e:
            print(f"[Scheduler] Erro ao configurar jobs: {e}")

# Limpeza graciosa

def cleanup_resources():
    try:
        print("[Shutdown] Limpando recursos...")
        CONNECTED_PLAYERS.clear()
        SOCKET_SID_TO_PLAYER.clear()
        SOCKET_SID_TO_USER.clear()
        if len(TRAFFIC_MINUTE) > 1000:
            with TRAFFIC_LOCK:
                TRAFFIC_MINUTE.clear()
        print("[Shutdown] Recursos limpos")
    except Exception as e:
        print(f"[Shutdown] Erro na limpeza: {e}")


def _safe_scheduler_shutdown():
    try:
        if scheduler.running:
            print("[Scheduler] Parando scheduler...")
            scheduler.shutdown(wait=False)
            print("[Scheduler] Scheduler parado")
    except Exception as e:
        print(f"[Scheduler] Erro ao parar: {e}")

atexit.register(cleanup_resources)
atexit.register(_safe_scheduler_shutdown)

# Bootstrap mínimo de tabelas e admin default
from werkzeug.security import generate_password_hash

def create_tables():
    with app.app_context():
        try:
            db.create_all()
            admin = User.query.filter_by(email='admin@tvs.com').first()
            if not admin:
                print("[Init] Criando usuário admin padrão...")
                admin = User(
                    username='admin',
                    email='admin@tvs.com',
                    password_hash=generate_password_hash('admin123'),
                    role='admin',
                    company='iTracker'
                )
                db.session.add(admin)
                db.session.commit()
                print("[Init] Usuário admin criado: admin@tvs.com / admin123")
        except Exception as e:
            print(f"[Init] Erro ao criar tabelas: {e}")
            db.session.rollback()

# Inicialização principal

def start_application():
    print("="*60)
    print(" TVs iTracker - Plataforma de TVs Corporativas")
    print("="*60)

    tv_mode = os.getenv('TV_MODE', 'false').lower() == 'true'
    port = 80 if tv_mode else int(os.getenv('PORT', 5000))
    host = '0.0.0.0'

    print("[Configuração]")
    print(f"├─ Modo TV: {'Ativado' if tv_mode else 'Desativado'}")
    print(f"├─ Host: {host}")
    print(f"├─ Porta: {port}")
    print(f"├─ Debug: {'Ativado' if app.debug else 'Desativado'}")
    print(f"├─ Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"├─ Uploads: {app.config['UPLOAD_FOLDER']}")

    create_tables()

    try:
        if not scheduler.running:
            scheduler.start()
            print("[Scheduler] Iniciado com sucesso")
        setup_scheduler_jobs()
    except Exception as e:
        print(f"[Scheduler] Erro ao iniciar/configurar: {e}")

    print("\n[Status] Aplicação configurada e pronta para iniciar")
    print("="*60)

    try:
        socketio.run(
            app,
            debug=True,
            host=host,
            port=port,
            allow_unsafe_werkzeug=True,
            use_reloader=False
        )
    except PermissionError:
        print(f"\n[ERRO] Porta {port} requer privilégios de administrador")
        if port == 80:
            print("Tentando porta padrão 5000...")
            socketio.run(app, debug=True, host=host, port=5000, allow_unsafe_werkzeug=True, use_reloader=False)
    except Exception as e:
        print(f"\n[ERRO CRÍTICO] Falha na inicialização: {e}")
    finally:
        cleanup_resources()


if __name__ == '__main__':
    start_application()
