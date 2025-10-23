from datetime import datetime
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

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')  # admin, manager, user, hr
    company = db.Column(db.String(100), default='iTracker')  # iTracker, Rio Brasil Terminal - RBT, CLIA
    is_active = db.Column(db.Boolean, default=True)
    # Novo: fluxo de aprovação e troca de senha
    status = db.Column(db.String(20), default='active')  # active, pending, rejected
    must_change_password = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    onboarding_version = db.Column(db.String(50))
    onboarding_completed_at = db.Column(db.DateTime)
    onboarding_step_index = db.Column(db.Integer, default=0)
    
    # Relacionamentos usando strings para evitar problemas de importação circular
    contents = db.relationship('Content', backref='author', lazy=True)
    campaigns = db.relationship('Campaign', backref='creator', lazy=True)  # Restaurado
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'company': self.company,
            'status': self.status,
            'must_change_password': self.must_change_password,
            'is_active': self.is_active,
            'created_at': fmt_br_datetime(self.created_at),
            'last_login': fmt_br_datetime(self.last_login),
            'onboarding_version': self.onboarding_version,
            'onboarding_completed_at': fmt_br_datetime(self.onboarding_completed_at),
            'onboarding_step_index': self.onboarding_step_index,
        }
    
    def __repr__(self):
        return f'<User {self.username}>'
