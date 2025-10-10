#!/usr/bin/env python3
"""
Script para corrigir problemas do player RBT
Execute via: python fix_player_rbt.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models.player import Player
from database import db
from datetime import datetime

def fix_player():
    with app.app_context():
        print("=" * 80)
        print("CORREÇÃO DO PLAYER RBT")
        print("=" * 80)
        print()
        
        # Buscar player RBT
        player = Player.query.filter_by(name='RBT').first()
        
        if not player:
            print("❌ Player RBT não encontrado no banco de dados")
            return
        
        print(f"✅ Player encontrado: {player.name} (ID: {player.id})")
        print()
        
        changes_made = []
        
        # 1. Verificar e corrigir tipo de last_ping
        print("1. Verificando campo last_ping...")
        if isinstance(player.last_ping, str):
            print(f"   ⚠️ last_ping está como string: '{player.last_ping}'")
            print("   🔧 Limpando campo...")
            player.last_ping = None
            changes_made.append("Limpou last_ping (estava como string)")
        elif player.last_ping is None:
            print("   ℹ️ last_ping é None (será preenchido no próximo ping)")
        else:
            print(f"   ✅ last_ping está correto (datetime): {player.last_ping}")
        print()
        
        # 2. Verificar e corrigir status
        print("2. Verificando campo status...")
        if isinstance(player._status, str):
            print(f"   ✅ Status está correto (string): '{player._status}'")
        else:
            print(f"   ⚠️ Status tem tipo inválido: {type(player._status).__name__}")
            print("   🔧 Corrigindo para 'offline'...")
            player._status = 'offline'
            changes_made.append("Corrigiu tipo do campo status")
        print()
        
        # 3. Verificar configuração da plataforma
        print("3. Verificando configuração de plataforma...")
        print(f"   Plataforma atual: {player.platform}")
        print(f"   Chromecast ID: {player.chromecast_id or 'Nenhum'}")
        
        platform_lower = (player.platform or '').lower()
        if platform_lower == 'chromecast' and not player.chromecast_id:
            print("   ⚠️ Plataforma é Chromecast mas não tem chromecast_id")
            print("   🔧 Alterando plataforma para 'android'...")
            player.platform = 'android'
            changes_made.append("Alterou plataforma de chromecast para android")
        elif platform_lower == 'chromecast' and player.chromecast_id:
            print("   ⚠️ Plataforma Chromecast com ID definido")
            print("   ℹ️ Se este não é um Chromecast real, altere manualmente")
        else:
            print(f"   ✅ Plataforma correta: {player.platform}")
        print()
        
        # 4. Garantir que device_type está correto
        print("4. Verificando device_type...")
        if not player.device_type or player.device_type == 'None':
            print("   🔧 Definindo device_type como 'modern'...")
            player.device_type = 'modern'
            changes_made.append("Definiu device_type como 'modern'")
        else:
            print(f"   ✅ device_type: {player.device_type}")
        print()
        
        # 5. Salvar alterações
        if changes_made:
            print("=" * 80)
            print("RESUMO DAS ALTERAÇÕES:")
            print("=" * 80)
            for i, change in enumerate(changes_made, 1):
                print(f"{i}. {change}")
            print()
            
            try:
                db.session.commit()
                print("✅ Alterações salvas com sucesso!")
            except Exception as e:
                print(f"❌ Erro ao salvar alterações: {e}")
                db.session.rollback()
        else:
            print("=" * 80)
            print("✅ Nenhuma correção necessária - player está OK!")
            print("=" * 80)
        
        print()
        print("Execute novamente: python check_player_rbt.py para verificar")

if __name__ == '__main__':
    fix_player()

