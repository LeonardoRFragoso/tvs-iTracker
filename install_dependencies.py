#!/usr/bin/env python3
"""
Script de instalação das dependências para o sistema de múltiplos conteúdos
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(command, description):
    """Executa um comando e mostra o resultado"""
    print(f"\n🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} concluído com sucesso!")
        if result.stdout:
            print(f"   Output: {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro em {description}:")
        print(f"   {e.stderr}")
        return False

def check_node_npm():
    """Verifica se Node.js e npm estão instalados"""
    print("\n📋 Verificando pré-requisitos...")
    
    try:
        node_result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        npm_result = subprocess.run(['npm', '--version'], capture_output=True, text=True)
        
        print(f"✅ Node.js: {node_result.stdout.strip()}")
        print(f"✅ npm: {npm_result.stdout.strip()}")
        return True
    except FileNotFoundError:
        print("❌ Node.js ou npm não encontrados!")
        print("   Por favor, instale Node.js primeiro: https://nodejs.org/")
        return False

def install_backend_dependencies():
    """Instala dependências do backend Python"""
    print("\n🐍 INSTALANDO DEPENDÊNCIAS DO BACKEND...")
    
    # Verificar se está no diretório correto
    backend_dir = Path("backend")
    if not backend_dir.exists():
        print("❌ Diretório 'backend' não encontrado!")
        return False
    
    os.chdir("backend")
    
    # Instalar dependências Python
    dependencies = [
        "flask",
        "flask-sqlalchemy", 
        "flask-jwt-extended",
        "flask-cors",
        "flask-socketio",
        "pychromecast",
        "apscheduler",
        "python-dateutil",
        "pillow",
        "werkzeug"
    ]
    
    for dep in dependencies:
        if not run_command(f"pip install {dep}", f"Instalando {dep}"):
            return False
    
    os.chdir("..")
    return True

def install_frontend_dependencies():
    """Instala dependências do frontend React"""
    print("\n⚛️  INSTALANDO DEPENDÊNCIAS DO FRONTEND...")
    
    # Verificar se package.json existe
    package_json = Path("package.json")
    if not package_json.exists():
        print("❌ package.json não encontrado!")
        return False
    
    # Instalar dependências base
    if not run_command("npm install", "Instalando dependências base"):
        return False
    
    # Instalar dependências específicas para múltiplos conteúdos
    new_dependencies = [
        "react-beautiful-dnd",  # Para drag & drop
        "recharts",             # Para gráficos de analytics
        "@mui/x-date-pickers",  # Para date pickers
        "date-fns"              # Para manipulação de datas
    ]
    
    for dep in new_dependencies:
        if not run_command(f"npm install {dep}", f"Instalando {dep}"):
            return False
    
    return True

def run_migration():
    """Executa a migração do banco de dados"""
    print("\n🗄️  EXECUTANDO MIGRAÇÃO DO BANCO DE DADOS...")
    
    backend_dir = Path("backend")
    if not backend_dir.exists():
        print("❌ Diretório 'backend' não encontrado!")
        return False
    
    os.chdir("backend")
    
    # Executar migração
    success = run_command("python run_migration.py", "Executando migração")
    
    os.chdir("..")
    return success

def create_startup_scripts():
    """Cria scripts de inicialização"""
    print("\n📜 CRIANDO SCRIPTS DE INICIALIZAÇÃO...")
    
    # Script para Windows
    startup_bat = """@echo off
echo 🚀 Iniciando TVs iTracker com Sistema Multi-Conteúdo
echo ================================================

echo.
echo 🐍 Iniciando Backend...
cd backend
start "Backend" python app.py

echo.
echo ⚛️  Iniciando Frontend...
cd ..
start "Frontend" npm start

echo.
echo ✅ Sistema iniciado!
echo 📱 Frontend: http://localhost:3000
echo 🔌 Backend: http://localhost:5000
echo.
pause
"""
    
    with open("start_system.bat", "w", encoding="utf-8") as f:
        f.write(startup_bat)
    
    # Script para Linux/Mac
    startup_sh = """#!/bin/bash
echo "🚀 Iniciando TVs iTracker com Sistema Multi-Conteúdo"
echo "================================================"

echo ""
echo "🐍 Iniciando Backend..."
cd backend
python app.py &
BACKEND_PID=$!

echo ""
echo "⚛️  Iniciando Frontend..."
cd ..
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Sistema iniciado!"
echo "📱 Frontend: http://localhost:3000"
echo "🔌 Backend: http://localhost:5000"
echo ""
echo "Para parar o sistema, pressione Ctrl+C"

# Aguardar sinal de interrupção
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
"""
    
    with open("start_system.sh", "w", encoding="utf-8") as f:
        f.write(startup_sh)
    
    # Tornar executável no Linux/Mac
    try:
        os.chmod("start_system.sh", 0o755)
    except:
        pass  # Ignorar erro no Windows
    
    print("✅ Scripts de inicialização criados:")
    print("   - start_system.bat (Windows)")
    print("   - start_system.sh (Linux/Mac)")

def main():
    """Função principal"""
    print("🎉 INSTALADOR DO SISTEMA DE MÚLTIPLOS CONTEÚDOS")
    print("=" * 60)
    print("Este script irá instalar todas as dependências necessárias")
    print("para o sistema de campanhas com múltiplos conteúdos.")
    print("=" * 60)
    
    # Verificar pré-requisitos
    if not check_node_npm():
        return False
    
    # Instalar dependências
    if not install_backend_dependencies():
        print("\n❌ Falha na instalação das dependências do backend!")
        return False
    
    if not install_frontend_dependencies():
        print("\n❌ Falha na instalação das dependências do frontend!")
        return False
    
    # Executar migração
    if not run_migration():
        print("\n❌ Falha na migração do banco de dados!")
        return False
    
    # Criar scripts de inicialização
    create_startup_scripts()
    
    # Sucesso!
    print("\n" + "=" * 60)
    print("🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!")
    print("=" * 60)
    print("\n📋 PRÓXIMOS PASSOS:")
    print("1. Execute 'start_system.bat' (Windows) ou './start_system.sh' (Linux/Mac)")
    print("2. Acesse http://localhost:3000 para usar o sistema")
    print("3. Crie uma nova campanha e adicione múltiplos conteúdos")
    print("4. Configure agendamentos para reproduzir no Chromecast")
    print("\n🚀 O sistema está pronto para uso!")
    
    return True

if __name__ == "__main__":
    success = main()
    if not success:
        print("\n❌ Instalação falhou. Verifique os erros acima.")
        sys.exit(1)
    
    print("\n✅ Instalação bem-sucedida!")
    sys.exit(0)
