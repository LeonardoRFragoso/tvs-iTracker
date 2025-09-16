#!/usr/bin/env python3
"""
Migração: Adicionar suporte a Chromecast
Adiciona campos chromecast_id e chromecast_name ao modelo Player
"""

import os
import sys
from datetime import datetime

# Garantir que estamos no diretório backend
backend_dir = os.path.dirname(os.path.abspath(__file__))
if 'migrations' in backend_dir:
    backend_dir = os.path.dirname(backend_dir)
sys.path.insert(0, backend_dir)

from app import app
from database import db
from sqlalchemy import text

def upgrade():
    """Aplicar migração - adicionar campos Chromecast"""
    
    print("🔧 Aplicando migração: Suporte a Chromecast...")
    
    with app.app_context():
        try:
            # Adicionar colunas chromecast_id e chromecast_name
            with db.engine.connect() as conn:
                conn.execute(text("""
                    ALTER TABLE players 
                    ADD COLUMN chromecast_id VARCHAR(100);
                """))
                
                conn.execute(text("""
                    ALTER TABLE players 
                    ADD COLUMN chromecast_name VARCHAR(100);
                """))
                
                print("✅ Campos chromecast_id e chromecast_name adicionados")
                
                # Atualizar players existentes com platform chromecast onde apropriado
                conn.execute(text("""
                    UPDATE players 
                    SET platform = 'chromecast' 
                    WHERE platform = 'web' AND name LIKE '%TV%';
                """))
                
                conn.commit()
                
            print("✅ Platform atualizada para players de TV")
            
            print("🎉 Migração aplicada com sucesso!")
            
        except Exception as e:
            print(f"❌ Erro durante migração: {e}")
            raise

def downgrade():
    """Reverter migração - remover campos Chromecast"""
    
    print("🔧 Revertendo migração: Suporte a Chromecast...")
    
    with app.app_context():
        try:
            # Remover colunas chromecast_id e chromecast_name
            with db.engine.connect() as conn:
                conn.execute(text("""
                    ALTER TABLE players 
                    DROP COLUMN chromecast_id;
                """))
                
                conn.execute(text("""
                    ALTER TABLE players 
                    DROP COLUMN chromecast_name;
                """))
                
                print("✅ Campos Chromecast removidos")
                
                # Reverter platform para web
                conn.execute(text("""
                    UPDATE players 
                    SET platform = 'web' 
                    WHERE platform = 'chromecast';
                """))
                
                conn.commit()
                
            print("✅ Platform revertida para web")
            
            print("🎉 Migração revertida com sucesso!")
            
        except Exception as e:
            print(f"❌ Erro durante reversão: {e}")
            raise

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'downgrade':
        downgrade()
    else:
        upgrade()
