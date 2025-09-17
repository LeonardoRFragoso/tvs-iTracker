#!/usr/bin/env python3
"""
Script para testar descoberta e conexão com Chromecast
"""

import time
from services.chromecast_service import chromecast_service

def test_chromecast_discovery():
    """Testa descoberta de dispositivos Chromecast"""
    print("🔍 Iniciando teste de descoberta de Chromecast...")
    print("=" * 60)
    
    try:
        # 1. Descobrir dispositivos
        print("📡 Descobrindo dispositivos Chromecast...")
        devices = chromecast_service.discover_devices(timeout=10)
        
        print(f"📊 Dispositivos encontrados: {len(devices)}")
        
        if not devices:
            print("❌ Nenhum dispositivo Chromecast encontrado!")
            print("\n🔧 Possíveis causas:")
            print("   - Chromecast desligado ou sem energia")
            print("   - Chromecast em rede diferente")
            print("   - Firewall bloqueando descoberta")
            print("   - Chromecast em modo sleep profundo")
            return
        
        # 2. Listar dispositivos encontrados
        for i, device in enumerate(devices, 1):
            print(f"\n📺 Dispositivo {i}:")
            print(f"   ID: {device.get('id', 'N/A')}")
            print(f"   Nome: {device.get('name', 'N/A')}")
            print(f"   IP: {device.get('ip', 'N/A')}")
            print(f"   Porta: {device.get('port', 'N/A')}")
            print(f"   Status: {device.get('status', 'N/A')}")
        
        # 3. Testar conexão com o primeiro dispositivo
        if devices:
            target_device = devices[0]
            device_id = target_device.get('id')
            device_name = target_device.get('name')
            
            print(f"\n🔗 Testando conexão com: {device_name} ({device_id})")
            
            # Tentar conectar
            success, actual_id = chromecast_service.connect_to_device(
                device_id=device_id,
                device_name=device_name
            )
            
            if success:
                print(f"✅ Conexão bem-sucedida!")
                print(f"   Device ID usado: {actual_id}")
                
                # Testar envio de mídia
                print(f"\n🎬 Testando envio de mídia...")
                test_url = "http://192.168.0.4:5000/uploads/af208f81-0928-4e9d-b656-8754a65254be_Ben_LOncle_Soul_-_Addicted_Acoustic_Live_Session.mp4"
                
                media_success = chromecast_service.load_media(
                    device_id=device_id,
                    media_url=test_url,
                    content_type="video/mp4",
                    title="Teste de Conexão",
                    subtitles="Teste do sistema TVs Tracker"
                )
                
                if media_success:
                    print("✅ Mídia enviada com sucesso!")
                    print("🎉 Chromecast deveria estar reproduzindo agora!")
                else:
                    print("❌ Falha ao enviar mídia")
                    
            else:
                print(f"❌ Falha na conexão com {device_name}")
        
    except Exception as e:
        print(f"❌ Erro durante teste: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("🏁 Teste concluído!")

def test_network_connectivity():
    """Testa conectividade de rede"""
    print("\n🌐 Testando conectividade de rede...")
    
    import socket
    import subprocess
    
    # Testar se porta 8009 está acessível (porta padrão do Chromecast)
    chromecast_ip = "192.168.0.10"  # IP conhecido do Chromecast
    port = 8009
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((chromecast_ip, port))
        sock.close()
        
        if result == 0:
            print(f"✅ Porta {port} acessível em {chromecast_ip}")
        else:
            print(f"❌ Porta {port} não acessível em {chromecast_ip}")
    except Exception as e:
        print(f"❌ Erro ao testar conectividade: {e}")
    
    # Testar ping
    try:
        result = subprocess.run(['ping', '-n', '1', chromecast_ip], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"✅ Ping para {chromecast_ip} bem-sucedido")
        else:
            print(f"❌ Ping para {chromecast_ip} falhou")
    except Exception as e:
        print(f"❌ Erro ao fazer ping: {e}")

if __name__ == "__main__":
    test_chromecast_discovery()
    test_network_connectivity()
