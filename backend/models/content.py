from datetime import datetime
import uuid
from database import db

class Content(db.Model):
    __tablename__ = 'contents'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    content_type = db.Column(db.String(50), nullable=False)  # image, video, text, html, rss
    file_path = db.Column(db.String(500))
    thumbnail_path = db.Column(db.String(500))  # Caminho para thumbnail/miniatura
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    duration = db.Column(db.Integer, default=10)  # segundos para exibição
    tags = db.Column(db.Text)  # JSON array de tags
    category = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Chaves estrangeiras
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    
    # Relacionamentos
    campaign_contents = db.relationship('CampaignContent', backref='content', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'content_type': self.content_type,
            'file_path': self.file_path,
            'thumbnail_path': self.thumbnail_path,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'duration': self.duration,
            'tags': self.tags,
            'category': self.category,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'user_id': self.user_id,
            'author': self.author.username if hasattr(self, 'author') and self.author else None
        }
    
    def __repr__(self):
        return f'<Content {self.title}>'
