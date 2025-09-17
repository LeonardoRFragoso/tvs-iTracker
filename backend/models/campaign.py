from database import db
from datetime import datetime
import json

class Campaign(db.Model):
    __tablename__ = 'campaigns'
    
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    # Scheduling window and metadata (used by routes/campaign.py and frontend)
    start_date = db.Column(db.DateTime)
    end_date = db.Column(db.DateTime)
    priority = db.Column(db.Integer, default=1)
    regions = db.Column(db.Text)       # JSON string
    time_slots = db.Column(db.Text)    # JSON string
    days_of_week = db.Column(db.Text)  # JSON string
    
    # Chave estrangeira para usuário
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    
    # Novos campos para múltiplos conteúdos
    playback_mode = db.Column(db.String(50), default='sequential')  # sequential, random, single, loop
    content_duration = db.Column(db.Integer, default=10)  # duração padrão em segundos
    loop_enabled = db.Column(db.Boolean, default=False)
    shuffle_enabled = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    contents = db.relationship('CampaignContent', lazy=True, cascade='all, delete-orphan')
    schedules = db.relationship('Schedule', lazy=True)
    user = db.relationship('User', overlaps="campaigns,creator", lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'priority': self.priority,
            'regions': json.loads(self.regions) if self.regions else [],
            'time_slots': json.loads(self.time_slots) if self.time_slots else [],
            'days_of_week': json.loads(self.days_of_week) if self.days_of_week else [],
            'playback_mode': self.playback_mode,
            'content_duration': self.content_duration,
            'loop_enabled': self.loop_enabled,
            'shuffle_enabled': self.shuffle_enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'content_count': len([c for c in self.contents if c.is_active]),
            'total_content_count': len(self.contents),
            'user_id': self.user_id
        }
    
    def get_active_contents(self, order_by_index=True):
        """Retorna conteúdos ativos da campanha"""
        query = CampaignContent.query.filter_by(
            campaign_id=self.id, 
            is_active=True
        )
        
        if order_by_index:
            query = query.order_by(CampaignContent.order_index)
        
        return query.all()
    
    def get_contents_for_playback(self, content_filter=None, location_filter=None):
        """Retorna conteúdos filtrados para reprodução"""
        contents = self.get_active_contents()
        
        # Aplicar filtro de tipo de conteúdo
        if content_filter:
            if content_filter == 'video':
                contents = [c for c in contents if c.content.content_type == 'video']
            elif content_filter == 'image':
                contents = [c for c in contents if c.content.content_type == 'image']
        
        # Aplicar filtro de localização
        if location_filter:
            filtered_contents = []
            for c in contents:
                if c.location_filter:
                    try:
                        locations = json.loads(c.location_filter)
                        if location_filter in locations or 'all' in locations:
                            filtered_contents.append(c)
                    except:
                        filtered_contents.append(c)  # Se erro no JSON, incluir
                else:
                    filtered_contents.append(c)  # Se sem filtro, incluir
            contents = filtered_contents
        
        # Aplicar modo de reprodução
        if self.shuffle_enabled and self.playback_mode == 'random':
            import random
            contents = contents.copy()
            random.shuffle(contents)
        
        return contents
    
    def add_content(self, content_id, order_index=None, duration_override=None, 
                   location_filter=None, schedule_filter=None):
        """Adiciona conteúdo à campanha"""
        if order_index is None:
            # Pegar próximo índice
            max_order = db.session.query(db.func.max(CampaignContent.order_index))\
                               .filter_by(campaign_id=self.id).scalar() or 0
            order_index = max_order + 1
        
        campaign_content = CampaignContent(
            campaign_id=self.id,
            content_id=content_id,
            order_index=order_index,
            duration_override=duration_override,
            location_filter=json.dumps(location_filter) if location_filter else None,
            schedule_filter=json.dumps(schedule_filter) if schedule_filter else None,
            is_active=True
        )
        
        db.session.add(campaign_content)
        return campaign_content
    
    def remove_content(self, content_id):
        """Remove conteúdo da campanha"""
        campaign_content = CampaignContent.query.filter_by(
            campaign_id=self.id,
            content_id=content_id
        ).first()
        
        if campaign_content:
            db.session.delete(campaign_content)
            return True
        return False
    
    def reorder_contents(self, content_orders):
        """Reordena conteúdos da campanha
        content_orders: lista de dicts com {'content_id': str, 'order_index': int}
        """
        for item in content_orders:
            campaign_content = CampaignContent.query.filter_by(
                campaign_id=self.id,
                content_id=item['content_id']
            ).first()
            
            if campaign_content:
                campaign_content.order_index = item['order_index']
        
        db.session.commit()

class CampaignContent(db.Model):
    __tablename__ = 'campaign_contents'
    
    id = db.Column(db.String(36), primary_key=True)
    campaign_id = db.Column(db.String(36), db.ForeignKey('campaigns.id'), nullable=False)
    content_id = db.Column(db.String(36), db.ForeignKey('contents.id'), nullable=False)
    
    # Novos campos para múltiplos conteúdos
    order_index = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    duration_override = db.Column(db.Integer)  # duração específica para este conteúdo
    location_filter = db.Column(db.Text)  # JSON com localizações permitidas
    schedule_filter = db.Column(db.Text)  # JSON com filtros de horário
    playback_settings = db.Column(db.Text)  # JSON com configurações específicas
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    content = db.relationship('Content', overlaps="campaign_contents", lazy=True)
    campaign = db.relationship('Campaign', overlaps="contents", lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'campaign_id': self.campaign_id,
            'content_id': self.content_id,
            'order_index': self.order_index,
            'is_active': self.is_active,
            'duration_override': self.duration_override,
            'location_filter': json.loads(self.location_filter) if self.location_filter else None,
            'schedule_filter': json.loads(self.schedule_filter) if self.schedule_filter else None,
            'playback_settings': json.loads(self.playback_settings) if self.playback_settings else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'content': self.content.to_dict() if self.content else None
        }
    
    def get_effective_duration(self):
        """Retorna a duração efetiva do conteúdo"""
        if self.duration_override:
            return self.duration_override
        elif self.content and self.content.duration:
            return self.content.duration
        else:
            return self.campaign.content_duration if self.campaign else 10
    
    def is_available_for_location(self, location):
        """Verifica se o conteúdo está disponível para uma localização"""
        if not self.location_filter:
            return True
        
        try:
            locations = json.loads(self.location_filter)
            return location in locations or 'all' in locations
        except:
            return True  # Se erro no JSON, assumir disponível
    
    def is_available_for_schedule(self, schedule_context):
        """Verifica se o conteúdo está disponível para um contexto de agendamento"""
        if not self.schedule_filter:
            return True
        
        try:
            filters = json.loads(self.schedule_filter)
            
            # Verificar filtros de horário
            if 'hours' in filters:
                current_hour = schedule_context.get('hour', 0)
                if current_hour not in filters['hours']:
                    return False
            
            # Verificar filtros de dia da semana
            if 'weekdays' in filters:
                current_weekday = schedule_context.get('weekday', 0)
                if current_weekday not in filters['weekdays']:
                    return False
            
            return True
        except:
            return True  # Se erro no JSON, assumir disponível
