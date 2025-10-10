from database import db
from datetime import datetime, time
import json
import uuid

# Module-level helper to format datetime in Brazilian standard
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

class Schedule(db.Model):
    __tablename__ = 'schedules'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    campaign_id = db.Column(db.String(36), db.ForeignKey('campaigns.id'), nullable=False)
    player_id = db.Column(db.String(36), db.ForeignKey('players.id'), nullable=False)
    
    # Campos de agendamento
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    days_of_week = db.Column(db.String(20), nullable=False)  # "0,1,2,3,4,5,6"
    
    # Campos de repetição
    repeat_type = db.Column(db.String(20), default='daily')
    repeat_interval = db.Column(db.Integer, default=1)
    
    # Campos de controle
    priority = db.Column(db.Integer, default=1)
    is_persistent = db.Column(db.Boolean, default=False)
    content_type = db.Column(db.String(20), default='main')  # main, overlay
    is_active = db.Column(db.Boolean, default=True)
    
    # CONFIGURAÇÕES UNIFICADAS DE REPRODUÇÃO (movidas da Campaign)
    # Modo de reprodução
    playback_mode = db.Column(db.String(50), default='sequential')  # sequential, random, single, loop_infinite
    
    # Duração e temporização
    content_duration = db.Column(db.Integer, default=10)  # duração padrão por conteúdo (segundos)
    transition_duration = db.Column(db.Integer, default=1)  # tempo entre conteúdos (segundos)
    
    # Comportamento de loop e persistência
    loop_behavior = db.Column(db.String(20), default='until_next')  # until_next, time_limited, infinite
    loop_duration_minutes = db.Column(db.Integer)  # para time_limited
    
    # Filtros e seleção de conteúdo
    content_filter = db.Column(db.Text)  # JSON com filtros de conteúdo
    content_selection = db.Column(db.String(20), default='all')  # all, specific, filtered
    
    # Configurações avançadas
    shuffle_enabled = db.Column(db.Boolean, default=False)  # embaralhar conteúdos
    auto_skip_errors = db.Column(db.Boolean, default=True)  # pular conteúdos com erro
    
    # Compatibilidade com tipos de dispositivos
    device_type_compatibility = db.Column(db.String(100), default='modern,tizen,legacy')  # tipos de dispositivos compatíveis
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    campaign = db.relationship('Campaign', overlaps="schedules", lazy=True)
    player = db.relationship('Player', overlaps="schedules", lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'campaign_id': self.campaign_id,
            'player_id': self.player_id,
            'start_date': fmt_br_datetime(self.start_date),
            'end_date': fmt_br_datetime(self.end_date),
            'start_time': self.start_time.strftime('%H:%M:%S') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M:%S') if self.end_time else None,
            'days_of_week': self.days_of_week,
            'repeat_type': self.repeat_type,
            'repeat_interval': self.repeat_interval,
            'priority': self.priority,
            'is_persistent': self.is_persistent,
            'content_type': self.content_type,
            'is_active': self.is_active,
            # Configurações unificadas de reprodução
            'playback_mode': self.playback_mode,
            'content_duration': self.content_duration,
            'transition_duration': self.transition_duration,
            'loop_behavior': self.loop_behavior,
            'loop_duration_minutes': self.loop_duration_minutes,
            'content_filter': json.loads(self.content_filter) if self.content_filter else None,
            'content_selection': self.content_selection,
            'shuffle_enabled': self.shuffle_enabled,
            'auto_skip_errors': self.auto_skip_errors,
            'device_type_compatibility': self.device_type_compatibility,
            'created_at': fmt_br_datetime(self.created_at),
            'updated_at': fmt_br_datetime(self.updated_at),
            'player': self.player.to_dict() if self.player else None,
            'campaign': self.campaign.to_dict() if self.campaign else None,
            'is_all_day': (self.start_time == time(0, 0, 0) and self.end_time == time(23, 59, 59)) if (self.start_time and self.end_time) else False
        }
    
    def get_filtered_contents(self):
        """Retorna conteúdos da campanha filtrados pelas configurações do agendamento"""
        if not self.campaign:
            return []
        
        # Obter filtros do agendamento
        filters = {}
        if self.content_filter:
            try:
                filters = json.loads(self.content_filter)
            except:
                filters = {}
        
        # Definir filtro padrão por slot caso não haja filtro explícito
        content_type_filter = filters.get('content_type') if isinstance(filters, dict) else None
        if not content_type_filter:
            # CORREÇÃO: Para content_type 'main', não aplicar filtro automático de tipo
            # Permitir que campanhas com imagens sejam reproduzidas em slots 'main'
            if self.content_type == 'overlay':
                content_type_filter = 'image'
            # Removido: elif self.content_type == 'main': content_type_filter = 'video'
            # Agora 'main' aceita qualquer tipo de conteúdo (video, image, audio)
        
        # Contexto do agendamento para filtros
        schedule_context = {
            'hour': datetime.now().hour,
            'weekday': datetime.now().weekday(),
            'player_location': self.player.location_id if self.player else None
        }
        
        # Obter conteúdos da campanha
        contents = self.campaign.get_contents_for_playback(
            content_filter=content_type_filter,
            location_filter=schedule_context.get('player_location')
        )
        
        # Aplicar filtros específicos do agendamento
        if self.content_selection == 'specific' and 'content_ids' in filters:
            specific_ids = filters['content_ids']
            contents = [c for c in contents if c.content_id in specific_ids]
        
        # Aplicar filtros de horário/contexto
        filtered_contents = []
        for content in contents:
            if content.is_available_for_schedule(schedule_context):
                filtered_contents.append(content)
        
        return filtered_contents
    
    def get_effective_playback_mode(self):
        """Retorna o modo de reprodução configurado no agendamento"""
        return self.playback_mode or 'sequential'
    
    def is_active_now(self):
        """Verifica se o agendamento deve estar ativo agora"""
        now = datetime.now()
        current_date = now.date()
        current_time = now.time()
        current_weekday = now.weekday()
        
        # Verificar se está no período de datas
        if current_date < self.start_date.date() or current_date > self.end_date.date():
            return False
        
        # Normalizar dias da semana do formato frontend (1=Seg..6=Sáb, 0=Dom) para Python (0=Seg..6=Dom)
        if self.days_of_week:
            try:
                allowed_days_raw = [int(d.strip()) for d in self.days_of_week.split(',')]
                allowed_days = [(6 if d == 0 else d - 1) for d in allowed_days_raw]
            except Exception:
                allowed_days = list(range(7))
        else:
            allowed_days = list(range(7))
        
        # Verificar horário com suporte a overnight e boundary de dia
        if self.start_time <= self.end_time:
            # Janela no mesmo dia
            if current_weekday not in allowed_days:
                return False
            if not (self.start_time <= current_time <= self.end_time):
                return False
        else:
            # Janela overnight (ex: 22:00 -> 06:00)
            in_window = (current_time >= self.start_time) or (current_time <= self.end_time)
            if not in_window:
                return False
            # Se estamos na madrugada (antes do end_time), validar contra o dia anterior
            weekday_to_check = current_weekday if current_time >= self.start_time else (current_weekday - 1) % 7
            if weekday_to_check not in allowed_days:
                return False
        
        return True
    
    def set_content_filter(self, content_type=None, content_ids=None, location_filter=None, 
                          time_filter=None, custom_filters=None):
        """Define filtros de conteúdo para o agendamento"""
        filters = {}
        
        if content_type:
            filters['content_type'] = content_type
        
        if content_ids:
            filters['content_ids'] = content_ids
            self.content_selection = 'specific'
        
        if location_filter:
            filters['location_filter'] = location_filter
        
        if time_filter:
            filters['time_filter'] = time_filter
        
        if custom_filters:
            filters.update(custom_filters)
        
        self.content_filter = json.dumps(filters) if filters else None
    
    def get_next_content(self, current_content_id=None):
        """Retorna o próximo conteúdo a ser reproduzido"""
        contents = self.get_filtered_contents()
        
        if not contents:
            return None
        
        playback_mode = self.get_effective_playback_mode()
        
        # Modo aleatório independe do switch 'shuffle_enabled' (UI simplificada)
        if playback_mode == 'random':
            import random
            return random.choice(contents)
        
        elif playback_mode == 'single':
            # Sempre retorna o primeiro conteúdo
            return contents[0]
        
        elif playback_mode in ['sequential', 'loop_infinite']:
            if not current_content_id:
                return contents[0]
            
            # Encontrar índice atual
            current_index = -1
            for i, content in enumerate(contents):
                if content.content_id == current_content_id:
                    current_index = i
                    break
            
            # Próximo índice
            next_index = current_index + 1
            
            if next_index >= len(contents):
                if playback_mode == 'loop_infinite' or self.loop_behavior in ['infinite', 'until_next']:
                    next_index = 0  # Volta ao início
                else:
                    return None  # Fim da sequência
            
            return contents[next_index]
        
        return contents[0]  # Fallback
    
    def get_content_duration(self, content):
        """Retorna a duração efetiva de um conteúdo no contexto deste agendamento"""
        # Prioridade: duration_override do conteúdo > duração do Schedule > duração do conteúdo > padrão
        if hasattr(content, 'duration_override') and content.duration_override:
            return content.duration_override
        elif self.content_duration:
            return self.content_duration
        elif hasattr(content, 'content') and content.content and content.content.duration:
            return content.content.duration
        else:
            return 10  # Duração padrão
    
    def is_compatible_with_device_type(self, device_type):
        """Verifica se o agendamento é compatível com o tipo de dispositivo"""
        # Sem restrição explícita → compatível
        if not self.device_type_compatibility:
            return True

        # Normaliza lista de tipos
        compatible_types = [t.strip() for t in str(self.device_type_compatibility or '').split(',') if t and str(t).strip()]

        # Se vazio após normalização, considerar compatível
        if not compatible_types:
            return True

        # Política: 'legacy' representa compatibilidade de recursos mínimos ⇒ vale para todos
        if 'legacy' in compatible_types:
            return True

        # Caso contrário, exigir correspondência explícita
        return (device_type or '').strip() in compatible_types
    
    def validate_schedule(self):
        """Valida a configuração do agendamento"""
        errors = []
        
        if not self.name or not self.name.strip():
            errors.append("Nome é obrigatório")
        
        if not self.campaign_id:
            errors.append("Campanha é obrigatória")
        
        if not self.player_id:
            errors.append("Player é obrigatório")
        
        if self.start_date >= self.end_date:
            errors.append("Data de início deve ser anterior à data de fim")
        
        if not self.days_of_week:
            errors.append("Pelo menos um dia da semana deve ser selecionado")
        
        # Verificar se a campanha tem conteúdos
        if self.campaign:
            active_contents = self.campaign.get_active_contents()
            if not active_contents:
                errors.append("A campanha selecionada não possui conteúdos ativos")
        
        # Validar configurações de loop
        if self.loop_behavior == 'time_limited' and not self.loop_duration_minutes:
            errors.append("Duração do loop é obrigatória quando comportamento é 'time_limited'")
        
        if self.content_duration and self.content_duration < 1:
            errors.append("Duração do conteúdo deve ser maior que 0")
        
        return errors
