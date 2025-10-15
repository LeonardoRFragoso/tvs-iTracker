from flask import request, jsonify, send_from_directory, make_response, redirect
import os
from database import db
from models.player import Player
from models.user import User
from models.location import Location

# Helpers locais (isolados)

def _react_build_dir(base_path):
    return os.path.join(base_path, 'build')


def _has_react_build(base_path):
    try:
        return os.path.exists(os.path.join(_react_build_dir(base_path), 'index.html'))
    except Exception:
        return False


def _serve_react_file(base_path, filename):
    try:
        return send_from_directory(_react_build_dir(base_path), filename)
    except Exception:
        return jsonify({'error': f'Arquivo {filename} não encontrado'}), 404


def _kiosk_landing_html(host, prefill_code: str = ''):
    html = f"""
    <!DOCTYPE html>
    <html lang="pt-br">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <title>TVs iTracker - Entrar no Player</title>
        <style>
          html, body {{ height: 100%; margin: 0; }}
          body {{ background: #000; color: #fff; font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; }}
          .card {{ width: 92%; max-width: 520px; background: #111; padding: 28px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.6); }}
          h1 {{ margin: 0 0 12px; font-size: 22px; }}
          p {{ margin: 6px 0 18px; color: #aaa; }}
          .row {{ display: flex; gap: 10px; }}
          input {{ flex: 1; padding: 14px 16px; font-size: 22px; border-radius: 8px; border: 1px solid #333; background: #000; color: #fff; text-align: center; letter-spacing: 2px; }}
          button {{ padding: 14px 18px; font-size: 18px; border-radius: 8px; border: 0; background: #0d6efd; color: #fff; cursor: pointer; }}
          button:disabled {{ opacity: .7; cursor: not-allowed; }}
          .hint {{ font-size: 14px; color: #888; margin-top: 12px; }}
          .error {{ color: #ff6b6b; margin-top: 12px; }}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>TVs iTracker</h1>
          <p>Digite o código do player (6 a 8 dígitos) para iniciar.</p>
          <div class="row">
            <input id="code" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="one-time-code" placeholder="Ex: 386342" value="{prefill_code}" autofocus />
            <button id="go">Entrar</button>
          </div>
          <div class="hint">Dica: abra apenas <strong>http://{host}/</strong> no navegador da TV/celular.</div>
          <div id="msg" class="error" role="alert" aria-live="polite"></div>
        </div>
        <script>
          const input = document.getElementById('code');
          const btn = document.getElementById('go');
          const msg = document.getElementById('msg');

          async function resolveAndGo(code) {{
            msg.textContent = '';
            if (!code) {{ msg.textContent = 'Informe o código do player.'; return; }}
            try {{
              btn.disabled = true;
              const res = await fetch(`/api/players/resolve-code/${{code}}`);
              const data = await res.json();
              if (res.ok && data.player_id) {{
                window.location.href = `/kiosk/player/${{data.player_id}}?fullscreen=true`;
              }} else {{
                msg.textContent = data.error || 'Código inválido';
              }}
            }} catch (e) {{
              msg.textContent = 'Falha de rede. Verifique se o celular/TV está na mesma rede.';
            }} finally {{
              btn.disabled = false;
            }}
          }}

          btn.addEventListener('click', () => resolveAndGo(input.value.trim()));
          input.addEventListener('keydown', (e) => {{ if (e.key === 'Enter') resolveAndGo(input.value.trim()); }});

          const params = new URLSearchParams(window.location.search);
          const q = params.get('code');
          if (q && !input.value) {{ input.value = q; resolveAndGo(q); }}
        </script>
      </body>
    </html>
    """
    resp = make_response(html)
    resp.headers['Content-Type'] = 'text/html; charset=utf-8'
    return resp


def register_public_routes(app):
    base_path = os.path.dirname(__file__)
    base_path = os.path.abspath(os.path.join(base_path, '..'))  # backend/

    # CORS preflight para toda API
    @app.route('/api/<path:any_path>', methods=['OPTIONS'])
    def api_cors_preflight(any_path):  # noqa: F401
        return make_response('', 204)

    # Servir uploads com cabeçalhos adequados
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):  # noqa: F401
        upload_dir = app.config['UPLOAD_FOLDER']
        if not os.path.isabs(upload_dir):
            upload_dir = os.path.join(app.root_path, upload_dir)
        resp = send_from_directory(upload_dir, filename, conditional=True)
        try:
            abs_path = os.path.normpath(os.path.join(upload_dir, filename))
            st = os.stat(abs_path)
            etag = f"\"{st.st_size:x}-{int(st.st_mtime):x}\""
            resp.headers['ETag'] = etag
        except Exception:
            pass
        resp.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
        resp.headers['Accept-Ranges'] = 'bytes'
        return resp

    # Tizen player assets
    @app.route('/tizen-player/<path:filename>')
    def serve_tizen_player(filename):  # noqa: F401
        tizen_dir = os.path.join(app.root_path, '..', 'tizen-player')
        return send_from_directory(tizen_dir, filename)

    # Short-link público /k/<code>
    @app.route('/k/<code>')
    def short_link_kiosk(code):  # noqa: F401
        try:
            player = Player.query.filter(Player.access_code == code.upper()).first()
            if not player:
                return _kiosk_landing_html(request.host, prefill_code=code)

            user_agent = request.headers.get('User-Agent', '').lower()
            if 'tizen' in user_agent:
                if player.device_type != 'tizen':
                    if player.device_type == 'modern':
                        player.device_type = 'tizen'
                        db.session.commit()
                return redirect(f"/tizen-player/index.html?id={player.id}")
            elif ('msie' in user_agent or 'trident' in user_agent or 
                  ('edge/' in user_agent and 'edg/' not in user_agent)):
                if player.device_type != 'legacy':
                    if player.device_type == 'modern':
                        player.device_type = 'legacy'
                        db.session.commit()
                return redirect(f"/tizen-player/index.html?id={player.id}")
            else:
                return redirect(f"/kiosk/player/{player.id}?fullscreen=true")
        except Exception:
            return _kiosk_landing_html(request.host, prefill_code=code)

    # Raiz e TV landing
    @app.route('/')
    def root_index():  # noqa: F401
        return _kiosk_landing_html(request.host)

    @app.route('/tv')
    def tv_landing():  # noqa: F401
        return _kiosk_landing_html(request.host)

    # Player page no SPA
    @app.route('/kiosk/player/<player_id>')
    def kiosk_player_page(player_id):  # noqa: F401
        if _has_react_build(base_path):
            return _serve_react_file(base_path, 'index.html')
        return _kiosk_landing_html(request.host)

    # Admin SPA (base /app)
    @app.route('/app')
    @app.route('/app/<path:path>')
    def serve_admin_app(path=''):  # noqa: F401
        if _has_react_build(base_path):
            return _serve_react_file(base_path, 'index.html')
        return redirect('/')

    # Redirecionador amigável numeric code: http://<host>/<CODIGO>
    @app.route('/<code>')
    def numeric_code_shortlink(code):  # noqa: F401
        try:
            if code.isdigit() and 6 <= len(code) <= 8:
                return redirect(f"/k/{code}")
        except Exception:
            pass
        return _kiosk_landing_html(request.host, prefill_code=str(code))

    # Redirects para rotas admin
    @app.route('/<path:admin_route>')
    def redirect_admin_routes(admin_route):  # noqa: F401
        admin_routes = ['login', 'register', 'forgot-password', 'change-password', 
                        'dashboard', 'content', 'campaigns', 'players', 'schedules', 'settings']
        if admin_route in admin_routes:
            return redirect(f'/app/{admin_route}')
        return jsonify({'error': 'Rota não encontrada'}), 404

    # Assets estáticos do build React
    @app.route('/static/<path:filename>')
    @app.route('/app/static/<path:filename>')
    def serve_static_assets(filename):  # noqa: F401
        try:
            return send_from_directory(os.path.join(_react_build_dir(base_path), 'static'), filename)
        except Exception:
            return jsonify({'error': 'Arquivo não encontrado'}), 404

    # Arquivos especiais React
    @app.route('/manifest.json')
    @app.route('/app/manifest.json')
    def serve_manifest():  # noqa: F401
        return _serve_react_file(base_path, 'manifest.json')

    @app.route('/favicon.ico')
    @app.route('/app/favicon.ico')
    def serve_favicon():  # noqa: F401
        return _serve_react_file(base_path, 'favicon.ico')

    @app.route('/app/asset-manifest.json')
    def serve_asset_manifest():  # noqa: F401
        return _serve_react_file(base_path, 'asset-manifest.json')

    # Endpoints utilitários públicos
    @app.route('/api/system/network-info')
    def get_network_info():  # noqa: F401
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return jsonify({
                'local_ip': local_ip,
                'suggested_frontend_url': f'http://{local_ip}:3000',
                'suggested_backend_url': f'http://{local_ip}:5000',
                'kiosk_base_url': f'http://{local_ip}:3000/k/',
                'current_detected_ip': local_ip
            }), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/public/companies', methods=['GET'])
    def public_companies():  # noqa: F401
        try:
            user_companies = [row[0] for row in db.session.query(db.func.distinct(User.company)).all()]
            location_companies = [row[0] for row in db.session.query(db.func.distinct(Location.company)).all()]
            companies = sorted({str(c).strip() for c in (user_companies + location_companies) if c and str(c).strip()})
            if not companies:
                companies = ['iTracker', 'Rio Brasil Terminal - RBT', 'CLIA']
            return jsonify({'companies': companies}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
