import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  LinearProgress,
  Button,
} from '@mui/material';
import { useSocket } from '../../contexts/SocketContext';
import axios from '../../config/axios';

const WebPlayer = ({ playerId, fullscreen = false }) => {
  const { socket, joinPlayerRoom } = useSocket();
  
  // States
  const [currentContent, setCurrentContent] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerInfo, setPlayerInfo] = useState(null);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [segments, setSegments] = useState([]);
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(-1);
  const [showCampaignBanner, setShowCampaignBanner] = useState(false);
  const [playlistEtag, setPlaylistEtag] = useState(null);
  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState(false);
  // Configurações de reprodução recebidas do backend
  const [playbackConfig, setPlaybackConfig] = useState({
    playback_mode: 'sequential',
    loop_behavior: 'until_next',
    loop_duration_minutes: null,
    content_duration: 10,
    transition_duration: 1,
    shuffle_enabled: false,
    auto_skip_errors: true,
    is_persistent: false,
    content_type: 'main',
  });
  const [playerPrefs, setPlayerPrefs] = useState({
    orientation: 'landscape',
    volume: 50,
  });

  // Refs
  const attemptCountRef = useRef(0);
  const connectTimeoutRef = useRef(null);
  const connectingRef = useRef(false);
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const mediaRef = useRef(null);
  const mediaErrorCountRef = useRef(0);
  const playbackStartTimeRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const playbackHeartbeatRef = useRef(null);
  const loadTimeoutRef = useRef(null);
  const preloadCacheRef = useRef({});

  // Constantes
  const RECONNECT_DELAY = 15000;
  const MAX_ATTEMPTS = 5;
  const CIRCUIT_BREAKER_TIMEOUT = 30000;

  // Main initialization effect
  useEffect(() => {
    if (!playerId) return;

    console.log('[WebPlayer] Inicializando player:', playerId);
    console.log('[WebPlayer] Socket disponível na inicialização:', !!socket);
    
    // Clear previous timeouts
    clearAllTimeouts();
    
    // Reset states
    setLoading(true);
    setError('');
    attemptCountRef.current = 0;
    
    // Load initial data
    loadPlayerData();
    
    // Connect to player
    connectToPlayer();
    
    // Join player room if socket available
    if (socket && joinPlayerRoom) {
      console.log('[WebPlayer] Entrando na sala do player:', playerId);
      joinPlayerRoom(playerId);
      
      // TESTE: Enviar evento de teste para verificar se Socket.IO está funcionando
      setTimeout(() => {
        console.log('[WebPlayer] TESTE: Enviando evento de teste...');
        sendPlaybackEvent('test_event', {
          message: 'Teste de conectividade Socket.IO',
          player_test: true
        });
      }, 2000);
    } else {
      console.log('[WebPlayer] Socket ou joinPlayerRoom não disponível');
    }
    
    // Cleanup on unmount
    return () => {
      console.log('[WebPlayer] Limpando recursos...');
      clearAllTimeouts();
      // Enviar evento de fim de reprodução
      if (socket && currentContent) {
        sendPlaybackEvent('playback_end', {
          content_id: currentContent.id,
          content_title: currentContent.title,
          content_type: currentContent.type,
          duration_actual: Date.now() - (playbackStartTimeRef.current || Date.now())
        });
      }
    };
  }, [playerId, socket]);

  const clearAllTimeouts = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    if (playbackHeartbeatRef.current) {
      clearInterval(playbackHeartbeatRef.current);
      playbackHeartbeatRef.current = null;
    }
    
    // Reset flags
    connectingRef.current = false;
    mediaErrorCountRef.current = 0;
  };

  const loadPlayerData = async () => {
    try {
      const now = Date.now();
      setLastLoadTime(now);
      
      console.log('[WebPlayer] Carregando dados do player, tentativa:', loadAttempts + 1);
      setLoading(true);
      setLoadAttempts(prev => prev + 1);
      
      // Circuit Breaker
      if (loadAttempts >= MAX_ATTEMPTS) {
        console.error('[WebPlayer] Circuit breaker ativado');
        setCircuitBreakerOpen(true);
        setError('Sistema temporariamente indisponível. Tentando reconectar...');
        setLoading(false);
        return;
      }
      
      // Load playlist
      const playlistRes = await axios.get(`/players/${playerId}/playlist`);
      console.log('[WebPlayer] Playlist carregada:', playlistRes.data);
      
      const rawItems = playlistRes.data.contents || [];
      setPlaylist(rawItems);
      
      // Carregar configurações de reprodução
      if (playlistRes.data.playback_config) {
        console.log('[WebPlayer] Configurações de reprodução recebidas:', playlistRes.data.playback_config);
        setPlaybackConfig(playlistRes.data.playback_config);
      }

      if (rawItems && rawItems.length > 0) {
        console.log('[WebPlayer] Conteúdo encontrado:', rawItems[0]);
        setCurrentContent(rawItems[0]);
        setCurrentIndex(0);
        setLoadAttempts(0);
        setError('');
      } else {
        console.log('[WebPlayer] Nenhum conteúdo encontrado, aguardando...');
        setCurrentContent(null);
        setCurrentIndex(0);
        
        // Reagendar carregamento
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = setTimeout(() => {
          console.log('[WebPlayer] Recarregando após timeout...');
          if (!circuitBreakerOpen) {
            loadPlayerData();
          }
        }, RECONNECT_DELAY);
      }

      // Load player info
      try {
        const playerRes = await axios.get(`/players/${playerId}/info`);
        setPlayerInfo(playerRes.data);
        console.log('[WebPlayer] Info do player carregada:', playerRes.data);
      } catch (e) {
        console.log('[WebPlayer] Info do player não disponível (modo kiosk)');
      }
    } catch (err) {
      console.error('[WebPlayer] Erro ao carregar dados:', err);
      
      if (err.code === 'NETWORK_ERROR' || err.response?.status >= 500) {
        console.log('[WebPlayer] Erro temporário de rede, tentando novamente...');
      } else {
        setError('Erro ao carregar dados do player');
      }
    } finally {
      setLoading(false);
    }
  };

  const connectToPlayer = async () => {
    if (connectingRef.current) {
      console.log('[WebPlayer] Conexão já em andamento, ignorando...');
      return;
    }
    
    connectingRef.current = true;
    
    try {
      console.log('[WebPlayer] Conectando ao player...');
      await axios.post(`/players/${playerId}/connect`);
      console.log('[WebPlayer] Conectado com sucesso');
      setIsConnected(true);
      
      // Reagendar reconexão
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        setIsConnected(false);
        connectingRef.current = false;
        if (!circuitBreakerOpen) {
          connectToPlayer();
        }
      }, RECONNECT_DELAY * 2);
      
    } catch (err) {
      console.error('[WebPlayer] Erro ao conectar:', err);
      setIsConnected(false);
      
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        connectingRef.current = false;
        if (!circuitBreakerOpen) {
          connectToPlayer();
        }
      }, RECONNECT_DELAY * 3);
    } finally {
      connectingRef.current = false;
    }
  };

  // Função para enviar eventos de telemetria de reprodução
  const sendPlaybackEvent = useCallback((eventType, eventData) => {
    console.log('[WebPlayer] sendPlaybackEvent chamado:', eventType);
    console.log('[WebPlayer] Socket:', !!socket, 'Player ID:', playerId);
    
    if (!socket || !playerId) {
      console.log('[WebPlayer] ERRO: Socket ou playerId não disponível para telemetria');
      console.log('[WebPlayer] Socket disponível:', !!socket);
      console.log('[WebPlayer] Player ID disponível:', !!playerId);
      return;
    }

    const telemetryData = {
      type: eventType,
      data: {
        player_id: playerId,
        timestamp: new Date().toISOString(),
        ...eventData
      }
    };

    console.log('[WebPlayer] Enviando evento de telemetria:', telemetryData);
    console.log('[WebPlayer] Socket.emit chamado com evento: playback_event');
    socket.emit('playback_event', telemetryData);
    console.log('[WebPlayer] Socket.emit executado');
  }, [socket, playerId]);

  // Função para iniciar heartbeat de reprodução
  const startPlaybackHeartbeat = useCallback(() => {
    if (playbackHeartbeatRef.current) {
      clearInterval(playbackHeartbeatRef.current);
    }

    playbackHeartbeatRef.current = setInterval(() => {
      if (currentContent && isPlaying) {
        sendPlaybackEvent('playback_heartbeat', {
          content_id: currentContent.id,
          content_title: currentContent.title,
          content_type: currentContent.type,
          is_playing: true,
          playlist_index: currentIndex,
          playlist_total: playlist.length
        });
      }
    }, 30000); // Heartbeat a cada 30 segundos
  }, [sendPlaybackEvent, currentContent, isPlaying, currentIndex, playlist.length]);

  // Função para parar heartbeat de reprodução
  const stopPlaybackHeartbeat = useCallback(() => {
    if (playbackHeartbeatRef.current) {
      clearInterval(playbackHeartbeatRef.current);
      playbackHeartbeatRef.current = null;
    }
  }, []);

  // Effect para configurar event listeners de mídia
  useEffect(() => {
    if (!currentContent) {
      console.log('[WebPlayer] useEffect: Sem currentContent');
      return;
    }

    console.log('[WebPlayer] useEffect: Configurando listeners para:', currentContent.title, 'tipo:', currentContent.type);

    // Para vídeos, usar mediaRef
    const mediaElement = currentContent.type === 'video' ? mediaRef.current : null;
    
    if (currentContent.type === 'video' && !mediaElement) {
      console.log('[WebPlayer] useEffect: mediaRef.current não disponível ainda, reagendando...');
      // Se o elemento de mídia não estiver pronto, reagendar
      const timer = setTimeout(() => {
        console.log('[WebPlayer] useEffect: Tentando novamente após timeout');
        // Forçar re-render do useEffect
        setCurrentContent(prev => ({ ...prev }));
      }, 100);
      return () => clearTimeout(timer);
    }
    
    const handleLoadStart = () => {
      console.log('[WebPlayer] Mídia começou a carregar');
    };

    const handleCanPlay = () => {
      console.log('[WebPlayer] Mídia pronta para reproduzir');
      console.log('[WebPlayer] Socket disponível:', !!socket);
      console.log('[WebPlayer] Player ID:', playerId);
      setIsPlaying(true);
      playbackStartTimeRef.current = Date.now();
      
      // Enviar evento de início de reprodução
      console.log('[WebPlayer] Enviando playback_start...');
      sendPlaybackEvent('playback_start', {
        content_id: currentContent.id,
        content_title: currentContent.title,
        content_type: currentContent.type,
        campaign_id: currentContent.campaign_id,
        campaign_name: currentContent.campaign_name,
        playlist_index: currentIndex,
        playlist_total: playlist.length,
        duration_expected: currentContent.duration || 0
      });

      // Iniciar heartbeat
      console.log('[WebPlayer] Iniciando heartbeat...');
      startPlaybackHeartbeat();
    };

    const handlePlay = () => {
      console.log('[WebPlayer] Reprodução iniciada');
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log('[WebPlayer] Reprodução pausada');
      setIsPlaying(false);
    };

    const handleEnded = () => {
      console.log('[WebPlayer] Reprodução finalizada');
      setIsPlaying(false);
      
      // Enviar evento de fim de reprodução
      sendPlaybackEvent('playback_end', {
        content_id: currentContent.id,
        content_title: currentContent.title,
        content_type: currentContent.type,
        duration_actual: Date.now() - (playbackStartTimeRef.current || Date.now())
      });

      // Parar heartbeat
      stopPlaybackHeartbeat();

      // Determinar o próximo conteúdo com base nas configurações de reprodução
      const { playback_mode, loop_behavior, shuffle_enabled } = playbackConfig;
      console.log(`[WebPlayer] Determinando próximo conteúdo: modo=${playback_mode}, loop=${loop_behavior}, shuffle=${shuffle_enabled}`);
      
      // Não avançar se for modo single e não for loop infinito
      if (playback_mode === 'single' && loop_behavior !== 'infinite') {
        console.log('[WebPlayer] Modo single sem loop, parando após reprodução');
        return;
      }
      
      let nextIndex = 0;
      let nextContent = null;
      
      // Determinar o próximo índice com base no modo de reprodução
      if (playback_mode === 'random' || shuffle_enabled) {
        // Modo aleatório
        nextIndex = Math.floor(Math.random() * playlist.length);
        console.log(`[WebPlayer] Modo aleatório: próximo índice = ${nextIndex}`);
      } else if (playback_mode === 'sequential' || playback_mode === 'loop_infinite') {
        // Modo sequencial
        if (currentIndex < playlist.length - 1) {
          // Ainda há próximos itens
          nextIndex = currentIndex + 1;
          console.log(`[WebPlayer] Modo sequencial: próximo índice = ${nextIndex}`);
        } else {
          // Chegou ao fim da playlist
          if (playback_mode === 'loop_infinite' || loop_behavior === 'infinite' || loop_behavior === 'until_next') {
            // Voltar ao início
            nextIndex = 0;
            console.log('[WebPlayer] Fim da playlist: voltando ao início (loop)');
          } else {
            // Parar reprodução
            console.log('[WebPlayer] Fim da playlist: parando reprodução');
            return;
          }
        }
      }
      
      // Obter o próximo conteúdo
      nextContent = playlist[nextIndex];
      
      // Aplicar transição
      const transitionTime = playbackConfig.transition_duration * 1000 || 1000;
      console.log(`[WebPlayer] Aplicando transição de ${transitionTime}ms`);
      
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setCurrentContent(nextContent);
        
        // Enviar evento de mudança de conteúdo
        sendPlaybackEvent('content_change', {
          previous_content_id: currentContent.id,
          next_content_id: nextContent.id,
          next_content_title: nextContent.title,
          next_content_type: nextContent.type,
          playlist_index: nextIndex
        });
      }, transitionTime);
    };

    const handleError = (e) => {
      console.error('[WebPlayer] Erro na mídia:', e);
      setIsPlaying(false);
      stopPlaybackHeartbeat();
    };

    // Adicionar event listeners apenas para vídeos
    if (currentContent.type === 'video' && mediaElement) {
      console.log('[WebPlayer] Adicionando event listeners ao elemento de vídeo');
      mediaElement.addEventListener('loadstart', handleLoadStart);
      mediaElement.addEventListener('canplay', handleCanPlay);
      mediaElement.addEventListener('play', handlePlay);
      mediaElement.addEventListener('pause', handlePause);
      mediaElement.addEventListener('ended', handleEnded);
      mediaElement.addEventListener('error', handleError);
      console.log('[WebPlayer] Event listeners adicionados com sucesso');
    } else if (currentContent.type === 'image') {
      console.log('[WebPlayer] Simulando eventos para imagem');
      // Para imagens, simular eventos de reprodução
      setTimeout(() => {
        handleCanPlay();
        handlePlay();
      }, 100);

      // Simular duração da imagem (padrão 10 segundos)
      const imageDuration = currentContent.duration || 10000;
      setTimeout(() => {
        handleEnded();
      }, imageDuration);
    }

    // Cleanup
    return () => {
      if (currentContent.type === 'video' && mediaElement) {
        mediaElement.removeEventListener('loadstart', handleLoadStart);
        mediaElement.removeEventListener('canplay', handleCanPlay);
        mediaElement.removeEventListener('play', handlePlay);
        mediaElement.removeEventListener('pause', handlePause);
        mediaElement.removeEventListener('ended', handleEnded);
        mediaElement.removeEventListener('error', handleError);
      }
      stopPlaybackHeartbeat();
    };
  }, [currentContent, currentIndex, playlist, sendPlaybackEvent, startPlaybackHeartbeat, stopPlaybackHeartbeat]);

  const renderContent = () => {
    if (!currentContent) return null;

    const commonStyle = {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      backgroundColor: '#000',
    };

    switch (currentContent.type) {
      case 'video':
        return (
          <video
            ref={mediaRef}
            key="video-player"
            src={currentContent.file_url || currentContent.url}
            style={commonStyle}
            muted={muted}
            playsInline
            autoPlay
            preload="auto"
            loop={playbackConfig.playback_mode === 'loop_infinite' || (playlist.length === 1 && playbackConfig.loop_behavior === 'infinite')}
          />
        );
      
      case 'image':
        return (
          <img
            key="image-player"
            src={currentContent.file_url || currentContent.url}
            alt={currentContent.title}
            style={commonStyle}
          />
        );
      
      default:
        return (
          <Box
            sx={{
              ...commonStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f5f5f5',
            }}
          >
            <Typography variant="h4" color="text.secondary">
              Tipo de conteúdo não suportado
            </Typography>
          </Box>
        );
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: fullscreen ? '100vh' : '400px',
          backgroundColor: '#000',
        }}
      >
        <CircularProgress color="primary" size={60} />
        <Typography variant="h6" color="white" mt={2}>
          Carregando player...
        </Typography>
        {loadAttempts > 0 && (
          <Typography variant="body2" color="white" mt={1}>
            Tentativa {loadAttempts} de {MAX_ATTEMPTS}
          </Typography>
        )}
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: fullscreen ? '100vh' : '400px',
          backgroundColor: '#000',
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 400, mb: 2 }}>
          {error}
        </Alert>
        {circuitBreakerOpen && (
          <Typography variant="body2" color="white" textAlign="center">
            Reconectando automaticamente em {Math.ceil(CIRCUIT_BREAKER_TIMEOUT / 1000)} segundos...
          </Typography>
        )}
      </Box>
    );
  }

  if (!currentContent) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: fullscreen ? '100vh' : '400px',
          backgroundColor: '#000',
        }}
      >
        <Typography variant="h5" color="white" textAlign="center">
          Nenhum conteúdo disponível
        </Typography>
        <Typography variant="body1" color="white" textAlign="center" mt={1}>
          Aguardando programação...
        </Typography>
        <Typography variant="body2" color="white" textAlign="center" mt={1}>
          Tentativas: {loadAttempts}/{MAX_ATTEMPTS}
        </Typography>
        <Typography variant="body2" color="white" textAlign="center" mt={1}>
          Status: {isConnected ? 'Conectado' : 'Desconectado'}
        </Typography>
      </Box>
    );
  }

  const playerContent = (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: fullscreen ? '100vh' : '400px',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      {renderContent()}
      
      {/* Progress Bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.3)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: '#1976d2',
          },
        }}
      />
      
      {/* Content Info Overlay */}
      {!fullscreen && currentContent && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          }}
        >
          <Typography variant="h6" noWrap>
            {currentContent.title}
          </Typography>
          <Typography variant="body2" noWrap>
            {currentIndex + 1} de {playlist.length}
          </Typography>
        </Box>
      )}
    </Box>
  );

  if (fullscreen) {
    return playerContent;
  }

  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        {playerContent}
      </CardContent>
    </Card>
  );
};

export default WebPlayer;
