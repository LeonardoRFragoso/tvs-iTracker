import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from '../../config/axios'; 
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import WebPlayer from '../../components/Player/WebPlayer';

const API_BASE_URL = axios.defaults.baseURL;

const PlayerView = () => {
  const { id, code } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);

  const fullscreenParam = searchParams.get('fullscreen');
  const playerId = id || searchParams.get('playerId');

  useEffect(() => {
    if (fullscreenParam === 'true') {
      // Enable fullscreen layout (overlay), but do not request browser fullscreen automatically
      setIsFullscreen(true);
      // The user can press 'F' or click the button to enter real browser fullscreen
    }
  }, [fullscreenParam]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      switch (event.key) {
        case 'Escape':
          if (isFullscreen) {
            exitFullscreen();
          }
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isFullscreen]);

  // Auto-detect TV/kiosk mode and enable fullscreen
  useEffect(() => {
    const isKioskMode = window.location.pathname.includes('/kiosk/') || window.location.pathname.includes('/k/');
    const isLargeScreen = window.screen.width >= 1920 || window.screen.height >= 1080;
    
    if (isKioskMode && isLargeScreen && !isFullscreen) {
      console.log('[PlayerView] Kiosk mode detected; awaiting user gesture to enter fullscreen');
      // Tip: press 'F' or click the "Tela Cheia" button to enter fullscreen.
    }
  }, [playerId, isFullscreen]);

  useEffect(() => {
    const resolveAndRedirect = async () => {
      if (!id && code) {
        try {
          setResolving(true);
          const res = await axios.get(`/players/resolve-code/${code}`);
          const pid = res.data.player_id;
          navigate(`/kiosk/player/${pid}?fullscreen=true`, { replace: true });
        } catch (e) {
          setError('Código de acesso inválido');
        } finally {
          setResolving(false);
        }
      }
    };
    resolveAndRedirect();
  }, [id, code, navigate]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  };

  const enterFullscreen = () => {
    console.log('[PlayerView] Entering fullscreen mode');
    setIsFullscreen(true);
    
    // Try multiple fullscreen methods for better compatibility
    const element = document.documentElement;
    
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(console.warn);
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen().catch(console.warn);
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen().catch(console.warn);
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen().catch(console.warn);
    }
  };

  const exitFullscreen = () => {
    console.log('[PlayerView] Exiting fullscreen mode');
    setIsFullscreen(false);
    
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(console.warn);
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen().catch(console.warn);
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen().catch(console.warn);
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen().catch(console.warn);
    }
  };

  if (resolving) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#000' }}>
        <Typography variant="h6" color="white">Carregando...</Typography>
      </Box>
    );
  }

  if (!playerId && !code) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#000',
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          ID do player não fornecido
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate('/players')}
          sx={{ mt: 2 }}
        >
          Voltar para Players
        </Button>
      </Box>
    );
  }

  if (isFullscreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: '#000',
        }}
      >
        <WebPlayer playerId={playerId} fullscreen={true} />
        
        {/* Fullscreen Controls */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10000,
          }}
        >
          <Tooltip title="Sair do modo tela cheia (ESC)">
            <IconButton
              onClick={exitFullscreen}
              sx={{
                color: 'white',
                backgroundColor: 'rgba(0,0,0,0.5)',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.7)',
                },
              }}
            >
              <FullscreenExitIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton onClick={() => navigate('/players')} sx={{ mr: 2 }}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Player - Visualização
          </Typography>
        </Box>
        
        <Box display="flex" gap={2}>
          <Tooltip title="Modo tela cheia (F)">
            <Button
              variant="outlined"
              startIcon={<FullscreenIcon />}
              onClick={enterFullscreen}
            >
              Tela Cheia
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <WebPlayer playerId={playerId} fullscreen={false} />

      <Box mt={2}>
        <Typography variant="body2" color="text.secondary">
          Pressione <strong>F</strong> para entrar no modo tela cheia ou <strong>ESC</strong> para sair.
        </Typography>
      </Box>
    </Box>
  );
};

export default PlayerView;
