#!/usr/bin/env bash

# Script para configurar banco de dados MariaDB/MySQL
# Uso: sudo ./setup_database.sh

set -euo pipefail

echo "=================================================="
echo "TVS iTracker - Configuração do Banco de Dados"
echo "=================================================="
echo

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
  echo "[ERRO] Este script precisa ser executado como root (sudo)"
  exit 1
fi

# Verificar se MariaDB/MySQL está instalado
if ! command -v mysql &> /dev/null; then
    echo "[ERRO] MariaDB/MySQL não encontrado!"
    echo "Instale com: sudo apt install mariadb-server mariadb-client"
    exit 1
fi

# Verificar se MariaDB está rodando
if ! systemctl is-active --quiet mariadb && ! systemctl is-active --quiet mysql; then
    echo "[ERRO] MariaDB/MySQL não está rodando!"
    echo "Inicie com: sudo systemctl start mariadb"
    exit 1
fi

# Configurações padrão
DB_NAME="tvs_itracker"
DB_USER="tvs_user"
DB_CHARSET="utf8mb4"
DB_COLLATION="utf8mb4_unicode_ci"

echo "Configurações:"
echo "  - Banco de dados: $DB_NAME"
echo "  - Usuário: $DB_USER"
echo "  - Charset: $DB_CHARSET"
echo "  - Collation: $DB_COLLATION"
echo

# Solicitar senha do root do MySQL
echo "Digite a senha do root do MariaDB/MySQL:"
read -s MYSQL_ROOT_PASSWORD
echo

# Testar conexão
if ! mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1;" &> /dev/null; then
    echo "[ERRO] Não foi possível conectar ao MariaDB com as credenciais fornecidas."
    exit 1
fi

echo "[OK] Conexão com MariaDB estabelecida."
echo

# Gerar senha aleatória para o usuário da aplicação
DB_PASSWORD=$(python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters + string.digits + '!@#$%^&*') for _ in range(20)))")

echo "Senha gerada para o usuário '$DB_USER': $DB_PASSWORD"
echo "⚠️  IMPORTANTE: Anote esta senha! Ela será necessária no arquivo .env"
echo

# Verificar se o banco já existe
DB_EXISTS=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES LIKE '$DB_NAME';" | grep -c "$DB_NAME" || true)

if [ "$DB_EXISTS" -gt 0 ]; then
    echo "[AVISO] Banco de dados '$DB_NAME' já existe!"
    read -p "Deseja recriar o banco? Isso apagará todos os dados! (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo "[INFO] Removendo banco existente..."
        mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS $DB_NAME;"
        echo "[OK] Banco removido."
    else
        echo "[INFO] Mantendo banco existente."
        DB_NAME_CREATED=false
    fi
fi

# Criar banco de dados
if [ "${DB_NAME_CREATED:-true}" != "false" ]; then
    echo "[INFO] Criando banco de dados '$DB_NAME'..."
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME 
  CHARACTER SET $DB_CHARSET 
  COLLATE $DB_COLLATION;
EOF
    echo "[OK] Banco de dados criado."
fi

# Verificar se usuário já existe
USER_EXISTS=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT COUNT(*) FROM mysql.user WHERE User='$DB_USER' AND Host='localhost';" | tail -n 1)

if [ "$USER_EXISTS" -gt 0 ]; then
    echo "[INFO] Usuário '$DB_USER' já existe. Atualizando senha..."
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
FLUSH PRIVILEGES;
EOF
else
    echo "[INFO] Criando usuário '$DB_USER'..."
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
EOF
fi

# Conceder privilégios
echo "[INFO] Concedendo privilégios..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "[OK] Privilégios concedidos."
echo

# Verificar criação
echo "[INFO] Verificando configuração..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
SELECT User, Host FROM mysql.user WHERE User='$DB_USER';
SHOW DATABASES LIKE '$DB_NAME';
EOF

# Testar conexão com novo usuário
echo
echo "[INFO] Testando conexão com novo usuário..."
if mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT 1;" &> /dev/null; then
    echo "[OK] Conexão bem-sucedida!"
else
    echo "[ERRO] Falha ao conectar com novo usuário."
    exit 1
fi

echo
echo "=================================================="
echo "✅ Configuração concluída com sucesso!"
echo "=================================================="
echo
echo "📋 INFORMAÇÕES IMPORTANTES:"
echo
echo "Banco de dados: $DB_NAME"
echo "Usuário: $DB_USER"
echo "Senha: $DB_PASSWORD"
echo
echo "String de conexão para o .env:"
echo "DATABASE_URL=mysql+pymysql://$DB_USER:$DB_PASSWORD@localhost:3306/$DB_NAME"
echo
echo "=================================================="
echo "PRÓXIMOS PASSOS:"
echo "=================================================="
echo
echo "1. Copie a string de conexão acima"
echo "2. Edite o arquivo backend/.env"
echo "3. Cole a string no DATABASE_URL"
echo "4. Execute: cd backend && source venv/bin/activate"
echo "5. Execute: flask db upgrade (ou python init_db.py)"
echo "6. Inicie a aplicação: python app.py"
echo
echo "⚠️  SEGURANÇA: Guarde a senha em local seguro!"
echo

# Salvar informações em arquivo (apenas root pode ler)
CREDENTIALS_FILE="/root/.tvs_itracker_credentials"
cat > "$CREDENTIALS_FILE" <<EOF
# TVS iTracker - Credenciais do Banco de Dados
# Gerado em: $(date)

DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# String de conexão:
DATABASE_URL=mysql+pymysql://$DB_USER:$DB_PASSWORD@localhost:3306/$DB_NAME
EOF

chmod 600 "$CREDENTIALS_FILE"
echo "💾 Credenciais salvas em: $CREDENTIALS_FILE (apenas root pode ler)"
echo
