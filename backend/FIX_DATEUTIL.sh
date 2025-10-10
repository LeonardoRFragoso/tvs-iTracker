#!/bin/bash
# Script para corrigir o problema do python-dateutil faltando
# Isso corrige o bug onde players aparecem como "Desconectado" mesmo estando online

echo "=========================================="
echo "FIX: Instalando python-dateutil"
echo "=========================================="
echo ""

# Ativar venv se existir
if [ -d "../venv" ]; then
    echo "✓ Ativando ambiente virtual..."
    source ../venv/bin/activate
elif [ -d "venv" ]; then
    echo "✓ Ativando ambiente virtual..."
    source venv/bin/activate
fi

# Instalar python-dateutil
echo ""
echo "✓ Instalando python-dateutil..."
pip install python-dateutil>=2.8.2

echo ""
echo "=========================================="
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "=========================================="
echo ""
echo "Agora teste novamente:"
echo "  1. python3 test_api_response.py"
echo "  2. Verifique se is_online agora retorna True"
echo ""
echo "Se precisar reiniciar o servidor:"
echo "  sudo systemctl restart tvs-itracker"
echo ""

