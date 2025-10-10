#!/usr/bin/env python3
"""
Script para verificar o status do player RBT
Execute via: python check_player_rbt.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models.player import Player
from datetime import datetime, timedelta

def check_player():
    with app.app_context():
        print("=" * 80)
        print("VERIFICAÇÃO DO PLAYER RBT")
        print("=" * 80)
        print()
        
        # Buscar player RBT
        player = Player.query.filter_by(name='RBT').first()
        
        if not player:
            print("❌ Player RBT não encontrado no banco de dados")
            return
        
        print(f"✅ Player encontrado!")
        print(f"ID: {player.id}")
        print(f"Nome: {player.name}")
        print()
        
        print("-" * 80)
        print("CONFIGURAÇÕES:")
        print("-" * 80)
        print(f"Plataforma: {player.platform}")
        print(f"Tipo de Dispositivo: {player.device_type}")
        print(f"Chromecast ID: {player.chromecast_id or 'Nenhum'}")
        print(f"MAC Address: {player.mac_address or 'Nenhum'}")
        print(f"IP Address: {player.ip_address or 'Nenhum'}")
        print(f"Localização ID: {player.location_id}")
        print()
        
        print("-" * 80)
        print("STATUS DE CONECTIVIDADE:")
        print("-" * 80)
        print(f"Status (campo direto): {player._status}")
        print(f"Status (property): {player.status}")
        print(f"Last Ping (raw): {player.last_ping} (tipo: {type(player.last_ping).__name__})")
        print(f"Is Online (property): {player.is_online}")
        print()
        
        # Verificar quando foi o último ping
        if player.last_ping:
            try:
                if isinstance(player.last_ping, datetime):
                    delta = datetime.utcnow() - player.last_ping
                    print(f"Último ping foi há: {delta.total_seconds():.0f} segundos")
                    print(f"Threshold para online: 300 segundos (5 minutos)")
                    print(f"Está dentro do threshold? {delta.total_seconds() < 300}")
                elif isinstance(player.last_ping, str):
                    print(f"⚠️ PROBLEMA: last_ping é uma string: '{player.last_ping}'")
                    print("   Deveria ser um objeto datetime!")
            except Exception as e:
                print(f"❌ Erro ao calcular delta: {e}")
        else:
            print("⚠️ last_ping é None - nunca recebeu ping")
        print()
        
        print("-" * 80)
        print("STATUS DE REPRODUÇÃO:")
        print("-" * 80)
        print(f"Está reproduzindo: {player.is_playing}")
        print(f"Conteúdo atual: {player.current_content_title or 'Nenhum'}")
        print(f"Campanha atual: {player.current_campaign_name or 'Nenhuma'}")
        print(f"Último heartbeat: {player.last_playback_heartbeat}")
        print()
        
        print("-" * 80)
        print("ANÁLISE:")
        print("-" * 80)
        
        # Análise da plataforma
        platform_lower = (player.platform or '').lower()
        is_chromecast = platform_lower == 'chromecast' and player.chromecast_id
        
        if is_chromecast:
            print("⚠️ Player configurado como CHROMECAST")
            print("   O comando /sync tentará descobrir o Chromecast na rede")
            print("   Se não encontrar, marcará como offline")
        else:
            print("✅ Player NÃO é Chromecast")
            print("   O comando /sync deve apenas atualizar last_ping e marcar como online")
        print()
        
        # Verificar se há problema com o tipo de dado
        if isinstance(player.last_ping, str):
            print("❌ PROBLEMA DETECTADO:")
            print("   O campo last_ping está armazenado como STRING no banco")
            print("   Isso pode causar problemas na verificação de is_online")
            print()
            print("   SOLUÇÃO:")
            print("   1. Limpar o campo: player.last_ping = None")
            print("   2. Aguardar próximo ping do player")
            print("   3. Verificar se o tipo correto (datetime) é armazenado")
        
        print()
        print("=" * 80)
        print("Para corrigir problemas, execute: python fix_player_rbt.py")
        print("=" * 80)

if __name__ == '__main__':
    check_player()

