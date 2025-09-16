from datetime import datetime
import threading
import time
from models.player import Player, db
from services.chromecast_service import chromecast_service

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
            
            for player in players:
                try:
                    if player.chromecast_id:
                        # Player com Chromecast - verificar se está disponível
                        chromecast_found = False
                        
                        for device in discovered_devices:
                            # Estratégia de identificação flexível
                            device_name = device.get('name', '').lower()
                            player_name = player.name.lower()
                            
                            uuid_match = device['id'] == player.chromecast_id
                            name_match = device_name == player_name
                            name_contains = player_name in device_name or device_name in player_name
                            
                            if uuid_match or name_match or name_contains:
                                print(f"[AUTO_SYNC] Chromecast encontrado para {player.name}: {device.get('name')}")
                                chromecast_found = True
                                
                                # Atualizar UUID se necessário
                                if device['id'] != player.chromecast_id:
                                    player.chromecast_id = str(device['id'])
                                
                                # Tentar conectar
                                if chromecast_service.connect_to_device(device['id']):
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
                        # Player sem Chromecast - assumir online se foi visto recentemente
                        if player.last_ping and (datetime.utcnow() - player.last_ping).total_seconds() < 300:
                            player.status = 'online'
                            online_count += 1
                        else:
                            player.status = 'offline'
                        print(f"[AUTO_SYNC] {player.name} (sem Chromecast) -> {player.status.upper()}")
                    
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
                    device_name = device.get('name', '').lower()
                    player_name = player.name.lower()
                    
                    uuid_match = device['id'] == player.chromecast_id
                    name_match = device_name == player_name
                    name_contains = player_name in device_name or device_name in player_name
                    
                    if uuid_match or name_match or name_contains:
                        if device['id'] != player.chromecast_id:
                            player.chromecast_id = str(device['id'])
                        
                        if chromecast_service.connect_to_device(device['id']):
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
