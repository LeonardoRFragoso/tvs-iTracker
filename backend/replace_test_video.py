#!/usr/bin/env python3
"""
Script para substituir o placeholder test_video.mp4 por um vídeo real
"""

import shutil
import os

def replace_test_video():
    # Vídeo real existente
    source_video = "uploads/1b9d27db-4184-4f57-a9e3-f00763220de8_Ben_LOncle_Soul_-_Addicted_Acoustic_Live_Session.mp4"
    target_video = "uploads/test_video.mp4"
    
    print("🔄 Substituindo placeholder por vídeo real...")
    print(f"   Origem: {source_video}")
    print(f"   Destino: {target_video}")
    
    try:
        if os.path.exists(source_video):
            # Fazer backup do placeholder
            if os.path.exists(target_video):
                os.rename(target_video, target_video + ".backup")
                print("   📦 Backup do placeholder criado")
            
            # Copiar vídeo real
            shutil.copy2(source_video, target_video)
            
            # Verificar tamanho
            size = os.path.getsize(target_video)
            print(f"   ✅ Vídeo substituído com sucesso!")
            print(f"   📊 Novo tamanho: {size:,} bytes")
            
            return True
        else:
            print(f"   ❌ Arquivo origem não encontrado: {source_video}")
            return False
            
    except Exception as e:
        print(f"   ❌ Erro ao substituir vídeo: {e}")
        return False

if __name__ == "__main__":
    print("=== SUBSTITUINDO VÍDEO DE TESTE ===\n")
    
    success = replace_test_video()
    
    if success:
        print("\n✅ Agora execute: python test_local_video.py")
        print("✅ E depois: python debug_chromecast.py")
        print("✅ O agendamento deve funcionar automaticamente!")
    else:
        print("\n❌ Falha ao substituir vídeo!")
