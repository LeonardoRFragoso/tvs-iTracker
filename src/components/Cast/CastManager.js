import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Typography,
  Alert
} from '@mui/material';
import {
  Cast as CastIcon,
  CastConnected as CastConnectedIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from '../../config/axios';

const CastManager = ({ playerId, onCastStateChange }) => {
  const [castSession, setCastSession] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [castApiLoaded, setCastApiLoaded] = useState(false);

  useEffect(() => {
    loadCastAPI();
  }, []);

  const loadCastAPI = () => {
    // Verificar se já está carregado
    if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
      initializeCastAPI();
      return;
    }

    // Carregar Google Cast API apenas se necessário
    if (!document.querySelector('script[src*="cast_sender.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.onload = () => {
        // Aguardar API estar disponível
        const checkAPI = () => {
          if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
            initializeCastAPI();
          } else {
            setTimeout(checkAPI, 100);
          }
        };
        checkAPI();
      };
      script.onerror = () => {
        console.warn('Falha ao carregar Google Cast API - funcionalidade Cast desabilitada');
        setCastApiLoaded(false);
      };
      document.head.appendChild(script);
    }
  };

  const initializeCastAPI = () => {
    window['__onGCastApiAvailable'] = (isAvailable) => {
      if (isAvailable) {
        const context = window.cast.framework.CastContext.getInstance();
        
        context.setOptions({
          receiverApplicationId: 'CC1AD845', // Default Media Receiver
          autoJoinPolicy: window.cast.framework.AutoJoinPolicy.ORIGIN_SCOPED
        });

        // Listener para mudanças de sessão
        context.addEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          handleSessionStateChanged
        );

        setCastApiLoaded(true);
        scanForDevices();
      }
    };
  };

  const handleSessionStateChanged = (event) => {
    const session = event.sessionState;
    setCastSession(session);
    
    if (onCastStateChange) {
      onCastStateChange(session ? 'connected' : 'disconnected');
    }
  };

  const scanForDevices = async () => {
    if (!window.cast || !window.cast.framework) return;

    try {
      // Usar axios central com JWT (localStorage 'access_token') e baseURL correto
      const { data } = await axios.post('/cast/devices/scan');
      setAvailableDevices(data.discovered_devices || []);
    } catch (error) {
      console.error('Erro na descoberta de dispositivos:', error);
      // Fallback para dispositivos mock em caso de erro
      const mockDevices = [
        { id: 'chromecast-1', name: 'TV Recepção', type: 'Chromecast' },
        { id: 'chromecast-2', name: 'TV Sala Reunião', type: 'Chromecast' },
        { id: 'chromecast-3', name: 'TV Cafeteria', type: 'Chromecast' }
      ];
      setAvailableDevices(mockDevices);
    }
  };

  const connectToDevice = async (device) => {
    try {
      const context = window.cast.framework.CastContext.getInstance();
      await context.requestSession();
      
      // Enviar ID do player para o Cast Receiver
      const session = context.getCurrentSession();
      if (session) {
        const mediaInfo = new window.chrome.cast.media.MediaInfo('', 'application/json');
        mediaInfo.customData = { 
          player_id: playerId,
          device_name: device.name 
        };

        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
        await session.loadMedia(request);
      }
      
      setShowDeviceDialog(false);
    } catch (error) {
      console.error('Erro ao conectar ao Chromecast:', error);
    }
  };

  const disconnectCast = () => {
    if (castSession) {
      castSession.endSession(true);
    }
  };

  const sendContentToCast = async (contentUrl, metadata) => {
    if (!castSession) return;

    try {
      const mediaInfo = new window.chrome.cast.media.MediaInfo(contentUrl, metadata.contentType);
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = metadata.title;
      mediaInfo.metadata.subtitle = metadata.description;
      mediaInfo.customData = { player_id: playerId };

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      await castSession.loadMedia(request);
    } catch (error) {
      console.error('Erro ao enviar conteúdo:', error);
    }
  };

  const sendCommand = (command, params = {}) => {
    if (!castSession) return;

    // Enviar comando via WebSocket para o Cast Receiver
    const message = {
      action: command,
      player_id: playerId,
      ...params
    };

    // Usar namespace customizado para comandos
    castSession.sendMessage('urn:x-cast:com.tvs.commands', message);
  };

  if (!castApiLoaded) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body2" color="text.secondary">
          Carregando Cast API...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Botão de Cast */}
      {!castSession ? (
        <Button
          variant="outlined"
          startIcon={<CastIcon />}
          onClick={() => setShowDeviceDialog(true)}
          size="small"
        >
          Conectar Cast
        </Button>
      ) : (
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            variant="contained"
            startIcon={<CastConnectedIcon />}
            onClick={disconnectCast}
            color="primary"
            size="small"
          >
            Conectado
          </Button>
          <Typography variant="body2" color="text.secondary">
            {castSession.getSessionObj().receiver.friendlyName}
          </Typography>
        </Box>
      )}

      {/* Dialog de seleção de dispositivos */}
      <Dialog 
        open={showDeviceDialog} 
        onClose={() => setShowDeviceDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Selecionar Chromecast
            <IconButton onClick={scanForDevices} size="small">
              <RefreshIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {availableDevices.length === 0 ? (
            <Alert severity="info">
              Nenhum dispositivo Chromecast encontrado na rede.
              Certifique-se de que os dispositivos estão conectados ao mesmo WiFi.
            </Alert>
          ) : (
            <List>
              {availableDevices.map((device) => (
                <ListItem 
                  key={device.id}
                  button
                  onClick={() => connectToDevice(device)}
                >
                  <ListItemIcon>
                    <CastIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={device.name}
                    secondary={device.type}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default CastManager;
