#!/usr/bin/env python3
"""
Script para corrigir armazenamento usado dos players
Remove valores fictícios e define como 0.0
"""

import os
import sys

# Garantir que estamos no diretório backend
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from app import app
from database import db
from models.player import Player

def fix_storage():
    """Zera o armazenamento usado de todos os players"""
    
    print("🔧 Corrigindo armazenamento dos players...")
    
    with app.app_context():
        try:
            # Buscar todos os players
            players = Player.query.all()
            
            print(f"📊 Encontrados {len(players)} players")
            
            # Zerar armazenamento usado
            for player in players:
                old_storage = player.storage_used_gb
                player.storage_used_gb = 0.0
                print(f"   {player.name}: {old_storage}GB → 0.0GB")
            
            # Salvar mudanças
            db.session.commit()
            
            print("✅ Armazenamento corrigido com sucesso!")
            print("\n📋 Resumo:")
            
            # Verificar resultado
            total_used = sum(p.storage_used_gb for p in players)
            total_capacity = sum(p.storage_capacity_gb for p in players)
            percentage = (total_used / total_capacity * 100) if total_capacity > 0 else 0
            
            print(f"   📦 Armazenamento usado: {total_used}GB")
            print(f"   💾 Capacidade total: {total_capacity}GB")
            print(f"   📊 Percentual: {percentage:.1f}%")
            
        except Exception as e:
            print(f"❌ Erro durante correção: {e}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    fix_storage()
