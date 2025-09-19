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
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.base import SchedulerNotRunningError, SchedulerAlreadyRunningError
import atexit
from sqlalchemy import text
from threading import Lock

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
                  ping_timeout=60, ping_interval=30)
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
from routes.cast import cast_bp

# Registrar blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(location_bp, url_prefix='/api/locations')
app.register_blueprint(content_bp)  
app.register_blueprint(campaign_bp, url_prefix='/api/campaigns')
app.register_blueprint(campaign_content_bp)  
app.register_blueprint(player_bp, url_prefix='/api/players')
app.register_blueprint(schedule_bp, url_prefix='/api/schedules')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
app.register_blueprint(cast_bp, url_prefix='/api/cast')

# Configurar scheduler para tarefas automáticas
scheduler = BackgroundScheduler()

# Adicionar job para verificar agendamentos a cada minuto
def check_schedules_with_context():
    """Wrapper para executar verificação de agendamentos com contexto da aplicação"""
    print(f"[{datetime.now(timezone.utc)}] Executando verificação de agendamentos...")
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

# Emitir estatísticas de tráfego para admins periodicamente
def emit_traffic_stats_job():
    try:
        socketio.emit('traffic_stats', _traffic_snapshot(), room='admin')
    except Exception as e:
        print(f"[Traffic] Falha ao emitir estatísticas: {e}")

scheduler.add_job(
    func=emit_traffic_stats_job,
    trigger="interval",
    seconds=30,
    id='traffic_stats_emitter',
    name='Emitir estatísticas de tráfego para admins'
)

# Opcional: sincronizar status dos players (Chromecast discovery) periodicamente
def sync_player_statuses_job():
    try:
        with app.app_context():
            from services.auto_sync_service import auto_sync_service
            auto_sync_service.sync_all_players()
    except Exception as e:
        print(f"[AutoSync] Falha ao sincronizar players: {e}")

scheduler.add_job(
    func=sync_player_statuses_job,
    trigger="interval",
    minutes=1,
    id='player_status_sync',
    name='Sincronizar status dos players (descoberta)'
)

# =========================
# Traffic monitoring memory
# =========================
TRAFFIC_STATS = {
    'since': datetime.now(timezone.utc).isoformat(),
    'total_bytes': 0,
    'players': {}  # player_id -> {bytes, requests, by_type, last_seen}
}
TRAFFIC_LOCK = Lock()
TRAFFIC_MINUTE = {}  # player_id -> {minute_key_iso -> {bytes, requests, by_type}}

# Mapas globais para rastrear conexões Socket.IO
# - CONNECTED_PLAYERS: player_id -> {sid, last_seen}
# - SOCKET_SID_TO_PLAYER: sid -> player_id (para limpeza em disconnect)
# - SOCKET_SID_TO_USER: sid -> {user_id, role, company}
CONNECTED_PLAYERS = {}
SOCKET_SID_TO_PLAYER = {}
SOCKET_SID_TO_USER = {}

def _categorize_content_type(path: str, mimetype: str) -> str:
    try:
        import os
        ext = os.path.splitext(path)[1].lower()
        if ('video' in (mimetype or '')) or ext in ['.mp4', '.mkv', '.mov', '.avi', '.wmv']:
            return 'video'
        if ('image' in (mimetype or '')) or ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            return 'image'
        if ('audio' in (mimetype or '')) or ext in ['.mp3', '.aac', '.wav', '.ogg']:
            return 'audio'
        return 'other'
    except Exception:
        return 'other'

@app.after_request
def _track_upload_traffic(response):
    try:
        # Contabiliza bytes enviados para downloads de mídia com atribuição por player pid
        if request.path.startswith('/uploads/'):
            pid = request.args.get('pid') or 'unknown'
            content_length = response.headers.get('Content-Length')
            try:
                bytes_sent = int(content_length) if content_length and str(content_length).isdigit() else 0
            except Exception:
                bytes_sent = 0
            category = _categorize_content_type(request.path, getattr(response, 'mimetype', '') or '')
            ts = datetime.now(timezone.utc).isoformat()
            with TRAFFIC_LOCK:
                pstats = TRAFFIC_STATS['players'].setdefault(pid, {
                    'bytes': 0,
                    'requests': 0,
                    'by_type': {'video': 0, 'image': 0, 'audio': 0, 'other': 0},
                    'last_seen': None
                })
                pstats['bytes'] += bytes_sent
                pstats['requests'] += 1
                pstats['by_type'][category] = pstats['by_type'].get(category, 0) + bytes_sent
                pstats['last_seen'] = ts
                TRAFFIC_STATS['total_bytes'] += bytes_sent

                # Atualizar bucket por minuto (para taxa recente)
                minute_key = datetime.now(timezone.utc).replace(second=0, microsecond=0).isoformat()
                pminute = TRAFFIC_MINUTE.setdefault(pid, {})
                bucket = pminute.setdefault(minute_key, {'bytes': 0, 'requests': 0, 'by_type': {'video': 0, 'image': 0, 'audio': 0, 'other': 0}})
                bucket['bytes'] += bytes_sent
                bucket['requests'] += 1
                bucket['by_type'][category] = bucket['by_type'].get(category, 0) + bytes_sent
    except Exception as e:
        print(f"[Traffic] Falha ao registrar tráfego: {e}")
    return response

def _traffic_snapshot():
    with TRAFFIC_LOCK:
        return {
            'since': TRAFFIC_STATS.get('since'),
            'total_bytes': TRAFFIC_STATS.get('total_bytes', 0),
            'players': TRAFFIC_STATS.get('players', {})
        }

# WebSocket events
@socketio.on('connect', namespace='/')
def handle_connect(auth=None):
    """Rastreia conexão e tenta associar usuário autenticado ao SID (se token for enviado)."""
    try:
        info = {}
        # Token pode vir via auth handshake, query (?token=...) ou Authorization: Bearer ...
        token = None
        if isinstance(auth, dict):
            token = auth.get('token') or auth.get('access_token')
        token = token or request.args.get('token')
        token = token or (request.headers.get('Authorization') or '').replace('Bearer ', '').strip()
        if token:
            try:
                from flask_jwt_extended import decode_token
                decoded = decode_token(token)
                uid = decoded.get('sub')
                u = db.session.get(User, uid) if uid else None
                if u:
                    info = {
                        'user_id': str(uid),
                        'role': getattr(u, 'role', None),
                        'company': getattr(u, 'company', None)
                    }
            except Exception:
                # Token inválido não deve derrubar a conexão
                pass
        SOCKET_SID_TO_USER[request.sid] = info
    except Exception:
        # Garante chave presente mesmo em caso de erro
        SOCKET_SID_TO_USER[request.sid] = {}

@socketio.on('disconnect')
def handle_disconnect():
    """Limpa mapeamentos quando um socket é desconectado."""
    try:
        sid = request.sid
        # Remover vínculo SID->Player e, se for o mesmo SID do player, removê-lo dos conectados
        pid = SOCKET_SID_TO_PLAYER.pop(sid, None)
        if pid:
            try:
                if CONNECTED_PLAYERS.get(pid, {}).get('sid') == sid:
                    CONNECTED_PLAYERS.pop(pid, None)
            except Exception:
                # fallback robusto
                CONNECTED_PLAYERS.pop(pid, None)
        # Remover vínculo SID->User
        SOCKET_SID_TO_USER.pop(sid, None)
    except Exception:
        pass

@socketio.on('join_player')
def handle_join_player(data):
    player_id = data.get('player_id')
    if player_id:
        join_room(f'player_{player_id}')
        emit('joined_player', {'player_id': player_id})
        # Mapear conexão -> player
        try:
            CONNECTED_PLAYERS[player_id] = {'sid': request.sid, 'last_seen': datetime.now(timezone.utc).isoformat()}
            SOCKET_SID_TO_PLAYER[request.sid] = player_id
        except Exception:
            pass

@socketio.on('join_admin')
def handle_join_admin():
    try:
        # Usar o mapeamento criado no connect (SOCKET_SID_TO_USER) para checar permissão
        info = SOCKET_SID_TO_USER.get(request.sid)
        role = info.get('role') if info else None
        if role in ['admin', 'manager']:
            join_room('admin')
            emit('joined_admin', {'ok': True})
        else:
            emit('joined_admin', {'ok': False, 'error': 'not_authorized'})
    except Exception as e:
        emit('joined_admin', {'ok': False, 'error': str(e)})

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
            'timestamp': datetime.now(timezone.utc).isoformat()
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
        distribution.updated_at = datetime.now(timezone.utc)
        
        if status == 'downloading' and not distribution.started_at:
            distribution.started_at = datetime.now(timezone.utc)
        elif status == 'completed':
            distribution.completed_at = datetime.now(timezone.utc)
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
                u = db.session.get(User, user_id)
                role = getattr(u, 'role', None)
                
                if u and role in ['admin', 'manager']:
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
        player.last_seen = datetime.now(timezone.utc)
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
            'timestamp': datetime.now(timezone.utc).isoformat()
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

# Public redirects for direct admin paths without /app base
@app.route('/login')
@app.route('/register')
@app.route('/forgot-password')
@app.route('/change-password')
def redirect_admin_public_routes():
    # Redirect /login -> /app/login, etc., without changing player routes
    try:
        target = f"/app{request.path}"
        return redirect(target)
    except Exception:
        return redirect('/app/login')

# Support serving admin static assets also under /app to avoid 404s
@app.route('/app/static/<path:filename>')
def serve_build_static_under_app(filename):
    try:
        return send_from_directory(os.path.join(_react_build_dir(), 'static'), filename)
    except Exception:
        return jsonify({'error': 'Arquivo estático não encontrado'}), 404

@app.route('/app/manifest.json')
def serve_manifest_under_app():
    try:
        return send_from_directory(_react_build_dir(), 'manifest.json')
    except Exception:
        return jsonify({'error': 'Manifest não encontrado'}), 404

@app.route('/app/asset-manifest.json')
def serve_asset_manifest_under_app():
    try:
        return send_from_directory(_react_build_dir(), 'asset-manifest.json')
    except Exception:
        return jsonify({'error': 'Asset manifest não encontrado'}), 404

@app.route('/app/favicon.ico')
def serve_favicon_under_app():
    try:
        return send_from_directory(_react_build_dir(), 'favicon.ico')
    except Exception:
        return jsonify({'error': 'Favicon não encontrado'}), 404

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

# Monitoramento (admin): tráfego e players
@app.route('/api/monitor/traffic', methods=['GET'])
@jwt_required()
def monitor_traffic():
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão'}), 403
        snapshot = _traffic_snapshot()

        # Calcular taxa recente (últimos N minutos) e detectar sobreuso
        try:
            window_min = int(os.getenv('OVERUSE_WINDOW_MIN', '1'))
        except Exception:
            window_min = 1
        try:
            overuse_bpm_bytes = int(float(os.getenv('OVERUSE_BPM_MB', '100')) * 1024 * 1024)
        except Exception:
            overuse_bpm_bytes = 100 * 1024 * 1024
        try:
            overuse_rpm = int(os.getenv('OVERUSE_RPM', '300'))
        except Exception:
            overuse_rpm = 300

        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        minute_keys = [(now - timedelta(minutes=i)).isoformat() for i in range(window_min)]
        overuse_players = []
        recent_players = {}
        with TRAFFIC_LOCK:
            for pid, buckets in TRAFFIC_MINUTE.items():
                sum_bytes = 0
                sum_requests = 0
                for mk in minute_keys:
                    if mk in buckets:
                        sum_bytes += buckets[mk].get('bytes', 0)
                        sum_requests += buckets[mk].get('requests', 0)
                bpm = sum_bytes / max(1, window_min)
                rpm = sum_requests / max(1, window_min)
                recent_players[pid] = {
                    'bytes': sum_bytes,
                    'requests': sum_requests,
                    'bytes_per_min': bpm,
                    'rpm': rpm
                }
                if bpm > overuse_bpm_bytes or rpm > overuse_rpm:
                    overuse_players.append({
                        'player_id': pid,
                        'bytes_per_min': bpm,
                        'rpm': rpm,
                        'bytes': sum_bytes,
                        'requests': sum_requests
                    })

        snapshot['recent_window_min'] = window_min
        snapshot['thresholds'] = {
            'overuse_bpm_bytes': overuse_bpm_bytes,
            'overuse_rpm': overuse_rpm
        }
        snapshot['recent'] = {'players': recent_players}
        snapshot['overuse_players'] = overuse_players
 
        if request.args.get('reset') == 'true':
            with TRAFFIC_LOCK:
                TRAFFIC_STATS['players'] = {}
                TRAFFIC_STATS['total_bytes'] = 0
                TRAFFIC_STATS['since'] = datetime.now(timezone.utc).isoformat()
                TRAFFIC_MINUTE.clear()
        return jsonify(snapshot), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/players', methods=['GET'])
@jwt_required()
def monitor_players():
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Sem permissão'}), 403
        # Fallback seguro para bancos antigos sem coluna created_at
        try:
            players = Player.query.order_by(Player.created_at.desc()).all()
        except Exception:
            players = Player.query.all()
        items = []
        for p in players:
            items.append({
                'id': str(p.id),
                'name': p.name,
                'status': getattr(p, 'status', None) or 'offline',
                'last_ping': (p.last_ping.isoformat() if getattr(p, 'last_ping', None) else None),
                'socket_connected': str(p.id) in CONNECTED_PLAYERS,
                'socket_last_seen': CONNECTED_PLAYERS.get(str(p.id), {}).get('last_seen')
            })
        return jsonify({'players': items, 'connected_count': len(CONNECTED_PLAYERS)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
    # Iniciar scheduler com segurança e registrar shutdown seguro
    def _safe_scheduler_shutdown():
        try:
            scheduler.shutdown(wait=False)
        except Exception:
            pass
    atexit.register(_safe_scheduler_shutdown)

    try:
        scheduler.start()
    except Exception:
        # Evita falhas em modo debug/reloader
        pass
     
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
