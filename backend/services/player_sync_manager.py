import os
import json
import sqlite3
import hashlib
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class PlayerSyncManager:
    """
    Gerenciador de sincronização offline para players.
    Responsável por manter cache local, sincronizar conteúdo e gerenciar armazenamento.
    """
    
    def __init__(self, player_id: str, cache_dir: str = "./player_cache", 
                 api_base_url: str = "http://localhost:5000/api"):
        self.player_id = player_id
        self.cache_dir = Path(cache_dir)
        self.api_base_url = api_base_url
        self.db_path = self.cache_dir / f"player_{player_id}.db"
        
        # Criar diretório de cache se não existir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Inicializar banco de dados local
        self._init_local_db()
        
        # Configurações
        self.max_storage_gb = 50  # Limite padrão de armazenamento
        self.sync_interval_minutes = 5
        self.cleanup_threshold_days = 30
        
    def _init_local_db(self):
        """Inicializa banco de dados SQLite local para cache"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Tabela de conteúdos em cache
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cached_content (
                content_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size_mb REAL NOT NULL,
                checksum TEXT NOT NULL,
                downloaded_at TIMESTAMP NOT NULL,
                last_accessed TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                metadata TEXT
            )
        ''')
        
        # Tabela de distribuições
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS distributions (
                distribution_id TEXT PRIMARY KEY,
                content_id TEXT NOT NULL,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP,
                error_message TEXT,
                retry_count INTEGER DEFAULT 0
            )
        ''')
        
        # Tabela de configurações
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sync_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def get_storage_info(self) -> Dict:
        """Retorna informações de armazenamento do player"""
        total_size = 0
        file_count = 0
        
        # Calcular tamanho total dos arquivos em cache
        for file_path in self.cache_dir.rglob("*"):
            if file_path.is_file() and not file_path.name.endswith('.db'):
                total_size += file_path.stat().st_size
                file_count += 1
        
        total_size_gb = total_size / (1024 ** 3)
        available_gb = self.max_storage_gb - total_size_gb
        usage_percentage = (total_size_gb / self.max_storage_gb) * 100
        
        return {
            'total_size_gb': round(total_size_gb, 2),
            'available_gb': round(available_gb, 2),
            'max_storage_gb': self.max_storage_gb,
            'usage_percentage': round(usage_percentage, 2),
            'file_count': file_count
        }
    
    def sync_with_server(self, auth_token: str) -> Dict:
        """Sincroniza com o servidor para obter lista de conteúdo"""
        try:
            headers = {'Authorization': f'Bearer {auth_token}'}
            
            # Solicitar lista de conteúdo para este player
            response = requests.get(
                f"{self.api_base_url}/distributions/player/{self.player_id}/content",
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Erro na API: {response.status_code}")
            
            data = response.json()
            content_list = data.get('content_list', [])
            
            # Processar lista de conteúdo
            sync_results = {
                'total_content': len(content_list),
                'downloaded': 0,
                'updated': 0,
                'removed': 0,
                'errors': []
            }
            
            # Baixar conteúdos novos ou atualizados
            for content in content_list:
                try:
                    result = self._process_content_item(content, auth_token)
                    if result == 'downloaded':
                        sync_results['downloaded'] += 1
                    elif result == 'updated':
                        sync_results['updated'] += 1
                except Exception as e:
                    sync_results['errors'].append({
                        'content_id': content.get('id'),
                        'error': str(e)
                    })
            
            # Remover conteúdos obsoletos
            removed_count = self._cleanup_obsolete_content(content_list)
            sync_results['removed'] = removed_count
            
            # Atualizar timestamp da última sincronização
            self._update_sync_timestamp()
            
            return sync_results
            
        except Exception as e:
            logger.error(f"Erro na sincronização: {e}")
            return {
                'error': str(e),
                'total_content': 0,
                'downloaded': 0,
                'updated': 0,
                'removed': 0,
                'errors': []
            }
    
    def _process_content_item(self, content: Dict, auth_token: str) -> str:
        """Processa um item de conteúdo (download ou atualização)"""
        content_id = content['id']
        checksum = content.get('checksum', '')
        
        # Verificar se já existe em cache
        cached_content = self._get_cached_content(content_id)
        
        if cached_content and cached_content['checksum'] == checksum:
            # Conteúdo já está atualizado, apenas marcar como acessado
            self._update_last_accessed(content_id)
            return 'up_to_date'
        
        # Verificar espaço disponível
        storage_info = self.get_storage_info()
        file_size_mb = content.get('file_size_mb', 0)
        
        if storage_info['available_gb'] * 1024 < file_size_mb:
            # Tentar liberar espaço
            self._cleanup_old_content()
            storage_info = self.get_storage_info()
            
            if storage_info['available_gb'] * 1024 < file_size_mb:
                raise Exception(f"Espaço insuficiente para download: {file_size_mb}MB")
        
        # Fazer download do conteúdo
        file_path = self._download_content(content, auth_token)
        
        # Salvar no cache local
        self._save_to_cache(content, file_path, checksum)
        
        return 'downloaded' if not cached_content else 'updated'
    
    def _download_content(self, content: Dict, auth_token: str) -> str:
        """Faz download de um conteúdo específico"""
        content_id = content['id']
        filename = content.get('filename', f"content_{content_id}")
        
        # Criar diretório para o conteúdo
        content_dir = self.cache_dir / "content" / content_id
        content_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = content_dir / filename
        
        # Fazer download
        headers = {'Authorization': f'Bearer {auth_token}'}
        download_url = f"{self.api_base_url}/content/{content_id}/download"
        
        response = requests.get(download_url, headers=headers, stream=True, timeout=300)
        response.raise_for_status()
        
        # Salvar arquivo
        with open(file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Verificar integridade do arquivo
        if content.get('checksum'):
            file_checksum = self._calculate_checksum(file_path)
            if file_checksum != content['checksum']:
                file_path.unlink()  # Remover arquivo corrompido
                raise Exception(f"Checksum inválido para {content_id}")
        
        return str(file_path)
    
    def _calculate_checksum(self, file_path: Path) -> str:
        """Calcula checksum MD5 de um arquivo"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def _save_to_cache(self, content: Dict, file_path: str, checksum: str):
        """Salva informações do conteúdo no cache local"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        now = datetime.utcnow()
        
        cursor.execute('''
            INSERT OR REPLACE INTO cached_content 
            (content_id, title, file_path, file_size_mb, checksum, 
             downloaded_at, last_accessed, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            content['id'],
            content.get('title', ''),
            file_path,
            content.get('file_size_mb', 0),
            checksum,
            now,
            now,
            json.dumps(content)
        ))
        
        conn.commit()
        conn.close()
    
    def _get_cached_content(self, content_id: str) -> Optional[Dict]:
        """Obtém informações de conteúdo do cache local"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT content_id, title, file_path, file_size_mb, checksum, 
                   downloaded_at, last_accessed, metadata
            FROM cached_content 
            WHERE content_id = ? AND is_active = 1
        ''', (content_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'content_id': row[0],
                'title': row[1],
                'file_path': row[2],
                'file_size_mb': row[3],
                'checksum': row[4],
                'downloaded_at': row[5],
                'last_accessed': row[6],
                'metadata': json.loads(row[7]) if row[7] else {}
            }
        
        return None
    
    def _update_last_accessed(self, content_id: str):
        """Atualiza timestamp de último acesso do conteúdo"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE cached_content 
            SET last_accessed = ? 
            WHERE content_id = ?
        ''', (datetime.utcnow(), content_id))
        
        conn.commit()
        conn.close()
    
    def _cleanup_obsolete_content(self, current_content_list: List[Dict]) -> int:
        """Remove conteúdos que não estão mais na lista do servidor"""
        current_ids = {content['id'] for content in current_content_list}
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Obter conteúdos em cache que não estão na lista atual
        cursor.execute('''
            SELECT content_id, file_path 
            FROM cached_content 
            WHERE is_active = 1
        ''')
        
        cached_content = cursor.fetchall()
        removed_count = 0
        
        for content_id, file_path in cached_content:
            if content_id not in current_ids:
                # Remover arquivo físico
                try:
                    Path(file_path).unlink(missing_ok=True)
                    # Remover diretório se vazio
                    parent_dir = Path(file_path).parent
                    if parent_dir.exists() and not any(parent_dir.iterdir()):
                        parent_dir.rmdir()
                except Exception as e:
                    logger.warning(f"Erro ao remover arquivo {file_path}: {e}")
                
                # Marcar como inativo no banco
                cursor.execute('''
                    UPDATE cached_content 
                    SET is_active = 0 
                    WHERE content_id = ?
                ''', (content_id,))
                
                removed_count += 1
        
        conn.commit()
        conn.close()
        
        return removed_count
    
    def _cleanup_old_content(self):
        """Remove conteúdos antigos para liberar espaço"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Obter conteúdos ordenados por último acesso (mais antigos primeiro)
        cutoff_date = datetime.utcnow() - timedelta(days=self.cleanup_threshold_days)
        
        cursor.execute('''
            SELECT content_id, file_path, file_size_mb
            FROM cached_content 
            WHERE is_active = 1 AND last_accessed < ?
            ORDER BY last_accessed ASC
        ''', (cutoff_date,))
        
        old_content = cursor.fetchall()
        
        for content_id, file_path, file_size_mb in old_content:
            try:
                # Remover arquivo físico
                Path(file_path).unlink(missing_ok=True)
                
                # Marcar como inativo
                cursor.execute('''
                    UPDATE cached_content 
                    SET is_active = 0 
                    WHERE content_id = ?
                ''', (content_id,))
                
                logger.info(f"Removido conteúdo antigo: {content_id} ({file_size_mb}MB)")
                
            except Exception as e:
                logger.warning(f"Erro ao remover conteúdo antigo {content_id}: {e}")
        
        conn.commit()
        conn.close()
    
    def _update_sync_timestamp(self):
        """Atualiza timestamp da última sincronização"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO sync_config (key, value, updated_at)
            VALUES (?, ?, ?)
        ''', ('last_sync', datetime.utcnow().isoformat(), datetime.utcnow()))
        
        conn.commit()
        conn.close()
    
    def get_playlist(self) -> List[Dict]:
        """Retorna playlist de conteúdos disponíveis localmente"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT content_id, title, file_path, metadata
            FROM cached_content 
            WHERE is_active = 1
            ORDER BY last_accessed DESC
        ''')
        
        rows = cursor.fetchall()
        conn.close()
        
        playlist = []
        for row in rows:
            content_id, title, file_path, metadata_json = row
            
            # Verificar se arquivo ainda existe
            if Path(file_path).exists():
                metadata = json.loads(metadata_json) if metadata_json else {}
                playlist.append({
                    'id': content_id,
                    'title': title,
                    'file_path': file_path,
                    'type': metadata.get('content_type', 'video'),
                    'duration': metadata.get('duration_seconds', 30),
                    'metadata': metadata
                })
        
        return playlist
    
    def report_playback_stats(self, content_id: str, played_duration: int, auth_token: str):
        """Reporta estatísticas de reprodução para o servidor"""
        try:
            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json'
            }
            
            data = {
                'content_id': content_id,
                'played_duration': played_duration,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            response = requests.post(
                f"{self.api_base_url}/players/{self.player_id}/playback-stats",
                headers=headers,
                json=data,
                timeout=10
            )
            
            # Atualizar último acesso local
            self._update_last_accessed(content_id)
            
            return response.status_code == 200
            
        except Exception as e:
            logger.warning(f"Erro ao reportar estatísticas: {e}")
            return False
