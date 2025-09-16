from datetime import datetime
import uuid
from database import db

class ContentDistribution(db.Model):
    __tablename__ = 'content_distributions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Relacionamentos
    content_id = db.Column(db.String(36), db.ForeignKey('contents.id'), nullable=False)
    player_id = db.Column(db.String(36), db.ForeignKey('players.id'), nullable=False)
    
    # Status da distribuição
    status = db.Column(db.String(20), default='pending')  # pending, downloading, completed, failed, cancelled
    priority = db.Column(db.Integer, default=1)  # 1=baixa, 5=alta
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    
    # Métricas de download
    download_progress = db.Column(db.Integer, default=0)  # 0-100%
    download_speed_kbps = db.Column(db.Integer, default=0)
    file_size_bytes = db.Column(db.BigInteger, default=0)
    bytes_downloaded = db.Column(db.BigInteger, default=0)
    checksum = db.Column(db.String(64))  # SHA256
    
    # Controle de retry
    retry_count = db.Column(db.Integer, default=0)
    max_retries = db.Column(db.Integer, default=3)
    last_error = db.Column(db.Text)
    
    # Configurações de distribuição
    scheduled_for = db.Column(db.DateTime)  # Para distribuição agendada
    expires_at = db.Column(db.DateTime)     # Quando o conteúdo expira no player
    
    def to_dict(self):
        return {
            'id': self.id,
            'content_id': self.content_id,
            'player_id': self.player_id,
            'status': self.status,
            'priority': self.priority,
            'download_progress': self.download_progress,
            'download_speed_kbps': self.download_speed_kbps,
            'file_size_bytes': self.file_size_bytes,
            'bytes_downloaded': self.bytes_downloaded,
            'checksum': self.checksum,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'last_error': self.last_error,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'scheduled_for': self.scheduled_for.isoformat() if self.scheduled_for else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'estimated_time_remaining': self.estimated_time_remaining,
            'download_percentage': round((self.bytes_downloaded / self.file_size_bytes * 100), 2) if self.file_size_bytes > 0 else 0
        }
    
    @property
    def estimated_time_remaining(self):
        """Calcula tempo estimado restante para download"""
        if self.download_speed_kbps > 0 and self.file_size_bytes > 0:
            remaining_bytes = self.file_size_bytes - self.bytes_downloaded
            remaining_seconds = (remaining_bytes / 1024) / self.download_speed_kbps
            return int(remaining_seconds)
        return None
    
    def mark_started(self):
        """Marca distribuição como iniciada"""
        self.status = 'downloading'
        self.started_at = datetime.utcnow()
        db.session.commit()
    
    def mark_completed(self):
        """Marca distribuição como concluída"""
        self.status = 'completed'
        self.completed_at = datetime.utcnow()
        self.download_progress = 100
        self.bytes_downloaded = self.file_size_bytes
        db.session.commit()
    
    def mark_failed(self, error_message=None):
        """Marca distribuição como falhou"""
        self.status = 'failed'
        self.retry_count += 1
        if error_message:
            self.last_error = error_message
        db.session.commit()
    
    def update_progress(self, bytes_downloaded, speed_kbps=None):
        """Atualiza progresso do download"""
        self.bytes_downloaded = bytes_downloaded
        if self.file_size_bytes > 0:
            self.download_progress = int((bytes_downloaded / self.file_size_bytes) * 100)
        
        if speed_kbps:
            self.download_speed_kbps = speed_kbps
        
        db.session.commit()
    
    def can_retry(self):
        """Verifica se pode tentar novamente"""
        return self.retry_count < self.max_retries
    
    def __repr__(self):
        return f'<ContentDistribution {self.content_id} -> {self.player_id} ({self.status})>'
