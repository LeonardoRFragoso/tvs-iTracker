import React, { useState, useEffect, useRef } from 'react';
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
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

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
  
  const mediaRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (playerId) {
      loadPlayerData();
      connectToPlayer();
      try { joinPlayerRoom(playerId); } catch (e) { /* noop */ }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [playerId]);

  useEffect(() => {
    if (socket && playerId) {
      const onPlayerCommand = (payload) => handlePlayerCommand(payload);
      const onPlaySchedule = (payload) => handlePlaySchedule(payload);

      socket.on('player_command', onPlayerCommand);
      socket.on('play_schedule', onPlaySchedule);

      return () => {
        socket.off('player_command', onPlayerCommand);
        socket.off('play_schedule', onPlaySchedule);
      };
    }
  }, [socket, playerId]);

  const loadPlayerData = async () => {
    try {
      setLoading(true);
      // 1) Always load playlist (public endpoint)
      const playlistRes = await axios.get(`${API_BASE_URL}/players/${playerId}/playlist`);
      setPlaylist(playlistRes.data.contents || []);

      if (playlistRes.data.contents && playlistRes.data.contents.length > 0) {
        setCurrentContent(playlistRes.data.contents[0]);
        setCurrentIndex(0);
      } else {
        setCurrentContent(null);
        setCurrentIndex(0);
      }

      // 2) Try to load player info (may require auth) — ignore errors in kiosk mode
      try {
        const playerRes = await axios.get(`${API_BASE_URL}/players/${playerId}`);
        setPlayerInfo(playerRes.data);
      } catch (e) {
        // Silent in kiosk
      }
    } catch (err) {
      setError('Erro ao carregar dados do player');
      console.error('Load player data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectToPlayer = async () => {
    try {
      await axios.post(`${API_BASE_URL}/players/${playerId}/connect`);
    } catch (err) {
      console.error('Connect player error:', err);
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
    try {
      await loadPlayerData();
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
      mediaRef.current.play();
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
            muted
            playsInline
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
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: fullscreen ? '100vh' : '400px',
          backgroundColor: '#000',
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          {error}
        </Alert>
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
