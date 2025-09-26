"""
Script de migração manual para corrigir o campo last_ping na tabela players
"""
import sys
import os

# Adicionar o diretório pai ao path para importar módulos do backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))  

from flask import Flask
from database import db
from sqlalchemy import text

def run_migration():
    """Corrige o campo last_ping na tabela players"""
    try:
        changes_made = False
        
        # Verificar se existem valores 'offline' no campo last_ping
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM players 
            WHERE last_ping = 'offline' OR last_ping LIKE '%offline%'
        """)).scalar()
        
        if result > 0:
            print(f"[Migração] Encontrados {result} registros com last_ping inválido")
            
            # Corrigir valores 'offline' no campo last_ping
            db.session.execute(text("""
                UPDATE players 
                SET last_ping = NULL 
                WHERE last_ping = 'offline' OR last_ping LIKE '%offline%'
            """))
            print("[Migração] Campo last_ping corrigido na tabela players")
            changes_made = True
        else:
            print("[Migração] Não foram encontrados valores inválidos no campo last_ping")
        
        # Verificar se existem valores 'offline' no campo last_content_sync
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM players 
            WHERE last_content_sync = 'offline' OR last_content_sync LIKE '%offline%'
        """)).scalar()
        
        if result > 0:
            print(f"[Migração] Encontrados {result} registros com last_content_sync inválido")
            
            # Corrigir valores 'offline' no campo last_content_sync
            db.session.execute(text("""
                UPDATE players 
                SET last_content_sync = NULL 
                WHERE last_content_sync = 'offline' OR last_content_sync LIKE '%offline%'
            """))
            print("[Migração] Campo last_content_sync corrigido na tabela players")
            changes_made = True
        else:
            print("[Migração] Não foram encontrados valores inválidos no campo last_content_sync")
        
        # Commit das alterações se necessário
        if changes_made:
            db.session.commit()
            print("[Migração] Alterações commitadas com sucesso")
        else:
            print("[Migração] Nenhuma alteração necessária")
            
        return changes_made
    except Exception as e:
        db.session.rollback()
        print(f"[Migração] Erro ao corrigir campos de data: {str(e)}")
        return False

if __name__ == "__main__":
    # Verificar qual banco de dados existe
    instance_db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'tvs_platform.db')
    root_db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tvs_platform.db')
    
    if os.path.exists(instance_db_path):
        print(f"[Migração] Usando banco de dados em: {instance_db_path}")
        db_uri = f'sqlite:///{instance_db_path}'
    elif os.path.exists(root_db_path):
        print(f"[Migração] Usando banco de dados em: {root_db_path}")
        db_uri = f'sqlite:///{root_db_path}'
    else:
        print("[Migração] Nenhum banco de dados encontrado. Criando novo em instance/tvs_platform.db")
        os.makedirs(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance'), exist_ok=True)
        db_uri = f'sqlite:///{instance_db_path}'
    
    # Criar uma aplicação Flask mínima para contexto
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    
    with app.app_context():
        run_migration()
