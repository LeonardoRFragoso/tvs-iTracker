#!/usr/bin/env python3
"""
Script de teste para verificar se as colunas de telemetria são adicionadas automaticamente
"""

import os
import sys
import sqlite3
from datetime import datetime

# Adicionar o diretório backend ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_telemetry_columns():
    """Testa se as colunas de telemetria são adicionadas automaticamente"""
    
    print("🔍 Testando adição automática de colunas de telemetria...")
    
    # Caminhos possíveis para o banco de dados
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
    
    print(f"📂 Usando banco: {db_path}")
    
    try:
        # Conectar ao banco
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar se a tabela players existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='players'")
        if not cursor.fetchone():
            print("❌ Tabela 'players' não encontrada!")
            return False
        
        # Verificar colunas atuais da tabela players
        cursor.execute("PRAGMA table_info(players)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        print(f"📋 Colunas atuais na tabela players: {len(column_names)}")
        
        # Colunas de telemetria que devem existir
        telemetry_columns = [
            'current_content_id',
            'current_content_title', 
            'current_content_type',
            'current_campaign_id',
            'current_campaign_name',
            'is_playing',
            'playback_start_time',
            'last_playback_heartbeat'
        ]
        
        # Verificar quais colunas estão faltando
        missing_columns = []
        existing_telemetry = []
        
        for col in telemetry_columns:
            if col in column_names:
                existing_telemetry.append(col)
            else:
                missing_columns.append(col)
        
        print(f"✅ Colunas de telemetria existentes: {len(existing_telemetry)}")
        for col in existing_telemetry:
            print(f"   - {col}")
        
        if missing_columns:
            print(f"❌ Colunas de telemetria faltando: {len(missing_columns)}")
            for col in missing_columns:
                print(f"   - {col}")
        else:
            print("🎉 Todas as colunas de telemetria estão presentes!")
        
        # Testar se conseguimos fazer uma query que causaria o erro original
        try:
            cursor.execute("""
                SELECT current_content_id, current_content_title, is_playing, 
                       playback_start_time, last_playback_heartbeat 
                FROM players 
                LIMIT 1
            """)
            result = cursor.fetchone()
            print("✅ Query de telemetria executada com sucesso!")
            
        except sqlite3.OperationalError as e:
            if "no such column" in str(e):
                print(f"❌ Erro de coluna ausente: {e}")
                return False
            else:
                raise
        
        conn.close()
        
        # Resultado final
        if missing_columns:
            print(f"\n⚠️  ATENÇÃO: {len(missing_columns)} colunas ainda estão faltando!")
            print("   A função _ensure_schema_columns() deve ser executada na inicialização do Flask.")
            return False
        else:
            print("\n🎉 SUCESSO: Todas as colunas de telemetria estão presentes!")
            print("   O erro de criação de empresa NÃO deve acontecer na VM.")
            return True
            
    except Exception as e:
        print(f"❌ Erro durante teste: {e}")
        return False

def simulate_location_creation():
    """Simula a criação de uma empresa para verificar se o erro ocorreria"""
    
    print("\n🧪 Simulando criação de empresa...")
    
    try:
        # Importar Flask app
        from app import app, db
        from models.location import Location
        from models.player import Player
        
        with app.app_context():
            # Criar uma localização de teste
            test_location = Location(
                name="Teste Empresa",
                address="Rua Teste, 123",
                company="iTracker"
            )
            
            db.session.add(test_location)
            db.session.flush()  # Para obter o ID
            
            # Tentar fazer uma query que causaria o erro original
            # (buscar players da localização)
            players = Player.query.filter_by(location_id=test_location.id).all()
            
            print(f"✅ Query de players executada com sucesso! Encontrados: {len(players)} players")
            
            # Rollback para não salvar dados de teste
            db.session.rollback()
            
            return True
            
    except Exception as e:
        print(f"❌ Erro durante simulação: {e}")
        if "no such column" in str(e):
            print("   Este é exatamente o erro que aconteceria na VM!")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("TESTE DE COLUNAS DE TELEMETRIA")
    print("=" * 60)
    
    # Teste 1: Verificar colunas no banco
    success1 = test_telemetry_columns()
    
    # Teste 2: Simular criação de empresa
    success2 = simulate_location_creation()
    
    print("\n" + "=" * 60)
    print("RESULTADO FINAL")
    print("=" * 60)
    
    if success1 and success2:
        print("🎉 TODOS OS TESTES PASSARAM!")
        print("   O erro NÃO deve acontecer na VM em produção.")
    else:
        print("❌ ALGUNS TESTES FALHARAM!")
        print("   O erro PODE acontecer na VM em produção.")
        
    print(f"\nTeste executado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
