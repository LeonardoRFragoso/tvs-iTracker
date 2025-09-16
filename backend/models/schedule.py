from datetime import datetime
import uuid
from database import db

class Schedule(db.Model):
    __tablename__ = 'schedules'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    
    # Relacionamentos
    campaign_id = db.Column(db.String(36), db.ForeignKey('campaigns.id'), nullable=False)
    player_id = db.Column(db.String(36), db.ForeignKey('players.id'), nullable=False)
    
    # Configurações de agendamento
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    start_time = db.Column(db.Time)  # Hora de início diária
    end_time = db.Column(db.Time)    # Hora de fim diária
    
    # Dias da semana (0=domingo, 6=sábado)
    days_of_week = db.Column(db.String(20), default='1,2,3,4,5')  # Segunda a sexta por padrão
    
    # Configurações de repetição
    repeat_type = db.Column(db.String(20), default='daily')  # daily, weekly, monthly
    repeat_interval = db.Column(db.Integer, default=1)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    priority = db.Column(db.Integer, default=1)  # 1-10 scale (1=baixa, 10=alta)
    
    # Configurações de persistência/overlay
    is_persistent = db.Column(db.Boolean, default=False)  # Se deve ficar fixo na tela
    content_type = db.Column(db.String(20), default='main')  # 'main' ou 'overlay'
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'campaign_id': self.campaign_id,
            'player_id': self.player_id,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'days_of_week': self.days_of_week,
            'repeat_type': self.repeat_type,
            'repeat_interval': self.repeat_interval,
            'is_active': self.is_active,
            'priority': self.priority,
            'is_persistent': self.is_persistent,
            'content_type': self.content_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'campaign': self.campaign.to_dict() if self.campaign else None,
            'player': self.player.to_dict() if self.player else None
        }
    
    def __repr__(self):
        return f'<Schedule {self.name}>'
