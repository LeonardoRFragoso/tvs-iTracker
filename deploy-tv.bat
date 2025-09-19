@echo off
rem Garantir que o script execute a partir da pasta do projeto, mesmo em 'Executar como administrador'
setlocal enableextensions
pushd "%~dp0"
echo [INFO] Diretorio atual: %CD%

echo ========================================
echo    TVs iTracker - Deploy Modo TV
echo ========================================
echo.

REM Verificar se está executando como administrador
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Executando como Administrador
) else (
    echo [ERRO] Este script precisa ser executado como Administrador
    echo Clique com botao direito e selecione "Executar como administrador"
    pause
    exit /b 1
)

echo.
echo [1/4] Configurando variaveis de ambiente...
set TV_MODE=true
set NODE_ENV=production
rem Usaremos auto-detecção no frontend (axios), sem URL fixa
set REACT_APP_API_URL=

echo.
echo [2/4] Fazendo build da aplicacao React...
call npm run build
if %errorLevel% neq 0 (
    echo [ERRO] Falha no build do React
    pause
    exit /b 1
)

echo.
echo [3/4] Copiando arquivos para backend...
if exist backend\build rmdir /s /q backend\build
xcopy build backend\build /e /i /y

echo.
echo [4/4] Iniciando sistema em modo TV...
echo.
echo ========================================
echo Sistema configurado para modo TV!
echo.
echo URLs para acesso:
echo - TV: http://192.168.0.4/  ou  http://192.168.0.4/tv
echo - Atalho por codigo: http://192.168.0.4/k/386342
echo - Admin: http://192.168.0.4/login
echo - API: http://192.168.0.4/api/
echo.
echo Pressione qualquer tecla para iniciar...
pause >nul

echo.
echo Iniciando backend na porta 80...
cd backend
if not exist venv\Scripts\python.exe (
    echo [INFO] Criando ambiente virtual Python...
    py -3 -m venv venv || python -m venv venv
)
call venv\Scripts\python.exe -m pip install --upgrade pip
call venv\Scripts\pip.exe install -r ..\requirements.txt
set TV_MODE=true
call venv\Scripts\python.exe app.py

pause
