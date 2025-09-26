"""
Script de migração manual para adicionar colunas device_type e device_type_compatibility e corrigir o campo is_online
"""
import sys
import os

# Adicionar o diretório pai ao path para importar módulos do backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))  

from flask import Flask
from database import db
from sqlalchemy import text

def column_exists(table_name, column_name):
    """Verifica se uma coluna existe em uma tabela"""
    try:
        result = db.session.execute(
            text(f"PRAGMA table_info({table_name})")  # SQLite-specific
        ).fetchall()
        for row in result:
            if row[1] == column_name:  # column name is at index 1
                return True
        return False
    except Exception as e:
        print(f"[Migração] Erro ao verificar coluna {column_name} na tabela {table_name}: {e}")
        return False

def run_migration():
    """Adiciona colunas device_type e device_type_compatibility às tabelas e corrige o campo is_online"""
    try:
        changes_made = False
        
        # Adicionar coluna device_type à tabela players se não existir
        if not column_exists('players', 'device_type'):
            db.session.execute(text("ALTER TABLE players ADD COLUMN device_type VARCHAR(50) DEFAULT 'modern'"))
            print("[Migração] Coluna device_type adicionada à tabela players")
            changes_made = True
        else:
            print("[Migração] Coluna device_type já existe na tabela players")
        
        # Adicionar coluna device_type_compatibility à tabela schedules se não existir
        if not column_exists('schedules', 'device_type_compatibility'):
            db.session.execute(text("ALTER TABLE schedules ADD COLUMN device_type_compatibility VARCHAR(100) DEFAULT 'modern,tizen,legacy'"))
            print("[Migração] Coluna device_type_compatibility adicionada à tabela schedules")
            changes_made = True
        else:
            print("[Migração] Coluna device_type_compatibility já existe na tabela schedules")
            
        # Verificar e corrigir o campo is_online na tabela players
        try:
            # Atualizar todos os players para garantir que o campo _is_online esteja consistente
            db.session.execute(text("""
                UPDATE players 
                SET is_online = CASE 
                    WHEN last_ping IS NOT NULL AND 
                         (julianday('now') - julianday(last_ping)) * 24 * 60 * 60 < 300 
                    THEN 1 
                    ELSE 0 
                END
            """))
            print("[Migração] Campo is_online atualizado com sucesso na tabela players")
            changes_made = True
        except Exception as e:
            print(f"[Migração] Aviso: Não foi possível atualizar o campo is_online: {e}")
            # Não impede a migração de continuar
        
        # Commit das alterações se necessário
        if changes_made:
            db.session.commit()
            print("[Migração] Alterações commitadas com sucesso")
        else:
            print("[Migração] Nenhuma alteração necessária")
            
        return changes_made
    except Exception as e:
        db.session.rollback()
        print(f"[Migração] Erro ao adicionar colunas: {str(e)}")
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
