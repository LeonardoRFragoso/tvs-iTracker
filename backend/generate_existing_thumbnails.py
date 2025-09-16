"""
Script para gerar thumbnails de conteúdos existentes
Executa após implementação do sistema de thumbnails
"""

import os
import sys
import uuid
import subprocess
import sqlite3
from PIL import Image
from dotenv import load_dotenv

def generate_video_thumbnail(video_path, thumbnail_path):
    """Gera thumbnail de vídeo usando FFmpeg"""
    try:
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-ss', '00:00:01.000',
            '-vframes', '1',
            '-q:v', '2',
            '-y',
            thumbnail_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.returncode == 0
        
    except Exception as e:
        print(f"Erro ao gerar thumbnail de vídeo: {str(e)}")
        return False

def generate_image_thumbnail(image_path, thumbnail_path, size=(300, 200)):
    """Gera thumbnail de imagem usando PIL"""
    try:
        with Image.open(image_path) as img:
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            img.thumbnail(size, Image.Resampling.LANCZOS)
            img.save(thumbnail_path, 'JPEG', quality=85)
            return True
            
    except Exception as e:
        print(f"Erro ao gerar thumbnail de imagem: {str(e)}")
        return False

def main():
    # Carregar variáveis de ambiente
    load_dotenv()
    
    # Configurações
    uploads_dir = os.getenv('UPLOAD_FOLDER', 'uploads')
    db_path = os.path.join('instance', 'tvs_platform.db')
    
    # Conectar diretamente ao SQLite
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Buscar conteúdos sem thumbnail
        cursor.execute("""
            SELECT id, title, file_path, content_type 
            FROM contents 
            WHERE thumbnail_path IS NULL 
            AND file_path IS NOT NULL 
            AND content_type IN ('video', 'image')
            AND is_active = 1
        """)
        
        contents = cursor.fetchall()
        print(f"Encontrados {len(contents)} conteúdos sem thumbnails")
        
        thumbnails_dir = os.path.join(uploads_dir, 'thumbnails')
        os.makedirs(thumbnails_dir, exist_ok=True)
        
        success_count = 0
        
        for content_id, title, file_path, content_type in contents:
            print(f"Processando: {title}")
            
            # Caminho do arquivo original
            full_file_path = os.path.join(uploads_dir, file_path)
            
            if not os.path.exists(full_file_path):
                print(f"  ❌ Arquivo não encontrado: {file_path}")
                continue
            
            # Gerar nome único para thumbnail
            thumbnail_filename = f"{uuid.uuid4()}.jpg"
            thumbnail_path = os.path.join(thumbnails_dir, thumbnail_filename)
            
            # Gerar thumbnail baseado no tipo
            thumbnail_generated = False
            
            if content_type == 'video':
                thumbnail_generated = generate_video_thumbnail(full_file_path, thumbnail_path)
            elif content_type == 'image':
                thumbnail_generated = generate_image_thumbnail(full_file_path, thumbnail_path)
            
            if thumbnail_generated:
                # Atualizar registro no banco
                cursor.execute(
                    "UPDATE contents SET thumbnail_path = ? WHERE id = ?",
                    (thumbnail_filename, content_id)
                )
                conn.commit()
                success_count += 1
                print(f"  ✅ Thumbnail gerado com sucesso")
            else:
                print(f"  ❌ Falha ao gerar thumbnail")
        
        print(f"\n🎉 Processo concluído!")
        print(f"✅ {success_count} thumbnails gerados com sucesso")
        print(f"❌ {len(contents) - success_count} falharam")
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()
