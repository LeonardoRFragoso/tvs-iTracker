"""
Script para executar a migração manual dentro do contexto da aplicação principal
"""
from app import app, db
from sqlalchemy import text
import os

def run_migration():
    """Adiciona colunas device_type e device_type_compatibility às tabelas"""
    with app.app_context():
        try:
            # Verificar se a coluna já existe antes de tentar adicioná-la
            try:
                db.session.execute(text("SELECT device_type FROM players LIMIT 1"))
                print("[Migração] Coluna device_type já existe na tabela players")
            except Exception:
                # Adicionar coluna device_type à tabela players
                db.session.execute(text("ALTER TABLE players ADD COLUMN device_type VARCHAR(50) DEFAULT 'modern'"))
                print("[Migração] Coluna device_type adicionada à tabela players")
            
            try:
                db.session.execute(text("SELECT device_type_compatibility FROM schedules LIMIT 1"))
                print("[Migração] Coluna device_type_compatibility já existe na tabela schedules")
            except Exception:
                # Adicionar coluna device_type_compatibility à tabela schedules
                db.session.execute(text("ALTER TABLE schedules ADD COLUMN device_type_compatibility VARCHAR(100) DEFAULT 'modern,tizen,legacy'"))
                print("[Migração] Coluna device_type_compatibility adicionada à tabela schedules")
            
            # Commit das alterações
            db.session.commit()
            print("[Migração] Alterações commitadas com sucesso")
            return True
        except Exception as e:
            db.session.rollback()
            print(f"[Migração] Erro ao adicionar colunas: {str(e)}")
            return False

if __name__ == "__main__":
    # Verificar se estamos usando o banco de dados correto
    print(f"[INFO] Usando banco de dados: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    # Verificar se o banco de dados existe
    db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
    if db_path.startswith('/'):
        db_path = db_path[1:]  # Remover a barra inicial para caminhos absolutos
    
    # Verificar se o caminho é relativo
    if not os.path.isabs(db_path):
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), db_path)
    
    # Verificar se o arquivo existe
    if os.path.exists(db_path):
        print(f"[INFO] Banco de dados encontrado em: {db_path}")
    else:
        print(f"[AVISO] Banco de dados não encontrado em: {db_path}")
        
        # Verificar se existe na pasta instance
        instance_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', os.path.basename(db_path))
        if os.path.exists(instance_db_path):
            print(f"[INFO] Banco de dados encontrado na pasta instance: {instance_db_path}")
            print(f"[AVISO] Considere atualizar a configuração SQLALCHEMY_DATABASE_URI para apontar para o arquivo correto")
    
    # Executar a migração
    run_migration()
