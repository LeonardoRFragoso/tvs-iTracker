#!/usr/bin/env python3
"""
Script para corrigir o conteúdo da campanha para usar um arquivo de vídeo real
ao invés do test_video.mp4 que não existe.
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from database import db

# Importar todos os modelos para resolver dependências
from models.content import Content
from models.campaign import Campaign, CampaignContent
from models.schedule import Schedule
from models.player import Player
from models.user import User
from models.location import Location
from models.content_distribution import ContentDistribution

def create_app():
    """Cria uma instância da aplicação Flask"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tvs_platform.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Inicializar o banco de dados
    db.init_app(app)
    
    return app

def fix_campaign_content():
    """Corrige o conteúdo da campanha para usar um arquivo real"""
    
    app = create_app()
    
    with app.app_context():
        print("=== Corrigindo Conteúdo da Campanha ===")
        
        # Buscar o conteúdo que está usando test_video.mp4
        test_content = Content.query.filter_by(file_path='test_video.mp4').first()
        
        if test_content:
            print(f"Encontrado conteúdo com test_video.mp4: {test_content.title}")
            
            # Listar arquivos disponíveis na pasta uploads
            uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
            available_files = []
            
            if os.path.exists(uploads_dir):
                for file in os.listdir(uploads_dir):
                    if file.endswith('.mp4'):
                        file_path = os.path.join(uploads_dir, file)
                        file_size = os.path.getsize(file_path)
                        available_files.append((file, file_size))
            
            print(f"\nArquivos disponíveis na pasta uploads:")
            for i, (file, size) in enumerate(available_files):
                print(f"{i+1}. {file} ({size} bytes)")
            
            if available_files:
                # Usar o primeiro arquivo disponível
                new_file = available_files[0][0]
                print(f"\nAtualizando conteúdo para usar: {new_file}")
                
                # Atualizar o file_path do conteúdo
                test_content.file_path = new_file
                test_content.title = f"Vídeo Real da Campanha"
                
                db.session.commit()
                print(f"✅ Conteúdo atualizado com sucesso!")
                print(f"   - Novo arquivo: {new_file}")
                print(f"   - Novo título: {test_content.title}")
                
                # Verificar se o conteúdo está vinculado a alguma campanha
                campaign_contents = CampaignContent.query.filter_by(content_id=test_content.id).all()
                print(f"\nCampanhas vinculadas: {len(campaign_contents)}")
                
                for cc in campaign_contents:
                    campaign = Campaign.query.get(cc.campaign_id)
                    if campaign:
                        print(f"   - Campanha: {campaign.name}")
                
            else:
                print("❌ Nenhum arquivo de vídeo encontrado na pasta uploads")
        else:
            print("ℹ️ Nenhum conteúdo encontrado usando test_video.mp4")
            
            # Listar todos os conteúdos
            all_contents = Content.query.all()
            print(f"\nTodos os conteúdos no banco ({len(all_contents)}):")
            for content in all_contents:
                print(f"   - {content.title}: {content.file_path}")

if __name__ == "__main__":
    fix_campaign_content()
