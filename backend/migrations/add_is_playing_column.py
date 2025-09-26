"""
Migração para adicionar a coluna is_playing à tabela players
"""
import sqlite3
import os

def run_migration():
    """
    Executa a migração para adicionar a coluna is_playing à tabela players
    """
    # Determinar o caminho do banco de dados
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'tvs_platform.db')
    if not os.path.exists(db_path):
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tvs_platform.db')
    
    print(f"[MIGRATION] Conectando ao banco de dados: {db_path}")
    
    # Conectar ao banco de dados
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Verificar se a coluna is_playing já existe
    cursor.execute("PRAGMA table_info(players)")
    columns = cursor.fetchall()
    column_names = [column['name'] for column in columns]
    
    if 'is_playing' in column_names:
        print("[MIGRATION] Coluna is_playing já existe na tabela players. Migração não necessária.")
    else:
        # Adicionar a coluna is_playing
        try:
            cursor.execute("ALTER TABLE players ADD COLUMN is_playing BOOLEAN DEFAULT 0")
            print("[MIGRATION] Coluna is_playing adicionada com sucesso à tabela players")
        except sqlite3.Error as e:
            print(f"[MIGRATION] Erro ao adicionar coluna is_playing: {str(e)}")
    
    # Commit das alterações
    conn.commit()
    conn.close()
    
    print("[MIGRATION] Migração concluída")

if __name__ == "__main__":
    run_migration()
