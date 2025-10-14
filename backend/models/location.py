from datetime import datetime, time
import uuid
from database import db

# Helper to format datetime in Brazilian standard
def fmt_br_datetime(dt):
    try:
        # Se dt for uma string, retorná-la diretamente
        if isinstance(dt, str):
            return dt
        # Se for um datetime, formatá-lo
        return dt.strftime('%d/%m/%Y %H:%M:%S') if dt else None
    except Exception as e:
        print(f"[WARN] Erro ao formatar datetime: {dt} - {str(e)}")
        return str(dt) if dt else None

class Location(db.Model):
    __tablename__ = 'locations'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)  # "Empresa São Paulo"
    city = db.Column(db.String(50), nullable=False)
    state = db.Column(db.String(2), nullable=False)
    address = db.Column(db.Text)
    company = db.Column(db.String(100), default='iTracker')  # iTracker, Rio Brasil Terminal - RBT, CLIA
    
    # Configurações de rede
    timezone = db.Column(db.String(50), default='America/Sao_Paulo')
    network_bandwidth_mbps = db.Column(db.Integer, default=100)
    peak_hours_start = db.Column(db.Time, default=time(8, 0))  # 08:00
    peak_hours_end = db.Column(db.Time, default=time(18, 0))   # 18:00
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    players = db.relationship('Player', backref='location_ref', lazy=True)
    
    def to_dict(self):
        # Usar SQL direto para contar players e evitar carregar todos os objetos
        from sqlalchemy import func, and_
        from models.player import Player
        
        # Contar todos os players associados a esta location
        player_count = db.session.query(func.count(Player.id)).filter(Player.location_id == self.id).scalar() or 0
        
        # Contar players online associados a esta location
        online_count = db.session.query(func.count(Player.id)).filter(
            and_(Player.location_id == self.id, Player.is_online == True)
        ).scalar() or 0
        
        return {
            'id': self.id,
            'name': self.name,
            'city': self.city,
            'state': self.state,
            'address': self.address,
            'company': self.company,
            'timezone': self.timezone,
            'network_bandwidth_mbps': self.network_bandwidth_mbps,
            'peak_hours_start': self.peak_hours_start.strftime('%H:%M') if self.peak_hours_start else None,
            'peak_hours_end': self.peak_hours_end.strftime('%H:%M') if self.peak_hours_end else None,
            'is_active': self.is_active,
            'player_count': player_count,
            'online_players': online_count,
            'created_at': fmt_br_datetime(self.created_at)
        }
    
    def __repr__(self):
        return f'<Location {self.name} - {self.city}/{self.state}>'
