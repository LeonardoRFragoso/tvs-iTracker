from sqlalchemy import text
from database import db


def ensure_schema_columns():
    """Garante colunas necessárias no schema e códigos de acesso em players.
    Esta função replica a lógica de bootstrap usada anteriormente no app monolítico.
    """
    try:
        engine = db.engine
        with engine.connect() as conn:
            table_columns = {
                'users': [
                    ('company', 'VARCHAR(100)', 'iTracker'),
                    ('status', 'VARCHAR(20)', 'active'),
                    ('must_change_password', 'BOOLEAN', '0')
                ],
                'locations': [('company', 'VARCHAR(100)', 'iTracker')],
                'location': [('company', 'VARCHAR(100)', 'iTracker')],  # fallback
                'players': [
                    ('current_content_id', 'VARCHAR(36)', None),
                    ('current_content_title', 'VARCHAR(255)', None),
                    ('current_content_type', 'VARCHAR(50)', None),
                    ('current_campaign_id', 'VARCHAR(36)', None),
                    ('current_campaign_name', 'VARCHAR(255)', None),
                    ('is_playing', 'BOOLEAN', '0'),
                    ('playback_start_time', 'DATETIME', None),
                    ('last_playback_heartbeat', 'DATETIME', None)
                ]
            }

            for table, columns in table_columns.items():
                try:
                    result = conn.execute(text(f"PRAGMA table_info({table})"))
                    rows = result.fetchall()
                    if rows:
                        existing_cols = [r[1] for r in rows]
                        for col_name, col_type, default_val in columns:
                            if col_name not in existing_cols:
                                if default_val is None:
                                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
                                else:
                                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT '{default_val}'"))
                except Exception as te:
                    print(f"[DB] Erro ao processar tabela {table}: {te}")

            # Garantir access_code em players (ou player)
            for table in ['players', 'player']:
                try:
                    result = conn.execute(text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"))
                    if result.fetchone():
                        info = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
                        colnames = [r[1] for r in info]
                        if 'access_code' not in colnames:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN access_code VARCHAR(12)"))
                            try:
                                conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{table}_access_code ON {table} (access_code)"))
                            except Exception:
                                pass
                            # Backfill códigos
                            import random
                            ALPHABET = '23456789'
                            def gen_code(n=6):
                                return ''.join(random.choice(ALPHABET) for _ in range(n))
                            ids = conn.execute(text(f"SELECT id FROM {table} WHERE access_code IS NULL OR access_code = ''")).fetchall()
                            for (pid,) in ids:
                                attempts = 0
                                while attempts < 20:
                                    code = gen_code(6)
                                    try:
                                        conn.execute(text(f"UPDATE {table} SET access_code = :code WHERE id = :pid"), {'code': code, 'pid': pid})
                                        break
                                    except Exception:
                                        attempts += 1
                        break
                except Exception:
                    continue
    except Exception as e:
        print(f"[DB] Erro ao garantir schema: {e}")
