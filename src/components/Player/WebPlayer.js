import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatBRDateTime } from '../../utils/dateFormatter';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import { useSocket } from '../../contexts/SocketContext';
import axios from '../../config/axios';

// Detecta modo legado automaticamente para rotas de Kiosk/TV
const isBrowser = typeof window !== 'undefined';
const currentPath = isBrowser ? (window.location.pathname || '') : '';
const LEGACY_MODE = isBrowser && (
  currentPath.startsWith('/kiosk') ||
  currentPath.startsWith('/k/') ||
  currentPath.startsWith('/tv')
);

const WebPlayer = ({ playerId, fullscreen = false, onRequestFullscreen }) => {
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
  const [showControls, setShowControls] = useState(false);
  const [segments, setSegments] = useState([]);
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(-1);
  const [showCampaignBanner, setShowCampaignBanner] = useState(false);
  const [playlistEtag, setPlaylistEtag] = useState(null);
  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState(false);
  // Background audio support
  const [backgroundAudioUrl, setBackgroundAudioUrl] = useState(null);
  const [backgroundAudioLoaded, setBackgroundAudioLoaded] = useState(false);
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
  const ignoreNextEndedRef = useRef(false);
  const activationDismissedRef = useRef(false);
  // Marca se já recebemos um gesto do usuário para liberar áudio/fullscreen
  const userGestureHandledRef = useRef(false);
  // Se o gesto ocorrer antes do <video> montar, aplicamos o desmute assim que possível
  const pendingUnmuteRef = useRef(false);
  // Ref para o elemento de áudio de fundo
  const backgroundAudioRef = useRef(null);
  // Timer dedicado para duração de imagens
  const imageTimeoutRef = useRef(null);

  // Constantes (ajustadas para modo legado)
  const MAX_ATTEMPTS = 5;
  const CIRCUIT_BREAKER_TIMEOUT = 30000;
  const RECONNECT_DELAY = LEGACY_MODE ? 30000 : 15000;
  const HEARTBEAT_INTERVAL_MS = LEGACY_MODE ? 60000 : 30000;

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


  // Overlay de ativação: exibir quando em fullscreen/kiosk
  const [showActivation, setShowActivation] = useState(false);
  useEffect(() => {
    const isVideo = currentContent?.type === 'video';
    // Em LEGACY_MODE, exibimos o overlay independentemente do estado de mute,
    // pois o objetivo é obter um gesto do usuário para liberar áudio/fullscreen.
    const shouldShow = fullscreen && isVideo && !activationDismissedRef.current && (
      LEGACY_MODE ? true : (muted === true)
    );
    setShowActivation(shouldShow);
  }, [fullscreen, muted, currentContent]);

  // Desmutar automaticamente no primeiro gesto do usuário (click/tecla/toque)
  // em modo kiosk/fullscreen. Isso cobre cenários em que o overlay não aparece.
  useEffect(() => {
    if (!fullscreen) return; // Só interessa no layout tela cheia
    if (userGestureHandledRef.current) return;

    const onFirstGesture = () => {
      if (userGestureHandledRef.current) return;
      userGestureHandledRef.current = true;
      // Mesmo que o <video> ainda não exista, já marcamos o desmute
      pendingUnmuteRef.current = true;
      try { setMuted(false); } catch (_) {}
      // Ativar áudio de fundo imediatamente após gesto
      if (backgroundAudioRef.current && backgroundAudioRef.current.paused) {
        console.log('[WebPlayer] 👆 Gesto detectado, ativando áudio de fundo');
        try {
          backgroundAudioRef.current.muted = false;
          backgroundAudioRef.current.play().then(() => {
            console.log('[WebPlayer] ✅ Áudio de fundo ativado após gesto!');
          }).catch(e => console.warn('[WebPlayer] Erro ao ativar áudio:', e));
        } catch (_) {}
      }
      // Chama a rotina padrão que desmuta, ajusta volume e tenta dar play
      try { activateAudioAndFullscreen(); } catch (_) {}
      // Remover listeners após o primeiro gesto
      window.removeEventListener('click', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
      window.removeEventListener('touchstart', onFirstGesture);
    };

    // Usar capture para garantir priorização em navegadores de TV
    window.addEventListener('click', onFirstGesture, { once: true, capture: true });
    window.addEventListener('keydown', onFirstGesture, { once: true, capture: true });
    window.addEventListener('touchstart', onFirstGesture, { once: true, capture: true });

    return () => {
      window.removeEventListener('click', onFirstGesture, true);
      window.removeEventListener('keydown', onFirstGesture, true);
      window.removeEventListener('touchstart', onFirstGesture, true);
    };
  }, [fullscreen]);

  // Gerenciar áudio de fundo
  useEffect(() => {
    if (!backgroundAudioUrl) {
      // Limpar áudio de fundo se não houver URL
      if (backgroundAudioRef.current) {
        console.log('[WebPlayer] Parando e removendo áudio de fundo');
        try {
          backgroundAudioRef.current.pause();
          backgroundAudioRef.current.src = '';
        } catch (e) {
          console.warn('[WebPlayer] Erro ao parar áudio de fundo:', e);
        }
        backgroundAudioRef.current = null;
        setBackgroundAudioLoaded(false);
      }
      return;
    }

    // Criar elemento de áudio de fundo se não existir
    if (!backgroundAudioRef.current) {
      console.log('[WebPlayer] Criando elemento de áudio de fundo');
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0.5; // Volume padrão 50%
      
      // Event listeners
      audio.addEventListener('canplaythrough', () => {
        console.log('[WebPlayer] Áudio de fundo carregado e pronto');
        setBackgroundAudioLoaded(true);
      });
      
      audio.addEventListener('error', (e) => {
        console.error('[WebPlayer] Erro ao carregar áudio de fundo:', e);
        setBackgroundAudioLoaded(false);
      });
      
      audio.addEventListener('play', () => {
        console.log('[WebPlayer] Áudio de fundo iniciado');
      });
      
      audio.addEventListener('pause', () => {
        console.log('[WebPlayer] Áudio de fundo pausado');
      });
      
      backgroundAudioRef.current = audio;
    }

    // Configurar URL do áudio
    if (backgroundAudioRef.current.src !== backgroundAudioUrl) {
      console.log('[WebPlayer] Configurando URL do áudio de fundo:', backgroundAudioUrl);
      backgroundAudioRef.current.src = backgroundAudioUrl;
      backgroundAudioRef.current.load();
    }

    // Cleanup
    return () => {
      if (backgroundAudioRef.current) {
        console.log('[WebPlayer] Limpando áudio de fundo no unmount');
        try {
          backgroundAudioRef.current.pause();
        } catch (e) {}
      }
    };
  }, [backgroundAudioUrl]);

  // Controlar reprodução do áudio de fundo: tocar apenas para imagens
  useEffect(() => {
    if (!backgroundAudioRef.current || !backgroundAudioLoaded) return;

    const shouldPlay = (playlist && playlist.length > 0) && (currentContent?.type === 'image');

    if (shouldPlay) {
      if (backgroundAudioRef.current.paused) {
        console.log('[WebPlayer] Iniciando áudio de fundo (imagem ativa)');
        backgroundAudioRef.current.play().catch(err => {
          console.warn('[WebPlayer] Falha ao iniciar áudio de fundo (pode precisar de gesto do usuário):', err);
          const tryOnGesture = () => {
            if (backgroundAudioRef.current && backgroundAudioRef.current.paused) {
              console.log('[WebPlayer] Tentando iniciar áudio após gesto do usuário (imagem)');
              backgroundAudioRef.current.play().catch(e => console.warn('[WebPlayer] Ainda bloqueado:', e));
            }
          };
          document.addEventListener('click', tryOnGesture, { once: true });
          document.addEventListener('keydown', tryOnGesture, { once: true });
        });
      }
    } else {
      // Pausar durante vídeos ou sem playlist
      if (!backgroundAudioRef.current.paused) {
        console.log('[WebPlayer] Pausando áudio de fundo (vídeo ativo ou sem playlist)');
        try { backgroundAudioRef.current.pause(); } catch (e) { console.warn('[WebPlayer] Erro ao pausar áudio de fundo:', e); }
      }
    }
  }, [backgroundAudioLoaded, playlist, currentContent]);

  // Sincronizar mute do áudio de fundo com o estado muted
  useEffect(() => {
    if (!backgroundAudioRef.current) return;
    
    backgroundAudioRef.current.muted = muted;
    console.log('[WebPlayer] Áudio de fundo muted:', muted);
  }, [muted]);

  // Tentar iniciar áudio quando primeiro conteúdo for uma imagem
  useEffect(() => {
    if (!currentContent || currentContent.type !== 'image') return;
    if (!backgroundAudioRef.current || !backgroundAudioLoaded) return;
    if (backgroundAudioRef.current.paused) {
      console.log('[WebPlayer] Primeiro conteúdo é imagem, tentando iniciar áudio de fundo');
      backgroundAudioRef.current.play().catch(err => {
        console.warn('[WebPlayer] Autoplay bloqueado (imagem), aguardando gesto do usuário:', err);
      });
    }
  }, [currentContent, backgroundAudioLoaded]);

  const activateAudioAndFullscreen = async () => {
    try {
      // 1) Entrar em fullscreen nativo se callback fornecido
      if (typeof onRequestFullscreen === 'function') {
        try { onRequestFullscreen(); } catch (_) {}
      }
      // 2) Desmutar e ajustar volume
      if (mediaRef.current) {
        // Em TVs legadas, garantimos que o vídeo esteja visível antes de tentar dar play
        try { if (LEGACY_MODE) mediaRef.current.style.display = 'block'; } catch (_) {}
        try { mediaRef.current.muted = false; } catch (_) {}
        setMuted(false);
        try {
          // Ajustar volume baseado nas preferências do player, se existir
          const vol = Number.isFinite(playerPrefs?.volume) ? Math.min(Math.max(playerPrefs.volume, 0), 100) : 50;
          mediaRef.current.volume = vol / 100;
        } catch (_) {}
        const p = mediaRef.current.play?.();
        if (p && typeof p.catch === 'function') {
          await p.catch(() => {
            try { mediaRef.current.controls = true; } catch (_) {}
            setShowControls(true);
          });
        }
      }
      // 3) Ativar áudio de fundo após gesto do usuário
      // Só iniciar o áudio de fundo se o conteúdo atual for imagem
      if (currentContent?.type === 'image') {
        if (backgroundAudioRef.current && backgroundAudioRef.current.paused) {
          console.log('[WebPlayer] Ativando áudio de fundo após gesto do usuário (imagem)');
          try {
            backgroundAudioRef.current.muted = false;
            await backgroundAudioRef.current.play();
            console.log('[WebPlayer] ✅ Áudio de fundo ativado com sucesso!');
          } catch (e) {
            console.warn('[WebPlayer] Erro ao ativar áudio de fundo:', e);
          }
        }
      } else if (backgroundAudioRef.current && !backgroundAudioRef.current.paused) {
        // Garantir pausa durante vídeo
        try { backgroundAudioRef.current.pause(); } catch (_) {}
      }
    } finally {
      activationDismissedRef.current = true;
      setShowActivation(false);
    }
  };

  // Preload do próximo item para reduzir gap entre trocas
  useEffect(() => {
    if (!playlist || playlist.length === 0) return;
    const nextIdx = (currentIndex + 1) % playlist.length;
    const next = playlist[nextIdx];
    if (!next) return;
    const key = next.file_url || next.url;
    if (!key) return;
    // Evitar recriar se já está no cache
    if (preloadCacheRef.current[key]) return;

    try {
      if (next.type === 'video') {
        const v = document.createElement('video');
        v.preload = 'auto';
        v.muted = true;
        v.src = key;
        preloadCacheRef.current[key] = v;
        console.log('[WebPlayer] Preloading próximo vídeo:', key);
      } else if (next.type === 'image') {
        const img = new Image();
        img.src = key;
        preloadCacheRef.current[key] = img;
        console.log('[WebPlayer] Preloading próxima imagem:', key);
      }
    } catch (e) {
      // ignore
    }
  }, [currentIndex, playlist]);

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
    if (imageTimeoutRef.current) {
      clearTimeout(imageTimeoutRef.current);
      imageTimeoutRef.current = null;
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
      
      // Carregar áudio de fundo se disponível (URL já vem pronta do backend!)
      if (playlistRes.data.background_audio_url) {
        console.log('[WebPlayer] Background audio URL recebida:', playlistRes.data.background_audio_url);
        setBackgroundAudioUrl(playlistRes.data.background_audio_url);
      } else {
        console.log('[WebPlayer] Nenhum áudio de fundo configurado');
        setBackgroundAudioUrl(null);
      }

      if (rawItems && rawItems.length > 0) {
        console.log('[WebPlayer] Conteúdo encontrado:', rawItems[0]);
        console.log('[WebPlayer] DEBUG: Playlist completa:', rawItems.map((item, idx) => `${idx}: ${item.type} - ${item.title}`));
        console.log('[WebPlayer] DEBUG: Definindo currentContent para índice 0:', rawItems[0]);
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
        timestamp: formatBRDateTime(),
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
    }, HEARTBEAT_INTERVAL_MS);
  }, [sendPlaybackEvent, currentContent, isPlaying, currentIndex, playlist.length]);

  // Função para parar heartbeat de reprodução
  const stopPlaybackHeartbeat = useCallback(() => {
    if (playbackHeartbeatRef.current) {
      clearInterval(playbackHeartbeatRef.current);
      playbackHeartbeatRef.current = null;
    }
  }, []);

  // Funções simplificadas de reprodução
  const shouldLoopVideo = (
    currentContent?.type === 'video' && (
      playbackConfig.playback_mode === 'loop_infinite' ||
      (playlist.length === 1 && (
        playbackConfig.loop_behavior === 'infinite' ||
        playbackConfig.loop_behavior === 'until_next'
      ))
    )
  );

  const beginPlaybackStartTelemetry = () => {
    if (!currentContent) return;
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
    startPlaybackHeartbeat();
  };

  const endPlaybackTelemetry = () => {
    if (!currentContent) return;
    sendPlaybackEvent('playback_end', {
      content_id: currentContent.id,
      content_title: currentContent.title,
      content_type: currentContent.type,
      duration_actual: Date.now() - (playbackStartTimeRef.current || Date.now())
    });
    stopPlaybackHeartbeat();
  };

  const advanceToNext = () => {
    if (!playlist || playlist.length === 0) return;
    const { playback_mode, loop_behavior, shuffle_enabled } = playbackConfig;
    let nextIndex = currentIndex;
    if (playback_mode === 'single' && loop_behavior !== 'infinite') {
      return;
    }
    if (playback_mode === 'random' || shuffle_enabled) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else if (currentIndex < playlist.length - 1) {
      nextIndex = currentIndex + 1;
    } else {
      // fim da playlist
      if (playback_mode === 'loop_infinite' || loop_behavior === 'infinite' || loop_behavior === 'until_next') {
        nextIndex = 0;
        if (backgroundAudioRef.current) {
          try { backgroundAudioRef.current.currentTime = 0; } catch (_) {}
        }
      } else {
        return;
      }
    }

    const nextContent = playlist[nextIndex];
    const transitionTime = (
      (playbackConfig.transition_duration ?? 0) * 1000
    );
    const doSwitch = () => {
      setCurrentIndex(nextIndex);
      setCurrentContent(nextContent);
      sendPlaybackEvent('content_change', {
        previous_content_id: currentContent?.id,
        next_content_id: nextContent?.id,
        next_content_title: nextContent?.title,
        next_content_type: nextContent?.type,
        playlist_index: nextIndex
      });
    };
    if (transitionTime > 0) {
      setTimeout(doSwitch, transitionTime);
    } else {
      doSwitch();
    }
  };

  const handleVideoLoadStart = () => {
    console.log('[WebPlayer] Mídia começou a carregar');
  };

  const handleVideoCanPlay = () => {
    console.log('[WebPlayer] Mídia pronta para reproduzir');
    setIsPlaying(true);
    playbackStartTimeRef.current = Date.now();
    // Pausar áudio de fundo se estiver tocando (evita duplicidade)
    if (backgroundAudioRef.current && !backgroundAudioRef.current.paused) {
      try { backgroundAudioRef.current.pause(); } catch (_) {}
    }

    if (mediaRef.current && (pendingUnmuteRef.current || !muted)) {
      try { mediaRef.current.muted = false; } catch (_) {}
      try {
        const vol = Number.isFinite(playerPrefs?.volume) ? Math.min(Math.max(playerPrefs.volume, 0), 100) : 50;
        mediaRef.current.volume = vol / 100;
      } catch (_) {}
      pendingUnmuteRef.current = false;
    }

    // tentar reproduzir
    try {
      const p = mediaRef.current?.play?.();
      if (p && typeof p.catch === 'function') p.catch(() => { try { mediaRef.current.controls = true; } catch (_) {} setShowControls(true); });
    } catch (_) { try { mediaRef.current.controls = true; } catch (_) {} setShowControls(true); }

    beginPlaybackStartTelemetry();
  };

  const handleVideoPlay = () => {
    console.log('[WebPlayer] Reprodução iniciada');
    setIsPlaying(true);
    // Segurança extra: pausar áudio de fundo durante vídeos
    if (backgroundAudioRef.current && !backgroundAudioRef.current.paused) {
      try { backgroundAudioRef.current.pause(); } catch (_) {}
    }
  };

  const handleVideoPause = () => {
    console.log('[WebPlayer] Reprodução pausada');
    setIsPlaying(false);
  };

  const handleVideoEnded = () => {
    console.log('[WebPlayer] Reprodução finalizada');
    setIsPlaying(false);
    if (ignoreNextEndedRef.current) { ignoreNextEndedRef.current = false; return; }
    endPlaybackTelemetry();
    if (!shouldLoopVideo) {
      advanceToNext();
    }
  };

  const handleVideoError = (e) => {
    console.error('[WebPlayer] Erro na mídia:', e);
    setIsPlaying(false);
    stopPlaybackHeartbeat();
    try { if (mediaRef.current) mediaRef.current.controls = true; } catch (_) {}
    setShowControls(true);
  };

  // Duração e telemetria para imagens
  useEffect(() => {
    if (!currentContent) return;
    if (currentContent.type !== 'image') return;
    // limpar timer anterior
    if (imageTimeoutRef.current) { clearTimeout(imageTimeoutRef.current); imageTimeoutRef.current = null; }
    setIsPlaying(true);
    playbackStartTimeRef.current = Date.now();
    beginPlaybackStartTelemetry();
    const rawDur = currentContent.duration || playbackConfig.content_duration || 10;
    const imageDuration = rawDur > 1000 ? rawDur : (rawDur * 1000);
    imageTimeoutRef.current = setTimeout(() => {
      setIsPlaying(false);
      endPlaybackTelemetry();
      advanceToNext();
    }, imageDuration);
    return () => {
      if (imageTimeoutRef.current) { clearTimeout(imageTimeoutRef.current); imageTimeoutRef.current = null; }
    };
  }, [currentContent, playbackConfig]);

  // Escutar comandos remotos via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleRemoteCommand = (data) => {
      console.log('[WebPlayer] Comando remoto recebido:', data);
      
      const { command, data: commandData } = data;
      
      switch (command) {
        case 'stop':
          console.log('[WebPlayer] Executando comando stop...');
          
          // Parar reprodução atual
          setIsPlaying(false);
          setCurrentIndex(-1);
          setCurrentContent(null);
          
          // Parar mídia atual
          if (mediaRef.current) {
            mediaRef.current.pause();
            mediaRef.current.currentTime = 0;
          }
          
          // Parar áudio de fundo
          if (backgroundAudioRef.current) {
            backgroundAudioRef.current.pause();
            backgroundAudioRef.current.currentTime = 0;
          }
          
          // Limpar playlist
          setPlaylist([]);
          
          console.log('[WebPlayer] Comando stop executado');
          break;
          
        case 'pause':
          console.log('[WebPlayer] Executando comando pause...');
          setIsPlaying(false);
          if (mediaRef.current) {
            mediaRef.current.pause();
          }
          if (backgroundAudioRef.current) {
            backgroundAudioRef.current.pause();
          }
          break;
          
        case 'start':
        case 'play':
          console.log('[WebPlayer] Executando comando play/start...');
          setIsPlaying(true);
          if (mediaRef.current) {
            mediaRef.current.play().catch(console.error);
          }
          if (backgroundAudioRef.current && backgroundAudioLoaded) {
            backgroundAudioRef.current.play().catch(console.error);
          }
          break;
          
        case 'restart':
          console.log('[WebPlayer] Executando comando restart...');
          // Recarregar dados do player
          if (typeof loadPlayerData === 'function') loadPlayerData();
          if (typeof connectToPlayer === 'function') connectToPlayer();
          break;
          
        default:
          console.log('[WebPlayer] Comando não reconhecido:', command);
      }
    };

    socket.on('remote_command', handleRemoteCommand);

    return () => {
      socket.off('remote_command', handleRemoteCommand);
    };
  }, [socket, backgroundAudioLoaded, loadPlayerData, connectToPlayer]);

  const renderContent = () => {
    if (!currentContent) return null;

    console.log('[WebPlayer] DEBUG: Renderizando conteúdo:', currentContent.type, currentContent.title, 'índice:', currentIndex);

    // Deve manter o vídeo em loop contínuo? (inclui 'até próximo agendamento')
    const shouldLoop = shouldLoopVideo;

    const commonStyle = {
      width: '100%',
      height: '100%',
      objectFit: (fullscreen || LEGACY_MODE) ? 'cover' : 'contain',
      backgroundColor: '#000',
    };
    // Em TVs mais antigas, o elemento de vídeo pode usar um plano de hardware que fica acima do HTML.
    // Para garantir que o botão de ativação fique visível, ocultamos o vídeo enquanto o overlay estiver ativo.
    const suspendVideoForActivation = showActivation && LEGACY_MODE;

    switch (currentContent.type) {
      case 'video':
        return (
          <video
            ref={mediaRef}
            key="video-player"
            src={currentContent.file_url || currentContent.url}
            style={{
              ...commonStyle,
              // Oculta completamente o vídeo para liberar o overlay em TVs com plano de vídeo dedicado
              display: suspendVideoForActivation ? 'none' : 'block',
              visibility: suspendVideoForActivation ? 'hidden' : 'visible',
              pointerEvents: suspendVideoForActivation ? 'none' : 'auto',
            }}
            muted={muted}
            playsInline
            autoPlay
            preload={(LEGACY_MODE && !shouldLoop) ? 'metadata' : 'auto'}
            controls={showControls}
            loop={shouldLoop}
            onLoadStart={handleVideoLoadStart}
            onCanPlay={handleVideoCanPlay}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onEnded={handleVideoEnded}
            onError={handleVideoError}
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

      {showActivation && (
        <Box
          onClick={activateAudioAndFullscreen}
          onTouchStart={activateAudioAndFullscreen}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'OK') activateAudioAndFullscreen(); }}
          role="button"
          tabIndex={0}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            zIndex: 2147483647,
          }}
        >
          <Box sx={{ textAlign: 'center', color: '#fff', px: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Toque para ativar Tela Cheia e Áudio</Typography>
            <button
              onClick={activateAudioAndFullscreen}
              onTouchStart={activateAudioAndFullscreen}
              style={{
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 700,
                color: '#000',
                backgroundColor: '#ffa000',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Ativar
            </button>
            <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
              Dica: pressione a tecla F para alternar tela cheia
            </Typography>
          </Box>
        </Box>
      )}
      
      {/* Progress Bar (oculta no modo legado) */}
      {!LEGACY_MODE && (
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
      )}
      
      {/* Content Info Overlay (oculta no modo legado) */}
      {!fullscreen && !LEGACY_MODE && currentContent && (
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
