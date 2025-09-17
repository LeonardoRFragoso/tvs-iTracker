import logging
from datetime import datetime, time, date
from typing import List
from database import db
from models.schedule import Schedule
from models.player import Player
from models.campaign import Campaign, CampaignContent
from models.content import Content
from services.chromecast_service import chromecast_service
from sqlalchemy import or_

logger = logging.getLogger(__name__)

class ScheduleExecutor:
    """Serviço para executar agendamentos automaticamente"""
    
    def __init__(self, socketio=None):
        self.socketio = socketio
        self.active_executions = {}  # player_id -> {'main': schedule_id, 'overlay': schedule_id}
        self.active_overlays = {}    # player_id -> schedule_id (for overlay content)
        self.current_content_tracking = {}  # "player_id_schedule_id" -> current_content_id
        self.current_content_started_at = {}  # "player_id_schedule_id" -> datetime started
    
    def check_and_execute_schedules(self):
        """Verifica e executa agendamentos que devem estar ativos agora"""
        try:
            logger.info("Verificando agendamentos ativos...")
            print(f"[DEBUG] Iniciando verificação de agendamentos às {datetime.now()}")
            
            # Usar horário local ao invés de UTC
            now = datetime.now()
            current_time = now.time()
            current_date = now.date()
            current_weekday = now.weekday() + 1  # 1=segunda, 7=domingo
            
            print(f"[DEBUG] Data atual: {current_date}, Hora: {current_time}, Dia da semana: {current_weekday}")
            
            # Debug: Verificar todos os agendamentos primeiro
            all_schedules = Schedule.query.all()
            print(f"[DEBUG] Total de agendamentos no banco: {len(all_schedules)}")
            
            for s in all_schedules:
                print(f"[DEBUG] Schedule: {s.name}, is_active: {s.is_active}, start_date: {s.start_date}, end_date: {s.end_date}")
            
            # Buscar agendamentos que devem estar ativos - query corrigida
            active_schedules = Schedule.query.filter(
                Schedule.is_active == True,
                db.func.date(Schedule.start_date) <= current_date,
                or_(Schedule.end_date.is_(None), db.func.date(Schedule.end_date) >= current_date)
            ).all()
            
            print(f"[DEBUG] Encontrados {len(active_schedules)} agendamentos ativos")
            
            # Agrupar agendamentos por player e tipo de conteúdo
            player_schedules = {}
            for schedule in active_schedules:
                if self._should_execute_now(schedule, current_time, current_weekday):
                    player_id = schedule.player_id
                    if player_id not in player_schedules:
                        player_schedules[player_id] = {'main': [], 'overlay': []}
                    
                    # Determinar tipo de conteúdo baseado na campanha
                    content_type = self._get_content_type(schedule)
                    player_schedules[player_id][content_type].append(schedule)
            
            # Executar agendamentos para cada player
            for player_id, schedules in player_schedules.items():
                self._execute_player_schedules(player_id, schedules)
                
        except Exception as e:
            logger.error(f"Erro ao verificar agendamentos: {e}")
            print(f"[ERROR] Erro ao verificar agendamentos: {e}")
    
    def _get_content_type(self, schedule):
        """Determina o tipo de conteúdo baseado na campanha e conteúdo"""
        try:
            campaign = Campaign.query.get(schedule.campaign_id)
            if not campaign:
                return 'main'
            
            # Buscar primeiro conteúdo da campanha para determinar tipo
            campaign_content = CampaignContent.query.filter_by(
                campaign_id=campaign.id
            ).order_by(CampaignContent.order_index).first()
            
            if campaign_content:
                content = Content.query.get(campaign_content.content_id)
                if content:
                    # Considerar imagens como overlay se o nome contém "logo" ou se é do tipo image
                    if ('logo' in content.title.lower() or 
                        'overlay' in content.title.lower() or 
                        content.content_type == 'image'):
                        return 'overlay'
            
            return 'main'
        except Exception as e:
            logger.error(f"Erro ao determinar tipo de conteúdo: {e}")
            return 'main'
    
    def _execute_player_schedules(self, player_id, schedules):
        """Executa agendamentos para um player específico, permitindo overlay + main content"""
        try:
            has_main = bool(schedules['main'])
            has_overlay = bool(schedules['overlay'])

            # 1) Se há conteúdo principal ativo, prioriza o principal e garante que o overlay saia de cena
            if has_main:
                # Limpa overlay do tracking para permitir reexecução automática quando o principal finalizar
                if player_id in self.active_overlays:
                    print(f"[DEBUG] Limpando overlay ativo do tracking para player {player_id} porque há conteúdo principal ativo")
                    del self.active_overlays[player_id]

                main_schedule = schedules['main'][0]  # primeiro principal
                if player_id not in self.active_executions:
                    self.active_executions[player_id] = {}
                current_main = self.active_executions[player_id].get('main')

                if current_main != main_schedule.id:
                    print(f"[DEBUG] Executando conteúdo principal para player {player_id}: {main_schedule.name}")
                    self._execute_schedule(main_schedule, content_type='main')
                    self.active_executions[player_id]['main'] = main_schedule.id

                # Verificar se precisa rotacionar conteúdo principal por duração
                self._rotate_if_needed(main_schedule, 'main')

            # 2) Se NÃO há principal ativo, assegura overlay persistente na tela
            else:
                if has_overlay:
                    overlay_schedule = schedules['overlay'][0]  # primeiro overlay
                    current_overlay = self.active_overlays.get(player_id)
                    if current_overlay != overlay_schedule.id:
                        print(f"[DEBUG] Executando overlay para player {player_id}: {overlay_schedule.name}")
                        self._execute_schedule(overlay_schedule, content_type='overlay')
                        self.active_overlays[player_id] = overlay_schedule.id

                    # Rotação somente se overlay NÃO for persistente
                    if not overlay_schedule.is_persistent:
                        self._rotate_if_needed(overlay_schedule, 'overlay')
             
        except Exception as e:
            logger.error(f"Erro ao executar agendamentos do player {player_id}: {e}")
            print(f"[ERROR] Erro ao executar agendamentos do player {player_id}: {e}")
    
    def _execute_chromecast_schedule(self, schedule: Schedule, player: Player, campaign: Campaign, content_type: str):
        """Executa agendamento em um Chromecast"""
        try:
            # Obter conteúdos filtrados da campanha
            filtered_contents = schedule.get_filtered_contents()
            
            print(f"[DEBUG] Campanha ID: {campaign.id}, Nome: {campaign.name}")
            print(f"[DEBUG] Conteúdos filtrados encontrados: {len(filtered_contents)}")
            
            if not filtered_contents:
                print(f"[DEBUG] Nenhum conteúdo ativo encontrado na campanha {campaign.name}")
                return
            
            # Determinar qual conteúdo reproduzir
            current_content = self._get_current_content_for_player(player.id, schedule.id)
            next_content_item = schedule.get_next_content(current_content)
            
            if not next_content_item:
                print(f"[DEBUG] Nenhum próximo conteúdo encontrado para reprodução")
                return
            
            content = next_content_item.content
            print(f"[DEBUG] Próximo conteúdo selecionado: {content.title}")
            print(f"[DEBUG] Tipo: {content.content_type}")
            print(f"[DEBUG] Duração efetiva: {next_content_item.get_effective_duration()}s")
            
            # Construir URL do conteúdo
            if content.file_path:
                content_url = f"http://192.168.0.4:5000/uploads/{content.file_path.split('/')[-1]}"
                print(f"[DEBUG] Enviando para Chromecast: {content_url}")
            else:
                print(f"[ERROR] Conteúdo {content.title} não tem arquivo associado")
                return
            
            # Obter IDs como strings para evitar problemas de UUID
            player_chromecast_id = str(player.chromecast_id) if player.chromecast_id else None
            if not player_chromecast_id:
                logger.error(f"Player {player.name} não tem chromecast_id configurado")
                return
            
            print(f"[DEBUG] Tentando conectar ao Chromecast:")
            print(f"[DEBUG] - Player: {player.name}")
            print(f"[DEBUG] - Chromecast ID: {player_chromecast_id}")
            print(f"[DEBUG] - Chromecast Name: {getattr(player, 'chromecast_name', 'N/A')}")
            
            # Tentar conectar usando UUID e nome do dispositivo
            # CORREÇÃO: Usar chromecast_name se disponível, senão usar nome do player
            device_name_for_discovery = getattr(player, 'chromecast_name', None) or player.name
            
            print(f"[DEBUG] - Nome para descoberta: {device_name_for_discovery}")
            
            connection_success, actual_device_id = chromecast_service.connect_to_device(
                device_id=player_chromecast_id,
                device_name=device_name_for_discovery  # Usar nome correto do dispositivo
            )
            
            print(f"[DEBUG] Resultado da conexão:")
            print(f"[DEBUG] - Success: {connection_success}")
            print(f"[DEBUG] - Actual Device ID: {actual_device_id}")
            
            if not connection_success:
                logger.error(f"Falha ao conectar ao Chromecast {player.name} após todas as tentativas")
                print(f"[ERROR] Falha ao conectar ao Chromecast {player.name}")
                
                # Tentar atualizar status do player para offline
                try:
                    player.status = 'offline'
                    player.last_seen = datetime.now()
                    db.session.commit()
                    logger.info(f"Status do player {player.name} atualizado para offline")
                except Exception as e:
                    logger.error(f"Erro ao atualizar status do player: {e}")
                    db.session.rollback()
                
                return
            
            # Usar o device_id original para load_media (compatibilidade)
            device_id_for_media = player_chromecast_id
            
            # Determinar tipo de mídia
            media_type = self._infer_mime_type_from_content(content)
            
            # Enviar mídia para o Chromecast
            success = chromecast_service.load_media(
                device_id=device_id_for_media,
                media_url=content_url,
                content_type=media_type,
                title=content.title or "Conteúdo da Campanha"
            )
            
            if success:
                logger.info(f"Conteúdo '{content.title}' enviado para {player.name}")
                print(f"[SUCCESS] Conteúdo '{content.title}' enviado para {player.name}")
                
                # Atualizar controle de conteúdo atual
                self._update_current_content_for_player(player.id, schedule.id, content.id)
                # Marcar início da reprodução do conteúdo atual
                self._set_content_started_at(player.id, schedule.id, datetime.now())
                
                # Atualizar status do player
                try:
                    player.status = 'online'
                    player.last_ping = datetime.now()
                    player.last_seen = datetime.now()
                    db.session.commit()
                    logger.info(f"Status do player {player.name} atualizado para online")
                except Exception as e:
                    logger.error(f"Erro ao atualizar status do player: {e}")
                    db.session.rollback()
                
                # Notificar via WebSocket se disponível
                if self.socketio:
                    self.socketio.emit('schedule_executed', {
                        'schedule_id': str(schedule.id),
                        'player_id': str(player.id),
                        'content_id': str(content.id),
                        'content_title': content.title,
                        'campaign_id': str(campaign.id),
                        'campaign_name': campaign.name,
                        'playback_mode': schedule.get_effective_playback_mode(),
                        'duration': next_content_item.get_effective_duration(),
                        'status': 'playing'
                    }, room=f'player_{player.id}')
            else:
                logger.error(f"Falha ao enviar conteúdo para {player.name}")
                print(f"[ERROR] Falha ao carregar mídia no Chromecast {player.name}")
                
        except Exception as e:
            logger.error(f"Erro ao executar agendamento Chromecast: {e}")
            print(f"[ERROR] Erro ao executar agendamento Chromecast: {e}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
    
    def _get_content_type_chromecast(self, content_type: str) -> str:
        """Converte tipo de conteúdo para formato Chromecast"""
        type_mapping = {
            'main': 'video/mp4',
            'overlay': 'image/jpeg'
        }
        return type_mapping.get(content_type, 'video/mp4')
    
    def _infer_mime_type_from_content(self, content) -> str:
        """Retorna um MIME type adequado para o Chromecast.
        Prioriza content.mime_type; se ausente, tenta inferir pela extensão; senão, usa mapeamento padrão.
        """
        try:
            # 1) Se o próprio conteúdo já tem mime_type, usar
            if getattr(content, 'mime_type', None):
                return content.mime_type

            # 2) Inferir pela extensão do arquivo
            filename = None
            if getattr(content, 'file_path', None):
                # file_path pode ser 'uploads/xyz.ext' — usar apenas o nome
                filename = content.file_path.split('/')[-1]
            elif getattr(content, 'title', None):
                filename = content.title

            if filename and '.' in filename:
                ext = filename.lower().rsplit('.', 1)[-1]
                if ext in ['jpg', 'jpeg']:
                    return 'image/jpeg'
                if ext in ['png']:
                    return 'image/png'
                if ext in ['gif']:
                    return 'image/gif'
                if ext in ['webp']:
                    return 'image/webp'
                if ext in ['mp4']:
                    return 'video/mp4'
                if ext in ['mov']:
                    return 'video/quicktime'
                if ext in ['avi']:
                    return 'video/x-msvideo'
                if ext in ['wmv']:
                    return 'video/x-ms-wmv'
                if ext in ['mkv']:
                    return 'video/x-matroska'

            # 3) Fallback a partir do content_type lógico
            return self._get_content_type_chromecast(getattr(content, 'content_type', 'main'))
        except Exception:
            # Fallback seguro
            return 'video/mp4'
    
    def _execute_web_schedule(self, schedule: Schedule, player: Player, campaign: Campaign):
        """Executa agendamento em um player web"""
        try:
            if not self.socketio:
                logger.warning("WebSocket não disponível para player web")
                return
            
            # Buscar conteúdo da campanha através do relacionamento CampaignContent
            campaign_contents = CampaignContent.query.filter_by(campaign_id=campaign.id).all()
            if not campaign_contents:
                logger.warning(f"Nenhum conteúdo encontrado na campanha {campaign.name}")
                return
            
            # Pegar o primeiro conteúdo ativo
            content = None
            for cc in campaign_contents:
                if cc.content and cc.content.is_active:
                    content = cc.content
                    break
            
            if not content:
                logger.warning(f"Nenhum conteúdo ativo encontrado na campanha {campaign.name}")
                return
            
            # Enviar comando via WebSocket
            self.socketio.emit('play_schedule', {
                'schedule_id': schedule.id,
                'campaign_id': campaign.id,
                'contents': [content.to_dict()]
            }, room=f'player_{player.id}')
            
            logger.info(f"Comando de reprodução enviado para player web {player.name}")
            
        except Exception as e:
            logger.error(f"Erro ao executar agendamento web: {e}")
    
    def _execute_schedule(self, schedule: Schedule, content_type: str = 'main'):
        """Executa um agendamento específico"""
        try:
            player = Player.query.get(schedule.player_id)
            if not player:
                logger.error(f"Player {schedule.player_id} não encontrado")
                return
            
            campaign = Campaign.query.get(schedule.campaign_id)
            if not campaign:
                logger.error(f"Campanha {schedule.campaign_id} não encontrada")
                return
            
            logger.info(f"Executando agendamento '{schedule.name}' no player '{player.name}'")
            
            # Verificar se é um Chromecast - SEMPRE tentar se tem chromecast_id
            if player.chromecast_id:
                print(f"[DEBUG] Player {player.name} tem chromecast_id: {player.chromecast_id}")
                print(f"[DEBUG] Status atual: {player.status}")
                print(f"[DEBUG] Tentando execução Chromecast...")
                self._execute_chromecast_schedule(schedule, player, campaign, content_type)
            else:
                print(f"[DEBUG] Player {player.name} não tem chromecast_id, usando web player")
                self._execute_web_schedule(schedule, player, campaign)
            
        except Exception as e:
            logger.error(f"Erro ao executar agendamento {schedule.id}: {e}")
            print(f"[ERROR] Erro ao executar agendamento {schedule.id}: {e}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
    
    def _update_current_content_for_player(self, player_id: str, schedule_id: str, content_id: str):
        """Atualiza o conteúdo atual sendo reproduzido pelo player para um agendamento"""
        key = f"{player_id}_{schedule_id}"
        self.current_content_tracking[key] = content_id

    # ======= NOVAS FUNÇÕES PARA ROTAÇÃO =======
    def _get_key(self, player_id: str, schedule_id: str) -> str:
        return f"{player_id}_{schedule_id}"

    def _get_content_started_at(self, player_id: str, schedule_id: str):
        return self.current_content_started_at.get(self._get_key(player_id, schedule_id))

    def _set_content_started_at(self, player_id: str, schedule_id: str, started_at: datetime):
        self.current_content_started_at[self._get_key(player_id, schedule_id)] = started_at

    def _clear_content_started_at(self, player_id: str, schedule_id: str):
        key = self._get_key(player_id, schedule_id)
        if key in self.current_content_started_at:
            del self.current_content_started_at[key]

    def _rotate_if_needed(self, schedule: Schedule, content_type: str):
        """Verifica se o conteúdo atual já cumpriu a duração e avança para o próximo."""
        try:
            player_id = schedule.player_id
            started_at = self._get_content_started_at(player_id, schedule.id)
            if not started_at:
                return  # ainda não foi marcado início

            # Obter conteúdo atual
            current_content_id = self._get_current_content_for_player(player_id, schedule.id)
            if not current_content_id:
                return

            # Encontrar CampaignContent correspondente para obter duração efetiva
            contents = schedule.get_filtered_contents()
            current_cc = None
            for cc in contents:
                if cc.content_id == current_content_id:
                    current_cc = cc
                    break
            duration = None
            if current_cc:
                duration = current_cc.get_effective_duration()
            if not duration:
                duration = schedule.campaign.content_duration if schedule.campaign else 10

            elapsed = (datetime.now() - started_at).total_seconds()
            if elapsed >= duration:
                print(f"[DEBUG] Rotacionando conteúdo (elapsed={elapsed}s >= {duration}s) para schedule {schedule.name}")
                # Executar novamente para carregar o próximo
                self._execute_schedule(schedule, content_type=content_type)
        except Exception as e:
            logger.error(f"Erro ao rotacionar conteúdo: {e}")
            print(f"[ERROR] Erro ao rotacionar conteúdo: {e}")
    
    def _should_execute_now(self, schedule, current_time, current_weekday):
        """Verifica se um agendamento deve ser executado agora"""
        try:
            print(f"[DEBUG] Verificando agendamento: {schedule.name}")
            print(f"[DEBUG] - Player ID: {schedule.player_id}")
            print(f"[DEBUG] - Horário: {schedule.start_time}")
            print(f"[DEBUG] - End time: {schedule.end_time}")
            print(f"[DEBUG] - Is persistent: {schedule.is_persistent}")
            print(f"[DEBUG] - Content type: {schedule.content_type}")
            print(f"[DEBUG] - Dias da semana: {schedule.days_of_week}")
            print(f"[DEBUG] - Tipo de repetição: {schedule.repeat_type}")
            
            # Verificar dia da semana
            days_of_week = [int(d) for d in schedule.days_of_week.split(',') if d.strip()]
            if current_weekday not in days_of_week:
                print(f"[DEBUG] Dia da semana {current_weekday} não está nos dias configurados {days_of_week}")
                return False
            
            # Verificar horário de início
            if schedule.start_time > current_time:
                print(f"[DEBUG] Ainda não chegou o horário: {schedule.start_time} > {current_time}")
                return False
            
            # Verificar horário de fim - com suporte a overnight schedules
            if schedule.end_time:
                from datetime import time as time_obj
                midnight = time_obj(0, 0, 0)
                
                # Caso especial: agendamento persistente até meia-noite
                if schedule.is_persistent and schedule.end_time == midnight:
                    print(f"[DEBUG] Agendamento persistente até meia-noite - sempre ativo após start_time")
                    return True
                
                # Detectar se é um agendamento overnight (end_time < start_time)
                if schedule.end_time < schedule.start_time:
                    print(f"[DEBUG] Agendamento overnight detectado: {schedule.start_time} até {schedule.end_time} (próximo dia)")
                    # Para overnight: deve estar APÓS start_time OU ANTES end_time
                    if current_time >= schedule.start_time or current_time <= schedule.end_time:
                        print(f"[DEBUG] Agendamento overnight ativo: {current_time} está no período válido")
                        return True
                    else:
                        print(f"[DEBUG] Agendamento overnight inativo: {current_time} não está no período válido")
                        return False
                else:
                    # Agendamento normal (mesmo dia): deve estar ENTRE start_time e end_time
                    # Adicionar pequena tolerância para o fim da janela
                    GRACE_SECONDS = 30
                    def _time_to_seconds(t):
                        return t.hour * 3600 + t.minute * 60 + t.second
                    now_s = _time_to_seconds(current_time)
                    end_s = _time_to_seconds(schedule.end_time) + GRACE_SECONDS
                    if now_s <= end_s:
                        print(f"[DEBUG] Agendamento normal ativo com tolerância: {current_time} <= {schedule.end_time} (+{GRACE_SECONDS}s)")
                        return True
                    else:
                        print(f"[DEBUG] Agendamento normal já passou: {schedule.end_time} < {current_time}")
                        return False
            
            print(f"[DEBUG] Agendamento {schedule.name} deve ser executado agora!")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao verificar se deve executar agendamento: {e}")
            return False
    
    def _cleanup_inactive_executions(self):
        """Para execuções que não devem mais estar ativas"""
        for player_id, executions in list(self.active_executions.items()):
            for content_type, schedule_id in executions.items():
                schedule = Schedule.query.get(schedule_id)
                if not schedule or schedule.is_active != True:
                    logger.info(f"Parando execução inativa: player {player_id}, schedule {schedule_id}")
                    
                    player = Player.query.get(player_id)
                    if player and player.chromecast_id:
                        # Parar reprodução no Chromecast
                        chromecast_service.send_command(player.chromecast_id, 'stop')
                    
                    # Remover da lista de execuções ativas
                    del self.active_executions[player_id][content_type]
                    
                    if not self.active_executions[player_id]:
                        del self.active_executions[player_id]
    
    def force_execute_schedule(self, schedule_id: str) -> bool:
        """Força execução de um agendamento específico"""
        try:
            schedule = Schedule.query.get(schedule_id)
            if not schedule:
                return False
            
            self._execute_schedule(schedule)
            return True
            
        except Exception as e:
            logger.error(f"Erro ao forçar execução do agendamento {schedule_id}: {e}")
            return False
    
    def _get_current_content_for_player(self, player_id: str, schedule_id: str) -> str:
        """Obtém o conteúdo atual sendo reproduzido pelo player para um agendamento"""
        key = f"{player_id}_{schedule_id}"
        return self.current_content_tracking.get(key)
    
    def _update_current_content_for_player(self, player_id: str, schedule_id: str, content_id: str):
        """Atualiza o conteúdo atual sendo reproduzido pelo player para um agendamento"""
        key = f"{player_id}_{schedule_id}"
        self.current_content_tracking[key] = content_id

# Instância global do executor
schedule_executor = ScheduleExecutor()
