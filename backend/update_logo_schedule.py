#!/usr/bin/env python3
"""
Script to update the teste-logo schedule to run continuously
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from database import db
from models.schedule import Schedule
from models.campaign import Campaign
from models.player import Player
from datetime import datetime, time, date

def update_logo_schedule():
    with app.app_context():
        try:
            # Buscar campanhas com "logo" no nome
            logo_campaigns = Campaign.query.filter(Campaign.name.like('%logo%')).all()
            
            if not logo_campaigns:
                print("Nenhuma campanha com 'logo' no nome encontrada!")
                return False
            
            print(f"Encontradas {len(logo_campaigns)} campanhas com 'logo' no nome:")
            
            for campaign in logo_campaigns:
                print(f"\nCampanha: {campaign.name} (ID: {campaign.id})")
                
                # Buscar agendamentos desta campanha
                schedules = Schedule.query.filter_by(campaign_id=campaign.id).all()
                
                if not schedules:
                    print("  Nenhum agendamento encontrado para esta campanha")
                    continue
                
                print(f"  Agendamentos encontrados: {len(schedules)}")
                
                for schedule in schedules:
                    player = Player.query.get(schedule.player_id)
                    
                    print(f"\n  Agendamento ID: {schedule.id}")
                    print(f"  Player: {player.name if player else 'N/A'}")
                    print(f"  Configuração atual:")
                    print(f"    Data início: {schedule.start_date}")
                    print(f"    Data fim: {schedule.end_date}")
                    print(f"    Hora início: {schedule.start_time}")
                    print(f"    Hora fim: {schedule.end_time}")
                    print(f"    Dias da semana: {schedule.days_of_week}")
                    print(f"    Intervalo: {schedule.repeat_interval} {schedule.repeat_type}")
                    print(f"    Ativo: {schedule.is_active}")
                    
                    # Atualizar para execução contínua
                    # Definir horário de início bem cedo (00:01) e fim tarde (23:59)
                    # Reduzir intervalo para 1 para manter overlay sempre ativo
                    
                    old_start_time = schedule.start_time
                    old_end_time = schedule.end_time
                    old_interval = schedule.repeat_interval
                    old_start_date = schedule.start_date
                    
                    # Configurar para execução contínua
                    schedule.start_time = time(0, 1)  # 00:01
                    schedule.end_time = time(23, 59)  # 23:59
                    schedule.repeat_interval = 1  # 1 para manter sempre ativo
                    schedule.start_date = datetime.combine(date.today(), time(0, 0))  # Começar hoje às 00:00
                    schedule.is_active = True
                    
                    # Garantir que executa todos os dias da semana
                    if not schedule.days_of_week or schedule.days_of_week == '[]':
                        schedule.days_of_week = '[0,1,2,3,4,5,6]'  # Todos os dias
                    
                    db.session.commit()
                    
                    print(f"\n  ✅ Agendamento atualizado:")
                    print(f"    Data início: {old_start_date} → {schedule.start_date}")
                    print(f"    Hora início: {old_start_time} → {schedule.start_time}")
                    print(f"    Hora fim: {old_end_time} → {schedule.end_time}")
                    print(f"    Intervalo: {old_interval} → {schedule.repeat_interval}")
                    print(f"    Dias da semana: {schedule.days_of_week}")
                    print(f"    Status: Ativo = {schedule.is_active}")
            
            return True
            
        except Exception as e:
            print(f"Erro ao atualizar agendamento: {e}")
            db.session.rollback()
            return False

if __name__ == "__main__":
    print("=== Atualizando agendamento do logo para execução contínua ===")
    success = update_logo_schedule()
    
    if success:
        print("\n✅ Agendamento atualizado com sucesso!")
        print("O logo agora deve executar continuamente das 00:01 às 23:59 todos os dias.")
    else:
        print("\n❌ Erro ao atualizar agendamento!")
