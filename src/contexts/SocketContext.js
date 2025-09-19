import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();
  const switchedToSameOriginRef = useRef(false);

  useEffect(() => {
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

    // Determine target URL for socket connection
    const envUrl = process.env.REACT_APP_SOCKET_URL; // if 'same-origin', force same-origin
    const proto = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port; // '' when 80
    const sameOrigin = `${proto}//${window.location.host}`; // includes port if present

    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isTVMode = !port || port === '80'; // production served on 80
    const isKiosk = window.location.pathname.startsWith('/kiosk/player/');
    const playerIdMatch = isKiosk ? window.location.pathname.match(/\/kiosk\/player\/(.+)$/) : null;
    const kioskPlayerId = playerIdMatch ? playerIdMatch[1].split('/')[0] : null;

    // Resolve target URL with sensible defaults:
    // 1) explicit env override wins
    // 2) kiosk/TV mode => same-origin (backend serves the SPA)
    // 3) localhost dev => :5000
    // 4) otherwise (LAN dev with CRA on 3000) => :5000
    let targetUrl = sameOrigin;
    if (envUrl) {
      targetUrl = envUrl === 'same-origin' ? sameOrigin : envUrl;
    } else if (isKiosk || isTVMode) {
      targetUrl = sameOrigin;
    } else if (isLocalhost) {
      targetUrl = 'http://localhost:5000';
    } else {
      targetUrl = `${proto}//${host}:5000`;
    }

    // Only connect if we are authenticated OR in kiosk mode
    if (!user && !isKiosk) return;

    const token = user ? localStorage.getItem('access_token') : null;

    const createSocket = (baseUrl) => {
      const socketInstance = io(baseUrl || undefined, {
        path: '/socket.io',
        auth: user ? { token } : { public: true, player_id: kioskPlayerId },
        transports: ['polling'],
        upgrade: false,
        rememberUpgrade: false,
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketInstance.on('connect', () => {
        console.log('Conectado ao servidor WebSocket', baseUrl);
        setConnected(true);
        // Auto-join player room in kiosk mode
        if (isKiosk && kioskPlayerId) {
          socketInstance.emit('join_player', { player_id: kioskPlayerId });
        }
      });

      socketInstance.on('disconnect', () => {
        console.log('Desconectado do servidor WebSocket');
        setConnected(false);
      });

      socketInstance.on('connect_error', (err) => {
        const msg = String(err?.message || err || '');
        const isConnRefused = /ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(msg);
        const using5000 = (baseUrl || '').includes(':5000');
        if (using5000 && isConnRefused && !switchedToSameOriginRef.current) {
          switchedToSameOriginRef.current = true;
          try { socketInstance.removeAllListeners(); } catch (_) {}
          try { socketInstance.disconnect(); } catch (_) {}
          const fallbackUrl = sameOrigin;
          console.warn('[Socket] Connection refused to :5000, switching to same-origin:', fallbackUrl);
          const newSock = createSocket(fallbackUrl);
          setSocket(newSock);
        }
      });

      socketInstance.on('connected', (data) => {
        console.log('WebSocket conectado:', data);
      });

      socketInstance.on('player_command', (data) => {
        console.log('Comando recebido:', data);
        // Processar comandos para players
      });

      socketInstance.on('notification', (notification) => {
        setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      });

      socketInstance.on('player_status_update', (data) => {
        console.log('Status do player atualizado:', data);
      });

      socketInstance.on('content_sync', (data) => {
        console.log('Sincronização de conteúdo:', data);
      });

      setSocket(socketInstance);
      return socketInstance;
    };

    const sock = createSocket(targetUrl);

    return () => {
      try { sock.disconnect(); } catch (_) {}
    };
  }, [user]);

  const joinPlayerRoom = (playerId) => {
    if (socket) {
      socket.emit('join_player', { player_id: playerId });
    }
  };

  const sendPlayerCommand = (playerId, command, data = {}) => {
    if (socket) {
      socket.emit('player_command', {
        player_id: playerId,
        command,
        data
      });
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => [
      {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...notification
      },
      ...prev.slice(0, 49)
    ]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const value = {
    socket,
    connected,
    notifications,
    joinPlayerRoom,
    sendPlayerCommand,
    addNotification,
    removeNotification,
    clearNotifications
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
