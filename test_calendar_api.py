#!/usr/bin/env python3
import requests
import json

# Configuração da API
BASE_URL = "http://localhost:5000/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
SCHEDULES_URL = f"{BASE_URL}/schedules/range"

def test_calendar_filter():
    print("=== TESTE DA API DO CALENDÁRIO ===\n")
    
    # 1. Login como admin
    print("1. Fazendo login como admin...")
    login_data = {
        "email": "admin@tvs.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(LOGIN_URL, json=login_data)
        if response.status_code == 200:
            token = response.json().get('access_token')
            print(f"✅ Login realizado com sucesso")
        else:
            print(f"❌ Erro no login: {response.status_code} - {response.text}")
            return
    except Exception as e:
        print(f"❌ Erro de conexão: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Buscar agendamentos SEM filtro (todos)
    print("\n2. Buscando TODOS os agendamentos...")
    params = {
        "start": "13/10/2025",
        "end": "19/10/2025",
        "is_active": "true"
    }
    
    try:
        response = requests.get(SCHEDULES_URL, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            schedules = data.get('schedules', [])
            print(f"✅ Encontrados {len(schedules)} agendamentos totais:")
            for schedule in schedules:
                print(f"   - {schedule['name']} (Player: {schedule['player_name']}, ID: {schedule['player_id']})")
        else:
            print(f"❌ Erro: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Erro: {e}")
    
    # 3. Buscar agendamentos COM filtro para player CLIA
    print(f"\n3. Buscando agendamentos do player CLIA-TV-Principal (ID: clia-player-id)...")
    params_clia = {
        "start": "13/10/2025",
        "end": "19/10/2025",
        "is_active": "true",
        "player_id": "clia-player-id"
    }
    
    try:
        response = requests.get(SCHEDULES_URL, params=params_clia, headers=headers)
        if response.status_code == 200:
            data = response.json()
            schedules = data.get('schedules', [])
            print(f"✅ Encontrados {len(schedules)} agendamentos para CLIA:")
            if schedules:
                for schedule in schedules:
                    print(f"   - {schedule['name']} (Player: {schedule['player_name']}, ID: {schedule['player_id']})")
            else:
                print("   (Nenhum agendamento - CORRETO!)")
        else:
            print(f"❌ Erro: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Erro: {e}")
    
    # 4. Buscar agendamentos COM filtro para player RBT
    print(f"\n4. Buscando agendamentos do player RBT (ID: 13f3692a-7270-484a-90f3-feb2aaa006f3)...")
    params_rbt = {
        "start": "13/10/2025",
        "end": "19/10/2025",
        "is_active": "true",
        "player_id": "13f3692a-7270-484a-90f3-feb2aaa006f3"
    }
    
    try:
        response = requests.get(SCHEDULES_URL, params=params_rbt, headers=headers)
        if response.status_code == 200:
            data = response.json()
            schedules = data.get('schedules', [])
            print(f"✅ Encontrados {len(schedules)} agendamentos para RBT:")
            for schedule in schedules:
                print(f"   - {schedule['name']} (Player: {schedule['player_name']}, ID: {schedule['player_id']})")
        else:
            print(f"❌ Erro: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    test_calendar_filter()
