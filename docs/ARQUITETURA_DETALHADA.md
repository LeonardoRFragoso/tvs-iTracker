# ARQUITETURA TÉCNICA DETALHADA - TVS DIGITAL SIGNAGE PLATFORM
## PLTI-012b - Arquitetura de TI To-Be

---

## 1. VISÃO GERAL DA ARQUITETURA

### 1.1 Diagrama de Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAMADA DE APRESENTAÇÃO                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web App    │  │    Players   │  │   Mobile     │          │
│  │   (React)    │  │  (Android/   │  │   (Futuro)   │          │
│  │              │  │   Windows)   │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                  │                   │
└─────────┼─────────────────┼──────────────────┼──────────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CAMADA DE REDE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│            HTTPS/WSS             │       HTTP/WS                 │
│       (Produção/Internet)        │    (Rede Interna)             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE PROXY REVERSO                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                        NGINX                                      │
│   ┌─────────────────────────────────────────────────┐           │
│   │ - SSL Termination                                │           │
│   │ - Load Balancing (futuro)                        │           │
│   │ - Static File Serving                            │           │
│   │ - Request Routing                                │           │
│   │ - Compression                                    │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                   │
└──────────────┬────────────────────────────┬─────────────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   Frontend (Static)      │   │   Backend API            │
│   - HTML/CSS/JS          │   │   - Flask Application    │
│   - React Build          │   │   - RESTful API          │
│   - Assets               │   │   - WebSocket Server     │
└──────────────────────────┘   └──────────┬───────────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────┐
          │                               │                       │
          ▼                               ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   CAMADA DE LÓGICA  │  │  CAMADA DE SERVIÇOS │  │   CAMADA REALTIME   │
│   DE NEGÓCIO        │  │                     │  │                     │
│                     │  │                     │  │                     │
│ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │
│ │ Content Service │ │  │ │ Media Processing│ │  │ │ SocketIO Handler│ │
│ │ Campaign Service│ │  │ │ Thumbnail Gen.  │ │  │ │ Player Manager  │ │
│ │ Schedule Service│ │  │ │ File Storage    │ │  │ │ Command Queue   │ │
│ │ Player Service  │ │  │ │ FFmpeg Wrapper  │ │  │ │ Heartbeat Mon.  │ │
│ │ Location Service│ │  │ │ Chromecast API  │ │  │ │ Status Broadcast│ │
│ │ User Service    │ │  │ │ Scheduler       │ │  │ │ Event Emitter   │ │
│ └─────────────────┘ │  │ └─────────────────┘ │  │ └─────────────────┘ │
└─────────┬───────────┘  └─────────┬───────────┘  └──────────┬──────────┘
          │                        │                         │
          └────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE ACESSO A DADOS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                      SQLAlchemy ORM                               │
│   ┌─────────────────────────────────────────────────┐           │
│   │ - Models (User, Location, Content, Campaign,    │           │
│   │   Schedule, Player, Editorial)                  │           │
│   │ - Query Builder                                 │           │
│   │ - Connection Pooling                            │           │
│   │ - Transaction Management                        │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE PERSISTÊNCIA                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────┐              ┌───────────────────┐       │
│  │   MySQL Database  │              │   File System     │       │
│  │                   │              │   /uploads        │       │
│  │ - Metadata        │              │   - Videos        │       │
│  │ - Configurations  │              │   - Images        │       │
│  │ - Logs            │              │   - Audio         │       │
│  │ - Relationships   │              │   - HTML          │       │
│  └───────────────────┘              │   - Thumbnails    │       │
│                                     └───────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. COMPONENTES DETALHADOS

### 2.1 Frontend (React Application)

#### 2.1.1 Estrutura de Componentes
```
src/
├── App.js (Root Component)
│   ├── Router Configuration
│   ├── Context Providers
│   │   ├── AuthContext (Autenticação)
│   │   ├── SocketContext (WebSocket)
│   │   ├── NotificationContext (Notificações)
│   │   └── ThemeContext (Temas)
│   └── Layout
│       ├── Header
│       ├── Sidebar
│       └── Content Area
│
├── pages/ (Page Components)
│   ├── Dashboard
│   │   ├── StatsCards
│   │   ├── ActivityFeed
│   │   ├── PlayerStatusGrid
│   │   └── AlertsPanel
│   │
│   ├── Content
│   │   ├── ContentList
│   │   ├── ContentUpload
│   │   ├── ContentPreview
│   │   └── ContentFilter
│   │
│   ├── Campaigns
│   │   ├── CampaignList
│   │   ├── CampaignBuilder (Drag-Drop)
│   │   ├── CampaignPreview
│   │   └── CampaignSchedule
│   │
│   ├── Players
│   │   ├── PlayerGrid
│   │   ├── PlayerDetail
│   │   ├── PlayerControl
│   │   └── PlayerStats
│   │
│   └── Settings
│       ├── UserManagement
│       ├── LocationManagement
│       └── SystemConfig
│
└── components/ (Reusable Components)
    ├── MediaUpload
    ├── DragDropEditor
    ├── DateTimePicker
    ├── ConfirmDialog
    └── DataTable
```

#### 2.1.2 Estado e Gerenciamento de Dados
```javascript
// Contexts
- AuthContext: { user, login(), logout(), isAuthenticated }
- SocketContext: { socket, connected, emit(), on() }
- NotificationContext: { notifications, addNotification() }

// Local State (useState/useReducer)
- Component-specific state

// Server State (API Calls)
- axios interceptors para autenticação
- Retry logic para requests falhados
```

#### 2.1.3 Comunicação com Backend
```javascript
// HTTP Client (Axios)
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// WebSocket Client (Socket.IO)
const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
  auth: { token: localStorage.getItem('token') },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});
```

---

### 2.2 Backend (Flask Application)

#### 2.2.1 Estrutura de Módulos
```python
# app.py - Application Factory
app = Flask(__name__)
- Configurações (SECRET_KEY, DATABASE_URL, JWT)
- Inicialização de extensões (SQLAlchemy, JWT, CORS, SocketIO)
- Registro de Blueprints
- Error handlers
- Background scheduler

# Blueprints (Rotas)
/api/auth        → routes/auth.py
/api/content     → routes/content.py
/api/campaigns   → routes/campaign.py
/api/schedules   → routes/schedule.py
/api/players     → routes/player.py
/api/locations   → routes/location.py
/api/dashboard   → routes/dashboard.py
/api/settings    → routes/settings.py
/api/cast        → routes/cast.py
```

#### 2.2.2 Models (SQLAlchemy)
```python
# models/user.py
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='viewer')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    locations = db.relationship('Location', secondary='user_locations')

# models/content.py
class Content(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    type = db.Column(db.String(20))  # video, image, audio, html
    filename = db.Column(db.String(255), unique=True)
    file_path = db.Column(db.String(500))
    thumbnail_path = db.Column(db.String(500))
    duration = db.Column(db.Integer)  # segundos
    file_size = db.Column(db.BigInteger)  # bytes
    mime_type = db.Column(db.String(100))
    metadata = db.Column(db.JSON)
    tags = db.Column(db.JSON)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# models/campaign.py
class Campaign(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    location_id = db.Column(db.Integer, db.ForeignKey('location.id'))
    priority = db.Column(db.Integer, default=0)
    content_order = db.Column(db.JSON)  # Array de content_ids ordenados
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    contents = db.relationship('Content', secondary='campaign_content')
    schedules = db.relationship('Schedule', backref='campaign')

# models/schedule.py
class Schedule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaign.id'))
    location_id = db.Column(db.Integer, db.ForeignKey('location.id'))
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    days_of_week = db.Column(db.JSON)  # [0,1,2,3,4,5,6]
    is_active = db.Column(db.Boolean, default=True)
    priority = db.Column(db.Integer, default=0)
    recurrence_rule = db.Column(db.JSON)

# models/player.py
class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    player_key = db.Column(db.String(36), unique=True)  # UUID
    location_id = db.Column(db.Integer, db.ForeignKey('location.id'))
    device_type = db.Column(db.String(20))  # android, windows, web
    ip_address = db.Column(db.String(45))
    mac_address = db.Column(db.String(17))
    resolution = db.Column(db.String(20))
    status = db.Column(db.String(20), default='offline')
    last_seen = db.Column(db.DateTime)
    current_campaign_id = db.Column(db.Integer, db.ForeignKey('campaign.id'))
    current_content_id = db.Column(db.Integer, db.ForeignKey('content.id'))
    system_info = db.Column(db.JSON)
```

#### 2.2.3 Services (Lógica de Negócio)
```python
# services/content_service.py
class ContentService:
    @staticmethod
    def upload_content(file, metadata):
        # 1. Validar arquivo
        # 2. Gerar nome único
        # 3. Salvar arquivo
        # 4. Processar (thumbnail, metadata)
        # 5. Criar registro no banco
        # 6. Retornar content
        
    @staticmethod
    def generate_thumbnail(content):
        # FFmpeg para vídeo, Pillow para imagem
        
    @staticmethod
    def delete_content(content_id):
        # 1. Verificar se está em uso
        # 2. Remover arquivo físico
        # 3. Remover do banco

# services/schedule_service.py
class ScheduleService:
    @staticmethod
    def get_active_campaign_for_player(player_id):
        # 1. Buscar schedules ativos
        # 2. Filtrar por localização do player
        # 3. Aplicar regras de prioridade
        # 4. Verificar horário atual
        # 5. Retornar campanha ativa
        
    @staticmethod
    def check_schedule_conflicts(schedule_data):
        # Detectar sobreposição de horários

# services/player_service.py
class PlayerService:
    @staticmethod
    def send_command(player_id, command):
        # Emitir comando via WebSocket
        
    @staticmethod
    def sync_player(player_id):
        # 1. Obter campanha ativa
        # 2. Preparar payload com conteúdos
        # 3. Enviar via WebSocket
```

#### 2.2.4 WebSocket Handlers (realtime/)
```python
# realtime/handlers.py
from flask_socketio import emit, join_room, leave_room

@socketio.on('player_register')
def handle_player_register(data):
    player_key = data.get('player_key')
    player = Player.query.filter_by(player_key=player_key).first()
    if player:
        player.status = 'online'
        player.last_seen = datetime.utcnow()
        db.session.commit()
        
        join_room(f'player_{player.id}')
        emit('register_success', {'player_id': player.id})
        
        # Enviar campanha ativa
        campaign = get_active_campaign_for_player(player.id)
        if campaign:
            emit('campaign_update', campaign.to_dict())

@socketio.on('player_heartbeat')
def handle_player_heartbeat(data):
    player_id = data.get('player_id')
    player = Player.query.get(player_id)
    if player:
        player.last_seen = datetime.utcnow()
        player.system_info = data.get('system_info', {})
        db.session.commit()

# Server → Player Commands
def send_player_command(player_id, command, params=None):
    socketio.emit('player_command', {
        'command': command,  # 'play', 'pause', 'sync', 'restart'
        'params': params
    }, room=f'player_{player_id}')
```

---

## 3. FLUXOS DE DADOS PRINCIPAIS

### 3.1 Fluxo de Upload de Conteúdo
```
1. Usuário seleciona arquivo no frontend
2. Frontend envia POST /api/content/upload (multipart/form-data)
3. Backend (content route):
   - Valida tipo e tamanho do arquivo
   - Gera nome único (UUID)
   - Salva arquivo em /uploads
   - Chama ContentService.process_content()
4. ContentService:
   - Extrai metadata (duração, resolução)
   - Gera thumbnail (FFmpeg/Pillow)
   - Cria registro no banco (Content model)
5. Backend retorna JSON com dados do conteúdo
6. Frontend atualiza lista de conteúdos
```

### 3.2 Fluxo de Criação de Campanha
```
1. Usuário cria campanha no frontend (drag-drop de conteúdos)
2. Frontend envia POST /api/campaigns com:
   {
     name, description, location_id, priority,
     content_order: [content_id_1, content_id_2, ...]
   }
3. Backend (campaign route):
   - Valida dados
   - Cria registro Campaign
   - Cria relacionamentos em campaign_content
4. Backend retorna campanha criada
5. Frontend redireciona para agendamento
```

### 3.3 Fluxo de Agendamento
```
1. Usuário define horários e datas no calendário
2. Frontend envia POST /api/schedules com:
   {
     campaign_id, location_id,
     start_date, end_date,
     start_time, end_time,
     days_of_week: [0,1,2,3,4,5,6],
     recurrence_rule: {...}
   }
3. Backend (schedule route):
   - Valida dados
   - Chama ScheduleService.check_conflicts()
   - Se OK, cria registro Schedule
   - Ativa scheduler background task
4. Backend retorna schedule criado
5. Scheduler (APScheduler):
   - Job periódico verifica schedules ativos
   - Quando ativado, envia campanha para players
```

### 3.4 Fluxo de Sincronização de Player
```
1. Player inicia e envia 'player_register' via WebSocket
   { player_key: "uuid" }
2. Backend (SocketIO handler):
   - Valida player_key
   - Atualiza status = 'online', last_seen
   - Adiciona socket ao room 'player_{id}'
   - Emite 'register_success'
3. Backend chama get_active_campaign_for_player(player_id)
   - Busca schedules ativos para location do player
   - Aplica regras de prioridade e horário
   - Retorna campanha ativa
4. Backend emite 'campaign_update' para o player
   {
     campaign: { id, name, ... },
     contents: [
       { id, title, type, url, duration, ... },
       ...
     ]
   }
5. Player recebe e baixa conteúdos (se necessário)
6. Player inicia reprodução
7. Player envia 'player_heartbeat' a cada 30s
   { player_id, status, current_content_id, system_info }
```

### 3.5 Fluxo de Comando Remoto
```
1. Usuário clica em "Restart" na interface do player
2. Frontend envia POST /api/players/{id}/command
   { command: "restart" }
3. Backend (player route):
   - Valida comando
   - Chama PlayerService.send_command(player_id, 'restart')
4. PlayerService emite via WebSocket:
   socketio.emit('player_command', { command: 'restart' }, room=f'player_{id}')
5. Player recebe comando e executa
6. Player envia confirmação via 'player_status_update'
7. Frontend recebe atualização e mostra feedback
```

---

## 4. SEGURANÇA

### 4.1 Autenticação (JWT)
```python
# Login Flow
POST /api/auth/login
Request: { username, password }

Backend:
1. Valida credenciais (bcrypt.check_password_hash)
2. Se válido, gera JWT:
   access_token = create_access_token(
       identity=user.id,
       additional_claims={'role': user.role}
   )
3. Retorna: { access_token, user: {...} }

Frontend:
1. Armazena token em localStorage
2. Inclui em todas as requisições:
   Authorization: Bearer <access_token>

# Token Validation
- JWT_SECRET_KEY para assinatura
- JWT_ACCESS_TOKEN_EXPIRES = 24h (configurável)
- Middleware valida token em cada request protegida
```

### 4.2 Autorização (RBAC)
```python
# Decorator para proteger rotas
from functools import wraps
from flask_jwt_extended import get_jwt

def role_required(role):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            if claims.get('role') != role and claims.get('role') != 'admin':
                return jsonify({'error': 'Forbidden'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

# Uso
@content_bp.route('/content', methods=['POST'])
@jwt_required()
@role_required('manager')  # Apenas manager e admin
def create_content():
    # ...
```

### 4.3 Proteção de Upload
```python
ALLOWED_EXTENSIONS = {
    'video': {'mp4', 'avi', 'mov', 'mkv', 'webm'},
    'image': {'jpg', 'jpeg', 'png', 'gif', 'webp'},
    'audio': {'mp3', 'wav', 'ogg', 'aac'},
    'html': {'html', 'htm'}
}

def validate_file(file):
    # Verifica extensão
    ext = file.filename.rsplit('.', 1)[1].lower()
    
    # Verifica MIME type real (libmagic)
    mime = magic.from_buffer(file.read(1024), mime=True)
    file.seek(0)
    
    # Verifica tamanho
    if file.content_length > MAX_CONTENT_LENGTH:
        raise ValueError('File too large')
    
    return True
```

### 4.4 HTTPS/SSL
```nginx
# Nginx SSL Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
add_header Strict-Transport-Security "max-age=31536000" always;
```

---

## 5. PERFORMANCE E OTIMIZAÇÃO

### 5.1 Database Optimization
```python
# Connection Pooling
SQLALCHEMY_ENGINE_OPTIONS = {
    'pool_size': 10,
    'pool_recycle': 3600,
    'pool_pre_ping': True,
    'max_overflow': 20
}

# Índices
class Content(db.Model):
    __table_args__ = (
        db.Index('idx_content_type', 'type'),
        db.Index('idx_content_created_at', 'created_at'),
    )

# Eager Loading (evitar N+1 queries)
campaigns = Campaign.query.options(
    joinedload(Campaign.contents),
    joinedload(Campaign.location)
).all()
```

### 5.2 Caching (Futuro)
```python
from flask_caching import Cache

cache = Cache(app, config={
    'CACHE_TYPE': 'redis',
    'CACHE_REDIS_URL': 'redis://localhost:6379/0'
})

@cache.cached(timeout=300)
def get_dashboard_stats():
    # Expensive query
    return stats
```

### 5.3 Asset Optimization
```bash
# Frontend Build
npm run build
# Resultado:
# - Minificação JS/CSS
# - Tree shaking
# - Code splitting
# - Lazy loading de rotas
```

### 5.4 Media Optimization
```python
# Thumbnail generation (FFmpeg)
def generate_video_thumbnail(video_path, output_path):
    cmd = [
        'ffmpeg', '-i', video_path,
        '-ss', '00:00:01',  # 1 segundo
        '-vframes', '1',
        '-vf', 'scale=320:180',  # Resize
        '-q:v', '2',  # Qualidade
        output_path
    ]
    subprocess.run(cmd, check=True)

# Image optimization (Pillow)
def generate_image_thumbnail(image_path, output_path):
    img = Image.open(image_path)
    img.thumbnail((320, 180), Image.LANCZOS)
    img.save(output_path, optimize=True, quality=85)
```

---

## 6. MONITORAMENTO E LOGS

### 6.1 Application Logging
```python
import logging
from logging.handlers import RotatingFileHandler

# Configuração
handler = RotatingFileHandler(
    'logs/app.log',
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=10
)
handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)

# Uso
app.logger.info(f'User {user.username} logged in')
app.logger.error(f'Failed to upload content: {str(e)}')
```

### 6.2 Health Check Endpoint
```python
@app.route('/api/health')
def health_check():
    try:
        # Testa conexão com banco
        db.session.execute(text('SELECT 1'))
        db_status = 'healthy'
    except Exception as e:
        db_status = f'unhealthy: {str(e)}'
    
    return jsonify({
        'status': 'healthy' if db_status == 'healthy' else 'degraded',
        'timestamp': datetime.utcnow().isoformat(),
        'database': db_status,
        'uptime': get_uptime(),
        'version': '1.0.0'
    })
```

### 6.3 Métricas (middleware/monitoring.py)
```python
# Request counter, response time tracker
TRAFFIC_MINUTE = {}
TRAFFIC_LOCK = threading.Lock()

@app.before_request
def before_request():
    request.start_time = time.time()

@app.after_request
def after_request(response):
    if hasattr(request, 'start_time'):
        elapsed = time.time() - request.start_time
        # Log slow requests
        if elapsed > 1.0:
            app.logger.warning(f'Slow request: {request.path} took {elapsed:.2f}s')
    
    # Traffic metrics
    with TRAFFIC_LOCK:
        minute = int(time.time() // 60)
        TRAFFIC_MINUTE[minute] = TRAFFIC_MINUTE.get(minute, 0) + 1
    
    return response
```

---

## 7. DEPLOY E CI/CD (Futuro)

### 7.1 Docker Containerization
```dockerfile
# Dockerfile (Backend)
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]

# Dockerfile (Frontend)
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 7.2 Docker Compose
```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: tvs_platform
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
  
  backend:
    build: ./backend
    environment:
      DATABASE_URL: mysql+pymysql://root:rootpass@mysql:3306/tvs_platform
      SECRET_KEY: production-secret
    volumes:
      - ./uploads:/app/uploads
    ports:
      - "5000:5000"
    depends_on:
      - mysql
  
  frontend:
    build: .
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mysql_data:
```

---

## 8. ESCALABILIDADE

### 8.1 Horizontal Scaling
```
┌─────────────┐
│ Load        │
│ Balancer    │
│ (Nginx)     │
└──────┬──────┘
       │
       ├───────────────┬───────────────┐
       │               │               │
   ┌───▼───┐       ┌───▼───┐       ┌───▼───┐
   │Backend│       │Backend│       │Backend│
   │ Node 1│       │ Node 2│       │ Node 3│
   └───┬───┘       └───┬───┘       └───┬───┘
       │               │               │
       └───────────────┴───────────────┘
                       │
                 ┌─────▼─────┐
                 │   MySQL   │
                 │  (Master) │
                 └───────────┘
```

### 8.2 Database Replication
```
┌─────────────┐
│   Master    │ ◄──── Writes
│   MySQL     │
└──────┬──────┘
       │ Replication
       ├─────────────────┬─────────────────┐
       │                 │                 │
   ┌───▼───┐         ┌───▼───┐         ┌───▼───┐
   │ Slave │◄────    │ Slave │ ◄────   │ Slave │ ◄──── Reads
   │   1   │ Reads   │   2   │ Reads   │   3   │ Reads
   └───────┘         └───────┘         └───────┘
```

---

## CONCLUSÃO

Esta arquitetura foi projetada para ser:
- **Escalável:** Suporte a crescimento horizontal e vertical
- **Manutenível:** Código modular e bem documentado
- **Segura:** Múltiplas camadas de segurança
- **Performática:** Otimizações em todos os níveis
- **Monitorável:** Logs e métricas integradas

A implementação atual é monolítica mas preparada para evolução para microserviços conforme necessário.

---

**Documento preparado por:** Leonardo Fragoso  
**Data:** Novembro 2024  
**Versão:** 1.0
