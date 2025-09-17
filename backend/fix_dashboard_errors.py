
#!/usr/bin/env python3
"""
fix_dashboard_errors.py

Diagnóstico e correção automática dos 500s no Dashboard (/api/dashboard/stats e /api/dashboard/alerts)
- Detecta o arquivo correto do banco (instance/tvs_platform.db preferencialmente)
- Verifica colunas necessárias em players e editorials
- Adiciona colunas que estiverem faltando (ALTER TABLE ... ADD COLUMN)
- Executa consultas básicas para validar
- Idempotente: seguro para rodar várias vezes
"""

import os
import sqlite3
from datetime import datetime, timedelta, timezone

REQUIRED_SCHEMA = {
    'players': {
        # Colunas usadas no dashboard
        'last_ping': 'DATETIME',
        'storage_used_gb': 'REAL DEFAULT 0.0',
        'storage_capacity_gb': 'INTEGER DEFAULT 32',
        'status': "TEXT DEFAULT 'offline'",
    },
    'editorials': {
        'is_active': 'BOOLEAN DEFAULT 1',
        'last_update': 'DATETIME',
        'last_error': 'TEXT',
    },
    # Campanhas: o dashboard agora é resiliente a ausência de datas,
    # mas podemos criar as colunas opcionalmente para futuras features.
    # 'campaigns': {
    #     'start_date': 'DATETIME',
    #     'end_date': 'DATETIME'
    # }
}

DB_CANDIDATES = [
    'instance/tvs_platform.db',
    'tvs_platform.db'
]


def pick_database():
    """Escolhe o caminho do banco com base na existência e na presença de tabelas."""
    existing = [p for p in DB_CANDIDATES if os.path.exists(p)]
    if not existing:
        return None

    # Preferir instance/
    if os.path.exists('instance/tvs_platform.db'):
        return 'instance/tvs_platform.db'
    return existing[0]


def get_columns(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cursor.fetchall()]


def ensure_columns(conn, cursor, table, columns_spec):
    try:
        existing_cols = get_columns(cursor, table)
    except sqlite3.OperationalError as e:
        print(f"   ❌ Tabela '{table}' não existe: {e}")
        return False

    ok = True
    for col, col_def in columns_spec.items():
        if col not in existing_cols:
            try:
                print(f"   ➕ Adicionando coluna {table}.{col} {col_def}")
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
            except Exception as e:
                ok = False
                print(f"   ❌ Falha ao adicionar {table}.{col}: {e}")
        else:
            print(f"   ✅ Coluna já existe: {table}.{col}")
    return ok


def diagnose_and_fix(db_path):
    print("🔍 Iniciando diagnóstico do dashboard")
    print(f"📁 Banco: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Verificar e corrigir schema
        print("\n📐 Verificando schema requerido...")
        schema_ok = True
        for table, cols in REQUIRED_SCHEMA.items():
            print(f"- Tabela: {table}")
            ok = ensure_columns(conn, cursor, table, cols)
            schema_ok = schema_ok and ok

        if schema_ok:
            print("\n✅ Schema verificado/ajustado com sucesso")
        else:
            print("\n⚠️  Houve falhas ao ajustar o schema. Verifique mensagens acima.")

        conn.commit()

        # Sanity checks mínimos que o dashboard usa
        print("\n🧪 Executando sanity checks...")
        def safe_count(sql):
            try:
                cursor.execute(sql)
                row = cursor.fetchone()
                return row[0] if row and row[0] is not None else 0
            except Exception as e:
                print(f"   ❌ Erro em '{sql}': {e}")
                return 0

        total_content = safe_count("SELECT COUNT(1) FROM contents WHERE is_active = 1")
        total_campaigns = safe_count("SELECT COUNT(1) FROM campaigns WHERE is_active = 1")
        total_players = safe_count("SELECT COUNT(1) FROM players")

        # players online: last_ping nos últimos 5 minutos
        try:
            five_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
            # Como SQLite salva sem timezone, comparar string ISO pode não funcionar.
            # Usaremos datetime('now','-5 minutes') do SQLite para comparação em SQL.
            online_players = safe_count(
                "SELECT COUNT(1) FROM players WHERE last_ping IS NOT NULL AND last_ping >= datetime('now','-5 minutes')"
            )
        except Exception:
            online_players = 0

        print(f"   • contents ativos: {total_content}")
        print(f"   • campanhas ativas: {total_campaigns}")
        print(f"   • players: {total_players} (online: {online_players})")

        # editorials com erro
        try:
            error_editorials = safe_count(
                "SELECT COUNT(1) FROM editorials WHERE is_active = 1 AND last_error IS NOT NULL AND last_error != ''"
            )
            print(f"   • editoriais com erro: {error_editorials}")
        except Exception as e:
            print(f"   ❌ Erro ao consultar editorials: {e}")

        print("\n🎯 Conclusão:")
        print("   - Se o schema foi ajustado acima, reinicie o backend e teste /api/dashboard/stats e /alerts")
        print("   - Este script é seguro para rodar novamente se necessário")

    finally:
        conn.commit()
        conn.close()


def main():
    db_path = pick_database()
    if not db_path:
        print("❌ Nenhum arquivo de banco de dados encontrado. Verifique a pasta 'backend/instance/'.")
        return

    diagnose_and_fix(db_path)


if __name__ == '__main__':
    main()