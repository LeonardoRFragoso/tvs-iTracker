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

// Detecta modo kiosk/legado por pathname
const isBrowser = typeof window !== 'undefined';
const kioskPathname = isBrowser ? (window.location.pathname || '') : '';
const IS_KIOSK_LEGACY = isBrowser && (
  kioskPathname.startsWith('/kiosk') ||
  kioskPathname.startsWith('/k/') ||
  kioskPathname.startsWith('/tv')
);

const PlayerView = () => {
  const { id, code } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
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

  // Helper: detect if the document is actually in native fullscreen
  const isNativeFullscreenActive = () => !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );

  useEffect(() => {
    const syncFs = () => setIsFullscreen(!!isNativeFullscreenActive());
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    document.addEventListener('mozfullscreenchange', syncFs);
    document.addEventListener('MSFullscreenChange', syncFs);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
      document.removeEventListener('mozfullscreenchange', syncFs);
      document.removeEventListener('MSFullscreenChange', syncFs);
    };
  }, []);

  const enterFullscreen = () => {
    if (isNativeFullscreenActive()) {
      // Already in fullscreen; just sync state
      setIsFullscreen(true);
      return;
    }
    console.log('[PlayerView] Entering fullscreen mode');
    setIsFullscreen(true);
    // Try multiple fullscreen methods for better compatibility
    const element = document.documentElement;
    try {
      if (element.requestFullscreen) {
        const p = element.requestFullscreen();
        if (p && typeof p.catch === 'function') p.catch(console.warn);
      } else if (element.webkitRequestFullscreen) {
        const p = element.webkitRequestFullscreen();
        if (p && typeof p.catch === 'function') p.catch(console.warn);
      } else if (element.mozRequestFullScreen) {
        const p = element.mozRequestFullScreen();
        if (p && typeof p.catch === 'function') p.catch(console.warn);
      } else if (element.msRequestFullscreen) {
        const p = element.msRequestFullscreen();
        if (p && typeof p.catch === 'function') p.catch(console.warn);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const exitFullscreen = () => {
    // Only try to exit if the browser is actually in fullscreen to avoid errors
    const active = isNativeFullscreenActive();
    if (!active) {
      setIsFullscreen(false);
      return;
    }
    console.log('[PlayerView] Exiting fullscreen mode');
    setIsFullscreen(false);
    try {
      if (document.exitFullscreen) {
        const p = document.exitFullscreen();
        if (p && typeof p.catch === 'function') p.catch(console.warn);
      } else if (document.webkitExitFullscreen) {
        const p = document.webkitExitFullscreen();
        if (p && typeof p.catch === 'function') p.catch(console.warn);
      } else if (document.mozCancelFullScreen) {
        const p = document.mozCancelFullScreen();
        if (p && typeof p.catch === 'function') p.catch(console.warn);
      } else if (document.msExitFullscreen) {
        const p = document.msExitFullscreen();
        if (p && typeof p.catch === 'function') p.catch(console.warn);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const refreshThisPlayer = async () => {
    try {
      setInfo('');
      setError('');
      await axios.post(`/players/${playerId}/refresh-playlist`);
      setInfo('Atualização de playlist enviada para o player');
      setTimeout(() => setInfo(''), 3000);
    } catch (e) {
      setError('Falha ao atualizar playlist do player');
      setTimeout(() => setError(''), 4000);
    }
  };

  const refreshAllPlayers = async () => {
    try {
      setInfo('');
      setError('');
      await axios.post(`/players/refresh-all-playlists`);
      setInfo('Atualização de playlist enviada para todos os players');
      setTimeout(() => setInfo(''), 3000);
    } catch (e) {
      setError('Falha ao atualizar playlists');
      setTimeout(() => setError(''), 4000);
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
        
        {/* Fullscreen Controls (ocultos no modo kiosk/legado) */}
        {!IS_KIOSK_LEGACY && (
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
        )}
      </Box>
    );
  }

  return (
    <Box>
      {!IS_KIOSK_LEGACY && (
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
          <Tooltip title="Forçar atualização da playlist deste player">
            <Button variant="contained" onClick={refreshThisPlayer}>
              Atualizar Playlist
            </Button>
          </Tooltip>
          <Tooltip title="Forçar atualização de todos os players">
            <Button variant="outlined" onClick={refreshAllPlayers}>
              Atualizar Todos
            </Button>
          </Tooltip>
        </Box>
      </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {info}
        </Alert>
      )}

      <WebPlayer playerId={playerId} fullscreen={false} />

      {!IS_KIOSK_LEGACY && (
        <Box mt={2}>
          <Typography variant="body2" color="text.secondary">
            Pressione <strong>F</strong> para entrar no modo tela cheia ou <strong>ESC</strong> para sair.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PlayerView;
