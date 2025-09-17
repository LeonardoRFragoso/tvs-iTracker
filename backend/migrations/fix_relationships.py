#!/usr/bin/env python3
"""
Migração: Corrigir relacionamentos e adicionar campos necessários
Data: 2025-09-16
Descrição: Adiciona user_id na tabela campaigns e corrige relacionamentos
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    """Executa a migração para corrigir relacionamentos"""
    print("🔄 Iniciando migração: Corrigir Relacionamentos")
    print("=" * 60)
    
    # Detectar banco de dados correto
    db_paths = [
        'instance/tvs_platform.db',
        'tvs_platform.db'
    ]
    
    db_path = None
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ Banco de dados não encontrado!")
        return False
    
    print(f"📁 Usando banco: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n📊 Verificando estrutura atual...")
        
        # 1. Verificar se user_id já existe na tabela campaigns
        cursor.execute("PRAGMA table_info(campaigns)")
        campaign_columns = [column[1] for column in cursor.fetchall()]
        print(f"Colunas atuais em campaigns: {campaign_columns}")
        
        # 2. Adicionar user_id à tabela campaigns se não existir
        if 'user_id' not in campaign_columns:
            print("➕ Adicionando coluna user_id à tabela campaigns...")
            cursor.execute("""
                ALTER TABLE campaigns 
                ADD COLUMN user_id TEXT REFERENCES users(id)
            """)
            print("✅ Coluna user_id adicionada")
        else:
            print("✅ Coluna user_id já existe")
        
        # 3. Obter um usuário admin para associar às campanhas existentes
        cursor.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        admin_user = cursor.fetchone()
        
        if not admin_user:
            # Criar usuário admin se não existir
            print("👤 Criando usuário admin...")
            import uuid
            from werkzeug.security import generate_password_hash
            
            admin_id = str(uuid.uuid4())
            admin_password = generate_password_hash('admin123')
            
            cursor.execute("""
                INSERT INTO users (id, username, email, password_hash, role, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (admin_id, 'admin', 'admin@tvs.com', admin_password, 'admin', 1, datetime.now()))
            
            admin_user = (admin_id,)
            print(f"✅ Usuário admin criado com ID: {admin_id}")
        
        admin_id = admin_user[0]
        
        # 4. Atualizar campanhas existentes sem user_id
        cursor.execute("UPDATE campaigns SET user_id = ? WHERE user_id IS NULL", (admin_id,))
        updated_campaigns = cursor.rowcount
        print(f"✅ {updated_campaigns} campanhas atualizadas com user_id")
        
        # 5. Corrigir chromecast_name se necessário
        cursor.execute("""
            UPDATE players 
            SET chromecast_name = 'Escritório'
            WHERE platform = 'chromecast' AND chromecast_name IS NULL
        """)
        updated_players = cursor.rowcount
        print(f"✅ {updated_players} players Chromecast atualizados")
        
        # 6. Verificar integridade dos dados
        print("\n🔍 Verificando integridade dos dados...")
        
        # Verificar campanhas
        cursor.execute("""
            SELECT c.name, u.username 
            FROM campaigns c 
            LEFT JOIN users u ON c.user_id = u.id 
            LIMIT 5
        """)
        campaigns_data = cursor.fetchall()
        print(f"📊 Campanhas com usuários:")
        for campaign_name, username in campaigns_data:
            print(f"   - {campaign_name}: {username or 'SEM USUÁRIO'}")
        
        # Verificar players Chromecast
        cursor.execute("""
            SELECT name, chromecast_name, status 
            FROM players 
            WHERE platform = 'chromecast'
        """)
        players_data = cursor.fetchall()
        print(f"📱 Players Chromecast:")
        for name, chromecast_name, status in players_data:
            print(f"   - {name}: {chromecast_name} ({status})")
        
        conn.commit()
        conn.close()
        
        print(f"\n✅ Migração concluída com sucesso!")
        print(f"📅 Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return True
        
    except Exception as e:
        print(f"❌ Erro durante a migração: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    success = run_migration()
    if success:
        print("\n🎉 Relacionamentos corrigidos!")
        print("🚀 Agora execute: python app.py")
    else:
        print("\n❌ Migração falhou. Verifique os logs acima.")
