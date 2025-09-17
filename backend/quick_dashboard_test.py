#!/usr/bin/env python3
"""
Teste rápido das APIs do dashboard para identificar erro 500
"""

import os
import sys
import requests
import json

# Adicionar o diretório atual ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_dashboard_apis():
    """Testa as APIs do dashboard diretamente"""
    print("🔍 TESTANDO APIs DO DASHBOARD...")
    
    base_url = "http://localhost:5000"
    
    # Primeiro, fazer login para obter token
    print("\n1. Fazendo login...")
    try:
        login_response = requests.post(f"{base_url}/api/auth/login", json={
            "email": "admin@example.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get('access_token')
            print("   ✅ Login realizado com sucesso")
        else:
            print(f"   ❌ Falha no login: {login_response.status_code}")
            print(f"   Response: {login_response.text}")
            return
            
    except Exception as e:
        print(f"   ❌ Erro no login: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Testar API de stats
    print("\n2. Testando /api/dashboard/stats...")
    try:
        stats_response = requests.get(f"{base_url}/api/dashboard/stats", headers=headers)
        print(f"   Status Code: {stats_response.status_code}")
        
        if stats_response.status_code == 200:
            print("   ✅ API stats funcionando!")
            data = stats_response.json()
            print(f"   Dados: {json.dumps(data, indent=2)[:200]}...")
        else:
            print(f"   ❌ API stats falhou: {stats_response.status_code}")
            print(f"   Error: {stats_response.text}")
            
    except Exception as e:
        print(f"   ❌ Erro na API stats: {e}")
    
    # Testar API de alerts
    print("\n3. Testando /api/dashboard/alerts...")
    try:
        alerts_response = requests.get(f"{base_url}/api/dashboard/alerts", headers=headers)
        print(f"   Status Code: {alerts_response.status_code}")
        
        if alerts_response.status_code == 200:
            print("   ✅ API alerts funcionando!")
            data = alerts_response.json()
            print(f"   Dados: {json.dumps(data, indent=2)[:200]}...")
        else:
            print(f"   ❌ API alerts falhou: {alerts_response.status_code}")
            print(f"   Error: {alerts_response.text}")
            
    except Exception as e:
        print(f"   ❌ Erro na API alerts: {e}")
    
    # Testar outras APIs do dashboard
    dashboard_endpoints = [
        '/api/dashboard/activity',
        '/api/dashboard/performance',
        '/api/dashboard/health'
    ]
    
    for endpoint in dashboard_endpoints:
        print(f"\n4. Testando {endpoint}...")
        try:
            response = requests.get(f"{base_url}{endpoint}", headers=headers)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print(f"   ✅ {endpoint} funcionando!")
            else:
                print(f"   ❌ {endpoint} falhou: {response.status_code}")
                print(f"   Error: {response.text[:200]}...")
                
        except Exception as e:
            print(f"   ❌ Erro em {endpoint}: {e}")

def test_direct_queries():
    """Testa as consultas diretamente no banco"""
    print("\n🔍 TESTANDO CONSULTAS DIRETAS NO BANCO...")
    
    try:
        from flask import Flask
        from database import db
        from datetime import datetime, timedelta
        from sqlalchemy import func
        
        # Configurar Flask app
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/tvs_platform.db'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        
        with app.app_context():
            db.init_app(app)
            
            # Importar modelos
            from models.user import User
            from models.content import Content
            from models.campaign import Campaign
            from models.player import Player
            from models.schedule import Schedule
            from models.editorial import Editorial
            from models.location import Location
            
            print("✅ Modelos importados com sucesso")
            
            # Teste das consultas específicas que estão falhando
            print("\n1. Testando contagem de players online...")
            try:
                five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
                online_players = Player.query.filter(
                    Player.last_ping.isnot(None),
                    Player.last_ping >= five_minutes_ago
                ).count()
                print(f"   ✅ Online players: {online_players}")
            except Exception as e:
                print(f"   ❌ Erro: {e}")
                import traceback
                traceback.print_exc()
            
            print("\n2. Testando JOIN com Location...")
            try:
                players_by_location = db.session.query(
                    Location.name,
                    func.count(Player.id).label('count')
                ).join(Player, Location.id == Player.location_id).group_by(Location.name).all()
                print(f"   ✅ Players by location: {len(players_by_location)} locations")
                for loc in players_by_location:
                    print(f"      - {loc[0]}: {loc[1]} players")
            except Exception as e:
                print(f"   ❌ Erro: {e}")
                import traceback
                traceback.print_exc()
            
            print("\n3. Testando consultas de Editorial...")
            try:
                total_editorials = Editorial.query.filter(Editorial.is_active == True).count()
                print(f"   ✅ Total editorials: {total_editorials}")
                
                error_editorials = Editorial.query.filter(
                    Editorial.is_active == True,
                    Editorial.last_error.isnot(None)
                ).count()
                print(f"   ✅ Error editorials: {error_editorials}")
            except Exception as e:
                print(f"   ❌ Erro: {e}")
                import traceback
                traceback.print_exc()
            
            print("\n4. Testando consultas de Storage...")
            try:
                total_storage_used = db.session.query(
                    func.sum(Player.storage_used_gb)
                ).scalar() or 0
                print(f"   ✅ Total storage used: {total_storage_used}")
                
                total_storage_capacity = db.session.query(
                    func.sum(Player.storage_capacity_gb)
                ).scalar() or 1
                print(f"   ✅ Total storage capacity: {total_storage_capacity}")
            except Exception as e:
                print(f"   ❌ Erro: {e}")
                import traceback
                traceback.print_exc()
                
    except Exception as e:
        print(f"❌ Erro geral: {e}")
        import traceback
        traceback.print_exc()

def main():
    print("🚀 TESTE RÁPIDO DO DASHBOARD")
    print("=" * 40)
    
    # Primeiro testar APIs HTTP
    test_dashboard_apis()
    
    # Depois testar consultas diretas
    test_direct_queries()
    
    print("\n✅ TESTE CONCLUÍDO!")

if __name__ == "__main__":
    main()
