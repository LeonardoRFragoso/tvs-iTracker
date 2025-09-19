#!/usr/bin/env python3
"""
Servidor HTTP simples na porta 80 para redirecionamento de TVs
Execute como administrador: python tv-server.py
"""

import http.server
import socketserver
import urllib.parse
import os

class TVRedirectHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse da URL
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)
        
        print(f"[TV Server] Requisição: {self.path}")
        
        # Redirecionar para o player
        if path == '/' or path == '/tv' or path == '/player':
            # Código padrão ou da query string
            code = query.get('code', ['386342'])[0]
            player_url = f"http://192.168.0.4:3000/k/{code}"
            
            # Página de redirecionamento
            html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>TV Player</title>
                <meta charset="UTF-8">
                <style>
                    body {{ 
                        background: #000; 
                        color: #fff; 
                        font-family: Arial; 
                        text-align: center; 
                        padding: 50px; 
                    }}
                    .loading {{ font-size: 24px; margin: 20px; }}
                    .url {{ 
                        background: #333; 
                        padding: 15px; 
                        border-radius: 5px; 
                        font-family: monospace; 
                        margin: 20px auto; 
                        max-width: 500px; 
                    }}
                </style>
            </head>
            <body>
                <h1>TV Player - Redirecionando...</h1>
                <div class="loading">Aguarde...</div>
                <div class="url">{player_url}</div>
                <p>Se não redirecionou, digite a URL acima no navegador da TV</p>
                <script>
                    console.log('Redirecionando para: {player_url}');
                    setTimeout(() => {{
                        window.location.href = '{player_url}';
                    }}, 2000);
                </script>
            </body>
            </html>
            """
            
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(html.encode('utf-8'))
            return
        
        # Servir arquivos estáticos se existirem
        if path == '/tv.html' and os.path.exists('public/tv.html'):
            with open('public/tv.html', 'r', encoding='utf-8') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
            return
        
        # 404 para outras rotas
        self.send_response(404)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(b'<h1>404 - Pagina nao encontrada</h1>')

def start_tv_server():
    PORT = 80
    
    try:
        with socketserver.TCPServer(("", PORT), TVRedirectHandler) as httpd:
            print(f"[TV Server] Servidor rodando na porta {PORT}")
            print(f"[TV Server] Acesse na TV: http://192.168.0.4")
            print(f"[TV Server] Ou: http://192.168.0.4/tv")
            print(f"[TV Server] Com código: http://192.168.0.4?code=386342")
            print(f"[TV Server] Pressione Ctrl+C para parar")
            httpd.serve_forever()
    except PermissionError:
        print("[ERRO] Porta 80 requer privilégios de administrador")
        print("Execute como administrador ou use porta alternativa")
    except OSError as e:
        print(f"[ERRO] Não foi possível iniciar servidor na porta {PORT}: {e}")
        print("Verifique se a porta está em uso")

if __name__ == "__main__":
    start_tv_server()
