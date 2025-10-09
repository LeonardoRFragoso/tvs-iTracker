"""
Script de migração manual para corrigir o valor 'modern' que está causando erro de conversão de data
"""
import sys
import os

# Adicionar o diretório pai ao path para importar módulos do backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))  

from flask import Flask
from database import db
from sqlalchemy import text

def run_migration():
    """Corrige o valor 'modern' que está causando erro"""
    try:
        changes_made = False
        
        # Verificar tabelas que podem conter o valor problemático
        tables = ['players', 'schedules', 'campaigns', 'campaign_contents', 'contents']
        
        for table in tables:
            # Obter todas as colunas da tabela
            columns = db.session.execute(text(f"PRAGMA table_info({table})")).fetchall()
            column_names = [col[1] for col in columns]  # Nome da coluna está no índice 1
            
            # Verificar cada coluna que pode conter o valor problemático
            for column in column_names:
                # Verificar se a coluna contém o valor problemático
                result = db.session.execute(text(f"""
                    SELECT COUNT(*) FROM {table} 
                    WHERE {column} = 'modern'
                    OR {column} LIKE '%modern%'
                """)).scalar()
                
                if result > 0:
                    print(f"[Migração] Encontrado valor problemático em {table}.{column}: {result} registros")
                    
                    # Determinar o tipo de dado da coluna para substituir com um valor apropriado
                    column_type = next((col[2] for col in columns if col[1] == column), 'TEXT')
                    
                    if 'DATETIME' in column_type.upper() or 'DATE' in column_type.upper():
                        # Se for uma coluna de data, definir como NULL
                        db.session.execute(text(f"""
                            UPDATE {table} 
                            SET {column} = NULL 
                            WHERE {column} = 'modern'
                            OR {column} LIKE '%modern%'
                        """))
                        print(f"[Migração] Valor em {table}.{column} corrigido para NULL")
                    else:
                        # Se for outro tipo de coluna, manter o valor mas marcar como string
                        pass
                    
                    changes_made = True
        
        # Também verificar especificamente na tabela de players, que sabemos que está causando o erro
        try:
            db.session.execute(text("""
                UPDATE players 
                SET last_ping = NULL 
                WHERE last_ping = 'modern'
                OR last_ping LIKE '%modern%'
            """))
            db.session.execute(text("""
                UPDATE players 
                SET last_content_sync = NULL 
                WHERE last_content_sync = 'modern'
                OR last_content_sync LIKE '%modern%'
            """))
            print("[Migração] Campos de data em players verificados e corrigidos")
            changes_made = True
        except Exception as e:
            print(f"[Migração] Aviso: Não foi possível corrigir campos em players: {e}")
        
        # Commit das alterações se necessário
        if changes_made:
            db.session.commit()
            print("[Migração] Alterações commitadas com sucesso")
        else:
            print("[Migração] Nenhuma alteração necessária")
            
        return changes_made
    except Exception as e:
        db.session.rollback()
        print(f"[Migração] Erro ao corrigir valor problemático: {str(e)}")
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
