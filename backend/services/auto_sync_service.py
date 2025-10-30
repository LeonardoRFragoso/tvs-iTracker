from datetime import datetime
import threading
import time
from models.player import Player, db
from services.chromecast_service import chromecast_service
import unicodedata

class AutoSyncService:
    def __init__(self):
        self.is_running = False
        self.sync_thread = None
    
    def sync_all_players(self):
        """Sincroniza todos os players e atualiza seus status"""
        try:
            print("[AUTO_SYNC] Iniciando sincronização automática de todos os players...")
            
            # Buscar todos os players ativos
            players = Player.query.filter(Player.is_active == True).all()
            print(f"[AUTO_SYNC] Encontrados {len(players)} players ativos")
            
            # Descobrir dispositivos Chromecast na rede
            discovered_devices = chromecast_service.discover_devices(timeout=8)
            print(f"[AUTO_SYNC] Dispositivos Chromecast descobertos: {len(discovered_devices)}")
            
            synced_count = 0
            online_count = 0
            
            def _norm(s: str) -> str:
                if not s:
                    return ''
                s = unicodedata.normalize('NFKD', s)
                s = ''.join(c for c in s if not unicodedata.combining(c))
                return s.strip().lower()
            
            for player in players:
                try:
                    if player.chromecast_id:
                        # Player com Chromecast - verificar se está disponível
                        chromecast_found = False
                        
                        for device in discovered_devices:
                            # Estratégia de identificação flexível
                            device_name = device.get('name', '')
                            player_target_name = player.chromecast_name or player.name or ''
                            device_name_norm = _norm(device_name)
                            player_name_norm = _norm(player_target_name)
                            
                            uuid_match = str(device['id']) == str(player.chromecast_id)
                            name_match = device_name_norm == player_name_norm
                            name_contains = (player_name_norm in device_name_norm) or (device_name_norm in player_name_norm)
                            
                            if uuid_match or name_match or name_contains:
                                print(f"[AUTO_SYNC] Chromecast encontrado para {player.name}: {device.get('name')}")
                                chromecast_found = True
                                
                                # Atualizar UUID se necessário
                                if str(device['id']) != str(player.chromecast_id):
                                    player.chromecast_id = str(device['id'])
                                
                                # Tentar conectar
                                success, actual_uuid = chromecast_service.connect_to_device(
                                    device_id=str(device['id']),
                                    device_name=player_target_name
                                )
                                if success:
                                    # Garantir que UUID no banco está correto
                                    if actual_uuid and str(actual_uuid) != str(player.chromecast_id):
                                        player.chromecast_id = str(actual_uuid)
                                    player.status = 'online'
                                    player.last_ping = datetime.utcnow()
                                    player.ip_address = device.get('ip', player.ip_address)
                                    online_count += 1
                                    print(f"[AUTO_SYNC] {player.name} -> ONLINE")
                                else:
                                    player.status = 'offline'
                                    print(f"[AUTO_SYNC] {player.name} -> OFFLINE (conexão falhou)")
                                break
                        
                        if not chromecast_found:
                            player.status = 'offline'
                            print(f"[AUTO_SYNC] {player.name} -> OFFLINE (não encontrado)")
                    else:
                        # Player sem chromecast_id
                        if (player.platform or '').lower() == 'chromecast':
                            # Tentar autoassociar por nome
                            player_target_name = player.chromecast_name or player.name or ''
                            player_name_norm = _norm(player_target_name)
                            matched = None
                            for device in discovered_devices:
                                device_name = device.get('name', '')
                                device_name_norm = _norm(device_name)
                                if device_name_norm == player_name_norm or player_name_norm in device_name_norm or device_name_norm in player_name_norm:
                                    matched = device
                                    break
                            if matched:
                                print(f"[AUTO_SYNC] Autoassociação por nome: {player.name} -> {matched.get('name')} ({matched.get('id')})")
                                player.chromecast_id = str(matched.get('id'))
                                player.chromecast_name = matched.get('name') or player.chromecast_name
                                # Validar conexão
                                success, actual_uuid = chromecast_service.connect_to_device(
                                    device_id=str(matched.get('id')),
                                    device_name=player_target_name
                                )
                                if success:
                                    if actual_uuid and str(actual_uuid) != str(player.chromecast_id):
                                        player.chromecast_id = str(actual_uuid)
                                    player.status = 'online'
                                    player.last_ping = datetime.utcnow()
                                    player.ip_address = matched.get('ip', player.ip_address)
                                    online_count += 1
                                    print(f"[AUTO_SYNC] {player.name} -> ONLINE (autoassociado)")
                                else:
                                    player.status = 'offline'
                                    print(f"[AUTO_SYNC] {player.name} -> OFFLINE (falha conexão após autoassociação)")
                            else:
                                player.status = 'offline'
                                print(f"[AUTO_SYNC] {player.name} (Chromecast sem ID) -> OFFLINE (nenhum correspondente)")
                        else:
                            # Player não-Chromecast: considerar atividade recente
                            if player.last_ping and (datetime.utcnow() - player.last_ping).total_seconds() < 300:
                                player.status = 'online'
                                online_count += 1
                            else:
                                player.status = 'offline'
                    
                    synced_count += 1
                    
                except Exception as e:
                    print(f"[AUTO_SYNC] Erro ao sincronizar {player.name}: {e}")
                    player.status = 'offline'
            
            # Salvar todas as alterações
            db.session.commit()
            
            print(f"[AUTO_SYNC] Sincronização concluída: {synced_count} players sincronizados, {online_count} online")
            
            return {
                'synced_players': synced_count,
                'online_players': online_count,
                'total_players': len(players),
                'discovered_devices': len(discovered_devices)
            }
            
        except Exception as e:
            print(f"[AUTO_SYNC] Erro durante sincronização automática: {e}")
            db.session.rollback()
            return None
    
    def sync_single_player(self, player_id):
        """Sincroniza um player específico"""
        try:
            player = Player.query.get(player_id)
            if not player:
                return None
        
            if player.chromecast_id:
                # Descobrir dispositivos para este player específico
                discovered_devices = chromecast_service.discover_devices(timeout=5)
                
                for device in discovered_devices:
                    device_name = device.get('name', '')
                    player_target_name = player.chromecast_name or player.name or ''
                    # Comparação simples (já funciona na maioria dos casos)
                    device_name_l = device_name.strip().lower()
                    player_name_l = player_target_name.strip().lower()
                    
                    uuid_match = str(device['id']) == str(player.chromecast_id)
                    name_match = device_name_l == player_name_l
                    name_contains = (player_name_l in device_name_l) or (device_name_l in player_name_l)
                    
                    if uuid_match or name_match or name_contains:
                        if str(device['id']) != str(player.chromecast_id):
                            player.chromecast_id = str(device['id'])
                        success, actual_uuid = chromecast_service.connect_to_device(
                            device_id=str(device['id']),
                            device_name=player_target_name
                        )
                        if success:
                            if actual_uuid and str(actual_uuid) != str(player.chromecast_id):
                                player.chromecast_id = str(actual_uuid)
                            player.status = 'online'
                            player.last_ping = datetime.utcnow()
                            player.ip_address = device.get('ip', player.ip_address)
                        else:
                            player.status = 'offline'
                        break
                else:
                    player.status = 'offline'
            else:
                # Player sem Chromecast
                if (player.platform or '').lower() == 'chromecast':
                    # Descobrir e tentar autoassociar por nome
                    discovered_devices = chromecast_service.discover_devices(timeout=5)
                    player_target_name = player.chromecast_name or player.name or ''
                    device = None
                    # Normalização simples
                    def _norm(s: str) -> str:
                        try:
                            import unicodedata
                            s = unicodedata.normalize('NFKD', s or '')
                            s = ''.join(c for c in s if not unicodedata.combining(c))
                            return s.strip().lower()
                        except Exception:
                            return (s or '').strip().lower()
                    tnorm = _norm(player_target_name)
                    for d in discovered_devices:
                        if _norm(d.get('name', '')) == tnorm or tnorm in _norm(d.get('name', '')) or _norm(d.get('name', '')) in tnorm:
                            device = d
                            break
                    if device:
                        print(f"[AUTO_SYNC] (single) Autoassociação: {player.name} -> {device.get('name')} ({device.get('id')})")
                        player.chromecast_id = str(device.get('id'))
                        player.chromecast_name = device.get('name') or player.chromecast_name
                        success, actual_uuid = chromecast_service.connect_to_device(
                            device_id=str(device.get('id')),
                            device_name=player_target_name
                        )
                        if success:
                            if actual_uuid and str(actual_uuid) != str(player.chromecast_id):
                                player.chromecast_id = str(actual_uuid)
                            player.status = 'online'
                            player.last_ping = datetime.utcnow()
                            player.ip_address = device.get('ip', player.ip_address)
                        else:
                            player.status = 'offline'
                    else:
                        player.status = 'offline'
                else:
                    player.last_ping = datetime.utcnow()
                    player.status = 'online'
            
            db.session.commit()
            return player.status
            
        except Exception as e:
            print(f"[AUTO_SYNC] Erro ao sincronizar player {player_id}: {e}")
            db.session.rollback()
            return None
    
    def start_background_sync(self, interval_minutes=10):
        """Inicia sincronização automática em background"""
        if self.is_running:
            return
        
        self.is_running = True
        
        def background_worker():
            while self.is_running:
                try:
                    self.sync_all_players()
                    time.sleep(interval_minutes * 60)  # Converter para segundos
                except Exception as e:
                    print(f"[AUTO_SYNC] Erro no worker background: {e}")
                    time.sleep(60)  # Aguardar 1 minuto antes de tentar novamente
        
        self.sync_thread = threading.Thread(target=background_worker, daemon=True)
        self.sync_thread.start()
        print(f"[AUTO_SYNC] Sincronização automática iniciada (intervalo: {interval_minutes} minutos)")
    
    def stop_background_sync(self):
        """Para a sincronização automática em background"""
        self.is_running = False
        if self.sync_thread:
            self.sync_thread.join(timeout=5)
        print("[AUTO_SYNC] Sincronização automática parada")

# Instância global do serviço
auto_sync_service = AutoSyncService()
