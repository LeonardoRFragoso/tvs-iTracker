from datetime import datetime
import uuid
import json
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
    campaign_contents = db.relationship('CampaignContent', lazy=True)
    
    def to_dict(self):
        tags_list = []
        try:
            if isinstance(self.tags, list):
                tags_list = self.tags
            elif isinstance(self.tags, str):
                s = self.tags.strip()
                if s:
                    try:
                        parsed = json.loads(s)
                        if isinstance(parsed, list):
                            tags_list = parsed
                        elif isinstance(parsed, str):
                            tags_list = [parsed]
                        else:
                            tags_list = [str(parsed)]
                    except Exception:
                        if ',' in s:
                            tags_list = [t.strip() for t in s.split(',') if t.strip()]
                        else:
                            tags_list = [s]
        except Exception:
            tags_list = []
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
            'tags': tags_list,
            'category': self.category,
            'is_active': self.is_active,
            'created_at': fmt_br_datetime(self.created_at),
            'updated_at': fmt_br_datetime(self.updated_at),
            'user_id': self.user_id,
            'author': self.author.username if hasattr(self, 'author') and self.author else None
        }
    
    def __repr__(self):
        return f'<Content {self.title}>'
