#!/usr/bin/env python3
import sqlite3
import os

# Localizar o banco de dados
db_paths = [
    'backend/instance/tvs_platform.db',
    'backend/tvs_platform.db'
]

db_path = None
for path in db_paths:
    if os.path.exists(path):
        db_path = path
        break

if not db_path:
    print("Banco de dados não encontrado!")
    exit(1)

print(f"Usando banco: {db_path}")

# Conectar e investigar
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n=== INVESTIGAÇÃO DOS AGENDAMENTOS ===")

# 1. Verificar todos os agendamentos e seus players
print("\n1. TODOS OS AGENDAMENTOS E SEUS PLAYERS:")
cursor.execute("""
    SELECT s.id, s.name, s.player_id, p.name as player_name, l.name as location_name, l.company
    FROM schedules s 
    JOIN players p ON s.player_id = p.id
    JOIN locations l ON p.location_id = l.id 
    ORDER BY s.name
""")
schedules = cursor.fetchall()

for schedule in schedules:
    schedule_id, schedule_name, player_id, player_name, location_name, company = schedule
    print(f"Agendamento: {schedule_name}")
    print(f"  ID: {schedule_id}")
    print(f"  Player ID: {player_id}")
    print(f"  Player Nome: {player_name}")
    print(f"  Sede: {location_name}")
    print(f"  Empresa: {company}")
    print("-" * 50)

# 2. Verificar todos os players e seus IDs
print("\n2. TODOS OS PLAYERS E SEUS IDs:")
cursor.execute("""
    SELECT p.id, p.name, l.name as location_name, l.company
    FROM players p 
    JOIN locations l ON p.location_id = l.id 
    ORDER BY p.name
""")
players = cursor.fetchall()

for player in players:
    player_id, player_name, location_name, company = player
    print(f"Player: {player_name}")
    print(f"  ID: {player_id}")
    print(f"  Sede: {location_name}")
    print(f"  Empresa: {company}")
    print("-" * 30)

# 3. Verificar se há agendamentos órfãos (player_id inválido)
print("\n3. VERIFICANDO AGENDAMENTOS ÓRFÃOS:")
cursor.execute("""
    SELECT s.id, s.name, s.player_id
    FROM schedules s 
    LEFT JOIN players p ON s.player_id = p.id
    WHERE p.id IS NULL
""")
orphan_schedules = cursor.fetchall()

if orphan_schedules:
    print("⚠️  AGENDAMENTOS ÓRFÃOS ENCONTRADOS:")
    for schedule in orphan_schedules:
        schedule_id, schedule_name, player_id = schedule
        print(f"  - {schedule_name} (ID: {schedule_id}) aponta para player inexistente: {player_id}")
else:
    print("✅ Nenhum agendamento órfão encontrado")

# 4. Verificar se o player CLIA tem agendamentos
print("\n4. AGENDAMENTOS DO PLAYER CLIA-TV-Principal:")
cursor.execute("""
    SELECT s.id, s.name, s.start_date, s.end_date
    FROM schedules s 
    JOIN players p ON s.player_id = p.id
    WHERE p.name = 'CLIA-TV-Principal'
""")
clia_schedules = cursor.fetchall()

if clia_schedules:
    print("📅 AGENDAMENTOS ENCONTRADOS PARA CLIA:")
    for schedule in clia_schedules:
        schedule_id, schedule_name, start_date, end_date = schedule
        print(f"  - {schedule_name} ({start_date} a {end_date})")
else:
    print("❌ Nenhum agendamento encontrado para CLIA-TV-Principal")

conn.close()

print(f"\n🔍 ANÁLISE COMPLETA")
print(f"Se você está vendo agendamentos no filtro CLIA mas eles não aparecem aqui,")
print(f"pode haver um problema no frontend ou cache do navegador.")
