#!/usr/bin/env python3
"""
Script para testar a rota de playlist e verificar se o áudio de fundo está sendo enviado
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models.player import Player
from models.schedule import Schedule
from models.campaign import Campaign

def test_playlist(player_id):
    with app.app_context():
        print("=" * 60)
        print(f"Testando playlist para player: {player_id}")
        print("=" * 60)
        
        # Verificar player
        player = Player.query.get(player_id)
        if not player:
            print(f"❌ Player {player_id} não encontrado")
            return
        
        print(f"✓ Player encontrado: {player.name}")
        print()
        
        # Verificar schedules ativos
        from datetime import datetime
        now = datetime.now()
        schedules = Schedule.query.filter(
            Schedule.player_id == player_id,
            Schedule.is_active == True,
            Schedule.start_date <= now,
            Schedule.end_date >= now
        ).all()
        
        print(f"Schedules encontrados: {len(schedules)}")
        for s in schedules:
            print(f"  - {s.name} (Campaign: {s.campaign_id})")
            
            # Verificar campanha
            if s.campaign:
                print(f"    Campanha: {s.campaign.name}")
                print(f"    Background Audio ID: {s.campaign.background_audio_content_id}")
                
                if s.campaign.background_audio_content_id:
                    # Verificar conteúdo de áudio
                    from models.content import Content
                    audio = Content.query.get(s.campaign.background_audio_content_id)
                    if audio:
                        print(f"    ✓ Áudio encontrado: {audio.title}")
                        print(f"      Tipo: {audio.content_type}")
                        print(f"      Arquivo: {audio.file_path}")
                        
                        # Verificar se arquivo existe
                        upload_dir = app.config.get('UPLOAD_FOLDER', 'uploads')
                        if not os.path.isabs(upload_dir):
                            upload_dir = os.path.join(app.root_path, upload_dir)
                        
                        filename = str(audio.file_path).split('/')[-1]
                        audio_abs = os.path.join(upload_dir, filename)
                        
                        if os.path.exists(audio_abs):
                            print(f"      ✓ Arquivo existe: {audio_abs}")
                        else:
                            print(f"      ❌ Arquivo NÃO existe: {audio_abs}")
                    else:
                        print(f"    ❌ Áudio não encontrado no banco")
                else:
                    print(f"    ℹ Sem áudio de fundo configurado")
            else:
                print(f"    ❌ Campanha não encontrada")
        
        print()
        print("=" * 60)
        print("Testando endpoint /playlist diretamente:")
        print("=" * 60)
        
        # Simular request
        with app.test_client() as client:
            response = client.get(f'/api/players/{player_id}/playlist')
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.get_json()
                print(f"✓ Playlist carregada com sucesso")
                print(f"  Conteúdos: {len(data.get('contents', []))}")
                print(f"  Background Audio ID: {data.get('background_audio_content_id')}")
                print(f"  Background Audio URL: {data.get('background_audio_url')}")
            else:
                print(f"❌ Erro {response.status_code}")
                print(f"Resposta: {response.get_data(as_text=True)}")

if __name__ == '__main__':
    # ID do player para teste
    player_id = sys.argv[1] if len(sys.argv) > 1 else '13f3692a-7270-484a-90f3-feb2aaa006f3'
    test_playlist(player_id)

