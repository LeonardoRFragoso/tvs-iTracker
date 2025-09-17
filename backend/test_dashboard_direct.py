#!/usr/bin/env python3
"""
Teste direto das consultas do dashboard para identificar erros 500
"""

import os
import sys

# Adicionar o diretório atual ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from database import db
from datetime import datetime, timedelta
from sqlalchemy import func

def test_direct():
    """Teste direto das consultas problemáticas"""
    
    # Configurar Flask app
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/tvs_platform.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    with app.app_context():
        db.init_app(app)
        
        try:
            # Importar modelos na ordem correta para evitar problemas de dependência
            from models.user import User  # Importar User primeiro
            from models.content import Content
            from models.campaign import Campaign
            from models.player import Player
            from models.schedule import Schedule
            from models.editorial import Editorial
            from models.location import Location
            
            print("🔍 TESTANDO CONSULTAS DO DASHBOARD...")
            
            # Teste 1: Contagem básica
            print("\n1. Testando contagens básicas...")
            try:
                total_content = Content.query.filter(Content.is_active == True).count()
                print(f"   ✅ Content count: {total_content}")
            except Exception as e:
                print(f"   ❌ Content count failed: {e}")
            
            try:
                total_campaigns = Campaign.query.filter(Campaign.is_active == True).count()
                print(f"   ✅ Campaign count: {total_campaigns}")
            except Exception as e:
                print(f"   ❌ Campaign count failed: {e}")
            
            try:
                total_players = Player.query.count()
                print(f"   ✅ Player count: {total_players}")
            except Exception as e:
                print(f"   ❌ Player count failed: {e}")
            
            # Teste 2: Players online (consulta mais complexa)
            print("\n2. Testando players online...")
            try:
                from datetime import timezone
                five_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
                online_players = Player.query.filter(
                    Player.last_ping.isnot(None),
                    Player.last_ping >= five_minutes_ago
                ).count()
                print(f"   ✅ Online players: {online_players}")
            except Exception as e:
                print(f"   ❌ Online players failed: {e}")
                import traceback
                traceback.print_exc()
            
            # Teste 3: Campanhas com start_date e end_date
            print("\n3. Testando campanhas ativas hoje...")
            try:
                from datetime import timezone
                now = datetime.now(timezone.utc)
                active_campaigns_today = Campaign.query.filter(
                    Campaign.is_active == True,
                    Campaign.start_date <= now,
                    Campaign.end_date >= now
                ).count()
                print(f"   ✅ Active campaigns today: {active_campaigns_today}")
            except Exception as e:
                print(f"   ❌ Active campaigns failed: {e}")
                import traceback
                traceback.print_exc()
            
            # Teste 4: JOIN com Location (provável problema)
            print("\n4. Testando JOIN com Location...")
            try:
                players_by_location = db.session.query(
                    Location.name,
                    func.count(Player.id).label('count')
                ).join(Player, Location.id == Player.location_id).group_by(Location.name).all()
                print(f"   ✅ Players by location: {len(players_by_location)} locations")
                for loc in players_by_location:
                    print(f"      - {loc[0]}: {loc[1]} players")
            except Exception as e:
                print(f"   ❌ Players by location failed: {e}")
                import traceback
                traceback.print_exc()
            
            # Teste 5: Editorial com campos específicos
            print("\n5. Testando Editorial queries...")
            try:
                total_editorials = Editorial.query.filter(Editorial.is_active == True).count()
                print(f"   ✅ Total editorials: {total_editorials}")
            except Exception as e:
                print(f"   ❌ Total editorials failed: {e}")
                import traceback
                traceback.print_exc()
            
            try:
                error_editorials = Editorial.query.filter(
                    Editorial.is_active == True,
                    Editorial.last_error.isnot(None)
                ).all()
                print(f"   ✅ Error editorials: {len(error_editorials)}")
            except Exception as e:
                print(f"   ❌ Error editorials failed: {e}")
                import traceback
                traceback.print_exc()
            
            # Teste 6: Storage queries
            print("\n6. Testando Storage queries...")
            try:
                total_storage_used = db.session.query(
                    func.sum(Player.storage_used_gb)
                ).scalar() or 0
                print(f"   ✅ Total storage used: {total_storage_used}")
            except Exception as e:
                print(f"   ❌ Storage used failed: {e}")
                import traceback
                traceback.print_exc()
            
            print("\n✅ TESTE CONCLUÍDO!")
            
        except Exception as e:
            print(f"❌ ERRO GERAL: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_direct()
