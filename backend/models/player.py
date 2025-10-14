from datetime import datetime, timedelta
import uuid
from database import db

# Helper to format datetime in Brazilian standard
def fmt_br_datetime(dt):
    try:
        # Se dt for None, retornar None
        if dt is None:
            return None
            
        # Se dt for uma string, verificar se parece uma data
        if isinstance(dt, str):
            # Se a string contiver caracteres que não são típicos de data, retorná-la diretamente
            if any(c in dt for c in ['offline', 'online', 'syncing', 'error']):
                return dt
                
            # Tentar converter para datetime se parecer uma data
            try:
                from datetime import datetime
                # Tentar diferentes formatos
                for fmt in ['%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y %H:%M:%S']:
                    try:
                        dt = datetime.strptime(dt, fmt)
                        return dt.strftime('%d/%m/%Y %H:%M:%S')
                    except ValueError:
                        continue
            except Exception:
                pass
                
            # Se não conseguir converter, retornar a string original
            return dt
            
        # Se for um datetime, formatá-lo
        return dt.strftime('%d/%m/%Y %H:%M:%S') if hasattr(dt, 'strftime') else str(dt)
        
    except Exception as e:
        print(f"[WARN] Erro ao formatar datetime: {dt} - {str(e)}")
        # Em caso de erro, retornar uma string segura
        if dt is None:
            return None
        return str(dt) if dt else None

class Player(db.Model):
    __tablename__ = 'players'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    
    # Localização e identificação
    location_id = db.Column(db.String(36), db.ForeignKey('locations.id'), nullable=False)
    room_name = db.Column(db.String(100))  # "Recepção", "Refeitório", "Corredor"
    mac_address = db.Column(db.String(17))  # Removida a restrição unique=True
    ip_address = db.Column(db.String(45))  # Suporta IPv6
    chromecast_id = db.Column(db.String(100))  # ID do dispositivo Chromecast
    chromecast_name = db.Column(db.String(100))  # Nome amigável do Chromecast
    # Código curto para acesso amigável ao player no modo kiosk (ex.: ABC123)
    access_code = db.Column(db.String(12), unique=True, index=True)
    
    # Configurações técnicas
    platform = db.Column(db.String(50), default='web')  # web, android, windows
    device_type = db.Column(db.String(50), default='modern')  # modern, tizen, legacy
    resolution = db.Column(db.String(20), default='1920x1080')
    orientation = db.Column(db.String(20), default='landscape')  # landscape, portrait
    player_version = db.Column(db.String(20), default='1.0.0')
    
    # Status e conectividade
    _is_online = db.Column('is_online', db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    last_ping = db.Column(db.DateTime)
    last_content_sync = db.Column(db.DateTime)
    _status = db.Column('status', db.String(20), default='offline')  # online, offline, syncing, error
    _is_playing = db.Column('is_playing', db.Boolean, default=False)  # Indica se está reproduzindo conteúdo
    
    @property
    def status(self):
        """Retorna o status do player como string"""
        return str(self._status) if self._status else 'offline'
    
    @status.setter
    def status(self, value):
        """Define o status do player garantindo que seja string"""
        self._status = str(value) if value else 'offline'
        
    @property
    def is_playing(self):
        """Retorna se o player está reproduzindo conteúdo"""
        return bool(self._is_playing)
    
    @is_playing.setter
    def is_playing(self, value):
        """Define se o player está reproduzindo conteúdo"""
        self._is_playing = bool(value)
    
    # Configurações de exibição
    default_content_duration = db.Column(db.Integer, default=10)
    transition_effect = db.Column(db.String(50), default='fade')
    volume_level = db.Column(db.Integer, default=50)
    
    # Armazenamento e cache
    storage_capacity_gb = db.Column(db.Integer, default=32)
    storage_used_gb = db.Column(db.Float, default=0.0)
    offline_content = db.Column(db.Text)  # JSON array de conteúdos para modo offline
    
    # Métricas de performance
    avg_download_speed_kbps = db.Column(db.Integer, default=0)
    network_speed_mbps = db.Column(db.Float, default=0.0)  # Velocidade da rede em Mbps
    total_content_downloaded_gb = db.Column(db.Float, default=0.0)
    uptime_percentage = db.Column(db.Float, default=0.0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    location = db.relationship('Location', lazy=True)
    schedules = db.relationship('Schedule', lazy=True)
    distributions = db.relationship('ContentDistribution', lazy=True)
    
    # Status de reprodução atual (para KPIs em tempo real)
    current_content_id = db.Column(db.String(36))
    current_content_title = db.Column(db.String(255))
    current_content_type = db.Column(db.String(50))
    current_campaign_id = db.Column(db.String(36))
    current_campaign_name = db.Column(db.String(255))
    playback_start_time = db.Column(db.DateTime)
    last_playback_heartbeat = db.Column(db.DateTime)
    
    @property
    def is_online(self):
        """Verifica se o player está online (último ping < 5 minutos)"""
        if not self.last_ping:
            return False
        
        # Verificar se last_ping é um objeto datetime
        try:
            last_ping_dt = None
            
            # Caso 1: last_ping já é um objeto datetime
            if isinstance(self.last_ping, datetime):
                last_ping_dt = self.last_ping
            
            # Caso 2: last_ping é uma string que precisa ser convertida
            elif isinstance(self.last_ping, str):
                # Ignorar strings que são status e não datas
                if any(status in self.last_ping.lower() for status in ['offline', 'online', 'syncing', 'error', 'modern']):
                    return False
                    
                # Tentar converter para datetime usando dateutil.parser
                try:
                    from dateutil import parser
                    last_ping_dt = parser.parse(self.last_ping)
                except Exception as e:
                    print(f"[WARN] Erro ao converter last_ping '{self.last_ping}' para datetime: {str(e)}")
                    return False
            
            # Caso 3: last_ping é algum outro tipo de objeto
            else:
                print(f"[WARN] last_ping tem tipo desconhecido: {type(self.last_ping)}")
                return False
                
            # Calcular se está online (último ping < 5 minutos)
            if last_ping_dt:
                delta_seconds = (datetime.utcnow() - last_ping_dt).total_seconds()
                return delta_seconds < 300  # 5 minutos
            return False
            
        except Exception as e:
            # Em caso de qualquer erro, logar e assumir que não está online
            print(f"[ERROR] Erro ao verificar is_online para player {self.id}: {str(e)}")
            return False
        
    @is_online.setter
    def is_online(self, value):
        """Setter para is_online que atualiza o campo _is_online"""
        self._is_online = bool(value)
    @property
    def storage_available_gb(self):
        """Calcula espaço disponível em GB"""
        capacity = self._safe_int(self.storage_capacity_gb, 32)
        used = self._safe_float(self.storage_used_gb, 0.0)
        return max(0, capacity - used)
    
    @property
    def storage_percentage(self):
        """Calcula percentual de uso do armazenamento"""
        capacity = self._safe_int(self.storage_capacity_gb, 32)
        used = self._safe_float(self.storage_used_gb, 0.0)
        if capacity > 0:
            return (used / capacity) * 100
        return 0
    
    @property
    def location_name(self):
        """Retorna nome da localização"""
        from models.location import Location
        location = Location.query.get(self.location_id)
        return location.name if location else 'N/A'
    
    @property
    def company(self):
        """Retorna a empresa associada via Location"""
        from models.location import Location
        location = Location.query.get(self.location_id)
        return getattr(location, 'company', None) if location else None
    
    def to_dict(self):
        # Garantir que todos os campos sejam do tipo correto para evitar erros de conversão
        result = {
            'id': str(self.id) if self.id else '',
            'access_code': str(self.access_code) if self.access_code else '',
            'name': str(self.name) if self.name else '',
            'description': str(self.description) if self.description else '',
            'location_id': str(self.location_id) if self.location_id else '',
            'location_name': str(self.location_name) if self.location_name else '',
            'company': str(self.company) if self.company else '',
            'room_name': str(self.room_name) if self.room_name else '',
            'mac_address': str(self.mac_address) if self.mac_address else '',
            'ip_address': str(self.ip_address) if self.ip_address else '',
            'chromecast_id': str(self.chromecast_id) if self.chromecast_id else '',
            'chromecast_name': str(self.chromecast_name) if self.chromecast_name else '',
            'platform': str(self.platform) if self.platform else 'web',
            'device_type': str(getattr(self, 'device_type', 'modern')),  # Usar getattr para evitar AttributeError
            'resolution': str(self.resolution) if self.resolution else '1920x1080',
            'orientation': str(self.orientation) if self.orientation else 'landscape',
            'player_version': str(self.player_version) if self.player_version else '1.0.0',
            'is_online': bool(self.is_online),
            'is_active': bool(self.is_active),
            'status': str(self.status) if self.status else 'offline',  # Garantir que status seja string
            'default_content_duration': self._safe_int(self.default_content_duration, 10),
            'transition_effect': str(self.transition_effect) if self.transition_effect else 'fade',
            'volume_level': self._safe_int(self.volume_level, 50),
            'storage_capacity_gb': self._safe_int(self.storage_capacity_gb, 32),
            'storage_used_gb': self._safe_float(self.storage_used_gb, 0.0),
            'storage_available_gb': self._safe_float(self.storage_available_gb, 0.0),
            'storage_percentage': round(self._safe_float(self.storage_percentage, 0.0), 2),
            'avg_download_speed_kbps': self._safe_int(self.avg_download_speed_kbps, 0),
            'network_speed_mbps': self._safe_float(self.network_speed_mbps, 0.0),
            'total_content_downloaded_gb': self._safe_float(self.total_content_downloaded_gb, 0.0),
            'uptime_percentage': self._safe_float(self.uptime_percentage, 0.0)
        }
        
        # Tratar datas separadamente para evitar erros de formato
        try:
            result['last_ping'] = fmt_br_datetime(self.last_ping)
        except Exception:
            result['last_ping'] = None
            
        try:
            result['last_content_sync'] = fmt_br_datetime(self.last_content_sync)
        except Exception:
            result['last_content_sync'] = None
            
        try:
            result['created_at'] = fmt_br_datetime(self.created_at)
        except Exception:
            result['created_at'] = None
            
        try:
            result['updated_at'] = fmt_br_datetime(self.updated_at)
        except Exception:
            result['updated_at'] = None
            
        return result
    
    def update_storage_usage(self, used_gb):
        """Atualiza uso de armazenamento"""
        self.storage_used_gb = used_gb
        self.updated_at = datetime.utcnow()
        db.session.commit()
    
    def mark_online(self):
        """Marca player como online"""
        self.status = 'online'
        self._is_online = True
        self.last_ping = datetime.utcnow()
        db.session.commit()
    
    def mark_offline(self):
        """Marca player como offline"""
        self.status = 'offline'
        self._is_online = False
        db.session.commit()
    
    def _safe_int(self, value, default=0):
        """Converte um valor para inteiro de forma segura"""
        try:
            if value is None:
                return default
            if isinstance(value, (int, float)):
                return int(value)
            if isinstance(value, str) and value.strip().isdigit():
                return int(value)
            return default
        except (ValueError, TypeError):
            return default
    
    def _safe_float(self, value, default=0.0):
        """Converte um valor para float de forma segura"""
        try:
            if value is None:
                return default
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                # Tentar converter para float
                try:
                    return float(value)
                except ValueError:
                    return default
            return default
        except (ValueError, TypeError):
            return default
    
    def __repr__(self):
        return f'<Player {self.name} - {self.location_name}>'
