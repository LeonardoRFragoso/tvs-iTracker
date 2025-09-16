#!/usr/bin/env python3
"""
Script para adicionar conteúdo de teste à campanha "teste"
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from database import db
from models.campaign import Campaign, CampaignContent
from models.content import Content
from models.user import User
import uuid

def add_test_content():
    with app.app_context():
        try:
            # Buscar a campanha "teste"
            campaign = Campaign.query.filter_by(name='teste').first()
            if not campaign:
                print("Campanha 'teste' não encontrada!")
                return False
            
            print(f"Campanha encontrada: {campaign.name} (ID: {campaign.id})")
            
            # Buscar um usuário para associar ao conteúdo
            user = User.query.first()
            if not user:
                print("Nenhum usuário encontrado no sistema!")
                return False
            
            # Verificar se já existe conteúdo na campanha
            existing_content = CampaignContent.query.filter_by(campaign_id=campaign.id).first()
            if existing_content:
                print("Campanha já possui conteúdo associado!")
                return True
            
            # Criar conteúdo de teste (vídeo)
            test_content = Content(
                id=str(uuid.uuid4()),
                title="Vídeo de Teste para Chromecast",
                description="Conteúdo de teste para verificar reprodução no Chromecast",
                content_type="video",
                file_path="test_video.mp4",  # Arquivo de exemplo
                mime_type="video/mp4",
                duration=30,  # 30 segundos
                is_active=True,
                user_id=user.id
            )
            
            db.session.add(test_content)
            db.session.flush()  # Para obter o ID
            
            print(f"Conteúdo criado: {test_content.title} (ID: {test_content.id})")
            
            # Associar conteúdo à campanha
            campaign_content = CampaignContent(
                id=str(uuid.uuid4()),
                campaign_id=campaign.id,
                content_id=test_content.id,
                order_index=0
            )
            
            db.session.add(campaign_content)
            db.session.commit()
            
            print(f"Conteúdo associado à campanha com sucesso!")
            print(f"CampaignContent ID: {campaign_content.id}")
            
            # Verificar associação
            verification = CampaignContent.query.filter_by(campaign_id=campaign.id).all()
            print(f"Total de conteúdos na campanha: {len(verification)}")
            
            return True
            
        except Exception as e:
            print(f"Erro ao adicionar conteúdo: {e}")
            db.session.rollback()
            return False

def create_test_video_file():
    """Cria um arquivo de vídeo de teste simples"""
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
    
    test_video_path = os.path.join(uploads_dir, 'test_video.mp4')
    
    # Se o arquivo não existe, criar um placeholder
    if not os.path.exists(test_video_path):
        # Criar um arquivo vazio como placeholder
        # Em produção, você deveria ter um vídeo real aqui
        with open(test_video_path, 'w') as f:
            f.write("# Placeholder para vídeo de teste\n")
        print(f"Arquivo placeholder criado: {test_video_path}")
        print("NOTA: Substitua este arquivo por um vídeo MP4 real para testar a reprodução")

if __name__ == "__main__":
    print("=== Adicionando conteúdo de teste à campanha ===")
    
    # Criar arquivo de teste se necessário
    create_test_video_file()
    
    # Adicionar conteúdo à campanha
    success = add_test_content()
    
    if success:
        print("\n✅ Conteúdo adicionado com sucesso!")
        print("Agora o agendamento deve conseguir enviar conteúdo para o Chromecast.")
    else:
        print("\n❌ Falha ao adicionar conteúdo!")
