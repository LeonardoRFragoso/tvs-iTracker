#!/usr/bin/env python3
"""
Migra dados do SQLite (origem) para MariaDB/MySQL (destino) preservando IDs e datas.

Uso:
  python backend/tools/migrate_sqlite_to_mysql.py \
    --sqlite backend/instance/tvs_platform.db \
    --mysql-url "mysql+pymysql://user:pass@127.0.0.1:3306/tvs_itracker?charset=utf8mb4" \
    [--tables users,locations,players,contents,campaigns,campaign_contents,schedules,system_configs,playback_events,content_distributions]

Observações:
- Requer que o schema já exista no destino (rodar o app com MariaDB para executar db.create_all()).
- Executa upsert simples (se id existir, ignora/atualiza alguns campos básicos; caso contrário, insere).
- Converte datetimes/booleans de forma robusta.
"""
import os
import sys
import argparse
import sqlite3
from contextlib import closing
from datetime import datetime, time

try:
    from dateutil import parser as dtparser
except Exception:
    dtparser = None

# Inicializa a app/flask e ORM do destino (MariaDB)
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app  # noqa: E402
from database import db  # noqa: E402
from models.user import User  # noqa: E402
from models.location import Location  # noqa: E402
from models.player import Player  # noqa: E402
from models.content import Content  # noqa: E402
from models.campaign import Campaign, CampaignContent, PlaybackEvent  # noqa: E402
from models.schedule import Schedule  # noqa: E402
from models.system_config import SystemConfig  # noqa: E402
from models.content_distribution import ContentDistribution  # noqa: E402

MODEL_BY_TABLE = {
    'users': User,
    'locations': Location,
    'players': Player,
    'contents': Content,
    'campaigns': Campaign,
    'campaign_contents': CampaignContent,
    'schedules': Schedule,
    'system_configs': SystemConfig,
    'playback_events': PlaybackEvent,
    'content_distributions': ContentDistribution,
}

DEFAULT_ORDER = [
    'users',
    'locations',
    'players',
    'contents',
    'campaigns',
    'campaign_contents',
    'schedules',
    'system_configs',
    'playback_events',
    'content_distributions',
]

DATETIME_COLS = {
    'users': ['created_at', 'updated_at', 'last_login'],
    'locations': ['created_at', 'updated_at'],
    'players': ['created_at', 'updated_at', 'last_ping', 'last_content_sync', 'playback_start_time', 'last_playback_heartbeat'],
    'contents': ['created_at', 'updated_at', 'uploaded_at'],
    'campaigns': ['start_date', 'end_date', 'compiled_video_updated_at', 'created_at', 'updated_at'],
    'campaign_contents': ['created_at', 'updated_at'],
    'schedules': ['start_date', 'end_date', 'created_at', 'updated_at'],
    'system_configs': ['created_at', 'updated_at'],
    'playback_events': ['started_at'],
    'content_distributions': ['created_at', 'started_at', 'completed_at', 'scheduled_for', 'expires_at'],
}

TIME_COLS = {
    'locations': ['peak_hours_start', 'peak_hours_end'],
    'schedules': ['start_time', 'end_time'],
}

BOOL_COLS = {
    'users': ['is_active', 'must_change_password'],
    'locations': ['is_active'],
    'players': ['is_active', 'is_online', 'is_playing'],
    'campaigns': ['is_active', 'compiled_stale'],
    'campaign_contents': ['is_active'],
    'schedules': ['is_active', 'is_persistent', 'shuffle_enabled', 'auto_skip_errors'],
    'content_distributions': [],
}


def _parse_dt(value):
    if value is None or value == '':
        return None
    if isinstance(value, datetime):
        return value
    try:
        # Tentativas comuns
        if isinstance(value, (int, float)):
            # epoch seconds?
            try:
                return datetime.utcfromtimestamp(value)
            except Exception:
                pass
        s = str(value).replace('Z', '')
        # Alguns dumps podem vir como 'YYYY-MM-DD HH:MM:SS.ssssss'
        if dtparser:
            try:
                return dtparser.parse(s)
            except Exception:
                pass
        try:
            return datetime.fromisoformat(s.split('.')[0] if '.' in s else s)
        except Exception:
            return None
    except Exception:
        return None


def _parse_time(value):
    if value is None or value == '':
        return None
    if isinstance(value, time):
        return value
    try:
        s = str(value)
        if 'T' in s:
            s = s.split('T', 1)[-1]
        s = s.replace('Z', '')
        parts = s.split(':')
        h = int(parts[0]); m = int(parts[1]) if len(parts) > 1 else 0; sec = int(parts[2]) if len(parts) > 2 else 0
        return time(h, m, sec)
    except Exception:
        return None


def _parse_bool(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    return s in ('1', 'true', 't', 'y', 'yes', 'sim')


def fetch_rows(sqlite_path: str, table: str):
    with closing(sqlite3.connect(sqlite_path)) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(f'SELECT * FROM {table}')
        rows = cur.fetchall()
        return [dict(r) for r in rows]


def migrate_table(sqlite_path: str, table: str, dry_run: bool = False):
    Model = MODEL_BY_TABLE.get(table)
    if not Model:
        print(f"[SKIP] Tabela não mapeada: {table}")
        return 0

    src_rows = fetch_rows(sqlite_path, table)
    if not src_rows:
        print(f"[OK] {table}: 0 linhas para migrar")
        return 0

    dest_cols = set(Model.__table__.columns.keys())
    dt_cols = set(DATETIME_COLS.get(table, []))
    tm_cols = set(TIME_COLS.get(table, []))
    bl_cols = set(BOOL_COLS.get(table, []))

    migrated = 0
    with app.app_context():
        for row in src_rows:
            data = {}
            for col in dest_cols:
                if col not in row:
                    continue
                val = row[col]
                if col in dt_cols:
                    val = _parse_dt(val)
                elif col in tm_cols:
                    val = _parse_time(val)
                elif col in bl_cols:
                    bv = _parse_bool(val)
                    # Se a origem não tinha a coluna, manter None; caso contrário Boolean
                    val = bv if val is not None else None
                data[col] = val

            # Upsert simples pelo PK 'id' quando existir
            identity = data.get('id')
            try:
                existing = None
                if identity is not None:
                    existing = db.session.get(Model, identity)
                if existing:
                    for k, v in data.items():
                        try:
                            setattr(existing, k, v)
                        except Exception:
                            pass
                else:
                    obj = Model(**data)
                    db.session.add(obj)
                migrated += 1
                if migrated % 500 == 0:
                    db.session.flush()
            except Exception as e:
                print(f"[WARN] Falha ao migrar linha em {table} (id={identity}): {e}")
        try:
            db.session.commit()
        except Exception as e:
            print(f"[ERRO] Commit falhou para {table}: {e}")
            db.session.rollback()
    print(f"[OK] {table}: {migrated} linhas migradas")
    return migrated


def main():
    parser = argparse.ArgumentParser(description='Migrar dados do SQLite para MariaDB/MySQL')
    parser.add_argument('--sqlite', required=True, help='Caminho do SQLite de origem (ex.: backend/instance/tvs_platform.db)')
    parser.add_argument('--mysql-url', required=False, help='URL de conexão destino; se ausente, usa DATABASE_URL do app')
    parser.add_argument('--tables', required=False, help='Lista separada por vírgulas de tabelas; padrão ALL em ordem segura')
    args = parser.parse_args()

    sqlite_path = os.path.abspath(args.sqlite)
    if not os.path.exists(sqlite_path):
        print('[ERRO] SQLite não encontrado:', sqlite_path)
        sys.exit(1)

    # Validar dialeto destino e garantir schema criado
    with app.app_context():
        engine = db.engine
        if not (engine.dialect.name or '').startswith('mysql'):
            print(f"[ERRO] Dialeto destino não é MySQL/MariaDB: {engine.dialect.name}")
            print('       Ajuste a variável DATABASE_URL antes de rodar este script.')
            sys.exit(2)
        try:
            print('[INIT] Criando schema no destino (db.create_all)...')
            db.create_all()
            print('[INIT] Schema criado/garantido com sucesso.')
        except Exception as e:
            print(f'[WARN] Falha ao garantir schema com create_all: {e}')

    tables = [t.strip() for t in (args.tables.split(',') if args.tables else DEFAULT_ORDER)]

    total = 0
    for t in tables:
        total += migrate_table(sqlite_path, t)

    print('\nResumo:')
    print(f'  Total migrado: {total} linhas em {len(tables)} tabelas')


if __name__ == '__main__':
    main()
