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

# Conectar e consultar usuários
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n=== USUÁRIOS NO SISTEMA ===")
cursor.execute("SELECT id, username, email, role, company FROM users ORDER BY username")
users = cursor.fetchall()

for user in users:
    user_id, username, email, role, company = user
    print(f"ID: {user_id}")
    print(f"Username: {username}")
    print(f"Email: {email}")
    print(f"Role: {role}")
    print(f"Company: {company}")
    print("-" * 40)

# Verificar especificamente o usuário "Itracker-rh"
print("\n=== USUÁRIO ITRACKER-RH ===")
cursor.execute("SELECT id, username, email, role, company FROM users WHERE username LIKE '%itracker%' OR username LIKE '%rh%'")
rh_users = cursor.fetchall()

for user in rh_users:
    user_id, username, email, role, company = user
    print(f"ID: {user_id}")
    print(f"Username: {username}")
    print(f"Email: {email}")
    print(f"Role: {role}")
    print(f"Company: {company}")
    print("-" * 40)

# Verificar players e suas empresas
print("\n=== PLAYERS E SUAS EMPRESAS ===")
cursor.execute("""
    SELECT p.id, p.name, l.name as location_name, l.company 
    FROM players p 
    JOIN locations l ON p.location_id = l.id 
    ORDER BY l.company, p.name
""")
players = cursor.fetchall()

for player in players:
    player_id, player_name, location_name, company = player
    print(f"Player: {player_name} | Sede: {location_name} | Empresa: {company}")

conn.close()
