"""
Migration: Add persistent and content_type fields to schedules table
Date: 2025-09-16
"""

import sqlite3
import os

def run_migration():
    # Caminho para o banco de dados
    db_path = os.path.join(os.path.dirname(__file__), '..', 'instance', 'tvs_platform.db')
    
    if not os.path.exists(db_path):
        db_path = os.path.join(os.path.dirname(__file__), '..', 'tvs_platform.db')
    
    print(f"Executando migração em: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar se as colunas já existem
        cursor.execute("PRAGMA table_info(schedules)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Adicionar coluna is_persistent se não existir
        if 'is_persistent' not in columns:
            cursor.execute("""
                ALTER TABLE schedules 
                ADD COLUMN is_persistent BOOLEAN DEFAULT 0
            """)
            print("✓ Coluna 'is_persistent' adicionada")
        else:
            print("- Coluna 'is_persistent' já existe")
        
        # Adicionar coluna content_type se não existir
        if 'content_type' not in columns:
            cursor.execute("""
                ALTER TABLE schedules 
                ADD COLUMN content_type VARCHAR(20) DEFAULT 'main'
            """)
            print("✓ Coluna 'content_type' adicionada")
        else:
            print("- Coluna 'content_type' já existe")
        
        # Atualizar agendamentos existentes baseado no tipo de conteúdo da campanha
        cursor.execute("""
            UPDATE schedules 
            SET content_type = 'overlay', is_persistent = 1
            WHERE campaign_id IN (
                SELECT DISTINCT c.id 
                FROM campaigns c
                JOIN campaign_contents cc ON c.id = cc.campaign_id
                JOIN contents ct ON cc.content_id = ct.id
                WHERE ct.content_type = 'image' 
                AND (LOWER(c.name) LIKE '%logo%' OR LOWER(c.name) LIKE '%overlay%')
            )
        """)
        
        updated_rows = cursor.rowcount
        if updated_rows > 0:
            print(f"✓ {updated_rows} agendamentos atualizados para tipo 'overlay'")
        
        conn.commit()
        print("✓ Migração concluída com sucesso!")
        
    except Exception as e:
        print(f"✗ Erro na migração: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
