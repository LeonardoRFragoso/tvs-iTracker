#!/usr/bin/env python3
"""
Script para testar o sync em tempo real e ver o que acontece
Execute via: python3 test_sync_realtime.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models.player import Player
from models.user import User
from models.location import Location
from database import db
from datetime import datetime

def test_sync_realtime():
    with app.app_context():
        print("=" * 80)
        print("TESTE DE SYNC EM TEMPO REAL - PLAYER RBT")
        print("=" * 80)
        print()
        
        # Buscar player RBT
        player = Player.query.get('13f3692a-7270-484a-90f3-feb2aaa006f3')
        
        if not player:
            print("❌ Player RBT não encontrado")
            return
        
        print(f"✅ Player encontrado: {player.name}")
        print()
        
        # ANTES DO SYNC
        print("=" * 80)
        print("📊 ESTADO ANTES DO SYNC:")
        print("=" * 80)
        print(f"Status (campo direto): {player._status}")
        print(f"Status (property): {player.status}")
        print(f"Last Ping: {player.last_ping}")
        print(f"Is Online: {player.is_online}")
        if player.last_ping:
            delta = (datetime.utcnow() - player.last_ping).total_seconds()
            print(f"Último ping foi há: {delta:.0f} segundos")
        print()
        
        # EXECUTAR A LÓGICA EXATA DA ROTA /sync
        print("=" * 80)
        print("🔄 EXECUTANDO LÓGICA DO SYNC (SIMULAÇÃO EXATA DA ROTA):")
        print("=" * 80)
        
        # Esta é a lógica EXATA do backend/routes/player.py linha 474-599
        player_id = player.id
        
        print(f"[SYNC] Iniciando sincronização para player: {player_id}")
        print(f"[SYNC] Player encontrado: {player.name}, Chromecast ID: {player.chromecast_id}")
        
        # Verificar se é Chromecast
        platform_lower = (player.platform or '').lower()
        has_chromecast_id = bool(player.chromecast_id)
        is_chromecast = platform_lower == 'chromecast' and has_chromecast_id
        
        print(f"[SYNC] Platform: '{player.platform}' (lower: '{platform_lower}')")
        print(f"[SYNC] Chromecast ID presente: {has_chromecast_id}")
        print(f"[SYNC] É Chromecast: {is_chromecast}")
        print()
        
        if is_chromecast:
            print("[SYNC] ⚠️ ENTRANDO NO CAMINHO CHROMECAST!")
            print("[SYNC] Tentaria descobrir dispositivos na rede...")
            print("[SYNC] Se não encontrar, marcaria como offline")
            print()
            print("❌ ESTE É O PROBLEMA!")
            print("   Player está configurado como Chromecast mas não deveria")
        else:
            print("[SYNC] ✅ ENTRANDO NO CAMINHO NÃO-CHROMECAST")
            print(f"[SYNC] Player não tem Chromecast associado")
            
            # Aplicar a lógica exata
            old_status = player.status
            old_last_ping = player.last_ping
            
            print(f"[SYNC] Atualizando last_ping...")
            player.last_ping = datetime.utcnow()
            
            print(f"[SYNC] Definindo status = 'online'")
            player.status = 'online'
            
            print(f"[SYNC] Salvando no banco...")
            db.session.commit()
            
            print()
            print(f"[SYNC] ✅ Status: '{old_status}' → '{player.status}'")
            print(f"[SYNC] ✅ Last ping atualizado: {old_last_ping} → {player.last_ping}")
            print(f"[SYNC] Status atualizado no banco: {player.status}")
        
        print()
        
        # DEPOIS DO SYNC
        print("=" * 80)
        print("📊 ESTADO DEPOIS DO SYNC:")
        print("=" * 80)
        
        # Recarregar do banco para garantir
        db.session.expire(player)
        db.session.refresh(player)
        
        print(f"Status (campo direto): {player._status}")
        print(f"Status (property): {player.status}")
        print(f"Last Ping: {player.last_ping}")
        print(f"Last Ping (tipo): {type(player.last_ping).__name__}")
        print(f"Is Online: {player.is_online}")
        
        if player.last_ping:
            delta = (datetime.utcnow() - player.last_ping).total_seconds()
            print(f"Último ping foi há: {delta:.0f} segundos")
            print(f"Deveria estar online: {delta < 300}")
        print()
        
        # ANÁLISE FINAL
        print("=" * 80)
        print("🔍 ANÁLISE FINAL:")
        print("=" * 80)
        
        if player.is_online and player.status == 'online':
            print("✅ SUCESSO! Player está ONLINE após sync")
            print()
            print("Se o frontend ainda mostra como desconectado, o problema pode ser:")
            print("  1. Cache do navegador")
            print("  2. O frontend não está atualizando após o sync")
            print("  3. Há um delay entre o sync e a atualização da lista")
            print()
            print("TESTE NO FRONTEND:")
            print("  1. Faça o sync do player")
            print("  2. Aguarde 2-3 segundos")
            print("  3. Clique em 'Atualizar' ou recarregue a página")
            print("  4. Verifique se o status mudou")
        else:
            print("❌ PROBLEMA! Player deveria estar online mas está:")
            print(f"   Status: {player.status}")
            print(f"   Is Online: {player.is_online}")
            print()
            print("Isso indica um bug na lógica do sync ou is_online")
        
        print()
        print("=" * 80)

if __name__ == '__main__':
    test_sync_realtime()

