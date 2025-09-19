#!/usr/bin/env python3
"""
Migração: Adicionar access_code aos players para URL curta /k/<code>
Data: 2025-09-18
Descrição: Adiciona coluna access_code, cria índice único e preenche códigos para registros existentes.
"""

import sqlite3
import os
import string
import random
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))  # backend/
DB_CANDIDATES = [
    os.path.join(BASE_DIR, 'instance', 'tvs_platform.db'),
    os.path.join(BASE_DIR, 'tvs_platform.db'),
]

def _choose_db():
    for path in DB_CANDIDATES:
        # Normalize to absolute paths
        apath = os.path.abspath(path)
        if os.path.exists(apath):
            print(f"📁 Candidato encontrado: {apath}")
            return apath
    return None

def _get_columns(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cursor.fetchall()]

def _ensure_column(conn, cursor, table):
    cols = _get_columns(cursor, table)
    if 'access_code' not in cols:
        print(f"➕ Adicionando coluna access_code na tabela {table}...")
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN access_code TEXT")
        conn.commit()
        return True
    print(f"✅ Coluna access_code já existe em {table}")
    return False

ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # sem caracteres ambíguos

def _gen_code(n=6):
    return ''.join(random.choice(ALPHABET) for _ in range(n))

def _backfill_codes(conn, cursor, table):
    print(f"🔄 Preenchendo access_code para registros existentes em {table}...")
    # Coletar códigos existentes
    cursor.execute(f"SELECT access_code FROM {table} WHERE access_code IS NOT NULL AND access_code != ''")
    existing = set([row[0] for row in cursor.fetchall() if row[0]])

    # Selecionar linhas sem código
    cursor.execute(f"SELECT id FROM {table} WHERE access_code IS NULL OR access_code = ''")
    rows = [row[0] for row in cursor.fetchall()]

    updated = 0
    for pid in rows:
        # Gerar código único
        code = _gen_code(6)
        attempts = 0
        while code in existing and attempts < 20:
            code = _gen_code(6)
            attempts += 1
        existing.add(code)
        cursor.execute(f"UPDATE {table} SET access_code = ? WHERE id = ?", (code, pid))
        updated += 1

    conn.commit()
    print(f"✅ {updated} registros atualizados com access_code")


def run_migration():
    print("🔧 Migração: Adicionar access_code aos players")
    db_path = _choose_db()
    if not db_path:
        print("❌ Banco de dados não encontrado")
        return False

    print(f"📁 Usando banco: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Detectar qual tabela usar (preferir 'players')
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        player_table = 'players' if 'players' in tables else ('player' if 'player' in tables else None)
        if not player_table:
            print("❌ Tabela de players não encontrada (esperado 'players' ou 'player')")
            return False

        # Garantir coluna e índice
        _ensure_column(conn, cursor, player_table)
        try:
            cursor.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{player_table}_access_code ON {player_table} (access_code)")
            conn.commit()
            print(f"✅ Índice único criado: idx_{player_table}_access_code")
        except Exception as e:
            print(f"⚠️ Falha ao criar índice (pode já existir): {e}")

        # Preencher códigos
        _backfill_codes(conn, cursor, player_table)

        conn.close()
        print("🎉 Migração concluída com sucesso!")
        return True
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
        conn.rollback()
        conn.close()
        return False

if __name__ == '__main__':
    run_migration()
