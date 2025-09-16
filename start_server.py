#!/usr/bin/env python3
"""
Script para inicializar o servidor TVS com verificação de dependências
"""

import os
import sys
import subprocess
import importlib.util

def check_python_version():
    """Verifica se a versão do Python é compatível"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ é necessário")
        sys.exit(1)
    print(f"✅ Python {sys.version.split()[0]} detectado")

def check_dependencies():
    """Verifica se as dependências estão instaladas"""
    required_packages = [
        'flask',
        'flask_sqlalchemy', 
        'flask_jwt_extended',
        'flask_socketio',
        'flask_cors',
        'werkzeug',
        'requests',
        'pytz'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        if importlib.util.find_spec(package) is None:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Dependências faltando: {', '.join(missing_packages)}")
        print("📦 Instalando dependências...")
        
        try:
            subprocess.check_call([
                sys.executable, '-m', 'pip', 'install', 
                'flask', 'flask-sqlalchemy', 'flask-jwt-extended', 
                'flask-socketio', 'flask-cors', 'werkzeug', 
                'requests', 'pytz', 'python-socketio', 'eventlet'
            ])
            print("✅ Dependências instaladas com sucesso")
        except subprocess.CalledProcessError:
            print("❌ Erro ao instalar dependências")
            print("💡 Execute manualmente: pip install -r requirements.txt")
            sys.exit(1)
    else:
        print("✅ Todas as dependências estão instaladas")

def setup_environment():
    """Configura variáveis de ambiente"""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Definir variáveis de ambiente se não existirem
    env_vars = {
        'FLASK_APP': 'app.py',
        'FLASK_ENV': 'development',
        'SECRET_KEY': 'dev-secret-key-change-in-production',
        'JWT_SECRET_KEY': 'jwt-secret-key-change-in-production',
        'DATABASE_URL': f'sqlite:///{os.path.join(backend_dir, "instance", "tvs_platform.db")}',
        'UPLOAD_FOLDER': os.path.join(backend_dir, 'uploads'),
        'MAX_CONTENT_LENGTH': '500'  # MB
    }
    
    for key, value in env_vars.items():
        if key not in os.environ:
            os.environ[key] = value
    
    # Criar diretórios necessários
    os.makedirs(os.path.join(backend_dir, 'instance'), exist_ok=True)
    os.makedirs(os.path.join(backend_dir, 'uploads'), exist_ok=True)
    
    print("✅ Ambiente configurado")

def init_database():
    """Inicializa banco de dados se necessário"""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(backend_dir, 'instance', 'tvs_platform.db')
    
    if not os.path.exists(db_path):
        print("🔧 Inicializando banco de dados...")
        try:
            # Adicionar backend ao path
            sys.path.insert(0, backend_dir)
            
            # Importar e executar inicialização
            from init_db import init_database
            init_database()
            
        except Exception as e:
            print(f"❌ Erro ao inicializar banco: {e}")
            print("💡 Tente executar manualmente: python init_db.py")
            return False
    else:
        print("✅ Banco de dados já existe")
    
    return True

def start_server():
    """Inicia o servidor Flask"""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    print("\n🚀 Iniciando servidor TVS...")
    print("📍 URL: http://localhost:5000")
    print("🔗 API Docs: http://localhost:5000/api")
    print("⚡ WebSocket: http://localhost:5000/socket.io")
    print("\n🔐 Credenciais padrão:")
    print("   Admin: admin / admin123")
    print("   Manager: manager / manager123")
    print("\n⏹️  Pressione Ctrl+C para parar o servidor\n")
    
    try:
        # Importar app do Flask
        sys.path.insert(0, backend_dir)
        from app import app, socketio
        
        # Iniciar servidor com SocketIO
        socketio.run(
            app, 
            host='0.0.0.0', 
            port=5000, 
            debug=True,
            use_reloader=False  # Evitar problemas com SocketIO
        )
        
    except KeyboardInterrupt:
        print("\n👋 Servidor parado pelo usuário")
    except Exception as e:
        print(f"\n❌ Erro ao iniciar servidor: {e}")
        print("💡 Verifique se a porta 5000 não está em uso")
        sys.exit(1)

def main():
    """Função principal"""
    print("🔧 TVS Digital Signage - Inicialização do Servidor")
    print("=" * 50)
    
    # Verificações
    check_python_version()
    check_dependencies()
    setup_environment()
    
    # Inicializar banco se necessário
    if not init_database():
        sys.exit(1)
    
    # Iniciar servidor
    start_server()

if __name__ == '__main__':
    main()
