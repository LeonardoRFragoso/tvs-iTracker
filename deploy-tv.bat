@echo off
rem Garantir que o script execute a partir da pasta do projeto, mesmo em 'Executar como administrador'
setlocal enableextensions
setlocal enabledelayedexpansion
pushd "%~dp0"
echo [INFO] Diretorio atual: %CD%

echo ========================================
echo    TVs iTracker - Deploy Modo TV
echo ========================================
echo.
chcp 65001 >nul

rem ===== Configurar logging =====
set "ROOT_DIR=%CD%"
set "LOGDIR=%ROOT_DIR%\deploy-logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyyMMdd_HHmmss')"') do set "TS=%%i"
set "LOGFILE=%LOGDIR%\tv_deploy_!TS!.log"
echo [INFO] Log: "%LOGFILE%"

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
rem Definindo API e Socket para porta 80 (mesma origem do backend)
set REACT_APP_API_URL=same-origin
set REACT_APP_SOCKET_URL=same-origin
rem Definindo API e Socket para porta 80 (mesma origem do backend)
echo.
echo [2/4] Fazendo build da aplicacao React...
call npm run build >> "%LOGFILE%" 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Falha no build do React
    pause
    exit /b 1
)

echo.
echo [3/4] Copiando arquivos para backend...
if exist backend\build rmdir /s /q backend\build
xcopy build backend\build /e /i /y >> "%LOGFILE%" 2>&1

echo.
echo [4/4] Iniciando sistema em modo TV...
echo.
echo ========================================
echo Sistema configurado para modo TV!
echo.
echo URLs para acesso:
echo - TV: http://192.168.0.4/  ou  http://192.168.0.4/tv
echo - Atalho por codigo: http://192.168.0.4/k/386342
echo - Admin: http://192.168.0.4/app/login
echo - API: http://192.168.0.4/api/
echo.
echo Pressione qualquer tecla para iniciar...
pause >nul

echo.
echo Iniciando backend na porta 80...
if not exist backend (
    echo [ERRO] Pasta 'backend' nao encontrada.
    echo [ERRO] Verifique se esta executando a partir da raiz do projeto.
    echo [ERRO] Log detalhado em: "%LOGFILE%"
    pause
    exit /b 1
)
cd /d backend
if not exist venv\Scripts\python.exe (
    echo [INFO] Criando ambiente virtual Python... >> "%LOGFILE%" 2>&1
    set "VENV_CREATED="
    where py >nul 2>&1
    if %errorlevel%==0 (
        echo [INFO] Usando 'py -3' para criar venv >> "%LOGFILE%" 2>&1
        py -3 -m venv venv >> "%LOGFILE%" 2>&1
        if %errorlevel%==0 set "VENV_CREATED=1"
    )
    if not defined VENV_CREATED (
        where python >nul 2>&1
        if %errorlevel%==0 (
            echo [INFO] Usando 'python' para criar venv >> "%LOGFILE%" 2>&1
            python -m venv venv >> "%LOGFILE%" 2>&1
            if %errorlevel%==0 set "VENV_CREATED=1"
        )
    )
    if not defined VENV_CREATED (
        echo [ERRO] Python 3 nao encontrado no PATH. Instale Python 3.10+ e reexecute. >> "%LOGFILE%" 2>&1
        echo [ERRO] Python 3 nao encontrado no PATH. Instale Python 3.10+ e reexecute.
        echo [DICA] Baixe em: https://www.python.org/downloads/windows/ (marque "Add python.exe to PATH")
        pause
        exit /b 1
    )
)
if not exist venv\Scripts\python.exe (
    echo [ERRO] Ambiente virtual nao foi criado. Veja o log: "%LOGFILE%"
    pause
    exit /b 1
)
call venv\Scripts\activate
python -m pip install --upgrade pip >> "%LOGFILE%" 2>&1
python -m pip install -r ..\requirements.txt >> "%LOGFILE%" 2>&1
set TV_MODE=true
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
python app.py >> "%LOGFILE%" 2>&1

pause
