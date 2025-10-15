from datetime import datetime, timezone, timedelta
from sqlalchemy import text

from database import db
from models.player import Player
from models.system_config import SystemConfig

from .state import TRAFFIC_STATS, TRAFFIC_MINUTE, TRAFFIC_LOCK
from .utils import collect_system_stats


def _ensure_network_tables():
    try:
        engine = db.engine
        with engine.connect() as conn:
            for table, ts_col in [
                ('network_samples_minute', 'ts_minute'),
                ('network_samples_hour', 'ts_hour'),
                ('network_samples_day', 'ts_day')
            ]:
                conn.execute(text(f'''\
                    CREATE TABLE IF NOT EXISTS {table} (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        player_id TEXT NOT NULL,
                        {ts_col} TEXT NOT NULL,
                        bytes INTEGER DEFAULT 0,
                        requests INTEGER DEFAULT 0,
                        video INTEGER DEFAULT 0,
                        image INTEGER DEFAULT 0,
                        audio INTEGER DEFAULT 0,
                        other INTEGER DEFAULT 0,
                        ip TEXT,
                        company TEXT,
                        location_id TEXT
                    )
                '''))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS idx_{table[17:]}_ts ON {table}({ts_col})'))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS idx_{table[17:]}_player_ts ON {table}(player_id, {ts_col})'))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS idx_{table[17:]}_company_ts ON {table}(company, {ts_col})'))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS idx_{table[17:]}_location_ts ON {table}(location_id, {ts_col})'))
    except Exception as e:
        print(f"[Monitor] Falha ao garantir tabelas de samples: {e}")


def flush_traffic_minute_now():
    try:
        with TRAFFIC_LOCK:
            snapshot = {pid: dict(buckets) for pid, buckets in TRAFFIC_MINUTE.items()}
            TRAFFIC_MINUTE.clear()
        if not snapshot:
            return
        enabled = SystemConfig.get_value('monitor.enable_persist', True)
        if str(enabled).lower() not in ['1', 'true', 'yes']:
            return
        _ensure_network_tables()
        for pid, buckets in snapshot.items():
            try:
                player = db.session.get(Player, pid)
                company = getattr(player, 'company', None)
                location_id = getattr(player, 'location_id', None)
            except Exception:
                player = None
                company = None
                location_id = None
            for ts_minute, data in buckets.items():
                try:
                    db.session.execute(text('''\
                        INSERT INTO network_samples_minute (
                            player_id, ts_minute, bytes, requests, video, image, audio, other, ip, company, location_id
                        ) VALUES (:player_id, :ts_minute, :bytes, :requests, :video, :image, :audio, :other, :ip, :company, :location_id)
                    '''), {
                        'player_id': str(pid),
                        'ts_minute': ts_minute,
                        'bytes': int(data.get('bytes', 0)),
                        'requests': int(data.get('requests', 0)),
                        'video': int(data.get('by_type', {}).get('video', 0)),
                        'image': int(data.get('by_type', {}).get('image', 0)),
                        'audio': int(data.get('by_type', {}).get('audio', 0)),
                        'other': int(data.get('by_type', {}).get('other', 0)),
                        'ip': getattr(player, 'ip_address', None) if player else None,
                        'company': company,
                        'location_id': str(location_id) if location_id else None
                    })
                except Exception as ie:
                    print(f"[Monitor] Falha ao inserir sample minuto para pid={pid}: {ie}")
        try:
            db.session.commit()
        except Exception as ce:
            print(f"[Monitor] Commit falhou nos samples minuto: {ce}")
            db.session.rollback()
    except Exception as e:
        print(f"[Monitor] Flush minuto falhou: {e}")


def aggregate_minute_to_hour():
    try:
        _ensure_network_tables()
        now = datetime.now(timezone.utc)
        start = (now - timedelta(hours=6)).isoformat()
        sql = text('''\
            SELECT player_id,
                   SUBSTR(ts_minute, 1, 13) AS hour_key,
                   SUM(bytes) AS bytes, SUM(requests) AS requests,
                   SUM(video) AS video, SUM(image) AS image,
                   SUM(audio) AS audio, SUM(other) AS other,
                   MAX(company) AS company, MAX(location_id) AS location_id, MAX(ip) AS ip
            FROM network_samples_minute
            WHERE ts_minute >= :start
            GROUP BY player_id, hour_key
        ''')
        rows = db.session.execute(sql, {'start': start}).fetchall()
        for r in rows:
            player_id, hour_key = r[0], r[1]
            ts_hour = f"{hour_key}:00:00+00:00"
            try:
                db.session.execute(text('DELETE FROM network_samples_hour WHERE player_id = :pid AND ts_hour = :th'),
                                   {'pid': str(player_id), 'th': ts_hour})
                db.session.execute(text('''\
                    INSERT INTO network_samples_hour (
                        player_id, ts_hour, bytes, requests, video, image, audio, other, ip, company, location_id
                    ) VALUES (:player_id, :ts_hour, :bytes, :requests, :video, :image, :audio, :other, :ip, :company, :location_id)
                '''), {
                    'player_id': str(player_id), 'ts_hour': ts_hour,
                    'bytes': int(r[2] or 0), 'requests': int(r[3] or 0),
                    'video': int(r[4] or 0), 'image': int(r[5] or 0),
                    'audio': int(r[6] or 0), 'other': int(r[7] or 0),
                    'ip': r[10], 'company': r[8], 'location_id': r[9]
                })
            except Exception as ie:
                print(f"[Agg m2h] Falha ao inserir hour pid={player_id} {ts_hour}: {ie}")
        try:
            db.session.commit()
        except Exception as ce:
            print(f"[Agg m2h] Commit falhou: {ce}")
            db.session.rollback()
    except Exception as e:
        print(f"[Agg m2h] Erro: {e}")


def aggregate_hour_to_day():
    try:
        _ensure_network_tables()
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=3)).isoformat()
        sql = text('''\
            SELECT player_id,
                   SUBSTR(ts_hour, 1, 10) AS day_key,
                   SUM(bytes) AS bytes, SUM(requests) AS requests,
                   SUM(video) AS video, SUM(image) AS image,
                   SUM(audio) AS audio, SUM(other) AS other,
                   MAX(company) AS company, MAX(location_id) AS location_id, MAX(ip) AS ip
            FROM network_samples_hour
            WHERE ts_hour >= :start
            GROUP BY player_id, day_key
        ''')
        rows = db.session.execute(sql, {'start': start}).fetchall()
        for r in rows:
            player_id, day_key = r[0], r[1]
            ts_day = f"{day_key}T00:00:00+00:00"
            try:
                db.session.execute(text('DELETE FROM network_samples_day WHERE player_id = :pid AND ts_day = :td'),
                                   {'pid': str(player_id), 'td': ts_day})
                db.session.execute(text('''\
                    INSERT INTO network_samples_day (
                        player_id, ts_day, bytes, requests, video, image, audio, other, ip, company, location_id
                    ) VALUES (:player_id, :ts_day, :bytes, :requests, :video, :image, :audio, :other, :ip, :company, :location_id)
                '''), {
                    'player_id': str(player_id), 'ts_day': ts_day,
                    'bytes': int(r[2] or 0), 'requests': int(r[3] or 0),
                    'video': int(r[4] or 0), 'image': int(r[5] or 0),
                    'audio': int(r[6] or 0), 'other': int(r[7] or 0),
                    'ip': r[10], 'company': r[8], 'location_id': r[9]
                })
            except Exception as ie:
                print(f"[Agg h2d] Falha ao inserir day pid={player_id} {ts_day}: {ie}")
        try:
            db.session.commit()
        except Exception as ce:
            print(f"[Agg h2d] Commit falhou: {ce}")
            db.session.rollback()
    except Exception as e:
        print(f"[Agg h2d] Erro: {e}")


def retention_cleanup():
    try:
        days = int(SystemConfig.get_value('monitor.sample_retention_days', 30) or 30)
        now = datetime.now(timezone.utc)
        cutoff = (now - timedelta(days=days)).isoformat()
        for table, col in [
            ('network_samples_minute', 'ts_minute'),
            ('network_samples_hour', 'ts_hour'),
            ('network_samples_day', 'ts_day'),
        ]:
            try:
                db.session.execute(text(f"DELETE FROM {table} WHERE {col} < :cutoff"), {'cutoff': cutoff})
            except Exception as de:
                print(f"[Retention] Falha ao limpar {table}: {de}")
        try:
            db.session.commit()
        except Exception as ce:
            print(f"[Retention] Commit falhou: {ce}")
            db.session.rollback()
    except Exception as e:
        print(f"[Retention] Erro: {e}")


def emit_traffic_stats_job(socketio):
    try:
        snapshot = {
            'since': TRAFFIC_STATS.get('since'),
            'total_bytes': TRAFFIC_STATS.get('total_bytes', 0),
            'players': TRAFFIC_STATS.get('players', {})
        }
        socketio.emit('traffic_stats', snapshot, room='admin')
    except Exception as e:
        print(f"[Traffic] Falha ao emitir estatísticas: {e}")


def sync_player_statuses_job(app):
    try:
        with app.app_context():
            enabled = SystemConfig.get_value('general.auto_sync')
            if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True or enabled is None:
                from services.auto_sync_service import auto_sync_service
                auto_sync_service.sync_all_players()
            else:
                print("[AutoSync] Ignorado (general.auto_sync = false)")
    except Exception as e:
        print(f"[AutoSync] Falha ao sincronizar players: {e}")


def check_schedules_with_context(app):
    try:
        print(f"[{datetime.now(timezone.utc)}] Executando verificação de agendamentos...")
        with app.app_context():
            from services.schedule_executor import schedule_executor
            schedule_executor.check_and_execute_schedules()
    except Exception as e:
        print(f"[Scheduler] Erro no check_and_execute_schedules: {e}")


def emit_system_stats_job(socketio):
    try:
        enabled = SystemConfig.get_value('monitor.enable_system_stats', True)
        if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True:
            socketio.emit('system_stats', collect_system_stats(), room='admin')
    except Exception as e:
        print(f"[System] Falha ao emitir métricas: {e}")


def configure_scheduler_jobs(scheduler, app, socketio):
    try:
        print("[Scheduler] Configurando jobs...")
        if not scheduler.get_job('schedule_checker'):
            scheduler.add_job(
                func=lambda: check_schedules_with_context(app),
                trigger="interval",
                minutes=1,
                id='schedule_checker',
                name='Verificar e executar agendamentos',
                replace_existing=True
            )
        try:
            emit_interval = int(SystemConfig.get_value('monitor.emit_interval_sec', 30) or 30)
        except Exception:
            emit_interval = 30
        if not scheduler.get_job('traffic_stats_emitter'):
            scheduler.add_job(
                func=lambda: emit_traffic_stats_job(socketio),
                trigger="interval",
                seconds=emit_interval,
                id='traffic_stats_emitter',
                name='Emitir estatísticas de tráfego para admins',
                replace_existing=True
            )
        if not scheduler.get_job('player_status_sync'):
            scheduler.add_job(
                func=lambda: sync_player_statuses_job(app),
                trigger="interval",
                minutes=1,
                id='player_status_sync',
                name='Sincronizar status dos players',
                replace_existing=True
            )
        if not scheduler.get_job('traffic_minute_flush'):
            scheduler.add_job(
                func=flush_traffic_minute_now,
                trigger='interval',
                seconds=60,
                id='traffic_minute_flush',
                name='Persistir buckets de tráfego por minuto',
                replace_existing=True
            )
        if not scheduler.get_job('agg_minute_hour'):
            scheduler.add_job(
                func=aggregate_minute_to_hour,
                trigger='interval',
                minutes=5,
                id='agg_minute_hour',
                name='Agregação minute->hour (lookback 6h)',
                replace_existing=True
            )
        if not scheduler.get_job('agg_hour_day'):
            scheduler.add_job(
                func=aggregate_hour_to_day,
                trigger='interval',
                hours=1,
                id='agg_hour_day',
                name='Agregação hour->day (lookback 3d)',
                replace_existing=True
            )
        if not scheduler.get_job('retention_cleanup'):
            scheduler.add_job(
                func=retention_cleanup,
                trigger='cron',
                hour=3,
                minute=15,
                id='retention_cleanup',
                name='Limpeza por retenção (samples antigas)',
                replace_existing=True
            )
        if not scheduler.get_job('system_stats_emitter'):
            scheduler.add_job(
                func=lambda: emit_system_stats_job(socketio),
                trigger='interval',
                seconds=int(SystemConfig.get_value('monitor.emit_interval_sec', 30) or 30),
                id='system_stats_emitter',
                name='Emitir métricas do sistema para admins',
                replace_existing=True
            )
        print(f"[Scheduler] {len(scheduler.get_jobs())} jobs configurados")
    except Exception as e:
        print(f"[Scheduler] Erro ao configurar jobs: {e}")
