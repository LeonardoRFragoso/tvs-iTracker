#!/bin/bash
# Script para deploy da correção de áudio de fundo

echo "🎵 Deploy: Correção de Áudio de Fundo"
echo "======================================"
echo ""

cd ~/projetos/tvs-iTracker || exit 1

echo "📥 1. Pull das alterações..."
git pull
echo ""

echo "🗄️ 2. Executando migração..."
cd backend
source ../venv/bin/activate
python run_background_audio_migration.py
cd ..
echo ""

echo "🔨 3. Build do frontend..."
npm run build
echo ""

echo "🔄 4. Reiniciando serviço..."
sudo systemctl restart tvs-itracker.service
echo ""

echo "✅ 5. Verificando status..."
sleep 2
sudo systemctl status tvs-itracker.service --no-pager -n 10 | grep -E "(Active|Main PID|Memory)"
echo ""

echo "======================================"
echo "✓ Deploy concluído com sucesso!"
echo "======================================"
echo ""
echo "🎯 Teste no navegador:"
echo "   http://192.168.0.45/kiosk/player/13f3692a-7270-484a-90f3-feb2aaa006f3?fullscreen=true"
echo ""
echo "👆 IMPORTANTE: Clique na tela para ativar o áudio!"
echo ""
echo "📊 Ver logs em tempo real:"
echo "   sudo journalctl -u tvs-itracker.service -f"
echo ""

