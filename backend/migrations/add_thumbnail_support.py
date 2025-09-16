"""
Migração: Adicionar suporte a thumbnails
Data: 2025-09-15
Descrição: Adiciona campo thumbnail_path à tabela contents
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    """Executa a migração para adicionar campo thumbnail_path"""
    
    # Caminho para o banco de dados
    db_path = os.path.join(os.path.dirname(__file__), '..', 'instance', 'tvs_platform.db')
    
    if not os.path.exists(db_path):
        print("Banco de dados não encontrado. Execute init_db.py primeiro.")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar se a coluna já existe
        cursor.execute("PRAGMA table_info(contents)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'thumbnail_path' not in columns:
            print("Adicionando campo thumbnail_path à tabela contents...")
            cursor.execute("ALTER TABLE contents ADD COLUMN thumbnail_path VARCHAR(500)")
            conn.commit()
            print("✅ Campo thumbnail_path adicionado com sucesso!")
        else:
            print("✅ Campo thumbnail_path já existe na tabela contents.")
        
        # Criar diretório de thumbnails se não existir
        uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
        thumbnails_dir = os.path.join(uploads_dir, 'thumbnails')
        
        if not os.path.exists(thumbnails_dir):
            os.makedirs(thumbnails_dir)
            print("✅ Diretório de thumbnails criado.")
        else:
            print("✅ Diretório de thumbnails já existe.")
        
        conn.close()
        print(f"✅ Migração concluída em {datetime.now()}")
        return True
        
    except Exception as e:
        print(f"❌ Erro na migração: {str(e)}")
        return False

if __name__ == "__main__":
    run_migration()
