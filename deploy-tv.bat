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

rem ===== Configurar logging =====
set "ROOT_DIR=%CD%"
set "LOGDIR=%ROOT_DIR%\deploy-logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyyMMdd_HHmmss')"') do set "TS=%%i"
set "LOGFILE=%LOGDIR%\tv_deploy_!TS!.log"
echo [INFO] Log: "%LOGFILE%"

REM Verificar se esta executando como administrador
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
set REACT_APP_API_URL=same-origin
set REACT_APP_SOCKET_URL=same-origin

echo.
echo [2/4] Fazendo build da aplicacao React...
call npm run build >> "%LOGFILE%" 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Falha no build do React
    echo [ERRO] Verifique se o Node.js esta instalado e npm run build funciona
    echo [ERRO] Log detalhado em: "%LOGFILE%"
    type "%LOGFILE%"
    pause
    exit /b 1
)

echo.
echo [3/4] Copiando arquivos para backend...
if not exist "build" (
    echo [ERRO] Pasta 'build' nao encontrada apos npm run build
    echo [ERRO] Log detalhado em: "%LOGFILE%"
    pause
    exit /b 1
)
if exist backend\build rmdir /s /q backend\build
xcopy build backend\build /e /i /y >> "%LOGFILE%" 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao copiar arquivos para backend
    echo [ERRO] Log detalhado em: "%LOGFILE%"
    pause
    exit /b 1
)

echo.
echo ========================================
echo Sistema configurado para modo TV!
echo.

rem ===== Detectar IP local para exibir URLs corretas =====
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$ip=$null; try{ $c=New-Object System.Net.Sockets.UdpClient; $c.Connect('8.8.8.8',80); $ip=$c.Client.LocalEndPoint.Address.ToString(); $c.Close() } catch{}; if(-not $ip -or $ip -eq '127.0.0.1' -or $ip -eq '0.0.0.0' ){ $route=Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 | Sort-Object RouteMetric | Select-Object -First 1; if($route){ $ip=(Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress -First 1) } }; if(-not $ip){ $ip = ([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and $_.ToString() -notlike '127.*' } | Select-Object -ExpandProperty IPAddressToString -First 1) }; if(-not $ip){ $ip='127.0.0.1' }; Write-Output $ip"`) do set "LOCAL_IP=%%i"
if not defined LOCAL_IP set "LOCAL_IP=127.0.0.1"

echo URLs para acesso:
echo - TV: http://%LOCAL_IP%/  ou  http://%LOCAL_IP%/tv
echo - Atalho por codigo: http://%LOCAL_IP%/k/CODIGO
echo - Admin: http://%LOCAL_IP%/app/login
echo - API: http://%LOCAL_IP%/api/
echo.
echo Pressione qualquer tecla para iniciar...
pause >nul

echo.
echo [4/4] Iniciando backend na porta 80...
if not exist backend (
    echo [ERRO] Pasta 'backend' nao encontrada.
    echo [ERRO] Verifique se esta executando a partir da raiz do projeto.
    echo [ERRO] Log detalhado em: "%LOGFILE%"
    pause
    exit /b 1
)

cd /d backend

if not exist venv\Scripts\python.exe (
    echo [INFO] Criando ambiente virtual Python...
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
        echo [ERRO] Python 3 nao encontrado no PATH. Instale Python 3.10+ e reexecute.
        echo [DICA] Baixe em: https://www.python.org/downloads/windows/
        echo [DICA] Marque a opcao "Add python.exe to PATH" durante a instalacao
        echo [ERRO] Log detalhado em: "%LOGFILE%"
        pause
        exit /b 1
    )
)

if not exist venv\Scripts\python.exe (
    echo [ERRO] Ambiente virtual nao foi criado.
    echo [ERRO] Veja o log: "%LOGFILE%"
    pause
    exit /b 1
)

echo [INFO] Ativando ambiente virtual...
call venv\Scripts\activate

echo [INFO] Atualizando pip...
python -m pip install --upgrade pip >> "%LOGFILE%" 2>&1

echo [INFO] Instalando dependencias...
python -m pip install -r ..\requirements.txt >> "%LOGFILE%" 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias Python
    echo [ERRO] Log detalhado em: "%LOGFILE%"
    pause
    exit /b 1
)

set TV_MODE=true
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

echo.
echo ========================================
echo Servidor iniciando...
echo ========================================
echo.

python app.py
set "EXIT_CODE=%errorLevel%"

echo.
echo ========================================
if %EXIT_CODE% neq 0 (
    echo [ERRO] O servidor encerrou com erro (codigo %EXIT_CODE%)
    echo [ERRO] Verifique o log: "%LOGFILE%"
) else (
    echo [INFO] Servidor encerrado normalmente
)
echo ========================================
echo.
echo Pressione qualquer tecla para fechar...
pause >nul
exit /b %EXIT_CODE%