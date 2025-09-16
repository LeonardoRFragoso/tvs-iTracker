#!/usr/bin/env python3
"""
Script para inicializar banco de dados com estrutura e dados de exemplo
"""

import os
import sys
from datetime import datetime, time
from werkzeug.security import generate_password_hash

# Garantir que estamos no diretório backend
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
if os.path.exists(backend_dir):
    os.chdir(backend_dir)
    sys.path.insert(0, backend_dir)
else:
    # Se já estamos no backend
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app import app
    from database import db
    from models.user import User
    from models.location import Location
    from models.player import Player
    from models.content import Content
except ImportError as e:
    print(f"❌ Erro ao importar módulos: {e}")
    print("💡 Certifique-se de estar no diretório correto e ter as dependências instaladas")
    sys.exit(1)

def init_database():
    """Inicializa banco de dados com estrutura e dados de exemplo"""
    
    print("🔧 Inicializando banco de dados...")
    
    with app.app_context():
        try:
            # Criar todas as tabelas
            db.create_all()
            print("✅ Tabelas criadas com sucesso")
            
            # Verificar se já existem dados
            if User.query.first():
                print("⚠️  Banco de dados já contém dados. Pulando inicialização.")
                return
            
            # Criar usuário administrador
            admin_user = User(
                username='admin',
                email='admin@tvs.com',
                password_hash=generate_password_hash('admin123'),
                role='admin',
                is_active=True
            )
            db.session.add(admin_user)
            
            # Criar usuário gerente
            manager_user = User(
                username='manager',
                email='manager@tvs.com', 
                password_hash=generate_password_hash('manager123'),
                role='manager',
                is_active=True
            )
            db.session.add(manager_user)
            
            print("✅ Usuários criados (admin/admin123, manager/manager123)")
            
            # Criar sedes de exemplo
            sede_sp = Location(
                name='Sede São Paulo Centro',
                city='São Paulo',
                state='SP',
                address='Av. Paulista, 1000 - Bela Vista',
                timezone='America/Sao_Paulo',
                network_bandwidth_mbps=200,
                peak_hours_start=time(8, 0),
                peak_hours_end=time(18, 0),
                is_active=True
            )
            db.session.add(sede_sp)
            
            sede_rj = Location(
                name='Sede Rio de Janeiro',
                city='Rio de Janeiro',
                state='RJ',
                address='Av. Atlântica, 500 - Copacabana',
                timezone='America/Sao_Paulo',
                network_bandwidth_mbps=150,
                peak_hours_start=time(9, 0),
                peak_hours_end=time(17, 0),
                is_active=True
            )
            db.session.add(sede_rj)
            
            sede_bh = Location(
                name='Sede Belo Horizonte',
                city='Belo Horizonte',
                state='MG',
                address='Av. Afonso Pena, 3000 - Centro',
                timezone='America/Sao_Paulo',
                network_bandwidth_mbps=100,
                peak_hours_start=time(8, 30),
                peak_hours_end=time(17, 30),
                is_active=True
            )
            db.session.add(sede_bh)
            
            # Commit para obter IDs das sedes
            db.session.commit()
            print("✅ Sedes criadas (São Paulo, Rio de Janeiro, Belo Horizonte)")
            
            # Criar players de exemplo
            players_data = [
                # São Paulo
                {'name': 'TV Recepção SP', 'location': sede_sp, 'room': 'Recepção'},
                {'name': 'TV Sala Reunião SP', 'location': sede_sp, 'room': 'Sala de Reunião 1'},
                {'name': 'TV Cafeteria SP', 'location': sede_sp, 'room': 'Cafeteria'},
                
                # Rio de Janeiro  
                {'name': 'TV Lobby RJ', 'location': sede_rj, 'room': 'Lobby'},
                {'name': 'TV Auditório RJ', 'location': sede_rj, 'room': 'Auditório'},
                
                # Belo Horizonte
                {'name': 'TV Entrada BH', 'location': sede_bh, 'room': 'Entrada'},
                {'name': 'TV Corredor BH', 'location': sede_bh, 'room': 'Corredor Principal'},
            ]
            
            for player_data in players_data:
                player = Player(
                    name=player_data['name'],
                    location_id=player_data['location'].id,
                    room_name=player_data['room'],
                    storage_capacity_gb=50.0,
                    storage_used_gb=0.0,  # Corrigido: sem conteúdo inicial
                    network_speed_mbps=player_data['location'].network_bandwidth_mbps * 0.8,
                    last_ping=datetime.utcnow()
                )
                db.session.add(player)
            
            print("✅ Players criados (7 players distribuídos pelas sedes)")
            
            # Criar conteúdos de exemplo
            contents_data = [
                {
                    'title': 'Vídeo Institucional 2024',
                    'content_type': 'video',
                    'file_size': int(125.5 * 1024 * 1024),  # Convert MB to bytes
                    'duration': 180
                },
                {
                    'title': 'Promoção Black Friday',
                    'content_type': 'image',
                    'file_size': int(8.2 * 1024 * 1024),  # Convert MB to bytes
                    'duration': 15
                },
                {
                    'title': 'Comunicado Importante',
                    'content_type': 'video',
                    'file_size': int(45.8 * 1024 * 1024),  # Convert MB to bytes
                    'duration': 60
                },
                {
                    'title': 'Banner Produtos Novos',
                    'content_type': 'image',
                    'file_size': int(12.1 * 1024 * 1024),  # Convert MB to bytes
                    'duration': 20
                }
            ]
            
            for content_data in contents_data:
                content = Content(
                    title=content_data['title'],
                    content_type=content_data['content_type'],
                    file_size=content_data['file_size'],
                    duration=content_data['duration'],
                    is_active=True,
                    user_id=admin_user.id
                )
                db.session.add(content)
            
            print("✅ Conteúdos de exemplo criados")
            
            # Commit final
            db.session.commit()
            print("🎉 Banco de dados inicializado com sucesso!")
            print("\n📋 Resumo:")
            print(f"   👥 Usuários: {User.query.count()}")
            print(f"   🏢 Sedes: {Location.query.count()}")
            print(f"   📺 Players: {Player.query.count()}")
            print(f"   🎬 Conteúdos: {Content.query.count()}")
            print("\n🔐 Credenciais de acesso:")
            print("   Admin: admin / admin123")
            print("   Manager: manager / manager123")
            
        except Exception as e:
            print(f"❌ Erro durante inicialização: {e}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    init_database()
