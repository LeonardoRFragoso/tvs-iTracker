"""
Script para executar a migração para remover a restrição UNIQUE da coluna mac_address
"""
from app import app, db
from sqlalchemy import text
import os

def run_migration():
    """Remove a restrição UNIQUE da coluna mac_address na tabela players"""
    with app.app_context():
        try:
            # SQLite não suporta ALTER TABLE DROP CONSTRAINT diretamente
            # Precisamos recriar a tabela sem a restrição
            
            # 1. Renomear a tabela atual
            db.session.execute(text("ALTER TABLE players RENAME TO players_old"))
            print("[Migração] Tabela players renomeada para players_old")
            
            # 2. Criar uma nova tabela sem a restrição UNIQUE
            db.session.execute(text("""
                CREATE TABLE players (
                    id VARCHAR(36) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    location_id VARCHAR(36) NOT NULL,
                    room_name VARCHAR(100),
                    mac_address VARCHAR(17),
                    ip_address VARCHAR(45),
                    chromecast_id VARCHAR(100),
                    chromecast_name VARCHAR(100),
                    access_code VARCHAR(12) UNIQUE,
                    platform VARCHAR(50),
                    device_type VARCHAR(50),
                    resolution VARCHAR(20),
                    orientation VARCHAR(20),
                    player_version VARCHAR(20),
                    is_online BOOLEAN,
                    is_active BOOLEAN,
                    last_ping DATETIME,
                    last_content_sync DATETIME,
                    status VARCHAR(20),
                    default_content_duration INTEGER,
                    transition_effect VARCHAR(50),
                    volume_level INTEGER,
                    storage_capacity_gb INTEGER,
                    storage_used_gb FLOAT,
                    offline_content TEXT,
                    avg_download_speed_kbps INTEGER,
                    network_speed_mbps FLOAT,
                    total_content_downloaded_gb FLOAT,
                    uptime_percentage FLOAT,
                    created_at DATETIME,
                    updated_at DATETIME,
                    current_content_id VARCHAR(36),
                    current_content_title VARCHAR(255),
                    current_content_type VARCHAR(50),
                    current_campaign_id VARCHAR(36),
                    current_campaign_name VARCHAR(255),
                    is_playing BOOLEAN,
                    playback_start_time DATETIME,
                    last_playback_heartbeat DATETIME,
                    FOREIGN KEY (location_id) REFERENCES locations (id)
                )
            """))
            print("[Migração] Nova tabela players criada sem a restrição UNIQUE em mac_address")
            
            # 3. Copiar os dados da tabela antiga para a nova
            db.session.execute(text("""
                INSERT INTO players SELECT * FROM players_old
            """))
            print("[Migração] Dados copiados da tabela antiga para a nova")
            
            # 4. Remover a tabela antiga
            db.session.execute(text("DROP TABLE players_old"))
            print("[Migração] Tabela antiga removida")
            
            # 5. Criar índice para access_code
            db.session.execute(text("CREATE INDEX idx_players_access_code ON players (access_code)"))
            print("[Migração] Índice criado para access_code")
            
            # Commit das alterações
            db.session.commit()
            print("[Migração] Alterações commitadas com sucesso")
            return True
        except Exception as e:
            db.session.rollback()
            print(f"[Migração] Erro ao remover restrição UNIQUE: {str(e)}")
            return False

if __name__ == "__main__":
    # Verificar se estamos usando o banco de dados correto
    print(f"[INFO] Usando banco de dados: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    # Verificar se o banco de dados existe
    db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
    if db_path.startswith('/'):
        db_path = db_path[1:]  # Remover a barra inicial para caminhos absolutos
    
    # Verificar se o caminho é relativo
    if not os.path.isabs(db_path):
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), db_path)
    
    # Verificar se o arquivo existe
    if os.path.exists(db_path):
        print(f"[INFO] Banco de dados encontrado em: {db_path}")
    else:
        print(f"[AVISO] Banco de dados não encontrado em: {db_path}")
        
        # Verificar se existe na pasta instance
        instance_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', os.path.basename(db_path))
        if os.path.exists(instance_db_path):
            print(f"[INFO] Banco de dados encontrado na pasta instance: {instance_db_path}")
            print(f"[AVISO] Considere atualizar a configuração SQLALCHEMY_DATABASE_URI para apontar para o arquivo correto")
    
    # Executar a migração
    run_migration()
