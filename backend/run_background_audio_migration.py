#!/usr/bin/env python3
"""
Script para executar a migração de adição de suporte a áudio de fundo
"""

import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

def main():
    with app.app_context():
        print("=" * 60)
        print("Executando migração: add_background_audio_support")
        print("=" * 60)
        
        from migrations.add_background_audio_support import upgrade
        
        success = upgrade()
        
        if success:
            print("=" * 60)
            print("✓ Migração concluída com sucesso!")
            print("=" * 60)
            return 0
        else:
            print("=" * 60)
            print("✗ Migração falhou!")
            print("=" * 60)
            return 1

if __name__ == '__main__':
    sys.exit(main())

