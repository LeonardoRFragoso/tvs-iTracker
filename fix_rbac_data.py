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

# Conectar e corrigir dados
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n=== CORRIGINDO DADOS PARA RBAC ===")

# 1. Corrigir a sede "RBT" para ter empresa "Rio Brasil Terminal - RBT"
print("1. Corrigindo empresa da sede RBT...")
cursor.execute("UPDATE locations SET company = 'Rio Brasil Terminal - RBT' WHERE name = 'RBT'")
affected = cursor.rowcount
print(f"   Sedes atualizadas: {affected}")

# 2. Verificar se existe sede para CLIA, se não criar
print("2. Verificando sede para CLIA...")
cursor.execute("SELECT id FROM locations WHERE company = 'CLIA'")
clia_location = cursor.fetchone()

if not clia_location:
    print("   Criando sede para CLIA...")
    cursor.execute("""
        INSERT INTO locations (id, name, address, city, state, company, created_at, updated_at)
        VALUES ('clia-location-id', 'CLIA Santos', 'Porto de Santos', 'Santos', 'SP', 'CLIA', datetime('now'), datetime('now'))
    """)
    clia_location_id = 'clia-location-id'
else:
    clia_location_id = clia_location[0]
    print(f"   Sede CLIA já existe: {clia_location_id}")

# 3. Criar um player para CLIA se não existir
print("3. Verificando player para CLIA...")
cursor.execute("SELECT p.id FROM players p JOIN locations l ON p.location_id = l.id WHERE l.company = 'CLIA'")
clia_player = cursor.fetchone()

if not clia_player:
    print("   Criando player para CLIA...")
    cursor.execute("""
        INSERT INTO players (id, name, location_id, device_type, access_code, is_active, created_at, updated_at)
        VALUES ('clia-player-id', 'CLIA-TV-Principal', ?, 'web', '123456', 1, datetime('now'), datetime('now'))
    """, (clia_location_id,))
    print("   Player CLIA criado com sucesso")

# 4. Mostrar estado atual após correções
print("\n=== ESTADO APÓS CORREÇÕES ===")

print("\n--- SEDES POR EMPRESA ---")
cursor.execute("SELECT name, company FROM locations ORDER BY company, name")
locations = cursor.fetchall()
for location_name, company in locations:
    print(f"  {company}: {location_name}")

print("\n--- PLAYERS POR EMPRESA ---")
cursor.execute("""
    SELECT p.name, l.company 
    FROM players p 
    JOIN locations l ON p.location_id = l.id 
    ORDER BY l.company, p.name
""")
players = cursor.fetchall()
for player_name, company in players:
    print(f"  {company}: {player_name}")

print("\n--- AGENDAMENTOS POR EMPRESA ---")
cursor.execute("""
    SELECT s.name, p.name as player_name, l.company
    FROM schedules s 
    JOIN players p ON s.player_id = p.id
    JOIN locations l ON p.location_id = l.id 
    ORDER BY l.company, s.name
""")
schedules = cursor.fetchall()
for schedule_name, player_name, company in schedules:
    print(f"  {company}: {schedule_name} (Player: {player_name})")

# Commit das mudanças
conn.commit()
conn.close()

print(f"\n✅ CORREÇÕES APLICADAS COM SUCESSO!")
print(f"\nAgora o usuário 'Itracker-rh' deve ver apenas:")
print(f"- Players da empresa 'iTracker': tv-casa, TV-Segurança")
print(f"- Agendamentos desses players apenas")
print(f"\nO player 'RBT' agora pertence à empresa 'Rio Brasil Terminal - RBT'")
print(f"e NÃO deve aparecer para o usuário 'Itracker-rh'")
