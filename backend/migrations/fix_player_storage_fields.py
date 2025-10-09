"""
Script de migração manual para corrigir campos de armazenamento na tabela players
"""
import sys
import os

# Adicionar o diretório pai ao path para importar módulos do backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))  

from flask import Flask
from database import db
from sqlalchemy import text

def run_migration():
    """Corrige campos de armazenamento na tabela players"""
    try:
        changes_made = False
        
        # Corrigir storage_capacity_gb quando é NULL
        try:
            db.session.execute(text("""
                UPDATE players 
                SET storage_capacity_gb = 32 
                WHERE storage_capacity_gb IS NULL
            """))
            print("[Migração] Campo storage_capacity_gb corrigido na tabela players")
            changes_made = True
        except Exception as e:
            print(f"[Migração] Aviso: Não foi possível corrigir storage_capacity_gb: {e}")
        
        # Corrigir storage_used_gb quando é NULL
        try:
            db.session.execute(text("""
                UPDATE players 
                SET storage_used_gb = 0.0 
                WHERE storage_used_gb IS NULL
            """))
            print("[Migração] Campo storage_used_gb corrigido na tabela players")
            changes_made = True
        except Exception as e:
            print(f"[Migração] Aviso: Não foi possível corrigir storage_used_gb: {e}")
        
        # Commit das alterações se necessário
        if changes_made:
            db.session.commit()
            print("[Migração] Alterações commitadas com sucesso")
        else:
            print("[Migração] Nenhuma alteração necessária")
            
        return changes_made
    except Exception as e:
        db.session.rollback()
        print(f"[Migração] Erro ao corrigir campos de armazenamento: {str(e)}")
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
