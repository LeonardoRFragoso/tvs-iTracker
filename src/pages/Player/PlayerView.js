import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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

const PlayerView = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');

  const fullscreenParam = searchParams.get('fullscreen');
  const playerId = id || searchParams.get('playerId');

  useEffect(() => {
    if (fullscreenParam === 'true') {
      setIsFullscreen(true);
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

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  };

  const enterFullscreen = () => {
    setIsFullscreen(true);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  if (!playerId) {
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
