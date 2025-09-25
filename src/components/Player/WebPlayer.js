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
      joinPlayerRoom(playerId);
    }
    
    // Cleanup on unmount
    return () => {
      console.log('[WebPlayer] Limpando recursos...');
      clearAllTimeouts();
    };
  }, [playerId]);

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
