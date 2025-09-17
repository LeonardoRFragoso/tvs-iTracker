#!/usr/bin/env python3
"""
Migração: Suporte a Múltiplos Conteúdos por Campanha
Data: 2025-09-16
Descrição: Adiciona campos para permitir múltiplos conteúdos por campanha
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    """Executa a migração para suportar múltiplos conteúdos"""
    print("🔄 Iniciando migração: Suporte a Múltiplos Conteúdos por Campanha")
    print("=" * 70)
    
    # Detectar banco de dados correto
    db_paths = [
        'instance/tvs_platform.db',
        'tvs_platform.db'
    ]
    
    db_path = None
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ Banco de dados não encontrado!")
        return False
    
    print(f"📁 Usando banco: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n📊 Verificando estrutura atual...")
        
        # 1. Verificar se as colunas já existem
        cursor.execute("PRAGMA table_info(campaign_contents)")
        columns = [column[1] for column in cursor.fetchall()]
        print(f"Colunas atuais em campaign_contents: {columns}")
        
        # 2. Adicionar novas colunas à tabela campaign_contents
        new_columns = [
            ('order_index', 'INTEGER DEFAULT 0'),
            ('is_active', 'BOOLEAN DEFAULT 1'),
            ('duration_override', 'INTEGER DEFAULT NULL'),
            ('location_filter', 'TEXT DEFAULT NULL'),
            ('schedule_filter', 'TEXT DEFAULT NULL'),
            ('playback_settings', 'TEXT DEFAULT NULL')
        ]
        
        for column_name, column_def in new_columns:
            if column_name not in columns:
                print(f"➕ Adicionando coluna: {column_name}")
                cursor.execute(f"ALTER TABLE campaign_contents ADD COLUMN {column_name} {column_def}")
            else:
                print(f"✅ Coluna já existe: {column_name}")
        
        # 3. Verificar tabela campaigns
        cursor.execute("PRAGMA table_info(campaigns)")
        campaign_columns = [column[1] for column in cursor.fetchall()]
        print(f"Colunas atuais em campaigns: {campaign_columns}")
        
        # 4. Adicionar novas colunas à tabela campaigns
        campaign_new_columns = [
            ('playback_mode', 'TEXT DEFAULT "sequential"'),
            ('content_duration', 'INTEGER DEFAULT 10'),
            ('loop_enabled', 'BOOLEAN DEFAULT 0'),
            ('shuffle_enabled', 'BOOLEAN DEFAULT 0')
        ]
        
        for column_name, column_def in campaign_new_columns:
            if column_name not in campaign_columns:
                print(f"➕ Adicionando coluna à campaigns: {column_name}")
                cursor.execute(f"ALTER TABLE campaigns ADD COLUMN {column_name} {column_def}")
            else:
                print(f"✅ Coluna já existe em campaigns: {column_name}")
        
        # 5. Verificar tabela schedules
        cursor.execute("PRAGMA table_info(schedules)")
        schedule_columns = [column[1] for column in cursor.fetchall()]
        print(f"Colunas atuais em schedules: {schedule_columns}")
        
        # 6. Adicionar novas colunas à tabela schedules
        schedule_new_columns = [
            ('content_filter', 'TEXT DEFAULT NULL'),
            ('playback_mode_override', 'TEXT DEFAULT NULL'),
            ('content_selection', 'TEXT DEFAULT "all"')
        ]
        
        for column_name, column_def in schedule_new_columns:
            if column_name not in schedule_columns:
                print(f"➕ Adicionando coluna à schedules: {column_name}")
                cursor.execute(f"ALTER TABLE schedules ADD COLUMN {column_name} {column_def}")
            else:
                print(f"✅ Coluna já existe em schedules: {column_name}")
        
        # 7. Atualizar dados existentes
        print("\n🔄 Atualizando dados existentes...")
        
        # Definir order_index para conteúdos existentes
        cursor.execute("""
            UPDATE campaign_contents 
            SET order_index = 1, is_active = 1 
            WHERE order_index = 0 OR order_index IS NULL
        """)
        
        # Definir configurações padrão para campanhas existentes
        cursor.execute("""
            UPDATE campaigns 
            SET playback_mode = 'sequential', 
                content_duration = 10, 
                loop_enabled = 0, 
                shuffle_enabled = 0 
            WHERE playback_mode IS NULL
        """)
        
        # Definir configurações padrão para agendamentos existentes
        cursor.execute("""
            UPDATE schedules 
            SET content_selection = 'all' 
            WHERE content_selection IS NULL
        """)
        
        # 8. Criar índices para performance
        print("\n📈 Criando índices para performance...")
        
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_campaign_contents_order ON campaign_contents(campaign_id, order_index)",
            "CREATE INDEX IF NOT EXISTS idx_campaign_contents_active ON campaign_contents(campaign_id, is_active)",
            "CREATE INDEX IF NOT EXISTS idx_schedules_content_filter ON schedules(campaign_id, content_selection)"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
            print(f"✅ Índice criado")
        
        # 9. Verificar integridade dos dados
        print("\n🔍 Verificando integridade dos dados...")
        
        cursor.execute("""
            SELECT c.name, COUNT(cc.id) as content_count 
            FROM campaigns c 
            LEFT JOIN campaign_contents cc ON c.id = cc.campaign_id 
            WHERE cc.is_active = 1 OR cc.is_active IS NULL
            GROUP BY c.id, c.name
        """)
        
        campaigns_data = cursor.fetchall()
        print(f"📊 Resumo das campanhas:")
        for campaign_name, content_count in campaigns_data:
            print(f"   - {campaign_name}: {content_count} conteúdo(s)")
        
        conn.commit()
        conn.close()
        
        print(f"\n✅ Migração concluída com sucesso!")
        print(f"📅 Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return True
        
    except Exception as e:
        print(f"❌ Erro durante a migração: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False

def rollback_migration():
    """Rollback da migração (se necessário)"""
    print("⚠️  ATENÇÃO: Rollback não implementado para preservar dados existentes")
    print("💡 Se necessário, restaure backup do banco de dados")

if __name__ == "__main__":
    success = run_migration()
    if success:
        print("\n🎉 Sistema agora suporta múltiplos conteúdos por campanha!")
    else:
        print("\n❌ Migração falhou. Verifique os logs acima.")
