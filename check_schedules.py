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

# Conectar e consultar
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n=== SEDES (LOCATIONS) E SUAS EMPRESAS ===")
cursor.execute("SELECT id, name, company FROM locations ORDER BY company, name")
locations = cursor.fetchall()

for location in locations:
    location_id, location_name, company = location
    print(f"ID: {location_id} | Sede: {location_name} | Empresa: {company}")

print("\n=== PLAYERS E SUAS SEDES/EMPRESAS ===")
cursor.execute("""
    SELECT p.id, p.name, p.location_id, l.name as location_name, l.company 
    FROM players p 
    LEFT JOIN locations l ON p.location_id = l.id 
    ORDER BY l.company, p.name
""")
players = cursor.fetchall()

for player in players:
    player_id, player_name, location_id, location_name, company = player
    print(f"Player: {player_name} | Location ID: {location_id} | Sede: {location_name} | Empresa: {company}")

print("\n=== AGENDAMENTOS E SUAS EMPRESAS ===")
cursor.execute("""
    SELECT s.id, s.name, s.player_id, p.name as player_name, l.name as location_name, l.company,
           s.start_date, s.end_date, s.start_time, s.end_time
    FROM schedules s 
    JOIN players p ON s.player_id = p.id
    JOIN locations l ON p.location_id = l.id 
    ORDER BY l.company, s.name
""")
schedules = cursor.fetchall()

for schedule in schedules:
    schedule_id, schedule_name, player_id, player_name, location_name, company, start_date, end_date, start_time, end_time = schedule
    print(f"Agendamento: {schedule_name}")
    print(f"  Player: {player_name}")
    print(f"  Sede: {location_name}")
    print(f"  Empresa: {company}")
    print(f"  Período: {start_date} a {end_date}")
    print(f"  Horário: {start_time} - {end_time}")
    print("-" * 50)

conn.close()
