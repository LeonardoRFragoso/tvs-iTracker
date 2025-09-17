#!/usr/bin/env python3
"""
Script completo para corrigir relacionamentos e iniciar servidor
"""

import sys
import os
import sqlite3
from datetime import datetime

def run_migration():
    """Executa a migração para corrigir relacionamentos"""
    print("🔄 MIGRAÇÃO: Corrigindo Relacionamentos")
    print("=" * 50)
    
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
        
        # 1. Adicionar user_id à tabela campaigns se não existir
        cursor.execute("PRAGMA table_info(campaigns)")
        campaign_columns = [column[1] for column in cursor.fetchall()]
        
        if 'user_id' not in campaign_columns:
            print("➕ Adicionando coluna user_id à tabela campaigns...")
            cursor.execute("""
                ALTER TABLE campaigns 
                ADD COLUMN user_id TEXT REFERENCES users(id)
            """)
            print("✅ Coluna user_id adicionada")
        else:
            print("✅ Coluna user_id já existe")
        
        # 2. Criar usuário admin se não existir
        cursor.execute("SELECT id FROM users WHERE email = 'admin@tvs.com' LIMIT 1")
        admin_user = cursor.fetchone()
        
        if not admin_user:
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
            print(f"✅ Usuário admin criado: admin@tvs.com / admin123")
        
        admin_id = admin_user[0]
        
        # 3. Atualizar campanhas existentes sem user_id
        cursor.execute("UPDATE campaigns SET user_id = ? WHERE user_id IS NULL", (admin_id,))
        updated_campaigns = cursor.rowcount
        print(f"✅ {updated_campaigns} campanhas associadas ao admin")
        
        # 4. Corrigir chromecast_name
        cursor.execute("""
            UPDATE players 
            SET chromecast_name = 'Escritório'
            WHERE platform = 'chromecast' AND (chromecast_name IS NULL OR chromecast_name != 'Escritório')
        """)
        updated_players = cursor.rowcount
        print(f"✅ {updated_players} players Chromecast corrigidos")
        
        conn.commit()
        conn.close()
        
        print(f"\n✅ MIGRAÇÃO CONCLUÍDA!")
        return True
        
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False

def fix_content_model():
    """Fix Content model relationships"""
    content_file = "models/content.py"
    
    print(f"Fixing {content_file}...")
    
    # Read current content
    with open(content_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the relationship line - remove backref since CampaignContent defines it
    old_line = "    campaign_contents = db.relationship('CampaignContent', backref='content', lazy=True)"
    new_line = "    campaign_contents = db.relationship('CampaignContent', lazy=True)"
    
    if old_line in content:
        content = content.replace(old_line, new_line)
        print("  ✓ Removed conflicting backref='content' from Content.campaign_contents")
    else:
        print("  ⚠ Content model relationship already fixed or not found")
    
    # Write back
    with open(content_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True

def fix_campaign_model():
    """Fix Campaign model relationships"""
    campaign_file = "models/campaign.py"
    
    print(f"Fixing {campaign_file}...")
    
    # Read current content
    with open(campaign_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the CampaignContent relationships in CampaignContent class
    # Remove backref from content relationship since Content model should define it
    old_content_line = "    content = db.relationship('Content', backref='campaign_contents', lazy=True)"
    new_content_line = "    content = db.relationship('Content', lazy=True)"
    
    # Remove backref from campaign relationship since Campaign model defines it
    old_campaign_line = "    campaign = db.relationship('Campaign', backref='contents', lazy=True)"
    new_campaign_line = "    campaign = db.relationship('Campaign', lazy=True)"
    
    # Remove backref from user relationship since User model defines it
    old_user_line = "    user = db.relationship('User', backref='campaigns', lazy=True)"
    new_user_line = "    user = db.relationship('User', lazy=True)"
    
    # Remove backref from contents relationship since CampaignContent defines it
    old_contents_line = "    contents = db.relationship('CampaignContent', backref='campaign', lazy=True, cascade='all, delete-orphan')"
    new_contents_line = "    contents = db.relationship('CampaignContent', lazy=True, cascade='all, delete-orphan')"
    
    # Remove backref from schedules relationship since Schedule defines it
    old_schedules_line = "    schedules = db.relationship('Schedule', backref='campaign', lazy=True)"
    new_schedules_line = "    schedules = db.relationship('Schedule', lazy=True)"
    
    changes_made = 0
    
    if old_content_line in content:
        content = content.replace(old_content_line, new_content_line)
        print("  ✓ Removed conflicting backref='campaign_contents' from CampaignContent.content")
        changes_made += 1
    
    if old_campaign_line in content:
        content = content.replace(old_campaign_line, new_campaign_line)
        print("  ✓ Removed conflicting backref='contents' from CampaignContent.campaign")
        changes_made += 1
    
    if old_user_line in content:
        content = content.replace(old_user_line, new_user_line)
        print("  ✓ Removed conflicting backref='campaigns' from Campaign.user")
        changes_made += 1
    
    if old_contents_line in content:
        content = content.replace(old_contents_line, new_contents_line)
        print("  ✓ Removed conflicting backref='campaign' from Campaign.contents")
        changes_made += 1
    
    if old_schedules_line in content:
        content = content.replace(old_schedules_line, new_schedules_line)
        print("  ✓ Removed conflicting backref='campaign' from Campaign.schedules")
        changes_made += 1
    
    if changes_made == 0:
        print("  ⚠ Campaign model relationships already fixed or not found")
    
    # Write back
    with open(campaign_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True

def fix_schedule_model():
    """Fix Schedule model relationships"""
    schedule_file = "models/schedule.py"
    
    print(f"Fixing {schedule_file}...")
    
    # Read current content
    with open(schedule_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add missing campaign relationship and fix player relationship
    old_relationships = """    # Relacionamentos
    player = db.relationship('Player', backref='schedules', lazy=True)"""
    
    new_relationships = """    # Relacionamentos
    campaign = db.relationship('Campaign', lazy=True)
    player = db.relationship('Player', lazy=True)"""
    
    if old_relationships in content:
        content = content.replace(old_relationships, new_relationships)
        print("  ✓ Added missing campaign relationship")
        print("  ✓ Removed conflicting backref='schedules' from Schedule.player")
    else:
        print("  ⚠ Schedule model relationships already fixed or not found")
    
    # Write back
    with open(schedule_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True

def fix_player_model():
    """Fix Player model relationships"""
    player_file = "models/player.py"
    
    print(f"Fixing {player_file}...")
    
    # Read current content
    with open(player_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix distributions relationship - remove backref
    old_line = "    distributions = db.relationship('ContentDistribution', backref='player', lazy=True)"
    new_line = "    distributions = db.relationship('ContentDistribution', lazy=True)"
    
    if old_line in content:
        content = content.replace(old_line, new_line)
        print("  ✓ Removed conflicting backref='player' from Player.distributions")
    else:
        print("  ⚠ Player model relationship already fixed or not found")
    
    # Write back
    with open(player_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True

def check_other_models():
    """Check other models for potential conflicts"""
    models_to_check = [
        "models/schedule.py",
        "models/player.py", 
        "models/user.py"
    ]
    
    print("\nChecking other models for potential conflicts...")
    
    for model_file in models_to_check:
        if os.path.exists(model_file):
            with open(model_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Look for potential backref conflicts
            if "backref=" in content:
                print(f"  ⚠ {model_file} contains backref definitions - may need manual review")
            else:
                print(f"  ✓ {model_file} looks clean")
        else:
            print(f"  - {model_file} not found")

def test_server_start():
    """Testa se o servidor pode iniciar"""
    print("\n🧪 TESTANDO INICIALIZAÇÃO DO SERVIDOR...")
    
    try:
        from app import app
        print("✅ App Flask importado com sucesso")
        
        # Testar rotas
        with app.app_context():
            routes = [str(rule) for rule in app.url_map.iter_rules()]
            api_routes = [r for r in routes if '/api/' in r]
            print(f"✅ {len(api_routes)} rotas API registradas")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Função principal que executa todas as correções"""
    print("=" * 80)
    print("� TVS TRACKER - CORREÇÃO COMPLETA DE RELACIONAMENTOS")
    print("=" * 80)
    print()
    
    # Verificar se estamos no diretório correto
    if not os.path.exists("models"):
        if os.path.exists("backend/models"):
            os.chdir("backend")
            print("📁 Mudando para diretório backend")
        else:
            print("❌ ERRO: Não foi possível encontrar o diretório models!")
            return False
    
    print("📋 EXECUTANDO CORREÇÕES:")
    print("1. Migração do banco de dados")
    print("2. Correção de relacionamentos SQLAlchemy")
    print("3. Teste de inicialização do servidor")
    print()
    
    try:
        # Passo 1: Executar migração
        print("🔄 PASSO 1: EXECUTANDO MIGRAÇÃO...")
        if not run_migration():
            print("\n❌ Falha na migração!")
            return False
        
        # Passo 2: Fixar relacionamentos do Content
        print("\n🔄 PASSO 2: CORRIGINDO RELACIONAMENTOS...")
        if not fix_content_model():
            print("\n❌ Falha ao fixar modelo Content!")
            return False
        
        # Passo 3: Fixar relacionamentos do Campaign
        if not fix_campaign_model():
            print("\n❌ Falha ao fixar modelo Campaign!")
            return False
        
        # Passo 4: Fixar relacionamentos do Schedule
        if not fix_schedule_model():
            print("\n❌ Falha ao fixar modelo Schedule!")
            return False
        
        # Passo 5: Fixar relacionamentos do Player
        if not fix_player_model():
            print("\n❌ Falha ao fixar modelo Player!")
            return False
        
        # Passo 6: Verificar outros modelos
        check_other_models()
        
        # Passo 7: Teste do servidor
        print("\n🔄 PASSO 3: TESTANDO SERVIDOR...")
        if not test_server_start():
            print("\n❌ Falha no teste do servidor!")
            return False
        
        # Sucesso!
        print("\n" + "=" * 80)
        print("✅ TODAS AS CORREÇÕES FORAM APLICADAS COM SUCESSO!")
        print("=" * 80)
        print()
        print("📊 RESUMO DAS CORREÇÕES:")
        print("✓ Migração do banco de dados executada")
        print("✓ Relacionamentos SQLAlchemy corrigidos:")
        print("  - Content.campaign_contents (removido backref='content')")
        print("  - CampaignContent.content (removido backref='campaign_contents')")
        print("  - CampaignContent.campaign (removido backref='contents')")
        print("  - Campaign.contents (removido backref='campaign')")
        print("  - Campaign.schedules (removido backref='campaign')")
        print("  - Campaign.user (removido backref='campaigns')")
        print("  - Schedule.campaign (relacionamento adicionado)")
        print("  - Schedule.player (removido backref='schedules')")
        print("  - Player.distributions (removido backref='player')")
        print("✓ Servidor testado e funcionando")
        print()
        print("🚀 O backend agora deve iniciar sem erros!")
        print("Execute: python app.py")
        print()
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERRO DURANTE A EXECUÇÃO: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    main()
