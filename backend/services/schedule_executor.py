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
            # Executar overlay se disponível
            if schedules['overlay']:
                overlay_schedule = schedules['overlay'][0]  # Usar primeiro overlay
                current_overlay = self.active_overlays.get(player_id)
                
                if current_overlay != overlay_schedule.id:
                    print(f"[DEBUG] Executando overlay para player {player_id}: {overlay_schedule.name}")
                    self._execute_schedule(overlay_schedule, content_type='overlay')
                    self.active_overlays[player_id] = overlay_schedule.id
            
            # Executar conteúdo principal se disponível
            if schedules['main']:
                main_schedule = schedules['main'][0]  # Usar primeiro agendamento principal
                
                if player_id not in self.active_executions:
                    self.active_executions[player_id] = {}
                
                current_main = self.active_executions[player_id].get('main')
                
                if current_main != main_schedule.id:
                    print(f"[DEBUG] Executando conteúdo principal para player {player_id}: {main_schedule.name}")
                    self._execute_schedule(main_schedule, content_type='main')
                    self.active_executions[player_id]['main'] = main_schedule.id
                    
        except Exception as e:
            logger.error(f"Erro ao executar agendamentos do player {player_id}: {e}")
            print(f"[ERROR] Erro ao executar agendamentos do player {player_id}: {e}")
    
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
            
            # Verificar se é um Chromecast
            if player.chromecast_id and player.status == 'online':
                self._execute_chromecast_schedule(schedule, player, campaign, content_type)
            else:
                self._execute_web_schedule(schedule, player, campaign)
            
        except Exception as e:
            logger.error(f"Erro ao executar agendamento {schedule.id}: {e}")
    
    def _execute_chromecast_schedule(self, schedule: Schedule, player: Player, campaign: Campaign, content_type: str):
        """Executa agendamento em um Chromecast"""
        try:
            # Buscar conteúdo da campanha através do relacionamento CampaignContent
            campaign_contents = CampaignContent.query.filter_by(campaign_id=campaign.id).all()
            print(f"[DEBUG] Campanha ID: {campaign.id}, Nome: {campaign.name}")
            print(f"[DEBUG] CampaignContent encontrados: {len(campaign_contents)}")
            
            for cc in campaign_contents:
                print(f"[DEBUG] CampaignContent: {cc.id}, content_id: {cc.content_id}")
                if cc.content:
                    print(f"[DEBUG] Content: {cc.content.title}, is_active: {cc.content.is_active}")
                else:
                    print(f"[DEBUG] Content é None para CampaignContent {cc.id}")
            
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
            
            # Construir URL do conteúdo
            media_url = f"http://192.168.0.4:5000/uploads/{content.file_path}"
            content_type_chromecast = self._get_content_type_chromecast(content_type)
            
            logger.info(f"Enviando conteúdo '{content.title}' para Chromecast {player.name}")
            print(f"[DEBUG] Enviando para Chromecast: {media_url}")
            
            # Obter IDs como strings para evitar problemas de UUID
            player_chromecast_id = str(player.chromecast_id) if player.chromecast_id else None
            if not player_chromecast_id:
                logger.error(f"Player {player.name} não tem chromecast_id configurado")
                return
            
            # Tentar conectar usando UUID e nome do dispositivo
            connection_success, actual_device_id = chromecast_service.connect_to_device(
                device_id=player_chromecast_id,
                device_name=player.name
            )
            
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
            
            print(f"[DEBUG] Conexão com Chromecast estabelecida com sucesso")
            print(f"[DEBUG] Device ID usado para conexão: {actual_device_id}")
            
            # Usar o device_id original para garantir compatibilidade
            device_id_for_media = player_chromecast_id
            
            # Enviar para o Chromecast
            success = chromecast_service.load_media(
                device_id=device_id_for_media,
                media_url=media_url,
                content_type=content_type_chromecast,
                title=content.title,
                subtitles=f"Campanha: {campaign.name}"
            )
            
            if success:
                logger.info(f"Conteúdo enviado com sucesso para {player.name}")
                print(f"[SUCCESS] Conteúdo '{content.title}' enviado para {player.name}")
                
                # Atualizar status do player para online e atualizar last_ping
                try:
                    player.status = 'online'
                    player.last_ping = datetime.now()  # Atualizar last_ping para dashboard
                    player.last_seen = datetime.now()
                    db.session.commit()
                    logger.info(f"Status do player {player.name} atualizado para online com last_ping")
                except Exception as e:
                    logger.error(f"Erro ao atualizar status do player: {e}")
                    db.session.rollback()
                
                # Notificar via WebSocket se disponível
                if self.socketio:
                    self.socketio.emit('schedule_executed', {
                        'schedule_id': str(schedule.id),
                        'player_id': str(player.id),
                        'content_id': str(content.id),
                        'status': 'playing'
                    }, room=f'player_{player.id}')
            else:
                logger.error(f"Falha ao enviar conteúdo para {player.name}")
                print(f"[ERROR] Falha ao carregar mídia no Chromecast {player.name}")
                
        except Exception as e:
            logger.error(f"Erro ao executar agendamento Chromecast: {e}")
            print(f"[ERROR] Erro ao executar agendamento Chromecast: {e}")
            # Fazer rollback em caso de erro
            try:
                db.session.rollback()
                logger.info("Rollback da sessão realizado após erro no Chromecast")
            except Exception as rollback_error:
                logger.error(f"Erro ao fazer rollback: {rollback_error}")
            import traceback
            traceback.print_exc()
    
    def _get_content_type_chromecast(self, content_type: str) -> str:
        """Converte tipo de conteúdo para formato Chromecast"""
        type_mapping = {
            'main': 'video/mp4',
            'overlay': 'image/jpeg'
        }
        return type_mapping.get(content_type, 'video/mp4')
    
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
    
    def _should_execute_now(self, schedule, current_time, current_weekday):
        """Verifica se um agendamento deve ser executado agora"""
        try:
            print(f"[DEBUG] Verificando agendamento: {schedule.name}")
            print(f"[DEBUG] - Player ID: {schedule.player_id}")
            print(f"[DEBUG] - Horário: {schedule.start_time}")
            print(f"[DEBUG] - Dias da semana: {schedule.days_of_week}")
            print(f"[DEBUG] - Tipo de repetição: {schedule.repeat_type}")
            
            # Verificar dia da semana
            days_of_week = [int(d) for d in schedule.days_of_week.split(',') if d.strip()]
            if current_weekday not in days_of_week:
                print(f"[DEBUG] Dia da semana {current_weekday} não está nos dias configurados {days_of_week}")
                return False
            
            # Verificar horário
            if schedule.start_time > current_time:
                print(f"[DEBUG] Ainda não chegou o horário: {schedule.start_time} > {current_time}")
                return False
            
            if schedule.end_time and schedule.end_time < current_time:
                print(f"[DEBUG] Horário já passou: {schedule.end_time} < {current_time}")
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

# Instância global do executor
schedule_executor = ScheduleExecutor()
