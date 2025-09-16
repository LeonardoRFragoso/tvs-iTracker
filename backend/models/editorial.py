from datetime import datetime
import uuid
from database import db

class Editorial(db.Model):
    __tablename__ = 'editorials'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    editorial_type = db.Column(db.String(50), nullable=False)  # news, weather, sports, finance, rss
    
    # Configurações do feed
    feed_url = db.Column(db.String(500))
    api_key = db.Column(db.String(255))
    refresh_interval = db.Column(db.Integer, default=3600)  # segundos
    max_items = db.Column(db.Integer, default=10)
    
    # Configurações de exibição
    template = db.Column(db.Text)  # HTML template para exibição
    duration_per_item = db.Column(db.Integer, default=15)  # segundos por item
    
    # Filtros e configurações
    keywords = db.Column(db.Text)  # JSON array de palavras-chave
    categories = db.Column(db.Text)  # JSON array de categorias
    language = db.Column(db.String(10), default='pt-BR')
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    last_update = db.Column(db.DateTime)
    last_error = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    items = db.relationship('EditorialItem', backref='editorial', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'editorial_type': self.editorial_type,
            'feed_url': self.feed_url,
            'refresh_interval': self.refresh_interval,
            'max_items': self.max_items,
            'template': self.template,
            'duration_per_item': self.duration_per_item,
            'keywords': self.keywords,
            'categories': self.categories,
            'language': self.language,
            'is_active': self.is_active,
            'last_update': self.last_update.isoformat() if self.last_update else None,
            'last_error': self.last_error,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'items_count': len(self.items)
        }
    
    def __repr__(self):
        return f'<Editorial {self.name}>'

class EditorialItem(db.Model):
    __tablename__ = 'editorial_items'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    editorial_id = db.Column(db.String(36), db.ForeignKey('editorials.id'), nullable=False)
    
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    content = db.Column(db.Text)
    image_url = db.Column(db.String(500))
    source_url = db.Column(db.String(500))
    author = db.Column(db.String(255))
    
    published_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'editorial_id': self.editorial_id,
            'title': self.title,
            'description': self.description,
            'content': self.content,
            'image_url': self.image_url,
            'source_url': self.source_url,
            'author': self.author,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<EditorialItem {self.title}>'
