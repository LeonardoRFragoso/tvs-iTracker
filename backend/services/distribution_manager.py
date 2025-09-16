import hashlib
import os
from datetime import datetime, timedelta, time
from typing import List, Optional
from database import db
from models.content import Content
from models.player import Player
from models.location import Location
from models.content_distribution import ContentDistribution
from flask_socketio import emit
import pytz

class ContentDistributionManager:
    """Gerenciador inteligente de distribuição de conteúdo para múltiplas sedes"""
    
    def __init__(self, socketio=None):
        self.socketio = socketio
        self.max_concurrent_downloads_per_location = 3
        self.retry_attempts = 3
        self.priority_weights = {
            'urgent': 5,
            'high': 4,
            'normal': 3,
            'low': 2,
            'background': 1
        }
    
    def distribute_content(self, content_id: str, target_locations: List[str] = None, 
                          target_players: List[str] = None, priority: str = 'normal',
                          schedule_for: datetime = None) -> dict:
        """
        Distribui conteúdo para players específicos com distribuição inteligente
        """
        try:
            content = Content.query.get(content_id)
            if not content:
                return {'success': False, 'error': 'Conteúdo não encontrado'}
            
            # Determina players alvo
            target_players_list = self._get_target_players(
                content, target_locations, target_players
            )
            
            if not target_players_list:
                return {'success': False, 'error': 'Nenhum player válido encontrado'}
            
            # Calcula checksum do arquivo
            checksum = self._calculate_file_checksum(content.file_path)
            
            # Cria distribuições
            distributions_created = []
            for player in target_players_list:
                distribution = self._create_distribution(
                    content, player, checksum, priority, schedule_for
                )
                if distribution:
                    distributions_created.append(distribution)
            
            # Agenda distribuições baseado na carga de rede
            scheduled_count = 0
            for distribution in distributions_created:
                if self._schedule_distribution(distribution):
                    scheduled_count += 1
            
            return {
                'success': True,
                'distributions_created': len(distributions_created),
                'distributions_scheduled': scheduled_count,
                'target_players': len(target_players_list)
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _get_target_players(self, content: Content, target_locations: List[str] = None,
                           target_players: List[str] = None) -> List[Player]:
        """Determina quais players devem receber o conteúdo"""
        
        # Inicia com players online e ativos
        query = Player.query.filter(
            Player.is_active == True,
            Player.status == 'online'
        )
        
        # Filtro por localização
        if target_locations:
            query = query.filter(Player.location_id.in_(target_locations))
        
        # Filtro por players específicos
        if target_players:
            query = query.filter(Player.id.in_(target_players))
        
        players = query.all()
        
        # Verifica capacidade de armazenamento
        valid_players = []
        content_size_gb = content.file_size / (1024**3) if content.file_size else 0
        
        for player in players:
            # Verifica se tem espaço suficiente
            if player.storage_available_gb >= content_size_gb:
                # Verifica se já não tem o conteúdo
                existing_dist = ContentDistribution.query.filter_by(
                    content_id=content.id,
                    player_id=player.id,
                    status='completed'
                ).first()
                
                if not existing_dist:
                    valid_players.append(player)
        
        return valid_players
    
    def _create_distribution(self, content: Content, player: Player, 
                           checksum: str, priority: str, schedule_for: datetime = None) -> ContentDistribution:
        """Cria registro de distribuição"""
        
        # Verifica se já existe distribuição pendente
        existing = ContentDistribution.query.filter_by(
            content_id=content.id,
            player_id=player.id
        ).filter(ContentDistribution.status.in_(['pending', 'downloading'])).first()
        
        if existing:
            return existing
        
        distribution = ContentDistribution(
            content_id=content.id,
            player_id=player.id,
            file_size_bytes=content.file_size or 0,
            checksum=checksum,
            priority=self.priority_weights.get(priority, 3),
            scheduled_for=schedule_for
        )
        
        db.session.add(distribution)
        db.session.commit()
        
        return distribution
    
    def _schedule_distribution(self, distribution: ContentDistribution) -> bool:
        """Agenda distribuição baseada na carga da rede e horário"""
        
        player = Player.query.get(distribution.player_id)
        location = Location.query.get(player.location_id)
        
        # Se tem horário agendado específico, usa ele
        if distribution.scheduled_for:
            self._send_distribution_notification(distribution, distribution.scheduled_for)
            return True
        
        # Verifica horário de pico na sede
        now = datetime.now()
        current_time = now.time()
        
        # Converte para timezone da sede
        if location.timezone:
            tz = pytz.timezone(location.timezone)
            local_now = datetime.now(tz)
            current_time = local_now.time()
        
        # Verifica se está no horário de pico
        is_peak_hours = (location.peak_hours_start <= current_time <= location.peak_hours_end)
        
        # Conta downloads ativos na localização
        active_downloads = ContentDistribution.query.join(Player).filter(
            Player.location_id == location.id,
            ContentDistribution.status == 'downloading'
        ).count()
        
        # Decide quando distribuir
        if is_peak_hours and active_downloads >= self.max_concurrent_downloads_per_location:
            # Agenda para após horário de pico
            next_day = now.date() + timedelta(days=1)
            schedule_time = datetime.combine(next_day, location.peak_hours_end)
            self._send_distribution_notification(distribution, schedule_time)
        else:
            # Distribui imediatamente
            self._send_distribution_notification(distribution)
        
        return True
    
    def _send_distribution_notification(self, distribution: ContentDistribution, 
                                      schedule_for: datetime = None):
        """Envia notificação de distribuição via WebSocket"""
        
        if not self.socketio:
            return
        
        player = Player.query.get(distribution.player_id)
        content = Content.query.get(distribution.content_id)
        
        message = {
            'type': 'download_content',
            'distribution_id': distribution.id,
            'content_id': content.id,
            'content_title': content.title,
            'download_url': f'/uploads/{content.file_path}',
            'file_size_bytes': distribution.file_size_bytes,
            'checksum': distribution.checksum,
            'priority': distribution.priority
        }
        
        if schedule_for:
            message['scheduled_for'] = schedule_for.isoformat()
        
        # Envia para o player específico
        player_room = f'player_{player.id}'
        self.socketio.emit('sync_notification', message, room=player_room)
        
        # Atualiza status da distribuição
        if not schedule_for:
            distribution.mark_started()
    
    def _calculate_file_checksum(self, file_path: str) -> str:
        """Calcula SHA256 do arquivo"""
        if not file_path or not os.path.exists(file_path):
            return ''
        
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(chunk)
            return sha256_hash.hexdigest()
        except Exception:
            return ''
    
    def get_distribution_stats(self, location_id: str = None) -> dict:
        """Retorna estatísticas de distribuição"""
        
        query = ContentDistribution.query
        if location_id:
            query = query.join(Player).filter(Player.location_id == location_id)
        
        total = query.count()
        pending = query.filter(ContentDistribution.status == 'pending').count()
        downloading = query.filter(ContentDistribution.status == 'downloading').count()
        completed = query.filter(ContentDistribution.status == 'completed').count()
        failed = query.filter(ContentDistribution.status == 'failed').count()
        
        return {
            'total_distributions': total,
            'pending': pending,
            'downloading': downloading,
            'completed': completed,
            'failed': failed,
            'success_rate': round((completed / total * 100), 2) if total > 0 else 0
        }
    
    def retry_failed_distributions(self, location_id: str = None) -> int:
        """Reprocessa distribuições falhadas"""
        
        query = ContentDistribution.query.filter(
            ContentDistribution.status == 'failed'
        )
        
        if location_id:
            query = query.join(Player).filter(Player.location_id == location_id)
        
        failed_distributions = query.filter(
            ContentDistribution.retry_count < ContentDistribution.max_retries
        ).all()
        
        retry_count = 0
        for distribution in failed_distributions:
            if self._schedule_distribution(distribution):
                distribution.status = 'pending'
                db.session.commit()
                retry_count += 1
        
        return retry_count
    
    def cleanup_expired_distributions(self) -> int:
        """Remove distribuições expiradas"""
        
        now = datetime.utcnow()
        expired = ContentDistribution.query.filter(
            ContentDistribution.expires_at < now,
            ContentDistribution.status.in_(['completed', 'failed'])
        ).all()
        
        cleanup_count = 0
        for distribution in expired:
            # Notifica player para remover conteúdo
            if self.socketio:
                player = Player.query.get(distribution.player_id)
                self.socketio.emit('remove_content', {
                    'content_id': distribution.content_id
                }, room=f'player_{player.id}')
            
            db.session.delete(distribution)
            cleanup_count += 1
        
        db.session.commit()
        return cleanup_count
    
    def get_player_content_list(self, player_id: str) -> List[dict]:
        """Retorna lista de conteúdo no player"""
        
        distributions = ContentDistribution.query.filter_by(
            player_id=player_id,
            status='completed'
        ).join(Content).all()
        
        content_list = []
        for dist in distributions:
            content = Content.query.get(dist.content_id)
            content_list.append({
                'content_id': content.id,
                'title': content.title,
                'file_path': content.file_path,
                'content_type': content.content_type,
                'duration': content.duration,
                'downloaded_at': dist.completed_at.isoformat() if dist.completed_at else None
            })
        
        return content_list
