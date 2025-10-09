"""
Migração para corrigir o formato do campo last_ping nos players
"""
import sqlite3
import os
from datetime import datetime
from dateutil import parser

def run_migration():
    """
    Executa a migração para corrigir o formato do campo last_ping nos players
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
    
    # Verificar se a coluna last_ping existe
    cursor.execute("PRAGMA table_info(players)")
    columns = cursor.fetchall()
    column_names = [column['name'] for column in columns]
    
    if 'last_ping' not in column_names:
        print("[MIGRATION] Coluna last_ping não encontrada na tabela players. Migração não necessária.")
        conn.close()
        return
    
    # Buscar todos os players
    cursor.execute("SELECT id, last_ping FROM players")
    players = cursor.fetchall()
    
    updated_count = 0
    error_count = 0
    
    for player in players:
        player_id = player['id']
        last_ping = player['last_ping']
        
        # Se last_ping for None, não precisa fazer nada
        if last_ping is None:
            continue
        
        # Se last_ping for uma string, tentar converter para datetime
        if isinstance(last_ping, str):
            try:
                # Tentar diferentes formatos de data
                try:
                    # Primeiro tentar com dateutil.parser que é mais flexível
                    parsed_date = parser.parse(last_ping)
                    iso_format = parsed_date.isoformat()
                    
                    # Atualizar o registro
                    cursor.execute(
                        "UPDATE players SET last_ping = ? WHERE id = ?",
                        (iso_format, player_id)
                    )
                    updated_count += 1
                    print(f"[MIGRATION] Player {player_id}: Convertido last_ping de '{last_ping}' para '{iso_format}'")
                    
                except Exception as e:
                    # Se last_ping contém palavras como 'offline', 'online', etc., definir como NULL
                    if any(status in last_ping.lower() for status in ['offline', 'online', 'syncing', 'error']):
                        cursor.execute(
                            "UPDATE players SET last_ping = NULL WHERE id = ?",
                            (player_id,)
                        )
                        updated_count += 1
                        print(f"[MIGRATION] Player {player_id}: Valor inválido '{last_ping}' definido como NULL")
                    else:
                        print(f"[MIGRATION] Player {player_id}: Erro ao converter last_ping '{last_ping}': {str(e)}")
                        error_count += 1
            
            except Exception as e:
                print(f"[MIGRATION] Player {player_id}: Erro ao processar last_ping '{last_ping}': {str(e)}")
                error_count += 1
    
    # Commit das alterações
    conn.commit()
    conn.close()
    
    print(f"[MIGRATION] Migração concluída: {updated_count} registros atualizados, {error_count} erros")

if __name__ == "__main__":
    run_migration()
