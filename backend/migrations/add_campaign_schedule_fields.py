#!/usr/bin/env python3
"""
Migração: Adiciona campos de agendamento às campanhas (start_date, end_date, priority, regions, time_slots, days_of_week)
- Idempotente
- Detecta automaticamente o banco correto (instance/tvs_platform.db > tvs_platform.db)
"""

import os
import sqlite3
from datetime import datetime

DB_CANDIDATES = [
    'instance/tvs_platform.db',
    'tvs_platform.db'
]

NEW_COLUMNS = [
    ('start_date', 'DATETIME'),
    ('end_date', 'DATETIME'),
    ('priority', 'INTEGER DEFAULT 1'),
    ('regions', 'TEXT DEFAULT NULL'),
    ('time_slots', 'TEXT DEFAULT NULL'),
    ('days_of_week', 'TEXT DEFAULT NULL'),
]

def pick_database():
    for path in DB_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def get_columns(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cursor.fetchall()]


def run_migration():
    db_path = pick_database()
    if not db_path:
        print("❌ Banco de dados não encontrado. Verifique a pasta 'backend/instance/'.")
        return False
    print(f"📁 Usando banco: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA table_info(campaigns)")
        cols = [c[1] for c in cursor.fetchall()]
        print(f"Colunas atuais em campaigns: {cols}")

        for col_name, col_def in NEW_COLUMNS:
            if col_name not in cols:
                print(f"➕ Adicionando coluna campaigns.{col_name} {col_def}")
                cursor.execute(f"ALTER TABLE campaigns ADD COLUMN {col_name} {col_def}")
            else:
                print(f"✅ Coluna já existe: {col_name}")

        conn.commit()
        print("\n✅ Migração concluída com sucesso!")
        print(f"📅 Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return True
    except Exception as e:
        print(f"❌ Erro durante migração: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


if __name__ == '__main__':
    run_migration()
