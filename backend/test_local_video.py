#!/usr/bin/env python3
"""
Script para testar se o arquivo local é acessível via HTTP
"""

import requests
import os

def test_local_video_access():
    # URL que o agendamento está tentando usar
    test_url = "http://192.168.0.4:5000/uploads/test_video.mp4"
    
    print(f"🔍 Testando acesso ao arquivo local:")
    print(f"   URL: {test_url}")
    
    try:
        response = requests.get(test_url, timeout=5)
        print(f"   Status Code: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"   Content-Length: {response.headers.get('Content-Length', 'N/A')} bytes")
        
        if response.status_code == 200:
            print("✅ Arquivo acessível via HTTP!")
            return True
        else:
            print("❌ Arquivo não acessível via HTTP!")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao acessar arquivo: {e}")
        return False

def check_file_exists():
    file_path = "uploads/test_video.mp4"
    
    print(f"\n🔍 Verificando arquivo local:")
    print(f"   Caminho: {file_path}")
    
    if os.path.exists(file_path):
        size = os.path.getsize(file_path)
        print(f"   Tamanho: {size} bytes")
        
        # Verificar se é um arquivo de vídeo real ou placeholder
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read(100)  # Ler primeiros 100 caracteres
            
        if content.startswith('# Placeholder'):
            print("❌ Arquivo é apenas um placeholder de texto!")
            return False
        else:
            print("✅ Arquivo existe e parece ser binário!")
            return True
    else:
        print("❌ Arquivo não existe!")
        return False

def suggest_solution():
    print(f"\n💡 Soluções possíveis:")
    print(f"   1. Substituir test_video.mp4 por um vídeo MP4 real")
    print(f"   2. Verificar se o servidor Flask está servindo arquivos estáticos")
    print(f"   3. Usar um vídeo de teste da internet temporariamente")

if __name__ == "__main__":
    print("=== TESTE DE ACESSO AO VÍDEO LOCAL ===\n")
    
    file_ok = check_file_exists()
    http_ok = test_local_video_access()
    
    if not file_ok or not http_ok:
        suggest_solution()
    else:
        print("\n✅ Arquivo local está funcionando corretamente!")
