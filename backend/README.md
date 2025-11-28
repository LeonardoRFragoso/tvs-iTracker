# Backend - TVS iTracker

## 🚀 Setup Rápido

### 1. Configurar Banco de Dados

```bash
# Execute como root
sudo bash setup_database.sh
```

Este script irá:
- ✅ Criar banco `tvs_itracker`
- ✅ Criar usuário `tvs_user`
- ✅ Gerar senha segura
- ✅ Exibir string de conexão

### 2. Configurar .env

```bash
# Editar arquivo
nano .env

# Colar a string DATABASE_URL fornecida pelo script
```

### 3. Instalar Dependências

```bash
# Criar ambiente virtual (se não existir)
python3 -m venv venv

# Ativar
source venv/bin/activate

# Instalar
pip install -r requirements.txt
```

### 4. Inicializar Banco

```bash
# Executar migrations
flask db upgrade

# OU
python init_db.py
```

### 5. Iniciar Servidor

```bash
python app.py
```

---

## 📁 Estrutura

```
backend/
├── app.py                    # Aplicação principal
├── database.py               # Configuração do banco
├── init_db.py               # Script de inicialização
├── setup_database.sh        # Setup automático do MariaDB
├── generate_keys.py         # Gerador de chaves de segurança
├── .env                     # Configurações (não commitar!)
├── .env.production.example  # Template para produção
├── models/                  # Modelos do banco de dados
├── routes/                  # Rotas da API
├── services/                # Serviços (Chromecast, etc)
├── migrations/              # Migrations do banco
└── uploads/                 # Arquivos enviados
```

---

## 🔧 Scripts Úteis

### setup_database.sh
Configura o banco de dados MariaDB automaticamente.

```bash
sudo bash setup_database.sh
```

### generate_keys.py
Gera chaves de segurança para o .env.

```bash
python generate_keys.py
```

### init_db.py
Inicializa o banco de dados e cria usuário admin.

```bash
python init_db.py
```

---

## 📝 Variáveis de Ambiente (.env)

```env
# Banco de Dados
DATABASE_URL=mysql+pymysql://tvs_user:senha@localhost:3306/tvs_itracker

# Segurança
SECRET_KEY=sua-chave-secreta
JWT_SECRET_KEY=sua-chave-jwt

# Flask
FLASK_ENV=production
FLASK_DEBUG=False

# Media
MEDIA_BASE_URL=http://192.168.1.100:5000

# Upload
UPLOAD_FOLDER=uploads
MAX_CONTENT_LENGTH=104857600
```

---

## 🗄️ Banco de Dados

### Ver credenciais salvas

```bash
sudo cat /root/.tvs_itracker_credentials
```

### Conectar ao banco

```bash
mysql -u tvs_user -p tvs_itracker
```

### Backup

```bash
mysqldump -u tvs_user -p tvs_itracker > backup.sql
```

---

## 🔍 Troubleshooting

### Erro de conexão com banco

1. Verificar se MariaDB está rodando:
   ```bash
   sudo systemctl status mariadb
   ```

2. Verificar credenciais no .env

3. Testar conexão:
   ```bash
   mysql -u tvs_user -p tvs_itracker
   ```

### Erro ao iniciar aplicação

1. Verificar logs:
   ```bash
   python app.py
   ```

2. Verificar .env existe e está configurado

3. Verificar dependências instaladas:
   ```bash
   pip list
   ```

---

## 📚 Documentação

- [Configuração MariaDB](../docs/CONFIGURACAO_MARIADB_PRODUCAO.md)
- [Guia de Deploy](../docs/GUIA_DEPLOY_PRODUCAO.md)
- [Comandos do Servidor](../COMANDOS_SERVIDOR.md)

---

**Última atualização:** 28/11/2024
