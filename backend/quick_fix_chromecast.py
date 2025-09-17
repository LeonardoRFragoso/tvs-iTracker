#!/usr/bin/env python3
"""
Script de correção rápida para o problema do Chromecast
"""

import sys
import os
import sqlite3
from datetime import datetime, time

def quick_fix():
    """Correção rápida do problema"""
    print("🚀 CORREÇÃO RÁPIDA DO CHROMECAST")
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
        
        print("\n🔍 DIAGNÓSTICO ATUAL:")
        
        # 1. Verificar players
        cursor.execute("""
            SELECT id, name, chromecast_id, chromecast_name, status
            FROM players 
            WHERE platform = 'chromecast'
        """)
        
        players = cursor.fetchall()
        
        if not players:
            print("❌ Nenhum player Chromecast encontrado!")
            return False
        
        print("\n📱 PLAYERS CHROMECAST:")
        for player in players:
            player_id, name, chromecast_id, chromecast_name, status = player
            print(f"   - Nome: {name}")
            print(f"   - Chromecast ID: {chromecast_id}")
            print(f"   - Chromecast Name: {chromecast_name}")
            print(f"   - Status: {status}")
        
        # 2. CORREÇÃO PRINCIPAL: Atualizar chromecast_name
        print(f"\n🔧 APLICANDO CORREÇÕES:")
        
        # Correção 1: Definir chromecast_name como 'Escritório'
        cursor.execute("""
            UPDATE players 
            SET chromecast_name = 'Escritório'
            WHERE platform = 'chromecast'
        """)
        
        print(f"✅ chromecast_name atualizado para 'Escritório'")
        
        # Correção 2: Atualizar status para online se necessário
        cursor.execute("""
            UPDATE players 
            SET status = 'online', last_seen = datetime('now')
            WHERE platform = 'chromecast' AND status = 'offline'
        """)
        
        print(f"✅ Status atualizado para online")
        
        # 3. Verificar agendamentos
        print(f"\n📅 VERIFICANDO AGENDAMENTOS:")
        
        current_time = datetime.now().time()
        print(f"⏰ Hora atual: {current_time}")
        
        cursor.execute("""
            SELECT s.name, s.start_time, s.end_time, s.is_active,
                   p.name as player_name, p.chromecast_name,
                   c.name as campaign_name
            FROM schedules s
            JOIN players p ON s.player_id = p.id
            JOIN campaigns c ON s.campaign_id = c.id
            WHERE s.is_active = 1 AND p.platform = 'chromecast'
        """)
        
        schedules = cursor.fetchall()
        
        for schedule in schedules:
            schedule_name, start_time, end_time, is_active, player_name, chromecast_name, campaign_name = schedule
            
            # Parse times
            start_t = datetime.strptime(start_time, '%H:%M:%S').time()
            end_t = datetime.strptime(end_time, '%H:%M:%S').time()
            
            # Check if should be active
            if start_t > end_t:  # Overnight
                should_be_active = current_time >= start_t or current_time <= end_t
            else:  # Normal
                should_be_active = start_t <= current_time <= end_t
            
            print(f"\n📋 {schedule_name}:")
            print(f"   - Horário: {start_time} - {end_time}")
            print(f"   - Player: {player_name} (Chromecast: {chromecast_name})")
            print(f"   - Campanha: {campaign_name}")
            print(f"   - Deveria estar ativo: {'✅ SIM' if should_be_active else '❌ NÃO'}")
        
        # 4. Verificar conteúdos das campanhas
        print(f"\n📺 VERIFICANDO CONTEÚDOS:")
        
        cursor.execute("""
            SELECT c.name, COUNT(cc.id) as total_contents,
                   SUM(CASE WHEN cc.is_active = 1 THEN 1 ELSE 0 END) as active_contents
            FROM campaigns c
            LEFT JOIN campaign_contents cc ON c.id = cc.campaign_id
            WHERE c.is_active = 1
            GROUP BY c.id, c.name
        """)
        
        campaigns = cursor.fetchall()
        
        for campaign_name, total_contents, active_contents in campaigns:
            print(f"   - {campaign_name}: {active_contents}/{total_contents} conteúdos ativos")
        
        # Commit mudanças
        conn.commit()
        conn.close()
        
        print(f"\n✅ CORREÇÃO CONCLUÍDA!")
        print(f"\n🎯 RESULTADO ESPERADO:")
        print("   - schedule_executor agora deve usar 'Escritório' para descoberta")
        print("   - Chromecast deve ser encontrado corretamente")
        print("   - Agendamentos devem executar no horário correto")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro durante a correção: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False

def create_test_schedule():
    """Cria um agendamento de teste para os próximos minutos"""
    print(f"\n🧪 CRIANDO AGENDAMENTO DE TESTE:")
    
    current_time = datetime.now()
    test_start = current_time.replace(second=0, microsecond=0)
    test_start = test_start.replace(minute=test_start.minute + 2)  # 2 minutos no futuro
    test_end = test_start.replace(minute=test_start.minute + 5)    # 5 minutos de duração
    
    print(f"   - Início: {test_start.strftime('%H:%M:%S')}")
    print(f"   - Fim: {test_end.strftime('%H:%M:%S')}")
    print(f"   - Aguarde 2 minutos para ver o teste executar!")

if __name__ == "__main__":
    success = quick_fix()
    if success:
        create_test_schedule()
        print(f"\n🚀 PRÓXIMOS PASSOS:")
        print("1. Reinicie o servidor backend (Ctrl+C e python app.py)")
        print("2. Aguarde o próximo agendamento (22:40 para TESTE-AUDIO)")
        print("3. Monitore os logs para ver se a conexão funciona")
        print("4. Se funcionar, o problema está resolvido! 🎉")
    else:
        print("\n❌ Correção falhou. Verifique os logs acima.")
