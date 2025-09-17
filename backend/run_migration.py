#!/usr/bin/env python3
"""
Script para executar a migração de suporte a múltiplos conteúdos
"""

import sys
import os

# Adicionar o diretório atual ao path para importar módulos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from migrations.add_multi_content_support import run_migration

if __name__ == "__main__":
    print(" Executando migração para suporte a múltiplos conteúdos...")
    print("=" * 60)
    
    success = run_migration()
    
    if success:
        print("\n" + "=" * 60)
        print(" MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
        print("\n Próximos passos:")
        print("1. Reinicie o servidor backend")
        print("2. Teste as novas APIs de múltiplos conteúdos")
        print("3. Atualize o frontend para usar as novas funcionalidades")
        print("\n Sistema agora suporta múltiplos conteúdos por campanha!")
    else:
        print("\n" + "=" * 60)
        print(" MIGRAÇÃO FALHOU!")
        print("\n Ações recomendadas:")
        print("1. Verifique os logs de erro acima")
        print("2. Faça backup do banco de dados")
        print("3. Tente executar novamente")
        sys.exit(1)
