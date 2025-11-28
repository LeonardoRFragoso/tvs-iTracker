# GUIA DE DEPLOY E CONFIGURAÇÃO - TVS DIGITAL SIGNAGE PLATFORM
## PLTI-012c - As-Built (Documentação de Implementação)

---

## 1. PRÉ-REQUISITOS DO SISTEMA

### 1.1 Hardware Mínimo (Servidor)

#### Ambiente de Desenvolvimento
- **CPU:** 2 cores
- **RAM:** 4GB
- **Disco:** 100GB
- **Rede:** 10Mbps

#### Ambiente de Produção
- **CPU:** 4 cores (8 recomendado)
- **RAM:** 8GB (16GB recomendado)
- **Disco:** 500GB SSD (escalável conforme volume de mídia)
- **Rede:** 100Mbps (1Gbps recomendado)

### 1.2 Software Necessário

#### Sistema Operacional
- **Linux:** Ubuntu 20.04 LTS ou superior (recomendado)
- **Windows:** Windows Server 2019/2022 ou Windows 10/11 Pro

#### Dependências do Sistema
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y python3.13 python3-pip python3-venv
sudo apt install -y nodejs npm
sudo apt install -y ffmpeg
sudo apt install -y mysql-server nginx

# Verificar instalações
python3 --version  # Python 3.13+
node --version     # Node 16+
npm --version
ffmpeg -version
mysql --version
```

```powershell
# Windows
# Instalar via Chocolatey (https://chocolatey.org/)
choco install python3 --version=3.13
choco install nodejs --version=18.0.0
choco install ffmpeg
choco install mysql
choco install nginx

# Ou baixar instaladores diretos:
# Python: https://www.python.org/downloads/
# Node.js: https://nodejs.org/
# FFmpeg: https://ffmpeg.org/download.html
# MySQL: https://dev.mysql.com/downloads/installer/
```

---

## 2. INSTALAÇÃO DO BACKEND

### 2.1 Preparação do Ambiente

#### 2.1.1 Clone do Repositório
```bash
cd /opt  # Linux
# ou
cd C:\inetpub  # Windows

git clone https://github.com/empresa/tvs-itracker.git tvs-platform
cd tvs-platform
```

#### 2.1.2 Configuração do Python Virtual Environment
```bash
# Linux
cd backend
python3 -m venv venv
source venv/bin/activate

# Windows
cd backend
python -m venv venv
venv\Scripts\activate
```

#### 2.1.3 Instalação de Dependências Python
```bash
pip install --upgrade pip
pip install -r requirements.txt

# Verificar instalação
pip list
```

### 2.2 Configuração do Banco de Dados MySQL

#### 2.2.1 Criar Banco de Dados
```sql
-- Login no MySQL
mysql -u root -p

-- Criar banco de dados
CREATE DATABASE tvs_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar usuário
CREATE USER 'tvs_user'@'localhost' IDENTIFIED BY 'senha_segura_aqui';

-- Conceder permissões
GRANT ALL PRIVILEGES ON tvs_platform.* TO 'tvs_user'@'localhost';
FLUSH PRIVILEGES;

-- Verificar
SHOW DATABASES;
USE tvs_platform;
```

#### 2.2.2 Configuração para Acesso Remoto (opcional)
```sql
-- Permitir conexão de qualquer IP (produção: especificar IPs)
CREATE USER 'tvs_user'@'%' IDENTIFIED BY 'senha_segura_aqui';
GRANT ALL PRIVILEGES ON tvs_platform.* TO 'tvs_user'@'%';
FLUSH PRIVILEGES;
```

```bash
# Editar configuração MySQL para aceitar conexões remotas
# Linux
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# Alterar bind-address
bind-address = 0.0.0.0

# Reiniciar MySQL
sudo systemctl restart mysql
```

### 2.3 Configuração de Variáveis de Ambiente

#### 2.3.1 Criar arquivo .env
```bash
cd /opt/tvs-platform/backend
cp .env.example .env
nano .env  # ou use seu editor preferido
```

#### 2.3.2 Configurar .env para Produção
```env
# Database Configuration
DATABASE_URL=mysql+pymysql://tvs_user:senha_segura_aqui@localhost:3306/tvs_platform

# JWT Configuration
JWT_SECRET_KEY=gere-uma-chave-aleatoria-segura-aqui-32-caracteres-minimo
JWT_ACCESS_TOKEN_EXPIRES=86400  # 24 horas em segundos

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=outra-chave-aleatoria-segura-diferente-da-jwt

# Upload Configuration
UPLOAD_FOLDER=/opt/tvs-platform/backend/uploads
MAX_CONTENT_LENGTH=104857600  # 100MB em bytes

# Media Base URL (URL acessível pelos players e Chromecast)
MEDIA_BASE_URL=https://tvs.empresa.com

# Socket.IO Configuration
SOCKETIO_ASYNC_MODE=threading
# Nota: eventlet não é suportado no Windows ou Python 3.13+

# External APIs (opcional)
NEWS_API_KEY=sua-news-api-key-aqui
WEATHER_API_KEY=sua-weather-api-key-aqui
```

**Importante:** Gerar chaves seguras:
```bash
# Gerar chaves aleatórias
python3 -c "import secrets; print(secrets.token_hex(32))"
# Execute 2x para gerar JWT_SECRET_KEY e SECRET_KEY diferentes
```

### 2.4 Inicialização do Banco de Dados

#### 2.4.1 Executar Migrações
```bash
cd /opt/tvs-platform/backend
source venv/bin/activate  # Linux
# ou
venv\Scripts\activate  # Windows

# Inicializar banco e criar tabelas
flask db upgrade

# Ou usar script de inicialização
python init_db.py
```

#### 2.4.2 Criar Usuário Administrador Padrão
```python
# O script init_db.py já cria o admin padrão
# Usuário: admin
# Senha: admin123

# Para criar manualmente via Python shell:
from app import app, db
from models.user import User
import bcrypt

with app.app_context():
    admin = User(
        username='admin',
        email='admin@empresa.com',
        password_hash=bcrypt.hashpw('senha_segura'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        role='admin'
    )
    db.session.add(admin)
    db.session.commit()
    print('Admin criado com sucesso!')
```

### 2.5 Teste do Backend

#### 2.5.1 Executar em Modo de Desenvolvimento
```bash
cd /opt/tvs-platform/backend
source venv/bin/activate

# Iniciar servidor
python app.py
# Ou
flask run --host=0.0.0.0 --port=5000

# Testar
curl http://localhost:5000/api/health
# Deve retornar: {"status": "healthy", ...}
```

---

## 3. INSTALAÇÃO DO FRONTEND

### 3.1 Instalação de Dependências Node.js

```bash
cd /opt/tvs-platform
npm install

# Verificar instalação
npm list
```

### 3.2 Configuração do Frontend

#### 3.2.1 Criar .env.local (Desenvolvimento)
```bash
cd /opt/tvs-platform
nano .env.local
```

```env
# .env.local (Desenvolvimento)
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_MEDIA_BASE_URL=http://localhost:5000
```

#### 3.2.2 Configurar para Produção
```bash
# .env.production
REACT_APP_API_URL=https://tvs.empresa.com/api
REACT_APP_SOCKET_URL=https://tvs.empresa.com
REACT_APP_MEDIA_BASE_URL=https://tvs.empresa.com
```

### 3.3 Build de Produção

```bash
cd /opt/tvs-platform

# Build otimizado
npm run build

# Resultado em ./build/
ls -la build/
```

### 3.4 Teste do Frontend (Desenvolvimento)

```bash
npm start
# Acesse: http://localhost:3000
```

---

## 4. CONFIGURAÇÃO DO NGINX (Produção)

### 4.1 Instalação do Nginx

```bash
# Ubuntu/Debian
sudo apt install nginx

# Windows: Baixar de https://nginx.org/en/download.html
```

### 4.2 Configuração do Site

#### 4.2.1 Criar arquivo de configuração
```bash
# Linux
sudo nano /etc/nginx/sites-available/tvs-platform

# Windows
notepad C:\nginx\conf\sites-available\tvs-platform.conf
```

#### 4.2.2 Configuração Nginx (HTTP - Desenvolvimento)
```nginx
server {
    listen 80;
    server_name tvs.empresa.com;
    
    client_max_body_size 100M;
    
    # Frontend (React Build)
    location / {
        root /opt/tvs-platform/build;
        try_files $uri $uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Uploads/Media
    location /uploads/ {
        alias /opt/tvs-platform/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # Suporte a Range Requests (streaming de vídeo)
        add_header Accept-Ranges bytes;
    }
    
    # Logs
    access_log /var/log/nginx/tvs_access.log;
    error_log /var/log/nginx/tvs_error.log;
}
```

#### 4.2.3 Configuração Nginx (HTTPS - Produção)
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name tvs.empresa.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tvs.empresa.com;
    
    # SSL Certificates
    ssl_certificate /etc/ssl/certs/tvs-empresa-com.crt;
    ssl_certificate_key /etc/ssl/private/tvs-empresa-com.key;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    client_max_body_size 100M;
    
    # ... (resto da configuração igual ao HTTP)
}
```

#### 4.2.4 Ativar Site
```bash
# Linux
sudo ln -s /etc/nginx/sites-available/tvs-platform /etc/nginx/sites-enabled/
sudo nginx -t  # Testar configuração
sudo systemctl reload nginx

# Windows
# Incluir no nginx.conf principal:
# include sites-available/tvs-platform.conf;
nginx -t
nginx -s reload
```

---

## 5. CONFIGURAÇÃO DE SSL/HTTPS

### 5.1 Obter Certificado SSL

#### 5.1.1 Opção 1: Let's Encrypt (Grátis)
```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d tvs.empresa.com

# Certbot configura automaticamente o Nginx
# Certificado renovado automaticamente
```

#### 5.1.2 Opção 2: Certificado Comercial
```bash
# Gerar CSR
sudo openssl req -new -newkey rsa:2048 -nodes \
  -keyout /etc/ssl/private/tvs-empresa-com.key \
  -out /etc/ssl/certs/tvs-empresa-com.csr

# Enviar CSR para a CA (Certificate Authority)
# Receber certificado e instalar conforme configuração do Nginx acima
```

---

## 6. DEPLOY DO BACKEND COMO SERVIÇO

### 6.1 Linux (systemd)

#### 6.1.1 Criar arquivo de serviço
```bash
sudo nano /etc/systemd/system/tvs-backend.service
```

```ini
[Unit]
Description=TVS Digital Signage Backend
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/tvs-platform/backend
Environment="PATH=/opt/tvs-platform/backend/venv/bin"
EnvironmentFile=/opt/tvs-platform/backend/.env
ExecStart=/opt/tvs-platform/backend/venv/bin/gunicorn \
    --workers 4 \
    --bind 127.0.0.1:5000 \
    --timeout 120 \
    --access-logfile /var/log/tvs-backend-access.log \
    --error-logfile /var/log/tvs-backend-error.log \
    app:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 6.1.2 Ativar e iniciar serviço
```bash
sudo systemctl daemon-reload
sudo systemctl enable tvs-backend
sudo systemctl start tvs-backend

# Verificar status
sudo systemctl status tvs-backend

# Logs
sudo journalctl -u tvs-backend -f
```

### 6.2 Windows (NSSM - Non-Sucking Service Manager)

#### 6.2.1 Instalar NSSM
```powershell
# Baixar de https://nssm.cc/download
# Ou via Chocolatey
choco install nssm
```

#### 6.2.2 Criar serviço
```powershell
# Navegar até a pasta do backend
cd C:\inetpub\tvs-platform\backend

# Criar serviço
nssm install TVS-Backend "C:\inetpub\tvs-platform\backend\venv\Scripts\python.exe" "app.py"

# Configurar working directory
nssm set TVS-Backend AppDirectory "C:\inetpub\tvs-platform\backend"

# Configurar logs
nssm set TVS-Backend AppStdout "C:\inetpub\tvs-platform\backend\logs\stdout.log"
nssm set TVS-Backend AppStderr "C:\inetpub\tvs-platform\backend\logs\stderr.log"

# Iniciar serviço
nssm start TVS-Backend

# Verificar status
nssm status TVS-Backend
```

---

## 7. CONFIGURAÇÃO DE BACKUP AUTOMÁTICO

### 7.1 Script de Backup (Linux)

#### 7.1.1 Criar script
```bash
sudo nano /opt/tvs-platform/scripts/backup.sh
```

```bash
#!/bin/bash

# Configurações
BACKUP_DIR="/opt/backups/tvs-platform"
DATE=$(date +%Y%m%d_%H%M%S)
DB_USER="tvs_user"
DB_PASS="senha_segura_aqui"
DB_NAME="tvs_platform"
RETENTION_DAYS=30

# Criar diretório de backup se não existir
mkdir -p $BACKUP_DIR

# Backup do banco de dados
echo "Backup do banco de dados..."
mysqldump -u$DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup dos uploads
echo "Backup dos uploads..."
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/tvs-platform/backend/uploads/

# Backup das configurações
echo "Backup das configurações..."
cp /opt/tvs-platform/backend/.env $BACKUP_DIR/env_$DATE.bak

# Remover backups antigos
echo "Limpando backups antigos (>${RETENTION_DAYS} dias)..."
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

echo "Backup concluído: $BACKUP_DIR"
```

#### 7.1.2 Tornar executável e agendar
```bash
sudo chmod +x /opt/tvs-platform/scripts/backup.sh

# Agendar com cron (diário às 2:00 AM)
sudo crontab -e

# Adicionar linha:
0 2 * * * /opt/tvs-platform/scripts/backup.sh >> /var/log/tvs-backup.log 2>&1
```

### 7.2 Script de Backup (Windows)

#### 7.2.1 Criar script PowerShell
```powershell
# C:\inetpub\tvs-platform\scripts\backup.ps1

$BackupDir = "C:\Backups\tvs-platform"
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$RetentionDays = 30

# Criar diretório de backup
New-Item -ItemType Directory -Force -Path $BackupDir

# Backup do banco de dados
Write-Host "Backup do banco de dados..."
mysqldump -u tvs_user -p"senha_segura_aqui" tvs_platform | Out-File -Encoding UTF8 "$BackupDir\db_$Date.sql"
Compress-Archive -Path "$BackupDir\db_$Date.sql" -DestinationPath "$BackupDir\db_$Date.zip"
Remove-Item "$BackupDir\db_$Date.sql"

# Backup dos uploads
Write-Host "Backup dos uploads..."
Compress-Archive -Path "C:\inetpub\tvs-platform\backend\uploads" -DestinationPath "$BackupDir\uploads_$Date.zip"

# Backup das configurações
Copy-Item "C:\inetpub\tvs-platform\backend\.env" -Destination "$BackupDir\env_$Date.bak"

# Remover backups antigos
Get-ChildItem -Path $BackupDir | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force

Write-Host "Backup concluído: $BackupDir"
```

#### 7.2.2 Agendar com Task Scheduler
```powershell
# Criar tarefa agendada (executar como administrador)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\inetpub\tvs-platform\scripts\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "TVS-Platform-Backup" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Backup diário do TVS Platform"
```

---

## 8. MONITORAMENTO E MANUTENÇÃO

### 8.1 Health Check Script

```bash
#!/bin/bash
# /opt/tvs-platform/scripts/health-check.sh

API_URL="http://localhost:5000/api/health"
RESPONSE=$(curl -s $API_URL)
STATUS=$(echo $RESPONSE | jq -r '.status')

if [ "$STATUS" != "healthy" ]; then
    echo "$(date): Sistema não está saudável: $RESPONSE" >> /var/log/tvs-health-check.log
    # Enviar alerta (email, SMS, etc.)
    # ...
else
    echo "$(date): Sistema operacional" >> /var/log/tvs-health-check.log
fi
```

### 8.2 Limpeza de Logs Antigos

```bash
#!/bin/bash
# /opt/tvs-platform/scripts/cleanup-logs.sh

# Limpar logs do aplicativo (>30 dias)
find /opt/tvs-platform/backend/logs -name "*.log" -mtime +30 -delete

# Limpar logs do Nginx (>60 dias)
find /var/log/nginx -name "tvs_*.log" -mtime +60 -delete

# Rotacionar logs (logrotate também pode ser usado)
```

### 8.3 Monitoramento de Disco

```bash
#!/bin/bash
# /opt/tvs-platform/scripts/disk-monitor.sh

THRESHOLD=90
CURRENT=$(df /opt/tvs-platform/backend/uploads | tail -1 | awk '{print $5}' | sed 's/%//')

if [ $CURRENT -gt $THRESHOLD ]; then
    echo "$(date): ALERTA! Disco está em ${CURRENT}% de uso (limite: ${THRESHOLD}%)" >> /var/log/tvs-disk-monitor.log
    # Enviar alerta
fi
```

---

## 9. ATUALIZAÇÃO DO SISTEMA

### 9.1 Processo de Atualização

```bash
#!/bin/bash
# /opt/tvs-platform/scripts/update.sh

echo "Iniciando atualização do TVS Platform..."

# Parar serviço
sudo systemctl stop tvs-backend

# Backup antes de atualizar
/opt/tvs-platform/scripts/backup.sh

# Atualizar código
cd /opt/tvs-platform
git pull origin main

# Atualizar dependências Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt --upgrade

# Executar migrações de banco
flask db upgrade

# Atualizar dependências Frontend
cd ..
npm install

# Rebuild Frontend
npm run build

# Reiniciar serviço
sudo systemctl start tvs-backend

# Verificar health
sleep 10
curl http://localhost:5000/api/health

echo "Atualização concluída!"
```

---

## 10. TROUBLESHOOTING

### 10.1 Problemas Comuns

#### Backend não inicia
```bash
# Verificar logs
sudo journalctl -u tvs-backend -n 50

# Verificar conexão com banco
mysql -u tvs_user -p tvs_platform -e "SELECT 1;"

# Verificar variáveis de ambiente
cat /opt/tvs-platform/backend/.env

# Testar manualmente
cd /opt/tvs-platform/backend
source venv/bin/activate
python app.py
```

#### Erro de conexão com banco de dados
```bash
# Verificar se MySQL está rodando
sudo systemctl status mysql

# Verificar conexão
mysql -u tvs_user -p -h localhost tvs_platform

# Verificar DATABASE_URL no .env
grep DATABASE_URL /opt/tvs-platform/backend/.env
```

#### Upload de arquivo falha
```bash
# Verificar permissões do diretório
ls -la /opt/tvs-platform/backend/uploads/
sudo chown -R www-data:www-data /opt/tvs-platform/backend/uploads/
sudo chmod -R 755 /opt/tvs-platform/backend/uploads/

# Verificar MAX_CONTENT_LENGTH
grep MAX_CONTENT_LENGTH /opt/tvs-platform/backend/.env

# Verificar client_max_body_size no Nginx
grep client_max_body_size /etc/nginx/sites-available/tvs-platform
```

#### WebSocket não conecta
```bash
# Verificar se backend está rodando
curl http://localhost:5000/api/health

# Verificar configuração Nginx para WebSocket
sudo nginx -t

# Verificar logs do Nginx
sudo tail -f /var/log/nginx/tvs_error.log

# Testar conexão WebSocket
# Usar ferramenta como: https://www.piesocket.com/websocket-tester
```

#### Player não sincroniza
```bash
# Verificar logs do backend
sudo journalctl -u tvs-backend -f | grep player

# Verificar se player está online
mysql -u tvs_user -p tvs_platform -e "SELECT id, name, status, last_seen FROM player;"

# Forçar sincronização via API
curl -X POST http://localhost:5000/api/players/{player_id}/command \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"command": "sync"}'
```

---

## 11. CHECKLIST DE DEPLOY

### 11.1 Pré-Deploy
- [ ] Servidor provisionado com specs mínimas
- [ ] Sistema operacional atualizado
- [ ] Dependências instaladas (Python, Node, FFmpeg, MySQL)
- [ ] Certificado SSL obtido (produção)
- [ ] Backup do sistema anterior (Wiplay)

### 11.2 Deploy Backend
- [ ] Código clonado
- [ ] Virtual environment criado
- [ ] Dependências Python instaladas
- [ ] Banco de dados MySQL criado
- [ ] Usuário e permissões do banco configurados
- [ ] Arquivo .env configurado corretamente
- [ ] Chaves secretas geradas (JWT, Flask)
- [ ] Migrações executadas
- [ ] Usuário admin criado
- [ ] Diretório de uploads criado com permissões
- [ ] Serviço systemd/NSSM configurado
- [ ] Backend iniciado e rodando
- [ ] Health check passou

### 11.3 Deploy Frontend
- [ ] Dependências Node instaladas
- [ ] Arquivo .env.production configurado
- [ ] Build de produção executado
- [ ] Build copiado para diretório do Nginx

### 11.4 Infraestrutura
- [ ] Nginx instalado
- [ ] Configuração do site criada
- [ ] SSL configurado (produção)
- [ ] Nginx recarregado
- [ ] Acesso via domínio funcionando
- [ ] HTTPS funcionando (produção)
- [ ] WebSocket funcionando

### 11.5 Backup e Monitoramento
- [ ] Script de backup criado
- [ ] Backup agendado (cron/Task Scheduler)
- [ ] Script de health check criado
- [ ] Monitoramento de disco configurado
- [ ] Logs configurados e rotacionando

### 11.6 Testes Pós-Deploy
- [ ] Login no sistema funciona
- [ ] Upload de conteúdo funciona
- [ ] Criação de campanha funciona
- [ ] Agendamento funciona
- [ ] Player consegue se registrar
- [ ] Player recebe campanha
- [ ] Comandos remotos funcionam
- [ ] Dashboard exibe métricas corretas

### 11.7 Documentação e Treinamento
- [ ] Documentação atualizada
- [ ] Credenciais documentadas (vault seguro)
- [ ] Equipe de suporte treinada
- [ ] Usuários finais treinados
- [ ] Procedimentos de emergência documentados

---

## 12. ROLLBACK PROCEDURE

### 12.1 Em caso de falha crítica

```bash
#!/bin/bash
# /opt/tvs-platform/scripts/rollback.sh

echo "Iniciando rollback..."

# Parar serviço
sudo systemctl stop tvs-backend

# Restaurar código anterior
cd /opt/tvs-platform
git reset --hard HEAD~1

# Restaurar banco de dados do último backup
LATEST_DB_BACKUP=$(ls -t /opt/backups/tvs-platform/db_*.sql.gz | head -1)
gunzip < $LATEST_DB_BACKUP | mysql -u tvs_user -p tvs_platform

# Reinstalar dependências da versão anterior
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Reiniciar serviço
sudo systemctl start tvs-backend

echo "Rollback concluído!"
```

---

## CONCLUSÃO

Este guia cobre todos os aspectos do deploy e configuração do TVS Digital Signage Platform. 

Para suporte adicional:
- **Documentação:** /opt/tvs-platform/docs/
- **Email:** ti-dev@empresa.com
- **Tickets:** helpdesk.empresa.com

---

**Documento preparado por:** Leonardo Fragoso  
**Data:** Novembro 2024  
**Versão:** 1.0
