from datetime import datetime, timedelta
import uuid
from database import db

class Player(db.Model):
    __tablename__ = 'players'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    
    # Localização e identificação
    location_id = db.Column(db.String(36), db.ForeignKey('locations.id'), nullable=False)
    room_name = db.Column(db.String(100))  # "Recepção", "Refeitório", "Corredor"
    mac_address = db.Column(db.String(17), unique=True)
    ip_address = db.Column(db.String(45))  # Suporta IPv6
    chromecast_id = db.Column(db.String(100))  # ID do dispositivo Chromecast
    chromecast_name = db.Column(db.String(100))  # Nome amigável do Chromecast
    
    # Configurações técnicas
    platform = db.Column(db.String(50), default='web')  # web, android, windows
    resolution = db.Column(db.String(20), default='1920x1080')
    orientation = db.Column(db.String(20), default='landscape')  # landscape, portrait
    player_version = db.Column(db.String(20), default='1.0.0')
    
    # Status e conectividade
    _is_online = db.Column('is_online', db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    last_ping = db.Column(db.DateTime)
    last_content_sync = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='offline')  # online, offline, syncing, error
    
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
    schedules = db.relationship('Schedule', lazy=True)
    distributions = db.relationship('ContentDistribution', lazy=True)
    
    @property
    def is_online(self):
        """Verifica se player está online baseado no último ping"""
        if not self.last_ping:
            return False
        return (datetime.utcnow() - self.last_ping).total_seconds() < 300  # 5 minutos
    
    @property
    def storage_available_gb(self):
        """Calcula espaço disponível em GB"""
        return max(0, self.storage_capacity_gb - self.storage_used_gb)
    
    @property
    def storage_percentage(self):
        """Calcula percentual de uso do armazenamento"""
        if self.storage_capacity_gb > 0:
            return (self.storage_used_gb / self.storage_capacity_gb) * 100
        return 0
    
    @property
    def location_name(self):
        """Retorna nome da localização"""
        from models.location import Location
        location = Location.query.get(self.location_id)
        return location.name if location else 'N/A'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'location_id': self.location_id,
            'location_name': self.location_name,
            'room_name': self.room_name,
            'mac_address': self.mac_address,
            'ip_address': self.ip_address,
            'chromecast_id': self.chromecast_id,
            'chromecast_name': self.chromecast_name,
            'platform': self.platform,
            'resolution': self.resolution,
            'orientation': self.orientation,
            'player_version': self.player_version,
            'is_online': self.is_online,
            'is_active': self.is_active,
            'status': self.status,
            'last_ping': self.last_ping.isoformat() if self.last_ping else None,
            'last_content_sync': self.last_content_sync.isoformat() if self.last_content_sync else None,
            'default_content_duration': self.default_content_duration,
            'transition_effect': self.transition_effect,
            'volume_level': self.volume_level,
            'storage_capacity_gb': self.storage_capacity_gb,
            'storage_used_gb': self.storage_used_gb,
            'storage_available_gb': self.storage_available_gb,
            'storage_percentage': round(self.storage_percentage, 2),
            'avg_download_speed_kbps': self.avg_download_speed_kbps,
            'network_speed_mbps': self.network_speed_mbps,
            'total_content_downloaded_gb': self.total_content_downloaded_gb,
            'uptime_percentage': self.uptime_percentage,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
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
    
    def __repr__(self):
        return f'<Player {self.name} - {self.location_name}>'
