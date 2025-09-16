#!/usr/bin/env python3
"""
Script para debugar conexão e status do Chromecast
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from database import db
from models.player import Player
from services.chromecast_service import chromecast_service
import time

def debug_chromecast():
    with app.app_context():
        try:
            # Buscar player Chromecast configurado
            chromecast_player = Player.query.filter(
                Player.chromecast_id.isnot(None)
            ).first()
            
            if not chromecast_player:
                print("❌ Nenhum player Chromecast encontrado no banco de dados!")
                return False
            
            print(f"🔍 Player Chromecast encontrado:")
            print(f"   - Nome: {chromecast_player.name}")
            print(f"   - ID: {chromecast_player.id}")
            print(f"   - Chromecast ID: {chromecast_player.chromecast_id}")
            print(f"   - Status: {chromecast_player.status}")
            print(f"   - Location ID: {chromecast_player.location_id}")
            
            # Descobrir dispositivos na rede
            print("\n🔍 Descobrindo dispositivos Chromecast na rede...")
            devices = chromecast_service.discover_devices(timeout=10)
            
            if not devices:
                print("❌ Nenhum dispositivo Chromecast encontrado na rede!")
                print("   Verifique se:")
                print("   - O Chromecast está ligado")
                print("   - Está na mesma rede Wi-Fi")
                print("   - Não há firewall bloqueando")
                return False
            
            print(f"✅ Encontrados {len(devices)} dispositivos:")
            for device in devices:
                print(f"   - {device['name']} (ID: {device['id']})")
                print(f"     IP: {device['ip']}, Modelo: {device['model']}")
            
            # Verificar se o Chromecast configurado está disponível
            target_device = None
            for device in devices:
                if (device['id'] == chromecast_player.chromecast_id or 
                    device['name'] == chromecast_player.name):
                    target_device = device
                    break
            
            if not target_device:
                print(f"❌ Chromecast configurado '{chromecast_player.name}' não encontrado na rede!")
                print("   Dispositivos disponíveis:")
                for device in devices:
                    print(f"   - {device['name']} (ID: {device['id']})")
                return False
            
            print(f"\n✅ Chromecast alvo encontrado: {target_device['name']}")
            
            # Tentar conectar
            print(f"🔗 Tentando conectar ao Chromecast...")
            success = chromecast_service.connect_to_device(target_device['id'])
            
            if not success:
                print("❌ Falha ao conectar ao Chromecast!")
                return False
            
            print("✅ Conectado com sucesso!")
            
            # Obter status
            print("\n📊 Status do dispositivo:")
            status = chromecast_service.get_device_status(target_device['id'])
            if status:
                print(f"   - Conectado: {status['is_connected']}")
                print(f"   - Volume: {status['volume_level']}")
                print(f"   - Mutado: {status['is_muted']}")
                print(f"   - App atual: {status['current_app']}")
                if status['media_status']:
                    print(f"   - Estado do player: {status['media_status']['player_state']}")
                    print(f"   - Conteúdo: {status['media_status']['title']}")
            
            # Testar carregamento de mídia
            print("\n🎬 Testando carregamento de mídia...")
            test_url = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            
            media_success = chromecast_service.load_media(
                device_id=target_device['id'],
                media_url=test_url,
                content_type='video/mp4',
                title='Teste de Vídeo',
                subtitles='Teste do sistema TVs Tracker'
            )
            
            if media_success:
                print("✅ Mídia de teste carregada com sucesso!")
                print("   O vídeo deve estar reproduzindo no Chromecast agora.")
                
                # Aguardar um pouco e verificar status
                time.sleep(3)
                status = chromecast_service.get_device_status(target_device['id'])
                if status and status['media_status']:
                    print(f"   Estado atual: {status['media_status']['player_state']}")
            else:
                print("❌ Falha ao carregar mídia de teste!")
            
            return True
            
        except Exception as e:
            print(f"❌ Erro durante debug: {e}")
            import traceback
            traceback.print_exc()
            return False

def test_schedule_execution():
    """Testa execução manual de agendamento"""
    with app.app_context():
        try:
            from models.schedule import Schedule
            from services.schedule_executor import schedule_executor
            
            # Buscar agendamento "teste"
            schedule = Schedule.query.filter_by(name='teste').first()
            if not schedule:
                print("❌ Agendamento 'teste' não encontrado!")
                return False
            
            print(f"🎯 Forçando execução do agendamento: {schedule.name}")
            success = schedule_executor.force_execute_schedule(schedule.id)
            
            if success:
                print("✅ Agendamento executado com sucesso!")
            else:
                print("❌ Falha na execução do agendamento!")
            
            return success
            
        except Exception as e:
            print(f"❌ Erro ao testar agendamento: {e}")
            return False

if __name__ == "__main__":
    print("=== DEBUG DO CHROMECAST ===\n")
    
    # Debug da conexão Chromecast
    chromecast_ok = debug_chromecast()
    
    if chromecast_ok:
        print("\n=== TESTE DE AGENDAMENTO ===")
        test_schedule_execution()
    
    print("\n=== FIM DO DEBUG ===")
