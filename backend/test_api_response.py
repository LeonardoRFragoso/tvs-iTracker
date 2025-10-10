#!/usr/bin/env python3
"""
Script para testar a resposta da API /players e ver o que o frontend recebe
Execute via: python3 test_api_response.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from datetime import datetime
import json

def test_api_response():
    with app.app_context():
        print("=" * 80)
        print("TESTE DA RESPOSTA DA API /players")
        print("=" * 80)
        print()
        
        # Simular request da API
        with app.test_client() as client:
            # Fazer sync primeiro
            print("1️⃣ EXECUTANDO SYNC DO PLAYER RBT...")
            print("-" * 80)
            sync_response = client.post('/api/players/13f3692a-7270-484a-90f3-feb2aaa006f3/sync')
            print(f"Status do sync: {sync_response.status_code}")
            if sync_response.status_code == 200:
                sync_data = sync_response.get_json()
                print(f"Resposta do sync: {json.dumps(sync_data, indent=2)}")
            print()
            
            # Aguardar 1 segundo (como o frontend faz)
            import time
            print("⏱️ Aguardando 1 segundo (como o frontend faz)...")
            time.sleep(1)
            print()
            
            # Buscar lista de players (como o frontend faz)
            print("2️⃣ BUSCANDO LISTA DE PLAYERS (GET /api/players)...")
            print("-" * 80)
            list_response = client.get('/api/players?page=1&per_page=12')
            print(f"Status da listagem: {list_response.status_code}")
            print()
            
            if list_response.status_code == 200:
                data = list_response.get_json()
                
                # Encontrar player RBT na resposta
                rbt_player = None
                for player in data.get('players', []):
                    if player['name'] == 'RBT':
                        rbt_player = player
                        break
                
                if rbt_player:
                    print("✅ PLAYER RBT ENCONTRADO NA RESPOSTA:")
                    print("-" * 80)
                    print(f"ID: {rbt_player['id']}")
                    print(f"Nome: {rbt_player['name']}")
                    print(f"Status: {rbt_player['status']}")
                    print(f"Is Online: {rbt_player['is_online']}")
                    print(f"Last Ping: {rbt_player['last_ping']}")
                    print(f"IP Address: {rbt_player.get('ip_address', 'N/A')}")
                    print()
                    
                    print("-" * 80)
                    print("🔍 ANÁLISE:")
                    print("-" * 80)
                    
                    if rbt_player['is_online'] == True:
                        print("✅ O backend retorna is_online = True")
                        print("   O frontend DEVERIA mostrar como 'Conectado'")
                        print()
                        print("Se o frontend mostra como 'Desconectado', o problema é:")
                        print("  1. Cache do navegador")
                        print("  2. A página não está recarregando os dados")
                        print("  3. Há filtros ativos que escondem o player")
                        print("  4. JavaScript do frontend tem bug")
                    else:
                        print("❌ O backend retorna is_online = False")
                        print("   Isso explica porque o frontend mostra 'Desconectado'")
                        print()
                        print("Possíveis causas:")
                        print("  1. last_ping não foi atualizado corretamente")
                        print("  2. Há mais de 5 minutos desde o último ping")
                        print("  3. Bug na property is_online do modelo Player")
                    
                    print()
                    print("-" * 80)
                    print("📋 DADOS COMPLETOS DO PLAYER (JSON):")
                    print("-" * 80)
                    print(json.dumps(rbt_player, indent=2, ensure_ascii=False))
                else:
                    print("❌ PLAYER RBT NÃO ENCONTRADO NA RESPOSTA!")
                    print()
                    print("Players retornados:")
                    for p in data.get('players', []):
                        print(f"  - {p['name']} (ID: {p['id']})")
            else:
                print(f"❌ Erro ao buscar players: {list_response.status_code}")
                print(f"Resposta: {list_response.get_data(as_text=True)}")
        
        print()
        print("=" * 80)

if __name__ == '__main__':
    test_api_response()

