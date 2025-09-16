import pychromecast
from pychromecast.controllers.media import MediaController
import time
import threading
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class ChromecastService:
    def __init__(self):
        self.discovered_devices = {}
        self.active_connections = {}
        self._discovery_thread = None
        self._stop_discovery = False
    
    def discover_devices(self, timeout: int = 5) -> List[Dict]:
        """Descobre dispositivos Chromecast na rede local"""
        try:
            logger.info("Iniciando descoberta de dispositivos Chromecast...")
            
            # Descobrir Chromecasts na rede
            chromecasts, browser = pychromecast.get_chromecasts(timeout=timeout)
            
            devices = []
            for cast in chromecasts:
                # Aguardar a conexão para obter informações do dispositivo
                cast.wait()
                
                device_info = {
                    'id': cast.uuid,
                    'name': cast.name,
                    'model': cast.model_name,
                    'ip': cast.socket_client.host if cast.socket_client else 'unknown',
                    'port': cast.socket_client.port if cast.socket_client else 8009,
                    'status': 'available',
                    'cast_type': cast.cast_type,
                    'manufacturer': getattr(cast, 'manufacturer', 'Google')
                }
                devices.append(device_info)
                self.discovered_devices[cast.uuid] = cast
            
            # Parar o browser de descoberta
            pychromecast.discovery.stop_discovery(browser)
            
            logger.info(f"Descobertos {len(devices)} dispositivos Chromecast")
            return devices
            
        except Exception as e:
            logger.error(f"Erro na descoberta de dispositivos: {e}")
            return []
    
    def connect_to_device(self, device_id: str, device_name: str = None) -> tuple[bool, str]:
        """Conecta a um dispositivo Chromecast específico usando UUID ou nome"""
        try:
            logger.info(f"Tentando conectar ao dispositivo {device_id} (nome: {device_name})")
            
            # Estratégia 1: Tentar UUID exato primeiro
            if device_id in self.discovered_devices:
                cast = self.discovered_devices[device_id]
                if self._test_connection(cast, device_id):
                    return True, device_id
            
            # Estratégia 2: Redescobrir dispositivos com timeout maior
            logger.info(f"Dispositivo {device_id} não encontrado, redescobrir com timeout maior...")
            self.discover_devices(timeout=10)
            
            # Tentar UUID novamente após descoberta
            if device_id in self.discovered_devices:
                cast = self.discovered_devices[device_id]
                if self._test_connection(cast, device_id):
                    return True, device_id
            
            # Estratégia 3: Buscar por nome do dispositivo se fornecido
            if device_name:
                logger.info(f"Tentando encontrar dispositivo pelo nome: {device_name}")
                for uuid, cast in self.discovered_devices.items():
                    if cast.name and cast.name.lower() == device_name.lower():
                        logger.info(f"Dispositivo encontrado pelo nome! UUID: {uuid}")
                        if self._test_connection(cast, uuid):
                            # Também armazenar com o UUID original para compatibilidade
                            self.active_connections[device_id] = cast
                            logger.info(f"Dispositivo também armazenado com UUID original: {device_id}")
                            # Atualizar o UUID no banco se necessário
                            self._update_device_uuid(device_id, uuid)
                            return True, uuid
            
            # Estratégia 4: Descoberta forçada com múltiplas tentativas
            logger.info("Tentando descoberta forçada com múltiplas tentativas...")
            for attempt in range(3):
                logger.info(f"Tentativa {attempt + 1}/3 de descoberta...")
                devices = self.discover_devices(timeout=15)
                
                # Verificar se encontrou o dispositivo por UUID
                if device_id in self.discovered_devices:
                    cast = self.discovered_devices[device_id]
                    if self._test_connection(cast, device_id):
                        return True, device_id
                
                # Verificar se encontrou por nome
                if device_name:
                    for uuid, cast in self.discovered_devices.items():
                        if cast.name and cast.name.lower() == device_name.lower():
                            logger.info(f"Dispositivo encontrado pelo nome na tentativa {attempt + 1}! UUID: {uuid}")
                            if self._test_connection(cast, uuid):
                                # Também armazenar com o UUID original para compatibilidade
                                self.active_connections[device_id] = cast
                                logger.info(f"Dispositivo também armazenado com UUID original: {device_id}")
                                self._update_device_uuid(device_id, uuid)
                                return True, uuid
                
                if attempt < 2:  # Não esperar na última tentativa
                    import time
                    time.sleep(2)
            
            logger.error(f"Dispositivo {device_id} não encontrado após todas as tentativas")
            return False, ""
            
        except Exception as e:
            logger.error(f"Erro ao conectar ao dispositivo {device_id}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False, ""
    
    def _test_connection(self, cast, device_id: str) -> bool:
        """Testa se a conexão com o dispositivo está funcionando"""
        try:
            cast.wait(timeout=5)
            
            if cast.status is not None:
                self.active_connections[device_id] = cast
                logger.info(f"Conectado ao Chromecast: {cast.name} ({device_id})")
                return True
            else:
                logger.warning(f"Status do dispositivo {device_id} é None")
                return False
                
        except Exception as e:
            logger.error(f"Erro ao testar conexão com {device_id}: {e}")
            return False
    
    def _update_device_uuid(self, old_uuid: str, new_uuid: str):
        """Atualiza UUID do dispositivo no banco de dados se necessário"""
        try:
            if old_uuid != new_uuid:
                logger.info(f"Atualizando UUID do dispositivo de {old_uuid} para {new_uuid}")
                # Importar aqui para evitar import circular
                from models.player import Player
                from database import db
                
                # Converter UUID para string se necessário
                new_uuid_str = str(new_uuid) if hasattr(new_uuid, 'hex') else new_uuid
                old_uuid_str = str(old_uuid) if hasattr(old_uuid, 'hex') else old_uuid
                
                player = Player.query.filter_by(chromecast_id=old_uuid_str).first()
                if player:
                    player.chromecast_id = new_uuid_str
                    db.session.commit()
                    logger.info(f"UUID do player {player.name} atualizado no banco")
        except Exception as e:
            logger.error(f"Erro ao atualizar UUID no banco: {e}")
            # Fazer rollback da sessão em caso de erro
            try:
                from database import db
                db.session.rollback()
                logger.info("Rollback da sessão realizado")
            except Exception as rollback_error:
                logger.error(f"Erro ao fazer rollback: {rollback_error}")
    
    def connect_to_device_by_name(self, device_name: str) -> tuple[bool, str]:
        """Conecta a um dispositivo pelo nome e retorna (sucesso, uuid)"""
        try:
            logger.info(f"Conectando ao dispositivo pelo nome: {device_name}")
            
            # Descobrir dispositivos
            self.discover_devices(timeout=10)
            
            # Buscar por nome
            for uuid, cast in self.discovered_devices.items():
                if cast.name and cast.name.lower() == device_name.lower():
                    if self._test_connection(cast, uuid):
                        return True, uuid
            
            logger.error(f"Dispositivo com nome '{device_name}' não encontrado")
            return False, ""
            
        except Exception as e:
            logger.error(f"Erro ao conectar pelo nome {device_name}: {e}")
            return False, ""
    
    def disconnect_device(self, device_id: str) -> bool:
        """Desconecta de um dispositivo Chromecast"""
        try:
            if device_id in self.active_connections:
                cast = self.active_connections[device_id]
                cast.quit_app()
                del self.active_connections[device_id]
                logger.info(f"Desconectado do Chromecast: {device_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Erro ao desconectar do dispositivo {device_id}: {e}")
            return False
    
    def send_command(self, device_id: str, command: str, params: Dict = None) -> bool:
        """Envia comando para um dispositivo Chromecast"""
        try:
            if device_id not in self.active_connections:
                return False
            
            cast = self.active_connections[device_id]
            mc = cast.media_controller
            
            if command == 'play':
                mc.play()
            elif command == 'pause':
                mc.pause()
            elif command == 'stop':
                mc.stop()
            elif command == 'set_volume':
                volume = params.get('volume', 0.5) if params else 0.5
                cast.set_volume(volume)
            elif command == 'seek':
                position = params.get('position', 0) if params else 0
                mc.seek(position)
            else:
                logger.warning(f"Comando não suportado: {command}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Erro ao enviar comando {command} para {device_id}: {e}")
            return False
    
    def load_media(self, device_id: str, media_url: str, content_type: str = 'video/mp4', 
                   title: str = '', subtitles: str = '') -> bool:
        """Carrega mídia em um dispositivo Chromecast"""
        try:
            logger.info(f"[CHROMECAST] Tentando carregar mídia:")
            logger.info(f"[CHROMECAST] - Device ID: {device_id}")
            logger.info(f"[CHROMECAST] - Media URL: {media_url}")
            logger.info(f"[CHROMECAST] - Content Type: {content_type}")
            logger.info(f"[CHROMECAST] - Title: {title}")
            logger.info(f"[CHROMECAST] - Subtitles: {subtitles}")
            
            if device_id not in self.active_connections:
                logger.error(f"[CHROMECAST] Device {device_id} não está nas conexões ativas")
                logger.info(f"[CHROMECAST] Conexões ativas: {list(self.active_connections.keys())}")
                return False
            
            cast = self.active_connections[device_id]
            logger.info(f"[CHROMECAST] Cast obtido: {cast.name}")
            
            mc = cast.media_controller
            logger.info(f"[CHROMECAST] Media controller: {mc}")
            
            # Criar MediaController se necessário
            if not hasattr(cast, 'media_controller') or cast.media_controller is None:
                logger.info(f"[CHROMECAST] Criando novo MediaController")
                mc = MediaController()
                cast.register_handler(mc)
            
            # Carregar mídia - corrigir parâmetro subtitle para subtitles
            logger.info(f"[CHROMECAST] Chamando play_media...")
            mc.play_media(media_url, content_type, title=title, subtitles=subtitles if subtitles else None)
            logger.info(f"[CHROMECAST] play_media chamado, aguardando ativação...")
            mc.block_until_active()
            logger.info(f"[CHROMECAST] Media controller ativo!")
            
            logger.info(f"Mídia carregada no Chromecast {device_id}: {title}")
            return True
            
        except Exception as e:
            logger.error(f"[CHROMECAST] Erro detalhado ao carregar mídia no dispositivo {device_id}: {e}")
            logger.error(f"[CHROMECAST] Tipo do erro: {type(e).__name__}")
            import traceback
            logger.error(f"[CHROMECAST] Traceback: {traceback.format_exc()}")
            return False
    
    def get_device_status(self, device_id: str) -> Optional[Dict]:
        """Obtém status atual de um dispositivo Chromecast"""
        try:
            if device_id not in self.active_connections:
                return None
            
            cast = self.active_connections[device_id]
            mc = cast.media_controller
            
            status = {
                'device_id': device_id,
                'device_name': cast.name,
                'is_connected': cast.status is not None,
                'volume_level': cast.status.volume_level if cast.status else 0,
                'is_muted': cast.status.volume_muted if cast.status else False,
                'current_app': cast.status.display_name if cast.status else None,
                'media_status': None
            }
            
            if mc.status.player_state is not None:
                status['media_status'] = {
                    'player_state': mc.status.player_state,
                    'current_time': mc.status.current_time,
                    'duration': mc.status.duration,
                    'content_id': mc.status.content_id,
                    'content_type': mc.status.content_type,
                    'title': mc.status.title
                }
            
            return status
            
        except Exception as e:
            logger.error(f"Erro ao obter status do dispositivo {device_id}: {e}")
            return None
    
    def start_continuous_discovery(self, interval: int = 30):
        """Inicia descoberta contínua de dispositivos"""
        def discovery_loop():
            while not self._stop_discovery:
                self.discover_devices()
                time.sleep(interval)
        
        if self._discovery_thread is None or not self._discovery_thread.is_alive():
            self._stop_discovery = False
            self._discovery_thread = threading.Thread(target=discovery_loop, daemon=True)
            self._discovery_thread.start()
            logger.info("Descoberta contínua de Chromecast iniciada")
    
    def stop_continuous_discovery(self):
        """Para a descoberta contínua de dispositivos"""
        self._stop_discovery = True
        if self._discovery_thread and self._discovery_thread.is_alive():
            self._discovery_thread.join(timeout=5)
        logger.info("Descoberta contínua de Chromecast parada")
    
    def cleanup(self):
        """Limpa conexões e para descoberta"""
        self.stop_continuous_discovery()
        
        # Desconectar todos os dispositivos
        for device_id in list(self.active_connections.keys()):
            self.disconnect_device(device_id)
        
        self.discovered_devices.clear()
        logger.info("ChromecastService limpo")

# Instância global do serviço
chromecast_service = ChromecastService()
