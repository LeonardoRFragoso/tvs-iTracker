#!/usr/bin/env python3
"""
Script para debugar a campanha "teste" e verificar por que o conteúdo não está sendo encontrado
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from database import db
from models.campaign import Campaign, CampaignContent
from models.content import Content
from models.schedule import Schedule
from models.player import Player

def debug_campaign_content():
    with app.app_context():
        try:
            print("=== DEBUG DA CAMPANHA TESTE ===\n")
            
            # 1. Buscar campanha "teste"
            campaign = Campaign.query.filter_by(name='teste').first()
            if not campaign:
                print("❌ Campanha 'teste' não encontrada!")
                return False
            
            print(f"✅ Campanha encontrada:")
            print(f"   - ID: {campaign.id}")
            print(f"   - Nome: {campaign.name}")
            print(f"   - Ativa: {campaign.is_active}")
            print(f"   - Data início: {campaign.start_date}")
            print(f"   - Data fim: {campaign.end_date}")
            
            # 2. Buscar CampaignContent diretamente
            print(f"\n🔍 Buscando CampaignContent para campanha ID: {campaign.id}")
            campaign_contents = CampaignContent.query.filter_by(campaign_id=campaign.id).all()
            
            print(f"   - Total encontrados: {len(campaign_contents)}")
            
            if not campaign_contents:
                print("❌ Nenhum CampaignContent encontrado!")
                
                # Verificar se existem CampaignContent em geral
                all_cc = CampaignContent.query.all()
                print(f"   - Total de CampaignContent no sistema: {len(all_cc)}")
                
                if all_cc:
                    print("   - CampaignContent existentes:")
                    for cc in all_cc[:5]:  # Mostrar apenas os primeiros 5
                        print(f"     * ID: {cc.id}, Campaign: {cc.campaign_id}, Content: {cc.content_id}")
                
                return False
            
            # 3. Analisar cada CampaignContent
            for i, cc in enumerate(campaign_contents):
                print(f"\n📋 CampaignContent #{i+1}:")
                print(f"   - ID: {cc.id}")
                print(f"   - Campaign ID: {cc.campaign_id}")
                print(f"   - Content ID: {cc.content_id}")
                print(f"   - Order Index: {cc.order_index}")
                
                # Verificar se o Content existe
                content = Content.query.get(cc.content_id)
                if content:
                    print(f"   ✅ Content encontrado:")
                    print(f"      - ID: {content.id}")
                    print(f"      - Título: {content.title}")
                    print(f"      - Tipo: {content.content_type}")
                    print(f"      - Arquivo: {content.file_path}")
                    print(f"      - Ativo: {content.is_active}")
                    print(f"      - MIME: {content.mime_type}")
                else:
                    print(f"   ❌ Content não encontrado para ID: {cc.content_id}")
            
            # 4. Testar a query exata do schedule_executor
            print(f"\n🧪 Testando query exata do schedule_executor:")
            test_query = CampaignContent.query.filter_by(campaign_id=campaign.id).all()
            print(f"   - Resultado da query: {len(test_query)} registros")
            
            # 5. Verificar agendamento
            print(f"\n📅 Verificando agendamento:")
            schedule = Schedule.query.filter_by(campaign_id=campaign.id).first()
            if schedule:
                print(f"   ✅ Agendamento encontrado:")
                print(f"      - ID: {schedule.id}")
                print(f"      - Nome: {schedule.name}")
                print(f"      - Player ID: {schedule.player_id}")
                print(f"      - Ativo: {schedule.is_active}")
                
                # Verificar player
                player = Player.query.get(schedule.player_id)
                if player:
                    print(f"   ✅ Player encontrado:")
                    print(f"      - Nome: {player.name}")
                    print(f"      - Status: {player.status}")
                    print(f"      - Chromecast ID: {player.chromecast_id}")
                else:
                    print(f"   ❌ Player não encontrado: {schedule.player_id}")
            else:
                print(f"   ❌ Nenhum agendamento encontrado para a campanha")
            
            # 6. Simular execução do schedule_executor
            print(f"\n🎬 Simulando execução do schedule_executor:")
            if campaign_contents:
                for cc in campaign_contents:
                    if cc.content and cc.content.is_active:
                        print(f"   ✅ Conteúdo ativo encontrado: {cc.content.title}")
                        media_url = f"http://192.168.0.4:5000/uploads/{cc.content.file_path}"
                        print(f"   📺 URL que seria enviada: {media_url}")
                        
                        # Verificar se arquivo existe
                        file_path = os.path.join(os.path.dirname(__file__), 'uploads', cc.content.file_path)
                        if os.path.exists(file_path):
                            print(f"   ✅ Arquivo existe: {file_path}")
                        else:
                            print(f"   ❌ Arquivo não encontrado: {file_path}")
                        break
                else:
                    print(f"   ❌ Nenhum conteúdo ativo encontrado")
            
            return True
            
        except Exception as e:
            print(f"❌ Erro durante debug: {e}")
            import traceback
            traceback.print_exc()
            return False

def fix_campaign_content_issue():
    """Tenta corrigir problemas comuns com CampaignContent"""
    with app.app_context():
        try:
            print("\n=== TENTANDO CORRIGIR PROBLEMAS ===\n")
            
            campaign = Campaign.query.filter_by(name='teste').first()
            if not campaign:
                print("❌ Campanha não encontrada")
                return False
            
            # Verificar se existe conteúdo "TESTE"
            content = Content.query.filter_by(title='TESTE').first()
            if not content:
                print("❌ Conteúdo 'TESTE' não encontrado")
                return False
            
            print(f"✅ Conteúdo encontrado: {content.title} (ID: {content.id})")
            
            # Verificar se já existe associação
            existing = CampaignContent.query.filter_by(
                campaign_id=campaign.id,
                content_id=content.id
            ).first()
            
            if existing:
                print(f"✅ Associação já existe: {existing.id}")
                return True
            
            # Criar associação se não existir
            print("🔧 Criando associação CampaignContent...")
            import uuid
            
            campaign_content = CampaignContent(
                id=str(uuid.uuid4()),
                campaign_id=campaign.id,
                content_id=content.id,
                order_index=0
            )
            
            db.session.add(campaign_content)
            db.session.commit()
            
            print(f"✅ Associação criada com sucesso: {campaign_content.id}")
            return True
            
        except Exception as e:
            print(f"❌ Erro ao corrigir: {e}")
            db.session.rollback()
            return False

if __name__ == "__main__":
    success = debug_campaign_content()
    
    if not success:
        print("\n🔧 Tentando corrigir o problema...")
        fix_campaign_content_issue()
        
        print("\n🔄 Executando debug novamente...")
        debug_campaign_content()
