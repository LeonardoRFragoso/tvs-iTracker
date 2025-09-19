# TVs iTracker - Deploy em Ubuntu

Este guia explica como rodar o TVs iTracker 24/7 em Ubuntu com systemd e Nginx.

## 1) Pré‑requisitos
- Ubuntu 20.04/22.04
- Pacotes base:
  ```bash
  sudo apt-get update
  sudo apt-get install -y python3 python3-venv python3-pip nginx curl git
  ```
- Node.js 18 (NodeSource):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  node -v
  ```

## 2) Clonar projeto e configurar .env
```bash
cd /opt
sudo git clone <SEU_REPO> tvs-iTracker
sudo chown -R $USER:$USER tvs-iTracker
cd tvs-iTracker
cp .env.example backend/.env  # Ajuste as variáveis conforme necessário
```

## 3) Build e preparação (deploy-tv.sh)
```bash
chmod +x deploy-tv.sh
./deploy-tv.sh                 # Build + preparar backend (porta 5000)
# ou
sudo ./deploy-tv.sh --port80 --run   # Inicia direto na porta 80 (requer sudo). Em produção, prefira Nginx.
```

Ao final, o build React estará em `backend/build` e o backend pronto em `backend/venv`.

## 4) Executar como serviço (systemd)
Edite o arquivo de exemplo e ajuste caminho/usuário:
```bash
nano deploy/systemd/tvs-itracker.service
# Ajuste User= e WorkingDirectory= (ex.: /opt/tvs-iTracker/backend)
```
Instale e habilite o serviço:
```bash
sudo cp deploy/systemd/tvs-itracker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tvs-itracker
sudo systemctl status tvs-itracker
journalctl -u tvs-itracker -f
```
Obs.: O serviço está configurado com `TV_MODE=false` para rodar na porta 5000. Use Nginx na porta 80.

## 5) Nginx como reverse proxy (porta 80)
Edite o arquivo de exemplo se quiser personalizar e instale:
```bash
sudo cp deploy/nginx/tvs-itracker.conf /etc/nginx/sites-available/tvs-itracker
sudo ln -s /etc/nginx/sites-available/tvs-itracker /etc/nginx/sites-enabled/tvs-itracker
sudo nginx -t
sudo systemctl reload nginx
```
- Acesse: http://SEU_IP/
- Admin SPA: http://SEU_IP/app
- Link curto: http://SEU_IP/k/<codigo>

## 6) Firewall (UFW)
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # abre 80 e 443
sudo ufw enable
sudo ufw status
```

## 7) Rodar sem Nginx (opcional)
Para rodar direto na porta 80 sem Nginx, você precisará de privilégios ou dar permissão ao binário Python:
```bash
# Com sudo:
cd /opt/tvs-iTracker/backend
sudo -E TV_MODE=true venv/bin/python app.py

# Sem sudo (setcap - reexecute após recriar/atualizar o venv):
sudo setcap 'cap_net_bind_service=+ep' /opt/tvs-iTracker/backend/venv/bin/python3
TV_MODE=true /opt/tvs-iTracker/backend/venv/bin/python app.py
```
Recomendado usar Nginx em produção.

## 8) Atualizações do sistema
```bash
cd /opt/tvs-iTracker
git pull
./deploy-tv.sh
sudo systemctl restart tvs-itracker
```

## 9) Solução de problemas
- Ver logs: `journalctl -u tvs-itracker -f`
- Porta 80 ocupada: `sudo lsof -i :80`
- Teste backend local: `curl http://127.0.0.1:5000/api/health` (se existir) ou `curl http://127.0.0.1:5000/`
- Socket.IO: O frontend está configurado para polling; websockets funcionam com Nginx graças às diretivas de upgrade.
- Banco de dados SQLite: por padrão em `backend/instance/tvs_platform.db` (instância Flask).
