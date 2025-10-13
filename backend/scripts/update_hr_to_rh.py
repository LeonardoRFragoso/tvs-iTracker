#!/usr/bin/env python3
"""
Script para atualizar registros de usuários com role 'hr' para 'rh'
Executa a migração de dados necessária após a alteração de terminologia
"""

import os
import sys
from datetime import datetime, timezone

# Garantir que estamos no diretório backend
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if os.path.exists(backend_dir):
    os.chdir(backend_dir)
    sys.path.insert(0, backend_dir)
else:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app import app
    from database import db
    from models.user import User
except ImportError as e:
    print(f"❌ Erro ao importar módulos: {e}")
    print("💡 Certifique-se de estar no diretório correto e ter as dependências instaladas")
    sys.exit(1)

def update_hr_to_rh():
    """Atualiza todos os usuários com role 'hr' para 'rh'"""
    
    print("🔄 Iniciando atualização de terminologia HR → RH...")
    
    with app.app_context():
        try:
            # Verificar quantos usuários têm role 'hr'
            hr_users = User.query.filter(User.role == 'hr').all()
            
            if not hr_users:
                print("✅ Nenhum usuário com role 'hr' encontrado. Sistema já está atualizado!")
                return
            
            print(f"📋 Encontrados {len(hr_users)} usuário(s) com role 'hr':")
            
            for user in hr_users:
                print(f"   - {user.username} ({user.email}) - Empresa: {user.company}")
            
            # Confirmar atualização
            print("\n⚠️  Esta operação irá atualizar o role de 'hr' para 'rh' para todos os usuários listados.")
            confirm = input("Deseja continuar? (s/N): ").strip().lower()
            
            if confirm not in ['s', 'sim', 'y', 'yes']:
                print("❌ Operação cancelada pelo usuário.")
                return
            
            # Realizar atualização
            updated_count = 0
            for user in hr_users:
                old_role = user.role
                user.role = 'rh'
                user.updated_at = datetime.now(timezone.utc)
                
                print(f"   ✅ {user.username}: '{old_role}' → '{user.role}'")
                updated_count += 1
            
            # Salvar alterações
            db.session.commit()
            
            print(f"\n🎉 Atualização concluída com sucesso!")
            print(f"📊 Total de usuários atualizados: {updated_count}")
            print(f"📅 Data da atualização: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
            
            # Verificação final
            remaining_hr = User.query.filter(User.role == 'hr').count()
            total_rh = User.query.filter(User.role == 'rh').count()
            
            print(f"\n📈 Status final:")
            print(f"   - Usuários com role 'hr': {remaining_hr}")
            print(f"   - Usuários com role 'rh': {total_rh}")
            
            if remaining_hr == 0:
                print("✅ Migração 100% concluída! Todos os usuários HR agora usam 'rh'.")
            else:
                print("⚠️  Ainda existem usuários com role 'hr'. Verifique manualmente.")
                
        except Exception as e:
            print(f"❌ Erro durante a atualização: {e}")
            db.session.rollback()
            sys.exit(1)

def verify_system_consistency():
    """Verifica a consistência do sistema após a atualização"""
    
    print("\n🔍 Verificando consistência do sistema...")
    
    with app.app_context():
        try:
            # Contar usuários por role
            roles_count = db.session.query(User.role, db.func.count(User.id)).group_by(User.role).all()
            
            print("📊 Distribuição atual de roles:")
            for role, count in roles_count:
                print(f"   - {role}: {count} usuário(s)")
            
            # Verificar se ainda há 'hr'
            hr_count = User.query.filter(User.role == 'hr').count()
            rh_count = User.query.filter(User.role == 'rh').count()
            
            if hr_count > 0:
                print(f"⚠️  ATENÇÃO: Ainda existem {hr_count} usuário(s) com role 'hr'!")
                hr_users = User.query.filter(User.role == 'hr').all()
                for user in hr_users:
                    print(f"   - {user.username} ({user.email})")
                return False
            else:
                print(f"✅ Sistema consistente: {rh_count} usuário(s) RH usando terminologia correta 'rh'")
                return True
                
        except Exception as e:
            print(f"❌ Erro durante verificação: {e}")
            return False

if __name__ == '__main__':
    print("=" * 60)
    print("🇧🇷 MIGRAÇÃO DE TERMINOLOGIA: HR → RH (RECURSOS HUMANOS)")
    print("=" * 60)
    
    # Primeiro verificar se há algo para atualizar
    with app.app_context():
        hr_count = User.query.filter(User.role == 'hr').count()
        rh_count = User.query.filter(User.role == 'rh').count()
        
        print(f"📊 Status atual:")
        print(f"   - Usuários com role 'hr': {hr_count}")
        print(f"   - Usuários com role 'rh': {rh_count}")
    
    if hr_count > 0:
        # Executar atualização
        update_hr_to_rh()
        
        # Verificar consistência
        if verify_system_consistency():
            print("\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
            print("💡 O sistema agora usa corretamente a terminologia brasileira 'RH'.")
        else:
            print("\n❌ MIGRAÇÃO INCOMPLETA!")
            print("💡 Execute o script novamente ou verifique manualmente.")
    else:
        print("\n✅ SISTEMA JÁ ATUALIZADO!")
        print("💡 Todos os usuários já usam a terminologia correta 'rh'.")
        verify_system_consistency()
    
    print("\n" + "=" * 60)
