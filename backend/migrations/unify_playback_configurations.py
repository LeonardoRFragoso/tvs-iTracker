"""
Migração: Unificar Configurações de Reprodução
Data: 2025-09-25
Descrição: Move todas as configurações de reprodução da Campaign para Schedule,
           criando um local único e intuitivo para configurar como o conteúdo será reproduzido.
"""

import sqlite3
import os
import sys

def run_migration():
    """Executa a migração para unificar configurações de reprodução"""
    
    # Caminho para o banco de dados (Windows e Linux)
    db_paths = [
        # Caminhos relativos ao diretório raiz do projeto
        '../instance/tvs_platform.db',
        '../tvs_platform.db',
        'instance/tvs_platform.db',
        'tvs_platform.db',
        # Caminhos absolutos a partir do diretório migrations
        'backend/instance/tvs_platform.db',
        'backend/tvs_platform.db',
        # Caminhos para execução a partir do diretório raiz
        './backend/instance/tvs_platform.db',
        './backend/tvs_platform.db',
        './instance/tvs_platform.db',
        './tvs_platform.db'
    ]
    
    db_path = None
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ Banco de dados não encontrado!")
        print("🔍 Caminhos verificados:")
        for path in db_paths:
            exists = "✅" if os.path.exists(path) else "❌"
            abs_path = os.path.abspath(path)
            print(f"  {exists} {path} -> {abs_path}")
        print(f"📁 Diretório atual: {os.getcwd()}")
        return False
    
    print(f"🔄 Executando migração no banco: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("📋 Verificando estrutura atual...")
        
        # Verificar se as colunas já existem
        cursor.execute("PRAGMA table_info(schedules)")
        columns = [row[1] for row in cursor.fetchall()]
        
        new_columns = [
            'playback_mode',
            'content_duration', 
            'transition_duration',
            'loop_behavior',
            'loop_duration_minutes',
            'shuffle_enabled',
            'auto_skip_errors'
        ]
        
        # Adicionar novas colunas se não existirem
        for column in new_columns:
            if column not in columns:
                print(f"➕ Adicionando coluna: schedules.{column}")
                
                if column == 'playback_mode':
                    cursor.execute("ALTER TABLE schedules ADD COLUMN playback_mode TEXT DEFAULT 'sequential'")
                elif column == 'content_duration':
                    cursor.execute("ALTER TABLE schedules ADD COLUMN content_duration INTEGER DEFAULT 10")
                elif column == 'transition_duration':
                    cursor.execute("ALTER TABLE schedules ADD COLUMN transition_duration INTEGER DEFAULT 1")
                elif column == 'loop_behavior':
                    cursor.execute("ALTER TABLE schedules ADD COLUMN loop_behavior TEXT DEFAULT 'until_next'")
                elif column == 'loop_duration_minutes':
                    cursor.execute("ALTER TABLE schedules ADD COLUMN loop_duration_minutes INTEGER")
                elif column == 'shuffle_enabled':
                    cursor.execute("ALTER TABLE schedules ADD COLUMN shuffle_enabled BOOLEAN DEFAULT 0")
                elif column == 'auto_skip_errors':
                    cursor.execute("ALTER TABLE schedules ADD COLUMN auto_skip_errors BOOLEAN DEFAULT 1")
        
        # Migrar dados existentes das campanhas para os agendamentos
        print("🔄 Migrando configurações existentes...")
        
        # Buscar campanhas com configurações de reprodução
        cursor.execute("""
            SELECT id, playback_mode, content_duration, loop_enabled, shuffle_enabled 
            FROM campaigns 
            WHERE playback_mode IS NOT NULL OR content_duration IS NOT NULL
        """)
        
        campaigns_with_config = cursor.fetchall()
        
        if campaigns_with_config:
            print(f"📦 Encontradas {len(campaigns_with_config)} campanhas com configurações")
            
            for campaign in campaigns_with_config:
                campaign_id, playback_mode, content_duration, loop_enabled, shuffle_enabled = campaign
                
                # Atualizar agendamentos desta campanha
                update_values = []
                update_sql = "UPDATE schedules SET "
                
                if playback_mode:
                    # Converter loop_enabled para novo sistema
                    if loop_enabled:
                        if playback_mode == 'sequential':
                            playback_mode = 'loop_infinite'
                        update_values.append(f"loop_behavior = 'infinite'")
                    
                    update_values.append(f"playback_mode = '{playback_mode}'")
                
                if content_duration:
                    update_values.append(f"content_duration = {content_duration}")
                
                if shuffle_enabled:
                    update_values.append(f"shuffle_enabled = 1")
                
                if update_values:
                    update_sql += ", ".join(update_values)
                    update_sql += f" WHERE campaign_id = '{campaign_id}'"
                    
                    cursor.execute(update_sql)
                    print(f"  ✅ Migrado agendamentos da campanha: {campaign_id}")
        
        # Verificar se precisamos remover colunas antigas da tabela campaigns
        print("🧹 Limpando configurações antigas...")
        
        # SQLite não suporta DROP COLUMN, então vamos apenas marcar como deprecated
        # As colunas serão ignoradas pelo modelo atualizado
        
        conn.commit()
        print("✅ Migração concluída com sucesso!")
        
        # Verificar resultado
        cursor.execute("SELECT COUNT(*) FROM schedules WHERE playback_mode IS NOT NULL")
        migrated_count = cursor.fetchone()[0]
        print(f"📊 {migrated_count} agendamentos agora têm configurações de reprodução")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro durante migração: {e}")
        if 'conn' in locals():
            conn.rollback()
        return False
        
    finally:
        if 'conn' in locals():
            conn.close()

def rollback_migration():
    """Rollback da migração (limitado no SQLite)"""
    print("⚠️  SQLite não suporta rollback completo de ALTER TABLE")
    print("   As novas colunas permanecerão, mas serão ignoradas pelo modelo antigo")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == 'rollback':
        rollback_migration()
    else:
        run_migration()
