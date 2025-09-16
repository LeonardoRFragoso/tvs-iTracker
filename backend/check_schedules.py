#!/usr/bin/env python3
"""
Script to check current schedules and find the teste-logo schedule
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from database import db
from models.schedule import Schedule
from models.campaign import Campaign
from models.player import Player
from datetime import datetime

def check_schedules():
    with app.app_context():
        try:
            # Buscar todos os agendamentos
            schedules = Schedule.query.all()
            
            print("=== AGENDAMENTOS ATUAIS ===")
            print(f"Total de agendamentos: {len(schedules)}")
            print()
            
            for schedule in schedules:
                campaign = Campaign.query.get(schedule.campaign_id)
                player = Player.query.get(schedule.player_id)
                
                print(f"ID: {schedule.id}")
                print(f"Campanha: {campaign.name if campaign else 'N/A'} (ID: {schedule.campaign_id})")
                print(f"Player: {player.name if player else 'N/A'} (ID: {schedule.player_id})")
                print(f"Data início: {schedule.start_date}")
                print(f"Data fim: {schedule.end_date}")
                print(f"Hora início: {schedule.start_time}")
                print(f"Hora fim: {schedule.end_time}")
                print(f"Dias da semana: {schedule.days_of_week}")
                print(f"Intervalo: {schedule.repeat_interval} {schedule.repeat_type}")
                print(f"Ativo: {schedule.is_active}")
                print("-" * 50)
            
            # Buscar especificamente campanhas com "logo" no nome
            logo_campaigns = Campaign.query.filter(Campaign.name.like('%logo%')).all()
            
            print("\n=== CAMPANHAS COM 'LOGO' NO NOME ===")
            for campaign in logo_campaigns:
                print(f"Campanha: {campaign.name} (ID: {campaign.id})")
                
                # Buscar agendamentos desta campanha
                campaign_schedules = Schedule.query.filter_by(campaign_id=campaign.id).all()
                print(f"Agendamentos: {len(campaign_schedules)}")
                
                for schedule in campaign_schedules:
                    player = Player.query.get(schedule.player_id)
                    print(f"  - Player: {player.name if player else 'N/A'}")
                    print(f"    Início: {schedule.start_date} {schedule.start_time}")
                    print(f"    Fim: {schedule.end_date} {schedule.end_time}")
                    print(f"    Dias: {schedule.days_of_week}")
                    print(f"    Intervalo: {schedule.repeat_interval} {schedule.repeat_type}")
                    print(f"    Ativo: {schedule.is_active}")
                print()
            
            return True
            
        except Exception as e:
            print(f"Erro ao verificar agendamentos: {e}")
            return False

if __name__ == "__main__":
    print("=== Verificando agendamentos no sistema ===")
    success = check_schedules()
    
    if success:
        print("\n✅ Verificação concluída!")
    else:
        print("\n❌ Erro na verificação!")
