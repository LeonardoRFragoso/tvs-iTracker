#!/usr/bin/env python3
"""
Servidor Proxy simples para TVs
Roda na porta 8080 e redireciona para o sistema principal
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        print(f"[Proxy] Requisição: {self.path}")
        
        # URLs especiais para TV
        if self.path == '/' or self.path.startswith('/k/'):
            # Redirecionar para o React na porta 3000
            target_url = f"http://192.168.0.4:3000{self.path}"
            print(f"[Proxy] Redirecionando para: {target_url}")
            
            try:
                # Fazer requisição para o servidor React
                with urllib.request.urlopen(target_url) as response:
                    content = response.read()
                    content_type = response.headers.get('Content-Type', 'text/html')
                
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
                return
                
            except Exception as e:
                print(f"[Proxy] Erro ao acessar React: {e}")
                # Fallback: página de redirecionamento
                self.send_redirect_page()
                return
        
        # APIs - redirecionar para backend na porta 5000
        elif self.path.startswith('/api/'):
            target_url = f"http://192.168.0.4:5000{self.path}"
            print(f"[Proxy] API -> {target_url}")
            
            try:
                with urllib.request.urlopen(target_url) as response:
                    content = response.read()
                    content_type = response.headers.get('Content-Type', 'application/json')
                
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
                return
                
            except Exception as e:
                print(f"[Proxy] Erro na API: {e}")
                self.send_error(500, f"Erro na API: {e}")
                return
        
        # Outros arquivos estáticos
        else:
            target_url = f"http://192.168.0.4:3000{self.path}"
            try:
                with urllib.request.urlopen(target_url) as response:
                    content = response.read()
                    content_type = response.headers.get('Content-Type', 'text/plain')
                
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.end_headers()
                self.wfile.write(content)
                return
                
            except Exception as e:
                print(f"[Proxy] Arquivo não encontrado: {e}")
                self.send_error(404, "Arquivo não encontrado")
    
    def send_redirect_page(self):
        """Enviar página de redirecionamento manual"""
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>TV Player</title>
            <meta charset="UTF-8">
            <style>
                body { 
                    background: #000; 
                    color: #fff; 
                    font-family: Arial; 
                    text-align: center; 
                    padding: 50px; 
                }
                .url { 
                    background: #333; 
                    padding: 15px; 
                    border-radius: 5px; 
                    font-family: monospace; 
                    margin: 20px auto; 
                    max-width: 500px; 
                    font-size: 18px;
                }
                .button {
                    background: #007bff;
                    color: white;
                    padding: 15px 30px;
                    border: none;
                    border-radius: 5px;
                    font-size: 16px;
                    cursor: pointer;
                    margin: 10px;
                }
            </style>
        </head>
        <body>
            <h1>🎯 TV Player - Sistema TVs iTracker</h1>
            <p>Acesse diretamente:</p>
            <div class="url">http://192.168.0.4:3000/k/386342</div>
            <button class="button" onclick="window.location.href='http://192.168.0.4:3000/k/386342'">
                Ir para o Player
            </button>
            <p>Ou digite a URL acima no navegador da TV</p>
        </body>
        </html>
        """
        
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

def start_proxy():
    PORT = 8080
    
    try:
        with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
            print(f"[Proxy] Servidor proxy rodando na porta {PORT}")
            print(f"[Proxy] Acesse na TV: http://192.168.0.4:8080/k/386342")
            print(f"[Proxy] Ou simplesmente: http://192.168.0.4:8080")
            print(f"[Proxy] Pressione Ctrl+C para parar")
            httpd.serve_forever()
    except OSError as e:
        print(f"[ERRO] Não foi possível iniciar proxy na porta {PORT}: {e}")

if __name__ == "__main__":
    start_proxy()
