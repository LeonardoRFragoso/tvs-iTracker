from datetime import datetime
import uuid
from database import db

# Helper to format datetime in Brazilian standard

def fmt_br_datetime(dt):
    try:
        return dt.strftime('%d/%m/%Y %H:%M:%S') if dt else None
    except Exception:
        return None

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')  # admin, manager, user
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Relacionamentos usando strings para evitar problemas de importação circular
    contents = db.relationship('Content', backref='author', lazy=True)
    campaigns = db.relationship('Campaign', backref='creator', lazy=True)  # Restaurado
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': fmt_br_datetime(self.created_at),
            'last_login': fmt_br_datetime(self.last_login)
        }
    
    def __repr__(self):
        return f'<User {self.username}>'
