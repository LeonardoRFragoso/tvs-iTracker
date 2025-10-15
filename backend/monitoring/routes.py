from datetime import datetime, timezone, timedelta
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text

from database import db
from models.user import User
from models.player import Player
from models.system_config import SystemConfig

from .state import TRAFFIC_STATS, TRAFFIC_MINUTE, TRAFFIC_LOCK
from .utils import collect_system_stats


# Helpers locais

def _traffic_snapshot():
    with TRAFFIC_LOCK:
        return {
            'since': TRAFFIC_STATS.get('since'),
            'total_bytes': TRAFFIC_STATS.get('total_bytes', 0),
            'players': TRAFFIC_STATS.get('players', {})
        }


def register_monitoring_routes(app):
    @app.route('/api/monitor/traffic', methods=['GET'])
    @jwt_required()
    def monitor_traffic():  # noqa: F401
        try:
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role != 'admin':
                return jsonify({'error': 'Sem permissão'}), 403

            window_min = int(SystemConfig.get_value('monitor.overuse_window_min', 1) or 1)
            try:
                overuse_bpm_mb = float(SystemConfig.get_value('monitor.overuse_bpm_mb', 100) or 100)
                overuse_bpm_bytes = int(overuse_bpm_mb * 1024 * 1024)
            except Exception:
                overuse_bpm_bytes = 100 * 1024 * 1024
            try:
                overuse_rpm = int(SystemConfig.get_value('monitor.overuse_rpm', 300) or 300)
            except Exception:
                overuse_rpm = 300

            snapshot = _traffic_snapshot()

            now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
            minute_keys = [(now - timedelta(minutes=i)).isoformat() for i in range(window_min)]
            overuse_players = []
            recent_players = {}

            with TRAFFIC_LOCK:
                for pid, buckets in TRAFFIC_MINUTE.items():
                    sum_bytes = sum(buckets.get(mk, {}).get('bytes', 0) for mk in minute_keys)
                    sum_requests = sum(buckets.get(mk, {}).get('requests', 0) for mk in minute_keys)
                    bpm = sum_bytes / max(1, window_min)
                    rpm = sum_requests / max(1, window_min)
                    recent_players[pid] = {
                        'bytes': sum_bytes, 'requests': sum_requests,
                        'bytes_per_min': bpm, 'rpm': rpm
                    }
                    if bpm > overuse_bpm_bytes or rpm > overuse_rpm:
                        overuse_players.append({
                            'player_id': pid, 'bytes_per_min': bpm, 'rpm': rpm,
                            'bytes': sum_bytes, 'requests': sum_requests
                        })

            snapshot.update({
                'recent_window_min': window_min,
                'thresholds': {'overuse_bpm_bytes': overuse_bpm_bytes, 'overuse_rpm': overuse_rpm},
                'recent': {'players': recent_players},
                'overuse_players': overuse_players
            })

            if request.args.get('reset') == 'true':
                with TRAFFIC_LOCK:
                    TRAFFIC_STATS.update({
                        'players': {}, 'total_bytes': 0,
                        'since': datetime.now(timezone.utc).isoformat()
                    })
                    TRAFFIC_MINUTE.clear()

            return jsonify(snapshot), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/monitor/players', methods=['GET'])
    @jwt_required()
    def monitor_players():  # noqa: F401
        try:
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role != 'admin':
                return jsonify({'error': 'Sem permissão'}), 403

            try:
                players = Player.query.order_by(Player.created_at.desc()).all()
            except Exception:
                players = Player.query.all()

            from realtime.state import CONNECTED_PLAYERS
            items = [{
                'id': str(p.id),
                'name': p.name,
                'status': getattr(p, 'status', None) or 'offline',
                'last_ping': (p.last_ping.isoformat() if getattr(p, 'last_ping', None) else None),
                'socket_connected': str(p.id) in CONNECTED_PLAYERS,
                'socket_last_seen': CONNECTED_PLAYERS.get(str(p.id), {}).get('last_seen')
            } for p in players]

            return jsonify({'players': items, 'connected_count': len(CONNECTED_PLAYERS)}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/monitor/traffic/timeseries', methods=['GET'])
    @jwt_required()
    def monitor_traffic_timeseries():  # noqa: F401
        try:
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role not in ['admin', 'manager', 'rh']:
                return jsonify({'error': 'Sem permissão'}), 403

            try:
                import dateutil.parser as _p
            except Exception:
                _p = None

            q_from = request.args.get('from')
            q_to = request.args.get('to')
            group_by = (request.args.get('group_by') or 'minute').lower()
            player_id = request.args.get('player_id')
            company = request.args.get('company')
            location_id = request.args.get('location_id')

            if group_by == 'hour':
                table, ts_col = 'network_samples_hour', 'ts_hour'
            elif group_by == 'day':
                table, ts_col = 'network_samples_day', 'ts_day'
            else:
                table, ts_col = 'network_samples_minute', 'ts_minute'

            def _iso(dt):
                if not dt:
                    return None
                try:
                    if _p:
                        return _p.isoparse(dt).isoformat()
                except Exception:
                    pass
                try:
                    d = dt.replace('Z', '')
                    return datetime.fromisoformat(d).isoformat()
                except Exception:
                    return dt

            params = {}
            clauses = []
            if q_from:
                clauses.append(f"{ts_col} >= :from"); params['from'] = _iso(q_from)
            if q_to:
                clauses.append(f"{ts_col} <= :to"); params['to'] = _iso(q_to)
            if player_id:
                clauses.append("player_id = :player_id"); params['player_id'] = str(player_id)
            if company:
                clauses.append("company = :company"); params['company'] = company
            if location_id:
                clauses.append("location_id = :location_id"); params['location_id'] = str(location_id)

            where_sql = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            sql = text(f"""
                SELECT {ts_col} AS ts,
                       SUM(bytes) AS bytes, SUM(requests) AS requests,
                       SUM(video) AS video, SUM(image) AS image,
                       SUM(audio) AS audio, SUM(other) AS other
                FROM {table}
                {where_sql}
                GROUP BY {ts_col}
                ORDER BY {ts_col} ASC
            """)
            rows = db.session.execute(sql, params).fetchall()
            series = [{
                'ts': r[0], 'bytes': int(r[1] or 0), 'requests': int(r[2] or 0),
                'video': int(r[3] or 0), 'image': int(r[4] or 0),
                'audio': int(r[5] or 0), 'other': int(r[6] or 0)
            } for r in rows]

            return jsonify({'group_by': group_by, 'series': series}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/monitor/traffic/top', methods=['GET'])
    @jwt_required()
    def monitor_traffic_top():  # noqa: F401
        try:
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role not in ['admin', 'manager', 'rh']:
                return jsonify({'error': 'Sem permissão'}), 403

            period = (request.args.get('period') or '24h').lower()
            limit = int(request.args.get('limit', 10))
            player_id = request.args.get('player_id')
            company = request.args.get('company')
            location_id = request.args.get('location_id')

            if user.role == 'rh' and getattr(user, 'company', None):
                company = user.company

            now = datetime.now(timezone.utc)
            if period.endswith('h'):
                delta = timedelta(hours=int(period[:-1] or 24))
            elif period.endswith('d'):
                delta = timedelta(days=int(period[:-1] or 1))
            else:
                delta = timedelta(hours=24)
            start = (now - delta).isoformat()

            clauses = ["ts_minute >= :start"]
            params = {'start': start, 'limit': limit}
            if player_id:
                clauses.append("player_id = :player_id"); params['player_id'] = str(player_id)
            if company:
                clauses.append("company = :company"); params['company'] = company
            if location_id:
                clauses.append("location_id = :location_id"); params['location_id'] = str(location_id)

            where_sql = " WHERE " + " AND ".join(clauses)
            sql = text(f'''\
                SELECT player_id, SUM(bytes) AS bytes, SUM(requests) AS requests
                FROM network_samples_minute
                {where_sql}
                GROUP BY player_id
                ORDER BY bytes DESC
                LIMIT :limit
            ''')
            rows = db.session.execute(sql, params).fetchall()
            items = [{'player_id': r[0], 'bytes': int(r[1] or 0), 'requests': int(r[2] or 0)} for r in rows]

            return jsonify({'start': start, 'now': now.isoformat(), 'top': items}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/system', methods=['GET'])
    @app.route('/api/monitor/system', methods=['GET'])
    @jwt_required()
    def api_monitor_system():  # noqa: F401
        try:
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role not in ['admin', 'manager']:
                return jsonify({'error': 'Sem permissão'}), 403
            return jsonify(collect_system_stats()), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/monitor/traffic/accumulated', methods=['GET'])
    @jwt_required()
    def monitor_traffic_accumulated():  # noqa: F401
        try:
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role not in ['admin', 'manager', 'rh']:
                return jsonify({'error': 'Sem permissão'}), 403

            period = (request.args.get('period') or '24h').lower()
            player_id = request.args.get('player_id')
            company = request.args.get('company')
            location_id = request.args.get('location_id')

            now = datetime.now(timezone.utc)
            if period == '1h':
                start = (now - timedelta(hours=1)).isoformat()
            elif period == '7d':
                start = (now - timedelta(days=7)).isoformat()
            else:
                start = (now - timedelta(days=1)).isoformat()

            where_sql = 'WHERE ts_minute >= :start'
            params = {'start': start}

            if user.role == 'rh' and getattr(user, 'company', None):
                company = user.company

            if player_id:
                where_sql += ' AND player_id = :pid'
                params['pid'] = str(player_id)
            if company:
                where_sql += ' AND company = :company'
                params['company'] = company
            if location_id:
                where_sql += ' AND location_id = :loc'
                params['loc'] = str(location_id)

            sql = text(f'''\
                SELECT player_id,
                       MAX(ts_minute) AS last_seen,
                       SUM(bytes) AS bytes,
                       SUM(requests) AS requests,
                       SUM(video) AS video,
                       SUM(image) AS image,
                       SUM(audio) AS audio,
                       SUM(other) AS other
                FROM network_samples_minute
                {where_sql}
                GROUP BY player_id
                ORDER BY bytes DESC
            ''')
            rows = db.session.execute(sql, params).fetchall()
            items = [{
                'player_id': r[0],
                'last_seen': r[1],
                'bytes': int(r[2] or 0),
                'requests': int(r[3] or 0),
                'video': int(r[4] or 0),
                'image': int(r[5] or 0),
                'audio': int(r[6] or 0),
                'other': int(r[7] or 0),
            } for r in rows]
            return jsonify({'start': start, 'now': now.isoformat(), 'items': items}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/monitor/traffic/flush-now', methods=['POST'])
    @jwt_required()
    def monitor_traffic_flush_now():  # noqa: F401
        try:
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role not in ['admin', 'manager']:
                return jsonify({'error': 'Sem permissão'}), 403
            from .jobs import flush_traffic_minute_now
            flush_traffic_minute_now()
            return jsonify({'ok': True}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
