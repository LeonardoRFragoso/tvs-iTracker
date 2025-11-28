# Guia de Configuração - MariaDB em Produção

**Versão:** 1.0  
**Data:** 28/11/2024  
**Sistema:** TVS iTracker - Digital Signage Platform

---

## 📋 Pré-requisitos

- MariaDB 10.5+ ou MySQL 8.0+ instalado
- Python 3.8+ com pip
- Acesso root ao banco de dados
- Rede configurada para acesso dos Chromecasts

---

## 🗄️ 1. Instalação do MariaDB

### Windows:
```powershell
# Baixe o instalador em: https://mariadb.org/download/
# Execute o instalador e configure a senha root
```

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install mariadb-server mariadb-client
sudo mysql_secure_installation
```

### Linux (CentOS/RHEL):
```bash
sudo yum install mariadb-server mariadb
sudo systemctl start mariadb
sudo systemctl enable mariadb
sudo mysql_secure_installation
```

---

## 🔧 2. Configuração do Banco de Dados

### 2.1. Criar o Banco de Dados

```sql
-- Conectar como root
mysql -u root -p

-- Criar banco de dados com charset UTF-8
CREATE DATABASE tvs_itracker 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;
```

### 2.2. Criar Usuário Dedicado

```sql
-- Criar usuário para a aplicação
CREATE USER 'tvs_user'@'localhost' IDENTIFIED BY 'SENHA_FORTE_AQUI';

-- Se o backend estiver em outro servidor, use:
CREATE USER 'tvs_user'@'%' IDENTIFIED BY 'SENHA_FORTE_AQUI';
-- ou especifique o IP:
CREATE USER 'tvs_user'@'192.168.1.100' IDENTIFIED BY 'SENHA_FORTE_AQUI';

-- Conceder privilégios
GRANT ALL PRIVILEGES ON tvs_itracker.* TO 'tvs_user'@'localhost';
FLUSH PRIVILEGES;

-- Verificar usuário criado
SELECT User, Host FROM mysql.user WHERE User = 'tvs_user';

-- Sair
EXIT;
```

### 2.3. Testar Conexão

```bash
# Testar login com novo usuário
mysql -u tvs_user -p tvs_itracker

# Se conectar com sucesso, está OK!
```

---

## ⚙️ 3. Configuração do Backend

### 3.1. Instalar Driver Python

```bash
# Ativar ambiente virtual
cd backend
.\venv\Scripts\Activate.ps1  # Windows
source venv/bin/activate      # Linux/Mac

# Instalar PyMySQL
pip install pymysql cryptography
```

### 3.2. Configurar .env

```bash
# Copiar template de produção
cp .env.production.example .env

# Editar .env com suas credenciais
notepad .env  # Windows
nano .env     # Linux
```

**Exemplo de configuração:**

```env
# Database Configuration
DATABASE_URL=mysql+pymysql://tvs_user:SuaSenhaForte123@localhost:3306/tvs_itracker

# Security Keys (gere novas!)
SECRET_KEY=sua-chave-secreta-gerada
JWT_SECRET_KEY=sua-chave-jwt-gerada

# Flask
FLASK_ENV=production
FLASK_DEBUG=False

# Media Base URL (IP acessível pelos Chromecasts)
MEDIA_BASE_URL=http://192.168.1.100:5000

# Upload
UPLOAD_FOLDER=uploads
MAX_CONTENT_LENGTH=104857600

# Socket.IO
SOCKETIO_ASYNC_MODE=eventlet
REACT_APP_SOCKET_URL=http://192.168.1.100:5000
```

### 3.3. Gerar Chaves de Segurança

```bash
# Gerar SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"

# Gerar JWT_SECRET_KEY
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(32))"

# Copie e cole no .env
```

---

## 🚀 4. Inicialização do Banco de Dados

### 4.1. Executar Migrations

```bash
# Ativar ambiente virtual
cd backend
.\venv\Scripts\Activate.ps1  # Windows

# Executar migrations
flask db upgrade

# Ou usar o script de inicialização
python init_db.py
```

### 4.2. Verificar Tabelas Criadas

```sql
-- Conectar ao banco
mysql -u tvs_user -p tvs_itracker

-- Listar tabelas
SHOW TABLES;

-- Deve mostrar algo como:
-- +------------------------+
-- | Tables_in_tvs_itracker |
-- +------------------------+
-- | users                  |
-- | locations              |
-- | players                |
-- | content                |
-- | campaigns              |
-- | schedules              |
-- | ...                    |
-- +------------------------+

-- Verificar estrutura de uma tabela
DESCRIBE players;

EXIT;
```

---

## 🔐 5. Segurança em Produção

### 5.1. Configuração do MariaDB

Edite o arquivo de configuração:

**Linux:** `/etc/mysql/mariadb.conf.d/50-server.cnf`  
**Windows:** `C:\Program Files\MariaDB\data\my.ini`

```ini
[mysqld]
# Bind apenas no IP necessário
bind-address = 0.0.0.0  # ou IP específico

# Configurações de performance
max_connections = 100
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M

# Configurações de segurança
local_infile = 0
skip_name_resolve = 1

# Charset padrão
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Logs
log_error = /var/log/mysql/error.log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```

Reinicie o MariaDB:

```bash
# Linux
sudo systemctl restart mariadb

# Windows
net stop MariaDB
net start MariaDB
```

### 5.2. Firewall

```bash
# Linux - Permitir acesso ao MariaDB apenas da rede local
sudo ufw allow from 192.168.1.0/24 to any port 3306

# Ou apenas do servidor backend
sudo ufw allow from 192.168.1.100 to any port 3306
```

### 5.3. Backup Automático

Crie um script de backup:

**Linux:** `/usr/local/bin/backup_tvs.sh`

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/tvs_itracker"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tvs_itracker_$DATE.sql.gz"

# Criar diretório se não existir
mkdir -p $BACKUP_DIR

# Fazer backup
mysqldump -u tvs_user -p'SENHA_AQUI' tvs_itracker | gzip > $BACKUP_FILE

# Manter apenas últimos 30 dias
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup concluído: $BACKUP_FILE"
```

Configure o cron:

```bash
# Editar crontab
crontab -e

# Adicionar backup diário às 3h da manhã
0 3 * * * /usr/local/bin/backup_tvs.sh >> /var/log/tvs_backup.log 2>&1
```

---

## 🧪 6. Testes de Conexão

### 6.1. Teste Python

```python
# test_db_connection.py
from sqlalchemy import create_engine, text

DATABASE_URL = "mysql+pymysql://tvs_user:SENHA@localhost:3306/tvs_itracker"

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT VERSION()"))
        version = result.fetchone()[0]
        print(f"✅ Conexão OK! MariaDB versão: {version}")
except Exception as e:
    print(f"❌ Erro na conexão: {e}")
```

Execute:

```bash
python test_db_connection.py
```

### 6.2. Teste da Aplicação

```bash
# Iniciar servidor
python app.py

# Em outro terminal, testar API
curl http://localhost:5000/api/health
```

---

## 📊 7. Monitoramento

### 7.1. Verificar Status

```sql
-- Conexões ativas
SHOW PROCESSLIST;

-- Status do servidor
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Uptime';

-- Tamanho do banco
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'tvs_itracker'
GROUP BY table_schema;
```

### 7.2. Logs

```bash
# Linux - Ver logs de erro
sudo tail -f /var/log/mysql/error.log

# Linux - Ver queries lentas
sudo tail -f /var/log/mysql/slow.log
```

---

## 🔄 8. Migração de SQLite para MariaDB

Se você já tem dados em SQLite:

```bash
# 1. Exportar dados do SQLite
sqlite3 tvs_platform.db .dump > dump.sql

# 2. Converter para MySQL (remover incompatibilidades)
sed -i 's/AUTOINCREMENT/AUTO_INCREMENT/g' dump.sql
sed -i '/BEGIN TRANSACTION;/d' dump.sql
sed -i '/COMMIT;/d' dump.sql

# 3. Importar no MariaDB
mysql -u tvs_user -p tvs_itracker < dump.sql
```

---

## ⚠️ Troubleshooting

### Erro: "Access denied for user"

```bash
# Verificar usuário e host
mysql -u root -p
SELECT User, Host FROM mysql.user WHERE User = 'tvs_user';

# Recriar permissões se necessário
GRANT ALL PRIVILEGES ON tvs_itracker.* TO 'tvs_user'@'localhost';
FLUSH PRIVILEGES;
```

### Erro: "Can't connect to MySQL server"

```bash
# Verificar se MariaDB está rodando
sudo systemctl status mariadb  # Linux
net start | findstr MariaDB    # Windows

# Verificar porta
netstat -an | grep 3306
```

### Erro: "Unknown database"

```sql
-- Listar bancos existentes
SHOW DATABASES;

-- Criar se não existir
CREATE DATABASE tvs_itracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Performance lenta

```sql
-- Analisar queries lentas
SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;

-- Otimizar tabelas
OPTIMIZE TABLE players;
OPTIMIZE TABLE content;
OPTIMIZE TABLE campaigns;
```

---

## 📝 Checklist de Produção

- [ ] MariaDB instalado e rodando
- [ ] Banco de dados `tvs_itracker` criado
- [ ] Usuário `tvs_user` criado com permissões
- [ ] Arquivo `.env` configurado com credenciais corretas
- [ ] Chaves de segurança geradas e configuradas
- [ ] PyMySQL instalado no ambiente virtual
- [ ] Migrations executadas com sucesso
- [ ] Tabelas criadas e verificadas
- [ ] Teste de conexão Python funcionando
- [ ] Backup automático configurado
- [ ] Firewall configurado (se necessário)
- [ ] Logs de erro monitorados
- [ ] MEDIA_BASE_URL configurado com IP acessível
- [ ] Aplicação iniciando sem erros

---

## 📞 Suporte

**Documentação Adicional:**
- [MariaDB Official Docs](https://mariadb.com/kb/en/)
- [SQLAlchemy MySQL Dialect](https://docs.sqlalchemy.org/en/14/dialects/mysql.html)
- [PyMySQL Documentation](https://pymysql.readthedocs.io/)

**Contato:**
- Responsável: Leonardo Fragoso
- Email: leonardo.fragoso@empresa.com

---

**Documento criado em:** 28/11/2024  
**Última atualização:** 28/11/2024
