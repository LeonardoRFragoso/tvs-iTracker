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
  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState(false);
  const [muted, setMuted] = useState(true); // start muted to allow autoplay
  const [segments, setSegments] = useState([]); // [{campaign_id, campaign_name, startIndex, endIndex, length}]
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(-1);
  const [showCampaignBanner, setShowCampaignBanner] = useState(false);
  const [playlistEtag, setPlaylistEtag] = useState(null);
  const userInteractedRef = useRef(false);
  const mediaErrorCountRef = useRef(0); // retry guard for media errors
  const preloadCacheRef = useRef({});

  const mediaRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const loadTimeoutRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const debounceRef = useRef(null);

  // Circuit Breaker: Previne loops infinitos
  const MAX_ATTEMPTS = 5;
  const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 segundos
  const DEBOUNCE_DELAY = 2000; // 2 segundos entre carregamentos
  const RECONNECT_DELAY = 30000; // 30 segundos entre reconexões/heartbeats

  useEffect(() => {
    console.log('[WebPlayer] Iniciando para playerId:', playerId);
    if (playerId && !circuitBreakerOpen) {
      debouncedLoadPlayerData();
      debouncedConnectToPlayer();
      try { 
        joinPlayerRoom(playerId); 
        console.log('[WebPlayer] Joined room:', playerId);
      } catch (e) { 
        console.warn('Join room failed:', e); 
      }
    }

    return () => {
      console.log('[WebPlayer] Cleanup');
      clearAllTimeouts();
      const el = mediaRef.current;
      if (el) {
        try {
          if (el.pause) el.pause();
          if (el.removeAttribute) el.removeAttribute('src');
          if (el.load) el.load();
        } catch (_) {}
      }
    };
  }, [playerId, circuitBreakerOpen]);

  useEffect(() => {
    if (socket && playerId) {
      const onPlayerCommand = (payload) => {
        console.log('[WebPlayer] Comando recebido:', payload);
        handlePlayerCommand(payload);
      };
      const onPlaySchedule = (payload) => {
        console.log('[WebPlayer] Play schedule recebido:', payload);
        handlePlaySchedule(payload);
      };

      socket.on('player_command', onPlayerCommand);
      socket.on('play_schedule', onPlaySchedule);

      return () => {
        socket.off('player_command', onPlayerCommand);
        socket.off('play_schedule', onPlaySchedule);
      };
    }
  }, [socket, playerId]);

  useEffect(() => {
    const onUserInteract = () => {
      if (userInteractedRef.current) return;
      userInteractedRef.current = true;
      setMuted(false);
      if (mediaRef.current) {
        try {
          mediaRef.current.muted = false;
          mediaRef.current.volume = 1.0;
          mediaRef.current.play().catch(() => {});
        } catch (_) {}
      }
      document.removeEventListener('click', onUserInteract);
      document.removeEventListener('keydown', onUserInteract);
      document.removeEventListener('touchstart', onUserInteract);
    };

    document.addEventListener('click', onUserInteract);
    document.addEventListener('keydown', onUserInteract);
    document.addEventListener('touchstart', onUserInteract, { passive: true });

    return () => {
      document.removeEventListener('click', onUserInteract);
      document.removeEventListener('keydown', onUserInteract);
      document.removeEventListener('touchstart', onUserInteract);
    };
  }, []);

  useEffect(() => {
    mediaErrorCountRef.current = 0;
  }, [currentIndex, currentContent?.id]);

  const clearAllTimeouts = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // Debounced loading para prevenir chamadas excessivas
  const debouncedLoadPlayerData = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTime;
    
    if (timeSinceLastLoad < DEBOUNCE_DELAY) {
      console.log('[WebPlayer] Debouncing load request');
      debounceRef.current = setTimeout(() => {
        loadPlayerData();
      }, DEBOUNCE_DELAY - timeSinceLastLoad);
      return;
    }
    
    loadPlayerData();
  }, [lastLoadTime]);

  const debouncedConnectToPlayer = useCallback(() => {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    
    if (!isConnected) {
      connectTimeoutRef.current = setTimeout(() => {
        connectToPlayer();
      }, 1000);
    }
  }, [isConnected]);

  const loadPlayerData = async () => {
    try {
      const now = Date.now();
      setLastLoadTime(now);
      
      console.log('[WebPlayer] Carregando dados do player, tentativa:', loadAttempts + 1);
      setLoading(true);
      setLoadAttempts(prev => prev + 1);
      
      // Circuit Breaker: Prevenir loops infinitos
      if (loadAttempts >= MAX_ATTEMPTS) {
        console.error('[WebPlayer] Circuit breaker ativado - muitas tentativas');
        setCircuitBreakerOpen(true);
        setError('Sistema temporariamente indisponível. Tentando reconectar...');
        setLoading(false);
        
        // Reset circuit breaker após timeout
        setTimeout(() => {
          console.log('[WebPlayer] Resetando circuit breaker');
          setCircuitBreakerOpen(false);
          setLoadAttempts(0);
          setError('');
        }, CIRCUIT_BREAKER_TIMEOUT);
        return;
      }
      
      // 1) Always load playlist (public endpoint)
      const playlistRes = await axios.get(`/players/${playerId}/playlist`, {
        headers: playlistEtag ? { 'If-None-Match': playlistEtag } : undefined,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      });
      console.log('[WebPlayer] Playlist carregada:', playlistRes.data);
      
      // Handle 304 Not Modified
      if (playlistRes.status === 304) {
        console.log('[WebPlayer] Playlist não modificada (304), mantendo cache atual');
        setLoading(false);
        return;
      }
      // Save new ETag if present
      try {
        if (playlistRes.headers && (playlistRes.headers.etag || playlistRes.headers.ETag)) {
          setPlaylistEtag(playlistRes.headers.etag || playlistRes.headers.ETag);
        }
      } catch (_) {}
      
      setPlaylist(playlistRes.data.contents || []);

      if (playlistRes.data.contents && playlistRes.data.contents.length > 0) {
        console.log('[WebPlayer] Conteúdo encontrado:', playlistRes.data.contents[0]);
        setCurrentContent(playlistRes.data.contents[0]);
        setCurrentIndex(0);
        setLoadAttempts(0); // Reset counter on success
        setError(''); // Clear any previous errors
        
        // Compute campaign segments
        const segs = buildSegments(playlistRes.data.contents);
        setSegments(segs);
        setCurrentSegmentIdx(segs.length ? 0 : -1);
        
        // Prefetch next images to smooth playback (first few items)
        try {
          prefetchUpcomingImages(playlistRes.data.contents, 0);
        } catch (_) {}
      } else {
        console.log('[WebPlayer] Nenhum conteúdo encontrado, aguardando...');
        setCurrentContent(null);
        setCurrentIndex(0);
        
        // Reagendar carregamento após delay maior se não há conteúdo
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = setTimeout(() => {
          console.log('[WebPlayer] Recarregando após timeout...');
          if (!circuitBreakerOpen) {
            debouncedLoadPlayerData();
          }
        }, RECONNECT_DELAY);
      }

      // 2) Try to load player info using public endpoint for kiosk mode
      try {
        const playerRes = await axios.get(`/players/${playerId}/info`);
        setPlayerInfo(playerRes.data);
        console.log('[WebPlayer] Info do player carregada:', playerRes.data);
      } catch (e) {
        // Fallback: try authenticated endpoint if available
        try {
          const playerRes = await axios.get(`/players/${playerId}`);
          setPlayerInfo(playerRes.data);
          console.log('[WebPlayer] Info do player carregada (auth):', playerRes.data);
        } catch (authError) {
          console.log('[WebPlayer] Info do player não disponível (modo kiosk)');
        }
      }
    } catch (err) {
      console.error('[WebPlayer] Erro ao carregar dados:', err);
      
      // Não definir erro para problemas de rede temporários
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
    try {
      console.log('[WebPlayer] Conectando ao player...');
      await axios.post(`/players/${playerId}/connect`);
      console.log('[WebPlayer] Conectado com sucesso');
      setIsConnected(true);
      
      // Reagendar reconexão periódica (heartbeat)
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        setIsConnected(false);
        if (!circuitBreakerOpen) {
          debouncedConnectToPlayer();
        }
      }, RECONNECT_DELAY);
      
    } catch (err) {
      console.error('[WebPlayer] Erro ao conectar:', err);
      setIsConnected(false);
      
      // Retry connection com delay
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        if (!circuitBreakerOpen) {
          debouncedConnectToPlayer();
        }
      }, RECONNECT_DELAY);
    }
  };

  const handlePlayerCommand = (payload) => {
    const cmd = (payload && (payload.type || payload.command)) || '';
    switch (cmd) {
      case 'play':
      case 'start':
        playContent();
        break;
      case 'pause':
      case 'stop':
        pauseContent();
        break;
      case 'next':
        nextContent();
        break;
      case 'previous':
        previousContent();
        break;
      case 'restart':
        restartPlayer();
        break;
      case 'sync':
      case 'update_playlist':
        loadPlayerData();
        break;
      default:
        console.log('Unknown command:', payload);
    }
  };

  const handlePlaySchedule = async (data) => {
    console.log('[WebPlayer] Atualizando playlist por comando do servidor');
    try {
      // Use debounced version para evitar múltiplas chamadas
      debouncedLoadPlayerData();
    } catch (e) {
      console.warn('Failed to refresh playlist on play_schedule', e);
    }
  };

  const playContent = () => {
    if (mediaRef.current) {
      mediaRef.current.play();
      setIsPlaying(true);
      startProgressTracking();
    }
  };

  const pauseContent = () => {
    if (mediaRef.current) {
      mediaRef.current.pause();
      setIsPlaying(false);
      stopProgressTracking();
    }
  };

  const nextContent = () => {
    if (playlist.length > 0) {
      const nextIndex = (currentIndex + 1) % playlist.length;
      setCurrentIndex(nextIndex);
      setCurrentContent(playlist[nextIndex]);
      setProgress(0);

      // Update current segment and show banner when campaign changes
      if (segments.length > 0) {
        const segIdx = segments.findIndex(seg => nextIndex >= seg.startIndex && nextIndex <= seg.endIndex);
        if (segIdx !== -1 && segIdx !== currentSegmentIdx) {
          setCurrentSegmentIdx(segIdx);
          setShowCampaignBanner(true);
          setTimeout(() => setShowCampaignBanner(false), 2000);
        }
      }

      // Single-item playlist handling without remounting
      if (playlist.length === 1) {
        const onlyItem = playlist[0];
        if (mediaRef.current && onlyItem?.type === 'video') {
          try {
            mediaRef.current.pause();
            mediaRef.current.currentTime = 0;
            mediaRef.current.play().catch(() => {});
          } catch (_) {}
        } else if (onlyItem?.type === 'image') {
          // Re-arm image timers explicitly since onLoad won't fire again
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (intervalRef.current) clearInterval(intervalRef.current);
          handleImageDisplay();
        }
      }

      // If we wrapped to the first item, refresh playlist to capture any new schedules
      if (nextIndex === 0) {
        try {
          debouncedLoadPlayerData();
          // Recompute segments after refresh will be handled within loadPlayerData
        } catch (_) {}
      }
      
      // Prefetch following images ahead of time
      try { prefetchUpcomingImages(playlist, nextIndex); } catch (_) {}
    }
  };

  const previousContent = () => {
    if (playlist.length > 0) {
      const prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
      setCurrentIndex(prevIndex);
      setCurrentContent(playlist[prevIndex]);
      setProgress(0);
    }
  };

  const restartPlayer = () => {
    window.location.reload();
  };

  const startProgressTracking = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      if (mediaRef.current && currentContent) {
        const duration = currentContent.duration || mediaRef.current.duration || 0;
        const currentTime = mediaRef.current.currentTime || 0;
        
        if (duration > 0) {
          const progressPercent = (currentTime / duration) * 100;
          setProgress(progressPercent);
          
          if (progressPercent >= 99) {
            nextContent();
          }
        }
      }
    }, 1000);
  };

  const stopProgressTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleMediaLoad = () => {
    if (mediaRef.current) {
      try {
        mediaRef.current.muted = muted;
        mediaRef.current.volume = muted ? 0 : 1.0;
        mediaRef.current.play().catch(() => {});
      } catch (_) {}
      setIsPlaying(true);
      startProgressTracking();
    }
  };

  const handleMediaEnd = () => {
    if (playlist.length === 1) {
      // Single item: loop seamlessly
      if (mediaRef.current) {
        try {
          mediaRef.current.currentTime = 0;
          mediaRef.current.play().catch(() => {});
        } catch (_) {}
      }
    } else {
      nextContent();
    }
  };

  const handleMediaError = (e) => {
    console.error('[WebPlayer] Erro ao carregar mídia:', e);
    // Try a single in-place reload without remounting
    mediaErrorCountRef.current = (mediaErrorCountRef.current || 0) + 1;
    const el = mediaRef.current;
    if (el && mediaErrorCountRef.current <= 1) {
      try {
        el.pause?.();
        el.load?.();
        el.play?.().catch(() => {});
        return;
      } catch (_) {}
    }
    // Fallback to next content after short delay to avoid stall
    mediaErrorCountRef.current = 0;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      nextContent();
    }, 2000);
  };

  const handleImageDisplay = () => {
    const duration = (currentContent.duration || 10) * 1000;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    timeoutRef.current = setTimeout(() => {
      nextContent();
    }, duration);

    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        const step = 100 / (duration / 1000);
        const newProgress = prev + step;
        if (newProgress >= 100) {
          clearInterval(intervalRef.current);
          return 100;
        }
        return newProgress;
      });
    }, 1000);
  };

  const buildSegments = useCallback((items) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const segs = [];
    let i = 0;
    while (i < items.length) {
      const first = items[i] || {};
      const cid = first.campaign_id || `unknown-${i}`;
      const cname = first.campaign_name || 'Campanha';
      let start = i;
      let end = i;
      while (end + 1 < items.length) {
        const next = items[end + 1] || {};
        const nextCid = next.campaign_id || `unknown-${end + 1}`;
        if (nextCid !== cid) break;
        end += 1;
      }
      segs.push({ campaign_id: cid, campaign_name: cname, startIndex: start, endIndex: end, length: end - start + 1 });
      i = end + 1;
    }
    return segs;
  }, []);

  const prefetchImage = (url) => {
    if (!url) return;
    if (preloadCacheRef.current[url]) return;
    const img = new Image();
    img.src = url;
    preloadCacheRef.current[url] = img;
  };

  const prefetchUpcomingImages = (items, startIdx, count = 3) => {
    if (!Array.isArray(items) || items.length === 0) return;
    let fetched = 0;
    for (let i = 0; i < items.length && fetched < count; i++) {
      const idx = (startIdx + 1 + i) % items.length;
      const it = items[idx];
      if (it && it.type === 'image') {
        prefetchImage(it.file_url || it.url);
        fetched += 1;
      }
    }
  };

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
            onLoadedData={handleMediaLoad}
            onEnded={handleMediaEnd}
            onError={handleMediaError}
            muted={muted}
            playsInline
            autoPlay
            preload="auto"
            loop={playlist.length === 1}
          />
        );
      
      case 'image':
        return (
          <img
            key="image-player"
            src={currentContent.file_url || currentContent.url}
            alt={currentContent.title}
            style={commonStyle}
            onLoad={handleImageDisplay}
            onError={handleMediaError}
          />
        );
      
      case 'audio':
        return (
          <Box
            sx={{
              ...commonStyle,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(45deg, #1976d2, #42a5f5)'
            }}
          >
            <audio
              ref={mediaRef}
              key="audio-player"
              src={currentContent.file_url || currentContent.url}
              onLoadedData={handleMediaLoad}
              onEnded={handleMediaEnd}
              onError={handleMediaError}
              style={{ display: 'none' }}
            />
            <Typography variant="h3" color="white" textAlign="center" mb={2}>
              {currentContent.title}
            </Typography>
            <Typography variant="h6" color="white" textAlign="center">
              {currentContent.description}
            </Typography>
          </Box>
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
      
      {/* Campaign change banner */}
      {showCampaignBanner && currentSegmentIdx >= 0 && segments[currentSegmentIdx] && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            px: 3,
            py: 1.5,
            borderRadius: 1,
            zIndex: 10000,
          }}
        >
          <Typography variant="h5" fontWeight={600}>
            Campanha: {segments[currentSegmentIdx].campaign_name}
          </Typography>
        </Box>
      )}
      
      {/* Campaign mini progress bar (item-based) */}
      {currentSegmentIdx >= 0 && segments[currentSegmentIdx] && (
        <LinearProgress
          variant="determinate"
          value={((currentIndex - segments[currentSegmentIdx].startIndex + 1) / segments[currentSegmentIdx].length) * 100}
          sx={{
            position: 'absolute',
            bottom: 6,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: 'rgba(255,255,255,0.2)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: '#66bb6a',
            },
          }}
        />
      )}
      
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
      
      {/* Enable-sound button shown while muted */}
      {currentContent?.type === 'video' && muted && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 10000,
          }}
        >
          <Button
            variant="contained"
            onClick={() => {
              setMuted(false);
              if (mediaRef.current) {
                try {
                  mediaRef.current.muted = false;
                  mediaRef.current.volume = 1.0;
                  mediaRef.current.play().catch(() => {});
                } catch (_) {}
              }
            }}
          >
            Ativar áudio
          </Button>
        </Box>
      )}
      
      {/* Content Info Overlay */}
      {!fullscreen && (
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
          {currentSegmentIdx >= 0 && segments[currentSegmentIdx] && (
            <Typography variant="body2" noWrap>
              Campanha: {segments[currentSegmentIdx].campaign_name} — {currentIndex - segments[currentSegmentIdx].startIndex + 1} de {segments[currentSegmentIdx].length}
            </Typography>
          )}
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
