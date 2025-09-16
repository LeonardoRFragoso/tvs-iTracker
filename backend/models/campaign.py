from datetime import datetime
import uuid
from database import db

class Campaign(db.Model):
    __tablename__ = 'campaigns'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    priority = db.Column(db.Integer, default=1)  # 1=baixa, 5=alta
    
    # Segmentação
    regions = db.Column(db.Text)  # JSON array de regiões
    time_slots = db.Column(db.Text)  # JSON array de horários
    days_of_week = db.Column(db.Text)  # JSON array de dias da semana
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Chaves estrangeiras
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    
    # Relacionamentos
    contents = db.relationship('CampaignContent', backref='campaign', lazy=True)
    schedules = db.relationship('Schedule', lazy=True)
    
    def to_dict(self):
        # Get first content thumbnail for campaign display
        first_content_thumbnail = None
        if self.contents:
            # Sort by order_index to get the first content
            sorted_contents = sorted(self.contents, key=lambda x: x.order_index)
            if sorted_contents and sorted_contents[0].content:
                first_content = sorted_contents[0].content
                if hasattr(first_content, 'thumbnail_path') and first_content.thumbnail_path:
                    first_content_thumbnail = f"/content/thumbnails/{first_content.thumbnail_path.split('/')[-1]}"
        
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_active': self.is_active,
            'priority': self.priority,
            'regions': self.regions,
            'time_slots': self.time_slots,
            'days_of_week': self.days_of_week,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'creator': self.creator.username if self.creator else None,
            'content_count': len(self.contents),
            'thumbnail': first_content_thumbnail,
            'contents': [cc.content.to_dict() if cc.content else None for cc in sorted(self.contents, key=lambda x: x.order_index)] if hasattr(self, '_include_contents') else None
        }
    
    def __repr__(self):
        return f'<Campaign {self.name}>'

class CampaignContent(db.Model):
    __tablename__ = 'campaign_contents'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = db.Column(db.String(36), db.ForeignKey('campaigns.id'), nullable=False)
    content_id = db.Column(db.String(36), db.ForeignKey('contents.id'), nullable=False)
    order_index = db.Column(db.Integer, default=0)
    duration_override = db.Column(db.Integer)  # Override da duração padrão do conteúdo
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'campaign_id': self.campaign_id,
            'content_id': self.content_id,
            'order_index': self.order_index,
            'duration_override': self.duration_override,
            'content': self.content.to_dict() if self.content else None
        }
