// Utilitário para telemetria de reprodução em tempo real
import { formatBRDateTime } from './dateFormatter';

class PlaybackTelemetry {
  constructor(playerId) {
    this.playerId = playerId;
    this.currentSession = null;
    this.heartbeatInterval = null;
  }

  // Enviar evento de telemetria
  sendEvent(eventType, data = {}) {
    const telemetryData = {
      player_id: this.playerId,
      event_type: eventType,
      timestamp: formatBRDateTime(),
      session_id: this.currentSession,
      ...data
    };
    
    try {
      this.lastTelemetry = Date.now();
      console.log('[PlaybackTelemetry]', eventType, telemetryData);
    } catch (error) {
      console.warn('[PlaybackTelemetry] Erro:', error);
    }
  }

  // Iniciar sessão de reprodução
  startSession(content) {
    this.currentSession = formatBRDateTime();
    
    this.sendEvent('playback_start', {
      content_id: content?.id,
      content_title: content?.title,
      content_type: content?.type,
      campaign_id: content?.campaign_id,
      campaign_name: content?.campaign_name,
      content_duration: content?.duration || 0
    });
    
    this.startHeartbeat();
    return this.currentSession;
  }

  // Finalizar sessão
  endSession(reason = 'completed', content = null) {
    if (!this.currentSession) return;
    
    const sessionDuration = Math.floor((Date.now() - new Date(this.currentSession).getTime()) / 1000);
    
    this.sendEvent('playback_end', {
      content_id: content?.id,
      session_duration_seconds: sessionDuration,
      end_reason: reason
    });
    
    this.currentSession = null;
    this.stopHeartbeat();
  }

  // Enviar mudança de conteúdo
  contentChange(previousContent, nextContent, nextIndex) {
    this.sendEvent('content_change', {
      previous_content_id: previousContent?.id,
      next_content_id: nextContent?.id,
      next_index: nextIndex,
      campaign_id: nextContent?.campaign_id,
      campaign_name: nextContent?.campaign_name
    });
  }

  // Enviar erro
  sendError(error, content = null) {
    this.sendEvent('error', {
      content_id: content?.id,
      error_message: error?.message || 'Erro desconhecido',
      error_code: error?.code || null
    });
  }

  // Iniciar heartbeat
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.currentSession) {
        const uptime = Math.floor((Date.now() - new Date(this.currentSession).getTime()) / 1000);
        this.sendEvent('heartbeat', { uptime_seconds: uptime });
      }
    }, 30000); // 30 segundos
  }

  // Parar heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Limpar recursos
  cleanup() {
    this.stopHeartbeat();
    if (this.currentSession) {
      this.endSession('cleanup');
    }
  }
}
