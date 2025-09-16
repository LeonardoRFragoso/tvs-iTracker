#!/usr/bin/env python3
"""
Script para interromper vídeo em reprodução no Chromecast
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from database import db
from services.chromecast_service import ChromecastService
from models.player import Player
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def stop_chromecast_video():
    """Interrompe o vídeo em reprodução no Chromecast"""
    
    print("=== INTERROMPENDO VÍDEO NO CHROMECAST ===\n")
    
    # Inicializar serviço do Chromecast
    chromecast_service = ChromecastService()
    
    # Usar contexto da aplicação Flask
    with app.app_context():
        try:
            player = Player.query.filter(
                Player.chromecast_id.isnot(None),
                Player.is_active == True
            ).first()
            
            if not player:
                print("❌ Nenhum player Chromecast ativo encontrado no banco de dados")
                return False
                
            print(f"🔍 Player Chromecast encontrado:")
            print(f"   - Nome: {player.name}")
            print(f"   - ID: {player.id}")
            print(f"   - Chromecast ID: {player.chromecast_id}")
            print(f"   - Status: {player.status}")
            print()
            
            # Descobrir dispositivos na rede
            print("🔍 Descobrindo dispositivos Chromecast na rede...")
            devices = chromecast_service.discover_devices()
            
            if not devices:
                print("❌ Nenhum dispositivo Chromecast encontrado na rede")
                return False
                
            print(f"✅ Encontrados {len(devices)} dispositivos:")
            for device in devices:
                print(f"   - {device['name']} (ID: {device['id']})")
                print(f"     IP: {device['ip']}, Modelo: {device['model']}")
            print()
            
            # Verificar se o Chromecast alvo foi encontrado
            target_device = None
            print(f"🔍 Procurando por Chromecast ID: '{player.chromecast_id}'")
            for device in devices:
                print(f"   Comparando com: '{device['id']}'")
                if device['id'] == player.chromecast_id:
                    target_device = device
                    break
                    
            if not target_device:
                print(f"❌ Chromecast alvo não encontrado: {player.chromecast_id}")
                return False
                
            print(f"✅ Chromecast alvo encontrado: {target_device['name']}")
            
            # Conectar ao Chromecast
            print("🔗 Tentando conectar ao Chromecast...")
            if not chromecast_service.connect_to_device(player.chromecast_id):
                print("❌ Falha ao conectar ao Chromecast")
                return False
                
            print("✅ Conectado com sucesso!")
            
            # Verificar status atual
            cast = chromecast_service.active_connections[player.chromecast_id]
            mc = cast.media_controller
            
            print("\n📊 Status atual do dispositivo:")
            print(f"   - Conectado: {cast.status is not None}")
            print(f"   - Volume: {cast.status.volume_level}")
            print(f"   - Mutado: {cast.status.volume_muted}")
            print(f"   - App atual: {cast.status.display_name}")
            
            if mc.status.player_state:
                print(f"   - Estado do player: {mc.status.player_state}")
                if mc.status.content_id:
                    print(f"   - Conteúdo: {mc.status.content_id}")
            else:
                print("   - Nenhum conteúdo em reprodução")
            
            # Interromper reprodução
            print("\n🛑 Interrompendo reprodução...")
            
            # Tentar parar o conteúdo atual
            if chromecast_service.send_command(player.chromecast_id, 'stop'):
                print("✅ Reprodução interrompida com sucesso!")
            else:
                print("⚠️ Falha ao enviar comando de parada")
                
            # Como alternativa, tentar sair do app atual
            print("🚪 Saindo do app atual...")
            cast.quit_app()
            print("✅ App encerrado!")
            
            # Desconectar
            chromecast_service.disconnect_device(player.chromecast_id)
            print("✅ Desconectado do Chromecast")
            
            return True
            
        except Exception as e:
            logger.error(f"Erro ao interromper vídeo: {e}")
            print(f"❌ Erro: {e}")
            return False
            
    db.session.close()

if __name__ == "__main__":
    print("Script para interromper vídeo no Chromecast\n")
    
    success = stop_chromecast_video()
    
    if success:
        print("\n=== VÍDEO INTERROMPIDO COM SUCESSO ===")
    else:
        print("\n=== FALHA AO INTERROMPER VÍDEO ===")
        sys.exit(1)
