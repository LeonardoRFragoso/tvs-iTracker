#!/usr/bin/env python3
"""
Script para corrigir o nome do Chromecast no banco de dados
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from database import db
from models.player import Player

def fix_chromecast_name():
    with app.app_context():
        try:
            # Buscar o player Chromecast
            player = Player.query.filter_by(name='Chromecast Escritório').first()
            if not player:
                print("❌ Player 'Chromecast Escritório' não encontrado!")
                return False
            
            print(f"🔍 Player encontrado:")
            print(f"   - Nome atual: {player.name}")
            print(f"   - Chromecast ID: {player.chromecast_id}")
            
            # Atualizar o nome para corresponder ao dispositivo real
            player.name = "Escritório"
            
            db.session.commit()
            
            print(f"✅ Nome atualizado para: {player.name}")
            print("Agora o sistema deve conseguir identificar o Chromecast corretamente!")
            
            return True
            
        except Exception as e:
            print(f"❌ Erro ao atualizar nome: {e}")
            db.session.rollback()
            return False

if __name__ == "__main__":
    print("=== Corrigindo nome do Chromecast ===")
    success = fix_chromecast_name()
    
    if success:
        print("\n✅ Nome corrigido com sucesso!")
        print("Execute novamente o debug_chromecast.py para testar.")
    else:
        print("\n❌ Falha ao corrigir nome!")
