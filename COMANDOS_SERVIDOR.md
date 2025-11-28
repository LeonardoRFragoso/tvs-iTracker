# Comandos Rápidos - Servidor de Produção

## 🚀 Setup Inicial (Primeira vez)

### 1. Instalar MariaDB (se não estiver instalado)

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar MariaDB
sudo apt install -y mariadb-server mariadb-client

# Iniciar MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Configurar segurança
sudo mysql_secure_installation
```

### 2. Configurar Banco de Dados

```bash
# Navegar até o projeto
cd /srv/streaming/tvs-iTracker

# Dar permissão ao script
chmod +x backend/setup_database.sh

# Executar configuração do banco (como root)
sudo bash backend/setup_database.sh
```

**O script irá:**
- ✅ Criar banco `tvs_itracker`
- ✅ Criar usuário `tvs_user`
- ✅ Gerar senha segura automaticamente
- ✅ Exibir string de conexão
- ✅ Salvar credenciais em `/root/.tvs_itracker_credentials`

### 3. Configurar arquivo .env

```bash
# Copiar string de conexão exibida pelo script anterior
# Editar .env
nano backend/.env

# Colar a linha DATABASE_URL fornecida pelo script
# Exemplo:
# DATABASE_URL=mysql+pymysql://tvs_user:SenhaGerada123@localhost:3306/tvs_itracker

# Salvar: Ctrl+O, Enter, Ctrl+X
```

### 4. Executar Deploy

```bash
# Dar permissão ao script de deploy
chmod +x deploy-tv.sh

# Executar deploy
./deploy-tv.sh
```

### 5. Inicializar Banco de Dados

```bash
cd backend

# Ativar ambiente virtual
source venv/bin/activate

# Executar migrations
flask db upgrade

# OU usar script de inicialização
python init_db.py
```

### 6. Iniciar Aplicação

```bash
# Ainda no diretório backend com venv ativado
python app.py
```

---

## 🔄 Atualização do Sistema

### Atualizar código do Git

```bash
cd /srv/streaming/tvs-iTracker

# Parar aplicação (se estiver rodando como serviço)
sudo systemctl stop tvs-itracker

# Atualizar código
git pull origin main

# Executar deploy novamente
./deploy-tv.sh

# Aplicar migrations (se houver)
cd backend
source venv/bin/activate
flask db upgrade

# Reiniciar aplicação
sudo systemctl start tvs-itracker
```

---

## 🔍 Verificações

### Ver credenciais do banco

```bash
# Como root
sudo cat /root/.tvs_itracker_credentials
```

### Testar conexão com banco

```bash
# Conectar ao banco
mysql -u tvs_user -p tvs_itracker

# Listar tabelas
SHOW TABLES;

# Sair
EXIT;
```

### Verificar se aplicação está rodando

```bash
# Verificar processo
ps aux | grep python

# Testar API
curl http://localhost:5000/api/health
```

---

## 🗄️ Comandos do Banco de Dados

### Backup do banco

```bash
# Backup completo
mysqldump -u tvs_user -p tvs_itracker > backup_$(date +%Y%m%d).sql

# Backup compactado
mysqldump -u tvs_user -p tvs_itracker | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restaurar backup

```bash
# Restaurar de arquivo SQL
mysql -u tvs_user -p tvs_itracker < backup_20241128.sql

# Restaurar de arquivo compactado
gunzip < backup_20241128.sql.gz | mysql -u tvs_user -p tvs_itracker
```

### Ver tamanho do banco

```bash
mysql -u tvs_user -p -e "
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'tvs_itracker'
GROUP BY table_schema;
"
```

### Listar tabelas e registros

```bash
mysql -u tvs_user -p tvs_itracker -e "
SELECT 
    TABLE_NAME,
    TABLE_ROWS
FROM information_schema.tables
WHERE table_schema = 'tvs_itracker'
ORDER BY TABLE_NAME;
"
```

---

## 🔧 Troubleshooting

### Erro: "Access denied for user"

```bash
# Reconfigurar banco de dados
sudo bash backend/setup_database.sh

# Atualizar .env com nova string de conexão
nano backend/.env
```

### Erro: "Can't connect to MySQL server"

```bash
# Verificar se MariaDB está rodando
sudo systemctl status mariadb

# Iniciar se necessário
sudo systemctl start mariadb

# Ver logs de erro
sudo tail -f /var/log/mysql/error.log
```

### Erro: "Unknown database"

```bash
# Verificar bancos existentes
mysql -u root -p -e "SHOW DATABASES;"

# Recriar banco se necessário
sudo bash backend/setup_database.sh
```

### Aplicação não inicia

```bash
# Ver logs do Python
cd backend
source venv/bin/activate
python app.py

# Verificar .env
cat .env

# Testar conexão com banco
python -c "
from database import db
from app import app
with app.app_context():
    db.create_all()
    print('OK')
"
```

---

## 📊 Monitoramento

### Ver logs em tempo real

```bash
# Logs da aplicação (se usando systemd)
sudo journalctl -u tvs-itracker -f

# Logs do MariaDB
sudo tail -f /var/log/mysql/error.log
```

### Verificar uso de recursos

```bash
# Uso de CPU e memória
htop

# Uso de disco
df -h

# Processos Python
ps aux | grep python

# Conexões MySQL
mysql -u root -p -e "SHOW PROCESSLIST;"
```

---

## 🔐 Segurança

### Alterar senha do usuário do banco

```bash
mysql -u root -p
```

```sql
ALTER USER 'tvs_user'@'localhost' IDENTIFIED BY 'nova_senha_forte';
FLUSH PRIVILEGES;
EXIT;
```

Depois atualizar o `.env`:

```bash
nano backend/.env
# Alterar DATABASE_URL com nova senha
```

### Ver usuários do banco

```bash
mysql -u root -p -e "SELECT User, Host FROM mysql.user;"
```

---

## 📝 Comandos Úteis do Git

### Ver status

```bash
cd /srv/streaming/tvs-iTracker
git status
git log --oneline -5
```

### Descartar alterações locais

```bash
git reset --hard HEAD
git clean -fd
```

### Atualizar branch específica

```bash
git fetch origin
git checkout main
git pull origin main
```

---

## 🎯 Checklist Rápido

- [ ] MariaDB instalado e rodando
- [ ] Banco `tvs_itracker` criado
- [ ] Usuário `tvs_user` configurado
- [ ] Arquivo `backend/.env` configurado
- [ ] Deploy executado com sucesso
- [ ] Migrations aplicadas
- [ ] Aplicação iniciando sem erros
- [ ] API respondendo em `/api/health`
- [ ] Chromecast consegue acessar o servidor

---

## 📞 Suporte

**Documentação Completa:**
- `docs/GUIA_DEPLOY_PRODUCAO.md`
- `docs/CONFIGURACAO_MARIADB_PRODUCAO.md`

**Contato:**
- Leonardo Fragoso
- leonardo.fragoso@empresa.com

---

**Última atualização:** 28/11/2024
