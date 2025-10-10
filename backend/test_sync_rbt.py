#!/usr/bin/env python3
"""
Script para testar o comportamento do sync no player RBT
Execute via: python test_sync_rbt.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models.player import Player
from database import db
from datetime import datetime

def test_sync():
    with app.app_context():
        print("=" * 80)
        print("TESTE DE SINCRONIZAÇÃO DO PLAYER RBT")
        print("=" * 80)
        print()
        
        # Buscar player RBT
        player = Player.query.filter_by(name='RBT').first()
        
        if not player:
            print("❌ Player RBT não encontrado no banco de dados")
            return
        
        print(f"✅ Player encontrado: {player.name}")
        print(f"   ID: {player.id}")
        print()
        
        # Estado ANTES do sync
        print("-" * 80)
        print("ESTADO ANTES DO SYNC:")
        print("-" * 80)
        print(f"Platform: {player.platform}")
        print(f"Chromecast ID: {player.chromecast_id or 'Nenhum'}")
        print(f"Status: {player.status}")
        print(f"Last Ping: {player.last_ping}")
        print(f"Is Online: {player.is_online}")
        print()
        
        # Simular a lógica do sync
        print("-" * 80)
        print("SIMULANDO LÓGICA DO SYNC:")
        print("-" * 80)
        
        platform_lower = (player.platform or '').lower()
        is_chromecast = platform_lower == 'chromecast' and player.chromecast_id
        
        print(f"1. Platform lower: '{platform_lower}'")
        print(f"2. Chromecast ID presente: {bool(player.chromecast_id)}")
        print(f"3. É Chromecast: {is_chromecast}")
        print()
        
        if is_chromecast:
            print("🔍 CAMINHO CHROMECAST:")
            print("   - Tentaria descobrir dispositivos na rede")
            print("   - Se não encontrar, marca como offline")
            print("   - Se encontrar, marca como online e atualiza last_ping")
            print()
            print("⚠️ PROBLEMA: Se o Chromecast não for encontrado, fica offline!")
        else:
            print("✅ CAMINHO NÃO-CHROMECAST:")
            print("   - Atualiza last_ping = datetime.utcnow()")
            print("   - Define status = 'online'")
            print("   - Commit no banco")
            print()
            
            # Executar a lógica
            print("Executando lógica de sync para player não-Chromecast...")
            old_status = player.status
            old_ping = player.last_ping
            
            player.last_ping = datetime.utcnow()
            player.status = 'online'
            db.session.commit()
            
            print(f"   ✅ Status alterado: '{old_status}' → '{player.status}'")
            print(f"   ✅ Last ping atualizado: {old_ping} → {player.last_ping}")
        
        print()
        
        # Estado DEPOIS do sync
        print("-" * 80)
        print("ESTADO DEPOIS DO SYNC:")
        print("-" * 80)
        
        # Recarregar do banco
        db.session.refresh(player)
        
        print(f"Status: {player.status}")
        print(f"Last Ping: {player.last_ping} (tipo: {type(player.last_ping).__name__})")
        print(f"Is Online: {player.is_online}")
        print()
        
        # Verificar se is_online funciona corretamente
        print("-" * 80)
        print("VERIFICAÇÃO DE IS_ONLINE:")
        print("-" * 80)
        
        if player.last_ping:
            if isinstance(player.last_ping, datetime):
                delta_seconds = (datetime.utcnow() - player.last_ping).total_seconds()
                print(f"Última atualização foi há: {delta_seconds:.2f} segundos")
                print(f"Threshold para online: 300 segundos")
                print(f"Deveria estar online? {delta_seconds < 300}")
                print(f"Property is_online retorna: {player.is_online}")
                
                if (delta_seconds < 300) != player.is_online:
                    print()
                    print("❌ INCONSISTÊNCIA DETECTADA!")
                    print("   O cálculo manual e a property is_online não batem!")
            else:
                print(f"❌ last_ping não é datetime: {type(player.last_ping).__name__}")
                print(f"   Valor: {player.last_ping}")
        else:
            print("⚠️ last_ping é None")
        
        print()
        print("=" * 80)
        print("TESTE CONCLUÍDO")
        print("=" * 80)

if __name__ == '__main__':
    test_sync()

