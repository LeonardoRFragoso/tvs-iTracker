#!/usr/bin/env python3
"""
Script de teste rápido para verificar se todos os modelos podem ser importados
"""

print("🧪 Testando importação de todos os modelos...")

try:
    from database import db
    print("✅ Database importado")
    
    from models.user import User
    print("✅ User importado")
    
    from models.content import Content
    print("✅ Content importado")
    
    from models.content_distribution import ContentDistribution
    print("✅ ContentDistribution importado")
    
    from models.campaign import Campaign
    print("✅ Campaign importado")
    
    from models.player import Player
    print("✅ Player importado")
    
    from models.schedule import Schedule
    print("✅ Schedule importado")
    
    from models.editorial import Editorial
    print("✅ Editorial importado")
    
    print("\n🎉 TODOS OS MODELOS IMPORTADOS COM SUCESSO!")
    
except Exception as e:
    print(f"❌ ERRO na importação: {e}")
    import traceback
    traceback.print_exc()
