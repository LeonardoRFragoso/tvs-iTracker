#!/usr/bin/env python3
"""
Migração: Adicionar suporte a configurações do sistema
Data: 2025-09-22
Descrição: Cria tabela system_configs para armazenar configurações do sistema
+           e as tabelas de séries temporais de tráfego (network_samples_*)
"""

import sqlite3
import os
import sys
from datetime import datetime
import time

def _create_network_tables(cursor: sqlite3.Cursor):
    """Cria tabelas de séries temporais para monitoramento de tráfego
    (minute/hour/day) e seus respectivos índices, caso não existam.
    """
    # Minute table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS network_samples_minute (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        ts_minute TEXT NOT NULL,
        bytes INTEGER DEFAULT 0,
        requests INTEGER DEFAULT 0,
        video INTEGER DEFAULT 0,
        image INTEGER DEFAULT 0,
        audio INTEGER DEFAULT 0,
        other INTEGER DEFAULT 0,
        ip TEXT,
        company TEXT,
        location_id TEXT
    )''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsm_ts ON network_samples_minute(ts_minute)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsm_player_ts ON network_samples_minute(player_id, ts_minute)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsm_company_ts ON network_samples_minute(company, ts_minute)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsm_location_ts ON network_samples_minute(location_id, ts_minute)')

    # Hour table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS network_samples_hour (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        ts_hour TEXT NOT NULL,
        bytes INTEGER DEFAULT 0,
        requests INTEGER DEFAULT 0,
        video INTEGER DEFAULT 0,
        image INTEGER DEFAULT 0,
        audio INTEGER DEFAULT 0,
        other INTEGER DEFAULT 0,
        ip TEXT,
        company TEXT,
        location_id TEXT
    )''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsh_ts ON network_samples_hour(ts_hour)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsh_player_ts ON network_samples_hour(player_id, ts_hour)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsh_company_ts ON network_samples_hour(company, ts_hour)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsh_location_ts ON network_samples_hour(location_id, ts_hour)')

    # Day table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS network_samples_day (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        ts_day TEXT NOT NULL,
        bytes INTEGER DEFAULT 0,
        requests INTEGER DEFAULT 0,
        video INTEGER DEFAULT 0,
        image INTEGER DEFAULT 0,
        audio INTEGER DEFAULT 0,
        other INTEGER DEFAULT 0,
        ip TEXT,
        company TEXT,
        location_id TEXT
    )''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsd_ts ON network_samples_day(ts_day)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsd_player_ts ON network_samples_day(player_id, ts_day)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsd_company_ts ON network_samples_day(company, ts_day)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nsd_location_ts ON network_samples_day(location_id, ts_day)')


def _resolve_db_path(cli_path: str | None = None):
    """Resolve o caminho absoluto do banco de dados considerando diferentes diretórios de execução.
    Prioridade: argumento CLI > env TVS_DB_PATH > caminhos padrão (instance/tvs_platform.db na pasta backend).
    """
    # 1) Caminho vindo por argumento explícito
    candidates = []
    if cli_path:
        candidates.append(os.path.abspath(cli_path))

    # 2) Variável de ambiente
    env_path = os.getenv('TVS_DB_PATH')
    if env_path:
        candidates.append(os.path.abspath(env_path))

    # 3) Caminhos padrão relativos à pasta backend (pai de migrations)
    migrations_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.abspath(os.path.join(migrations_dir, os.pardir))
    candidates.extend([
        os.path.join(backend_dir, 'instance', 'tvs_platform.db'),
        os.path.join(backend_dir, 'tvs_platform.db'),
    ])

    # 4) Compatibilidade: caminhos relativos ao diretório atual (cwd)
    candidates.extend([
        os.path.join('instance', 'tvs_platform.db'),
        'tvs_platform.db',
    ])

    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def _open_conn(db_path: str, attempts: int = 10, timeout_sec: int = 30) -> sqlite3.Connection:
    """Abre conexão SQLite com retry/backoff e pragmas que reduzem lock.
    - WAL: melhora concorrência de leitura/escrita
    - busy_timeout: aguarda até N ms quando o banco está temporariamente bloqueado
    """
    last_err = None
    for i in range(attempts):
        try:
            conn = sqlite3.connect(db_path, timeout=timeout_sec)
            # PRAGMAs recomendados
            try:
                conn.execute('PRAGMA journal_mode=WAL;')
                conn.execute('PRAGMA synchronous=NORMAL;')
                conn.execute('PRAGMA busy_timeout=5000;')  # 5s
            except Exception:
                pass
            return conn
        except sqlite3.OperationalError as e:
            last_err = e
            # backoff incremental
            time.sleep(1 + i * 0.5)
    # Última tentativa sem captura para propagar erro
    return sqlite3.connect(db_path, timeout=timeout_sec)


def run_migration():
    """Executa a migração para adicionar suporte a configurações do sistema"""
    print(" Iniciando migração: Adicionar Suporte a Configurações do Sistema")
    print("=" * 60)

    # Detectar banco de dados correto (CLI arg opcional ou env TVS_DB_PATH)
    cli_arg = sys.argv[1] if len(sys.argv) > 1 else None
    db_path = _resolve_db_path(cli_arg)

    if not db_path:
        print(" Banco de dados não encontrado!\n")
        print(" Dicas:")
        print("  - Execute a partir da pasta backend: python migrations/add_system_configs.py")
        print("  - Ou informe o caminho: python migrations/add_system_configs.py instance/tvs_platform.db")
        print("  - Ou defina TVS_DB_PATH=...\n")
        return

    print(f" Usando banco de dados: {db_path}")

    try:
        conn = _open_conn(db_path)
        cursor = conn.cursor()

        # Verificar se a tabela já existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='system_configs'")
        if cursor.fetchone():
            print(" Tabela system_configs já existe. Pulando criação.")
        else:
            # Criar tabela system_configs
            cursor.execute('''
            CREATE TABLE system_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL UNIQUE,
                value TEXT,
                value_type TEXT DEFAULT 'string',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            print(" Tabela system_configs criada com sucesso!")

            # Adicionar configurações padrão
            default_configs = [
                # Configurações Gerais
                ('general.company_name', 'TVS Digital Signage', 'string', 'Nome da empresa'),
                ('general.timezone', 'America/Sao_Paulo', 'string', 'Fuso horário do sistema'),
                ('general.language', 'pt-BR', 'string', 'Idioma padrão do sistema'),
                ('general.auto_sync', 'true', 'bool', 'Sincronização automática de players'),
                ('general.auto_update', 'true', 'bool', 'Atualizações automáticas do sistema'),
                ('general.debug_mode', 'false', 'bool', 'Modo de depuração'),

                # Configurações de UI
                ('ui.dark_theme', 'false', 'bool', 'Tema escuro'),
                ('ui.animations_enabled', 'true', 'bool', 'Animações habilitadas'),
                ('ui.transition_duration', '300', 'int', 'Duração das transições (ms)'),

                # Configurações de Display
                ('display.default_orientation', 'landscape', 'string', 'Orientação padrão'),
                ('display.default_volume', '50', 'int', 'Volume padrão (%)'),

                # Configurações de Armazenamento
                ('storage.max_storage_gb', '100', 'int', 'Limite máximo de armazenamento (GB)'),
                ('storage.auto_cleanup', 'true', 'bool', 'Limpeza automática de arquivos não utilizados'),
                ('storage.backup_enabled', 'false', 'bool', 'Backup automático habilitado'),

                # Configurações de Segurança
                ('security.session_timeout', '30', 'int', 'Timeout da sessão (minutos)'),
                ('security.password_policy', 'medium', 'string', 'Política de senha (low, medium, high)'),

                # Configurações de Monitoramento/Tráfego
                ('monitor.emit_interval_sec', '30', 'int', 'Intervalo (s) para emitir estatísticas em tempo real'),
                ('monitor.overuse_window_min', '1', 'int', 'Janela (min) para cálculo de bytes/min e req/min'),
                ('monitor.overuse_bpm_mb', '100', 'int', 'Limite de bytes/min em MB para alertar sobreuso'),
                ('monitor.overuse_rpm', '300', 'int', 'Limite de requisições/min para alertar sobreuso'),
                ('monitor.sample_retention_days', '30', 'int', 'Dias de retenção dos samples agregados'),
                ('monitor.enable_persist', 'true', 'bool', 'Persistir métricas (minute/hour/day) no banco'),
                ('monitor.enable_system_stats', 'true', 'bool', 'Coletar e expor métricas do servidor (CPU/RAM/NET)')
            ]

            now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            for key, value, value_type, description in default_configs:
                cursor.execute('''
                INSERT INTO system_configs (key, value, value_type, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ''', (key, value, value_type, description, now, now))

            print(f" {len(default_configs)} configurações padrão adicionadas!")

        # Sempre garantir as tabelas de séries temporais
        _create_network_tables(cursor)
        print(" Tabelas network_samples_* garantidas (minute/hour/day) com índices.")

        conn.commit()
        print(" Migração concluída com sucesso!")

    except sqlite3.Error as e:
        print(f" Erro ao executar migração: {e}")

        # Dicas quando for lock
        if 'locked' in str(e).lower():
            print("\n Dica: Feche o servidor Flask que está usando o banco ou aguarde alguns segundos e tente novamente.")
            print(" Você também pode parar o serviço/terminal que está com o backend ativo e reexecutar esta migração.")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    run_migration()
