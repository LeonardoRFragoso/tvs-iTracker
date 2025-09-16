from datetime import datetime, time
import uuid
from database import db

class Location(db.Model):
    __tablename__ = 'locations'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)  # "Sede São Paulo"
    city = db.Column(db.String(50), nullable=False)
    state = db.Column(db.String(2), nullable=False)
    address = db.Column(db.Text)
    
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
        return {
            'id': self.id,
            'name': self.name,
            'city': self.city,
            'state': self.state,
            'address': self.address,
            'timezone': self.timezone,
            'network_bandwidth_mbps': self.network_bandwidth_mbps,
            'peak_hours_start': self.peak_hours_start.strftime('%H:%M') if self.peak_hours_start else None,
            'peak_hours_end': self.peak_hours_end.strftime('%H:%M') if self.peak_hours_end else None,
            'is_active': self.is_active,
            'player_count': len(self.players),
            'online_players': len([p for p in self.players if p.is_online]),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<Location {self.name} - {self.city}/{self.state}>'
