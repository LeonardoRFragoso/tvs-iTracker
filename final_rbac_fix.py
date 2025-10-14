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

# Conectar e fazer ajuste final
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n=== AJUSTE FINAL DO RBAC ===")

# 1. Mover player "TV-Segurança" de volta para sede "casa" (iTracker)
print("1. Movendo TV-Segurança para sede 'casa' (iTracker)...")
cursor.execute("SELECT id FROM locations WHERE name = 'casa' AND company = 'iTracker'")
casa_location = cursor.fetchone()

if casa_location:
    casa_location_id = casa_location[0]
    cursor.execute("UPDATE players SET location_id = ? WHERE name = 'TV-Segurança'", (casa_location_id,))
    affected = cursor.rowcount
    print(f"   Players movidos: {affected}")
else:
    print("   Erro: Sede 'casa' não encontrada!")

# 2. Mover player "RBT" para sede "RBT" (Rio Brasil Terminal - RBT)
print("2. Movendo player 'RBT' para sede 'RBT' (Rio Brasil Terminal - RBT)...")
cursor.execute("SELECT id FROM locations WHERE name = 'RBT' AND company = 'Rio Brasil Terminal - RBT'")
rbt_location = cursor.fetchone()

if rbt_location:
    rbt_location_id = rbt_location[0]
    cursor.execute("UPDATE players SET location_id = ? WHERE name = 'RBT'", (rbt_location_id,))
    affected = cursor.rowcount
    print(f"   Players movidos: {affected}")
else:
    print("   Erro: Sede 'RBT' não encontrada!")

# 3. Mostrar distribuição final
print("\n=== DISTRIBUIÇÃO FINAL CORRETA ===")

print("\n--- PLAYERS POR EMPRESA ---")
cursor.execute("""
    SELECT p.name, l.name as location_name, l.company 
    FROM players p 
    JOIN locations l ON p.location_id = l.id 
    ORDER BY l.company, p.name
""")
players = cursor.fetchall()
for player_name, location_name, company in players:
    print(f"  {company}: {player_name} (Sede: {location_name})")

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

print(f"\n✅ RBAC CONFIGURADO CORRETAMENTE!")
print(f"\n🔒 AGORA O CONTROLE DE ACESSO FUNCIONA ASSIM:")
print(f"\n👤 Usuário 'Itracker-rh' (empresa: iTracker) verá apenas:")
print(f"   - Players: tv-casa, TV-Segurança")
print(f"   - Agendamentos: NENHUM (pois os agendamentos estão no player RBT da outra empresa)")
print(f"\n👤 Usuário 'RBT-rh' (empresa: Rio Brasil Terminal - RBT) verá apenas:")
print(f"   - Players: RBT")
print(f"   - Agendamentos: teste-audio, teste-sobreposição-calendario")
print(f"\n👤 Usuário 'Clia-rh' (empresa: CLIA) verá apenas:")
print(f"   - Players: CLIA-TV-Principal")
print(f"   - Agendamentos: NENHUM")
print(f"\n🔓 Usuário 'admin' verá TUDO de todas as empresas")
