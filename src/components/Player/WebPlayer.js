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
  const userInteractedRef = useRef(false);

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
  const RECONNECT_DELAY = 15000; // 15 segundos entre reconexões

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
      const playlistRes = await axios.get(`/players/${playerId}/playlist`);
      console.log('[WebPlayer] Playlist carregada:', playlistRes.data);
      
      setPlaylist(playlistRes.data.contents || []);

      if (playlistRes.data.contents && playlistRes.data.contents.length > 0) {
        console.log('[WebPlayer] Conteúdo encontrado:', playlistRes.data.contents[0]);
        setCurrentContent(playlistRes.data.contents[0]);
        setCurrentIndex(0);
        setLoadAttempts(0); // Reset counter on success
        setError(''); // Clear any previous errors
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
    nextContent();
  };

  const handleImageDisplay = () => {
    const duration = (currentContent.duration || 10) * 1000;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      nextContent();
    }, duration);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (duration / 1000));
        if (newProgress >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return newProgress;
      });
    }, 1000);
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
            src={currentContent.file_url || currentContent.url}
            style={commonStyle}
            onLoadedData={handleMediaLoad}
            onEnded={handleMediaEnd}
            muted={muted}
            playsInline
            autoPlay
            preload="auto"
          />
        );
      
      case 'image':
        return (
          <img
            src={currentContent.file_url || currentContent.url}
            alt={currentContent.title}
            style={commonStyle}
            onLoad={handleImageDisplay}
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
              background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
            }}
          >
            <audio
              ref={mediaRef}
              src={currentContent.file_url || currentContent.url}
              onLoadedData={handleMediaLoad}
              onEnded={handleMediaEnd}
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
