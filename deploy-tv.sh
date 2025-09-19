#!/usr/bin/env bash

# TVs iTracker - Deploy Modo TV (Linux/Ubuntu)
# Equivalente ao deploy-tv.bat para ambientes Linux
# Uso:
#   ./deploy-tv.sh            # Apenas build + preparar backend (porta 5000 por padrão)
#   ./deploy-tv.sh --run      # Build + preparar + iniciar backend (porta 5000)
#   ./deploy-tv.sh --port80 --run   # Build + preparar + iniciar backend na porta 80 (requer sudo ou setcap)
#   ./deploy-tv.sh --tv --run       # Alias para --port80

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

step() {
  echo
  echo "=================================================="
  echo "[STEP] $1"
  echo "=================================================="
}

die() { echo "[ERRO] $*" >&2; exit 1; }

# Parse de argumentos
PORT80=false
RUN_AFTER=false
for arg in "$@"; do
  case "$arg" in
    --port80|--tv) PORT80=true ;;
    --run) RUN_AFTER=true ;;
    -h|--help)
      grep '^# ' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "[AVISO] Argumento desconhecido: $arg" ;;
  esac
done

# Verificações de dependência
command -v node >/dev/null 2>&1 || die "Node.js não encontrado. Instale Node 18+ (ex.: NodeSource)."
command -v npm  >/dev/null 2>&1 || die "npm não encontrado. Instale npm (vem com Node)."
command -v python3 >/dev/null 2>&1 || die "python3 não encontrado. sudo apt-get install -y python3 python3-venv python3-pip"

# 1) Variáveis de ambiente
step "[1/4] Configurando variáveis de ambiente"
export NODE_ENV=production
# Axios usará same-origin; evitar base URL fixa
unset REACT_APP_API_URL || true

# 2) Build do React
step "[2/4] Fazendo build da aplicação React"
if [ -f package-lock.json ]; then
  echo "[INFO] Instalando dependências com npm ci..."
  npm ci
else
  echo "[INFO] Instalando dependências com npm install..."
  npm install
fi
npm run build

# 3) Copiar build para backend/build
step "[3/4] Copiando build gerado para backend/build"
rm -rf backend/build
mkdir -p backend/build
cp -r build/* backend/build/

# 4) Preparar backend (venv + deps)
step "[4/4] Preparando backend (venv + dependências)"
if [ ! -d backend/venv ]; then
  python3 -m venv backend/venv
fi
backend/venv/bin/python -m pip install --upgrade pip
backend/venv/bin/pip install -r requirements.txt

# Descobrir IP local (para exibir URLs)
LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -z "${LOCAL_IP:-}" ]; then
  LOCAL_IP="$(ip route get 8.8.8.8 2>/dev/null | awk '/src/ {print $7; exit}')"
fi
LOCAL_IP=${LOCAL_IP:-127.0.0.1}

# Informações
echo
echo "Sistema preparado para modo TV!"
if [ "$PORT80" = true ]; then
  echo "- Porta destino: 80 (TV_MODE=true)"
else
  echo "- Porta destino: 5000 (TV_MODE=false)"
fi

echo
echo "URLs sugeridas:"
if [ "$PORT80" = true ]; then
  echo " - TV/Admin: http://$LOCAL_IP/    (landing + SPA)"
  echo " - TV:       http://$LOCAL_IP/tv"
  echo " - Atalho:   http://$LOCAL_IP/k/<codigo>"
  echo " - API:      http://$LOCAL_IP/api/"
else
  echo " - Backend:  http://$LOCAL_IP:5000/ (landing + API + SPA build)"
  echo " - Atalho:   http://$LOCAL_IP:5000/k/<codigo>"
  echo " - Admin:    http://$LOCAL_IP:5000/app"
fi

echo
if [ "$RUN_AFTER" = true ]; then
  echo "Iniciando backend..."
  # Executa a partir da pasta backend para paths relativos (uploads, etc.)
  pushd backend >/dev/null
  if [ "$PORT80" = true ]; then
    if [ "$EUID" -ne 0 ]; then
      echo "[AVISO] Porta 80 requer privilégios (sudo) ou setcap no Python."
      echo "[AVISO] Iniciando fallback na porta 5000 (TV_MODE=false)."
      TV_MODE=false venv/bin/python app.py
    else
      TV_MODE=true venv/bin/python app.py
    fi
  else
    TV_MODE=false venv/bin/python app.py
  fi
  popd >/dev/null
else
  echo "Para iniciar manualmente agora, execute um dos comandos abaixo:"
  if [ "$PORT80" = true ]; then
    echo "  cd backend && sudo -E TV_MODE=true venv/bin/python app.py"
    echo "(Recomendado em produção: usar systemd + Nginx; veja exemplos em deploy/nginx e deploy/systemd)"
  else
    echo "  cd backend && TV_MODE=false venv/bin/python app.py"
  fi
fi
