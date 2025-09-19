from flask import Flask, request, jsonify, send_from_directory, make_response, redirect
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv
import os
import uuid
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import atexit
from sqlalchemy import text

# Importar instância do banco
from database import db

# Carregar variáveis de ambiente
load_dotenv()

# Configuração da aplicação (desabilita rota estática padrão para evitar conflito)
app = Flask(__name__, static_folder=None)
# Ensure correct host/scheme/IP when behind a reverse proxy (Nginx/Caddy)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)
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
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True,
        "expose_headers": ["Content-Range", "X-Content-Range"]
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
socketio = SocketIO(app, cors_allowed_origins="*", 
                  async_mode='threading', logger=False, engineio_logger=False, 
                  ping_timeout=60, ping_interval=25)
app.socketio = socketio

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

    try:
        # Kiosk/public mode: allow connection without JWT
        if auth and auth.get('public'):
            print("WebSocket public kiosk connection accepted")
            return True

        # Authenticated users: require valid JWT
        if auth and 'token' in auth:
            from flask_jwt_extended import decode_token
            decode_token(auth['token'])
            print("WebSocket connection successful (JWT)")
            return True
    except Exception as e:
        print(f"WebSocket authentication failed: {e}")
        return False

    # Default deny if neither public nor token was provided
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
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Endpoint para descobrir IP da máquina (útil para configuração automática)
@app.route('/api/system/network-info')
def get_network_info():
    """Retorna informações de rede da máquina para configuração automática"""
    try:
        import socket
        # Descobrir IP local
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        return jsonify({
            'local_ip': local_ip,
            'suggested_frontend_url': f'http://{local_ip}:3000',
            'suggested_backend_url': f'http://{local_ip}:5000',
            'kiosk_base_url': f'http://{local_ip}:3000/k/',
            'current_detected_ip': '192.168.113.97'  # Seu IP atual
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ------------------------------
# TV/Kiosk landing + SPA serving
# ------------------------------
import os

def _react_build_dir() -> str:
    return os.path.join(os.path.dirname(__file__), 'build')

def _has_react_build() -> bool:
    try:
        return os.path.exists(os.path.join(_react_build_dir(), 'index.html'))
    except Exception:
        return False

def _serve_react_index():
    # Serve CRA build index.html if present
    return send_from_directory(_react_build_dir(), 'index.html')

def _kiosk_landing_html(prefill_code: str = ''):
    html = f"""
    <!DOCTYPE html>
    <html lang="pt-br">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <title>TVs iTracker - Entrar no Player</title>
        <style>
          html, body {{ height: 100%; margin: 0; }}
          body {{ background: #000; color: #fff; font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; }}
          .card {{ width: 92%; max-width: 520px; background: #111; padding: 28px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.6); }}
          h1 {{ margin: 0 0 12px; font-size: 22px; }}
          p {{ margin: 6px 0 18px; color: #aaa; }}
          .row {{ display: flex; gap: 10px; }}
          input {{ flex: 1; padding: 14px 16px; font-size: 22px; border-radius: 8px; border: 1px solid #333; background: #000; color: #fff; text-align: center; letter-spacing: 2px; }}
          button {{ padding: 14px 18px; font-size: 18px; border-radius: 8px; border: 0; background: #0d6efd; color: #fff; cursor: pointer; }}
          button:disabled {{ opacity: .7; cursor: not-allowed; }}
          .hint {{ font-size: 14px; color: #888; margin-top: 12px; }}
          .error {{ color: #ff6b6b; margin-top: 12px; }}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>TVs iTracker</h1>
          <p>Digite o código do player (6 a 8 dígitos) para iniciar.</p>
          <div class="row">
            <input id="code" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="one-time-code" placeholder="Ex: 386342" value="{prefill_code}" autofocus />
            <button id="go">Entrar</button>
          </div>
          <div class="hint">Dica: abra apenas <strong>http://{request.host}/</strong> no navegador da TV/celular.</div>
          <div id="msg" class="error" role="alert" aria-live="polite"></div>
        </div>
        <script>
          const input = document.getElementById('code');
          const btn = document.getElementById('go');
          const msg = document.getElementById('msg');

          async function resolveAndGo(code) {{
            msg.textContent = '';
            if (!code) {{ msg.textContent = 'Informe o código do player.'; return; }}
            try {{
              btn.disabled = true;
              const res = await fetch(`/api/players/resolve-code/${{code}}`);
              const data = await res.json();
              if (res.ok && data.player_id) {{
                window.location.href = `/kiosk/player/${{data.player_id}}?fullscreen=true`;
              }} else {{
                msg.textContent = data.error || 'Código inválido';
              }}
            }} catch (e) {{
              msg.textContent = 'Falha de rede. Verifique se o celular/TV está na mesma rede.';
            }} finally {{
              btn.disabled = false;
            }}
          }}

          btn.addEventListener('click', () => resolveAndGo(input.value.trim()));
          input.addEventListener('keydown', (e) => {{ if (e.key === 'Enter') resolveAndGo(input.value.trim()); }});

          // Suporte a ?code=XXXXX para redireciono automático
          const params = new URLSearchParams(window.location.search);
          const q = params.get('code');
          if (q && !input.value) {{ input.value = q; resolveAndGo(q); }}
        </script>
      </body>
    </html>
    """
    resp = make_response(html)
    resp.headers['Content-Type'] = 'text/html; charset=utf-8'
    return resp

# Short-link público /k/<code>
@app.route('/k/<code>')
def short_link_kiosk(code):
    # Sempre resolve no backend para garantir redirecionamento robusto
    try:
        player = Player.query.filter(Player.access_code == code.upper()).first()
        if player:
            return redirect(f"/kiosk/player/{player.id}?fullscreen=true")
        return _kiosk_landing_html(prefill_code=code)
    except Exception:
        return _kiosk_landing_html(prefill_code=code)

# Rota raiz: serve kiosk landing page
@app.route('/')
def root_index():
    return _kiosk_landing_html()

# Admin SPA served under /app so root (/) can stay as TV landing
@app.route('/app')
@app.route('/app/<path:path>')
def serve_admin_app(path=''):
    if _has_react_build():
        return _serve_react_index()
    return _kiosk_landing_html()

# Página simples dedicada para TVs/celulares: sempre exibe o formulário de código
@app.route('/tv')
def tv_landing():
    return _kiosk_landing_html()

# Rotas estáticas do build (quando disponível)
@app.route('/static/<path:filename>')
def serve_build_static(filename):
    try:
        return send_from_directory(os.path.join(_react_build_dir(), 'static'), filename)
    except Exception:
        return jsonify({'error': 'Arquivo não encontrado'}), 404

@app.route('/manifest.json')
def serve_manifest():
    try:
        return send_from_directory(_react_build_dir(), 'manifest.json')
    except Exception:
        return jsonify({'error': 'Manifest não encontrado'}), 404

@app.route('/favicon.ico')
def serve_favicon():
    try:
        return send_from_directory(_react_build_dir(), 'favicon.ico')
    except Exception:
        return jsonify({'error': 'Favicon não encontrado'}), 404

# Página pública do player no SPA
@app.route('/kiosk/player/<player_id>')
def kiosk_player_page(player_id):
    if _has_react_build():
        return _serve_react_index()
    return _kiosk_landing_html()

# Utilitário: garantir colunas 'company' nos bancos existentes (SQLite)
def ensure_company_columns():
    try:
        engine = db.engine
        with engine.connect() as conn:
            for table in ['users', 'locations', 'location']:
                try:
                    result = conn.execute(text(f"PRAGMA table_info({table})"))
                    rows = result.fetchall()
                    if rows:
                        colnames = [r[1] for r in rows]
                        if 'company' not in colnames:
                            print(f"[DB] Adicionando coluna 'company' à tabela {table}...")
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN company VARCHAR(100) DEFAULT 'iTracker'"))
                            print(f"[DB] Coluna 'company' adicionada à tabela {table}")
                        # Extras apenas para tabela users
                        if table == 'users':
                            if 'status' not in colnames:
                                print("[DB] Adicionando coluna 'status' à tabela users...")
                                conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'"))
                            if 'must_change_password' not in colnames:
                                print("[DB] Adicionando coluna 'must_change_password' à tabela users...")
                                conn.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0"))
                except Exception as inner_e:
                    print(f"[DB] Não foi possível verificar/adicionar coluna em {table}: {inner_e}")
    except Exception as e:
        print(f"[DB] Erro ao garantir colunas 'company': {e}")

# Utilitário: garantir coluna 'access_code' em players (SQLite auto-reparo)
def ensure_player_access_code_column():
    try:
        engine = db.engine
        with engine.connect() as conn:
            # Detectar tabela de players
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('players','player')"))
            rows = result.fetchall()
            if not rows:
                return
            table = 'players' if any(r[0] == 'players' for r in rows) else rows[0][0]
            # Verificar colunas existentes
            info = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            colnames = [r[1] for r in info]
            if 'access_code' not in colnames:
                print(f"[DB] Adicionando coluna 'access_code' à tabela {table}...")
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN access_code VARCHAR(12)"))
                try:
                    conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{table}_access_code ON {table} (access_code)"))
                except Exception as idx_e:
                    print(f"[DB] Falha ao criar índice único para access_code: {idx_e}")
                # Backfill códigos
                import random
                ALPHABET = '23456789'
                def gen_code(n=6):
                    return ''.join(random.choice(ALPHABET) for _ in range(n))
                # Atualizar linhas sem código
                ids = conn.execute(text(f"SELECT id FROM {table} WHERE access_code IS NULL OR access_code = ''")).fetchall()
                for (pid,) in ids:
                    attempts = 0
                    while attempts < 20:
                        code = gen_code(6)
                        try:
                            conn.execute(text(f"UPDATE {table} SET access_code = :code WHERE id = :pid"), {'code': code, 'pid': pid})
                            break
                        except Exception:
                            attempts += 1
            else:
                # Garantir índice mesmo se coluna já existir
                try:
                    conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{table}_access_code ON {table} (access_code)"))
                except Exception:
                    pass
    except Exception as e:
        print(f"[DB] Erro ao garantir coluna 'access_code' em players: {e}")

# Executar salvaguardas de esquema no primeiro request (compatível com Flask 3)
_schema_bootstrap_done = False

@app.before_request
def _bootstrap_schema_safeguards_once():
    global _schema_bootstrap_done
    if not _schema_bootstrap_done:
        try:
            ensure_company_columns()
            ensure_player_access_code_column()
        except Exception as e:
            print(f"[DB] Erro no bootstrap de esquema: {e}")
        _schema_bootstrap_done = True

# Inicializar banco de dados
def create_tables():
    with app.app_context():
        db.create_all()
        # Garantir colunas 'company' em DBs já existentes
        ensure_company_columns()
        # Garantir coluna access_code em players
        ensure_player_access_code_column()
        
        # Criar usuário admin padrão
        admin = User.query.filter_by(email='admin@tvs.com').first()
        if not admin:
            admin = User(
                username='admin',
                email='admin@tvs.com',
                password_hash=generate_password_hash('admin123'),
                role='admin',
                company='iTracker'
            )
            db.session.add(admin)
            db.session.commit()

if __name__ == '__main__':
    create_tables()
    atexit.register(lambda: scheduler.shutdown())
    
    # Detectar modo TV pela variável de ambiente
    tv_mode = os.getenv('TV_MODE', 'false').lower() == 'true'
    port = 80 if tv_mode else 5000
    
    print(f"[TVS Backend] Modo TV: {'Ativado' if tv_mode else 'Desativado'}")
    print(f"[TVS Backend] Porta: {port}")
    
    if tv_mode:
        print("[TVS Backend] ATENÇÃO: Executando na porta 80 - requer privilégios de administrador")
        print("[TVS Backend] URLs para TV:")
        print("[TVS Backend] - http://192.168.0.4/")
        print("[TVS Backend] - http://192.168.0.4/k/386342")
        print("[TVS Backend] - http://192.168.0.4/api/players/...")
    
    try:
        socketio.run(app, debug=True, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
    except PermissionError:
        print(f"[ERRO] Porta {port} requer privilégios de administrador")
        print("Execute como administrador ou use: set TV_MODE=false")
    except OSError as e:
        print(f"[ERRO] Não foi possível iniciar na porta {port}: {e}")
        if port == 80:
            print("Tentando porta padrão 5000...")
            socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
