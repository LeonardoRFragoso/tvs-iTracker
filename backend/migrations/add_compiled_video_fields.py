#!/usr/bin/env python3
"""
Migração: Campos de vídeo compilado em campanhas
Data: 2025-09-17
Descrição: Adiciona colunas para armazenar informações do vídeo compilado de uma campanha
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    print("🔄 Iniciando migração: Campos de vídeo compilado em campanhas")
    print("=" * 70)

    # Detectar banco de dados correto (usar o que possui tabelas)
    db_candidates = [
        'instance/tvs_platform.db',
        'tvs_platform.db',
    ]
    db_path = None
    for p in db_candidates:
        if os.path.exists(p):
            db_path = p
            break
    if not db_path:
        print("❌ Banco de dados não encontrado!")
        return False

    print(f"📁 Usando banco: {db_path}")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("\n📊 Verificando colunas em campaigns...")
        cursor.execute("PRAGMA table_info(campaigns)")
        campaign_columns = [c[1] for c in cursor.fetchall()]
        print(f"Colunas atuais: {campaign_columns}")

        new_columns = [
            ('compiled_video_path', 'TEXT'),
            ('compiled_video_duration', 'INTEGER'),
            ('compiled_video_status', 'TEXT DEFAULT "none"'),
            ('compiled_video_error', 'TEXT'),
            ('compiled_video_updated_at', 'DATETIME'),
            ('compiled_stale', 'BOOLEAN DEFAULT 1'),
            ('compiled_video_resolution', 'TEXT'),
            ('compiled_video_fps', 'INTEGER')
        ]

        for name, ddl in new_columns:
            if name not in campaign_columns:
                print(f"➕ Adicionando coluna: {name}")
                cursor.execute(f"ALTER TABLE campaigns ADD COLUMN {name} {ddl}")
            else:
                print(f"✅ Coluna já existe: {name}")

        conn.commit()
        conn.close()

        # Garantir diretório de compilados dentro de uploads
        uploads_dir = 'uploads'
        compiled_dir = os.path.join(uploads_dir, 'compiled')
        try:
            os.makedirs(compiled_dir, exist_ok=True)
            print(f"📁 Diretório garantido: {compiled_dir}")
        except Exception as e:
            print(f"⚠️  Falha ao criar diretório {compiled_dir}: {e}")

        print(f"\n✅ Migração concluída com sucesso!")
        print(f"📅 Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return True

    except Exception as e:
        print(f"❌ Erro durante a migração: {e}")
        try:
            conn.rollback()
            conn.close()
        except Exception:
            pass
        return False

if __name__ == "__main__":
    ok = run_migration()
    if ok:
        print("\n🎉 Campos de vídeo compilado prontos!")
    else:
        print("\n❌ Migração falhou. Verifique os logs acima.")
