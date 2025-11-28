# Guia de Deploy em Produção - TVS iTracker

**Versão:** 1.0  
**Data:** 28/11/2024  
**Ambiente:** Linux (Ubuntu/Debian)

---

## 📋 Pré-requisitos no Servidor

### Software Necessário:
- Ubuntu 20.04+ ou Debian 11+
- MariaDB 10.5+ ou MySQL 8.0+
- Python 3.8+
- Node.js 18+
- Git

---

## 🚀 Passo a Passo de Deploy

### 1. Preparar o Servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências
sudo apt install -y git python3 python3-venv python3-pip \
                    mariadb-server mariadb-client \
                    nodejs npm build-essential

# Verificar versões
python3 --version  # Deve ser 3.8+
node --version     # Deve ser 18+
mysql --version    # MariaDB 10.5+
```

---

### 2. Configurar MariaDB

```bash
# Configurar MariaDB
sudo mysql_secure_installation

# Criar banco de dados
sudo mysql -u root -p
```

```sql
-- Criar banco
CREATE DATABASE tvs_itracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar usuário
CREATE USER 'tvs_user'@'localhost' IDENTIFIED BY 'SENHA_FORTE_AQUI';
GRANT ALL PRIVILEGES ON tvs_itracker.* TO 'tvs_user'@'localhost';
FLUSH PRIVILEGES;

-- Verificar
SHOW DATABASES;
SELECT User, Host FROM mysql.user WHERE User = 'tvs_user';

EXIT;
```

---

### 3. Clonar o Repositório

```bash
# Criar diretório para aplicação
sudo mkdir -p /opt/tvs-itracker
sudo chown $USER:$USER /opt/tvs-itracker

# Clonar repositório
cd /opt
git clone <URL_DO_REPOSITORIO> tvs-itracker
cd tvs-itracker
```

---

### 4. Executar Script de Deploy

```bash
# Dar permissão de execução
chmod +x deploy-tv.sh

# Executar deploy (apenas preparar)
./deploy-tv.sh

# Isso irá:
# - Instalar dependências npm
# - Fazer build do React
# - Criar ambiente virtual Python
# - Instalar dependências Python
# - Criar arquivo backend/.env (se não existir)
```

---

### 5. Configurar Arquivo .env

O script criou o arquivo `backend/.env` automaticamente. Agora você precisa editá-lo:

```bash
# Editar .env
nano backend/.env
```

**Configure as seguintes variáveis:**

```env
# Database - IMPORTANTE: Altere com suas credenciais!
DATABASE_URL=mysql+pymysql://tvs_user:SUA_SENHA_REAL@localhost:3306/tvs_itracker

# Security Keys - Já foram geradas automaticamente, mas você pode trocar
SECRET_KEY=<chave-gerada-automaticamente>
JWT_SECRET_KEY=<chave-gerada-automaticamente>

# Flask
FLASK_ENV=production
FLASK_DEBUG=False

# Media Base URL - Use o IP do servidor
MEDIA_BASE_URL=http://192.168.1.100:5000

# Socket.IO
REACT_APP_SOCKET_URL=http://192.168.1.100:5000
```

**Salvar:** `Ctrl+O`, `Enter`, `Ctrl+X`

---

### 6. Inicializar Banco de Dados

```bash
cd backend

# Ativar ambiente virtual
source venv/bin/activate

# Executar migrations
flask db upgrade

# OU usar script de inicialização
python init_db.py

# Verificar se tabelas foram criadas
mysql -u tvs_user -p tvs_itracker -e "SHOW TABLES;"
```

---

### 7. Testar Aplicação

```bash
# Ainda no diretório backend com venv ativado
python app.py

# Em outro terminal, testar
curl http://localhost:5000/api/health
```

Se funcionar, pressione `Ctrl+C` para parar.

---

### 8. Configurar Systemd (Serviço)

Crie um arquivo de serviço:

```bash
sudo nano /etc/systemd/system/tvs-itracker.service
```

**Conteúdo:**

```ini
[Unit]
Description=TVS iTracker - Digital Signage Platform
After=network.target mariadb.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/tvs-itracker/backend
Environment="PATH=/opt/tvs-itracker/backend/venv/bin"
Environment="TV_MODE=false"
ExecStart=/opt/tvs-itracker/backend/venv/bin/python app.py
Restart=always
RestartSec=10

# Logs
StandardOutput=append:/var/log/tvs-itracker/access.log
StandardError=append:/var/log/tvs-itracker/error.log

[Install]
WantedBy=multi-user.target
```

**Configurar permissões e logs:**

```bash
# Criar diretório de logs
sudo mkdir -p /var/log/tvs-itracker
sudo chown www-data:www-data /var/log/tvs-itracker

# Ajustar permissões da aplicação
sudo chown -R www-data:www-data /opt/tvs-itracker

# Recarregar systemd
sudo systemctl daemon-reload

# Iniciar serviço
sudo systemctl start tvs-itracker

# Verificar status
sudo systemctl status tvs-itracker

# Habilitar para iniciar no boot
sudo systemctl enable tvs-itracker
```

---

### 9. Configurar Nginx (Opcional mas Recomendado)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Criar configuração
sudo nano /etc/nginx/sites-available/tvs-itracker
```

**Conteúdo:**

```nginx
server {
    listen 80;
    server_name seu-dominio.com;  # ou IP do servidor

    # Logs
    access_log /var/log/nginx/tvs-itracker-access.log;
    error_log /var/log/nginx/tvs-itracker-error.log;

    # Proxy para backend Flask
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://127.0.0.1:5000/socket.io;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Uploads (arquivos grandes)
    client_max_body_size 100M;
}
```

**Ativar configuração:**

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/tvs-itracker /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

---

### 10. Configurar Firewall

```bash
# Permitir HTTP e HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Se não usar Nginx, permitir porta 5000
sudo ufw allow 5000/tcp

# Habilitar firewall
sudo ufw enable

# Verificar status
sudo ufw status
```

---

## 🔧 Comandos Úteis de Manutenção

### Gerenciar Serviço:

```bash
# Ver status
sudo systemctl status tvs-itracker

# Parar
sudo systemctl stop tvs-itracker

# Iniciar
sudo systemctl start tvs-itracker

# Reiniciar
sudo systemctl restart tvs-itracker

# Ver logs
sudo journalctl -u tvs-itracker -f
```

### Ver Logs:

```bash
# Logs da aplicação
tail -f /var/log/tvs-itracker/error.log
tail -f /var/log/tvs-itracker/access.log

# Logs do Nginx
tail -f /var/log/nginx/tvs-itracker-error.log
```

### Atualizar Aplicação:

```bash
# Parar serviço
sudo systemctl stop tvs-itracker

# Atualizar código
cd /opt/tvs-itracker
git pull origin main

# Executar deploy novamente
./deploy-tv.sh

# Reiniciar serviço
sudo systemctl start tvs-itracker
```

---

## 🔐 Segurança

### 1. SSL/HTTPS com Let's Encrypt:

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d seu-dominio.com

# Renovação automática já está configurada
```

### 2. Backup Automático:

```bash
# Criar script de backup
sudo nano /usr/local/bin/backup-tvs.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/tvs-itracker"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup do banco
mysqldump -u tvs_user -p'SENHA' tvs_itracker | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup dos uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/tvs-itracker/backend/uploads

# Manter apenas últimos 30 dias
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup concluído: $DATE"
```

```bash
# Dar permissão
sudo chmod +x /usr/local/bin/backup-tvs.sh

# Agendar no cron (diário às 3h)
sudo crontab -e
```

Adicionar:
```
0 3 * * * /usr/local/bin/backup-tvs.sh >> /var/log/tvs-backup.log 2>&1
```

---

## 📊 Monitoramento

### Verificar Saúde da Aplicação:

```bash
# API Health Check
curl http://localhost:5000/api/health

# Verificar conexões do banco
mysql -u tvs_user -p tvs_itracker -e "SHOW PROCESSLIST;"

# Uso de disco
df -h

# Uso de memória
free -h

# Processos Python
ps aux | grep python
```

---

## ⚠️ Troubleshooting

### Aplicação não inicia:

```bash
# Ver logs detalhados
sudo journalctl -u tvs-itracker -n 100 --no-pager

# Verificar .env
cat backend/.env

# Testar conexão com banco
mysql -u tvs_user -p tvs_itracker
```

### Erro de conexão com banco:

```sql
-- Verificar usuário
SELECT User, Host FROM mysql.user WHERE User = 'tvs_user';

-- Recriar permissões
GRANT ALL PRIVILEGES ON tvs_itracker.* TO 'tvs_user'@'localhost';
FLUSH PRIVILEGES;
```

### Chromecast não conecta:

1. Verificar `MEDIA_BASE_URL` no `.env`
2. Deve ser IP acessível na rede local
3. Não usar `localhost` ou `127.0.0.1`
4. Testar: `curl http://SEU_IP:5000/api/health`

---

## 📞 Suporte

**Documentação:**
- `docs/CONFIGURACAO_MARIADB_PRODUCAO.md`
- `docs/CHANGELOG_CHROMECAST4_SIMPLIFICATION.md`
- `docs/GUIA_TESTE_CHROMECAST4.md`

**Contato:**
- Leonardo Fragoso
- leonardo.fragoso@empresa.com

---

**Documento criado em:** 28/11/2024
