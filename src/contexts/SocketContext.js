import React, { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const defaultSocketUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
    const socketUrl = process.env.REACT_APP_SOCKET_URL || defaultSocketUrl;

    const isKiosk = window.location.pathname.startsWith('/kiosk/player/');
    const playerIdMatch = isKiosk ? window.location.pathname.match(/\/kiosk\/player\/(.+)$/) : null;
    const kioskPlayerId = playerIdMatch ? playerIdMatch[1].split('/')[0] : null;

    // Only connect if we are authenticated OR in kiosk mode
    if (!user && !isKiosk) return;

    const token = user ? localStorage.getItem('access_token') : null;

    const socketInstance = io(socketUrl, {
      auth: user ? { token } : { public: true, player_id: kioskPlayerId },
      transports: isDev ? ['polling'] : ['websocket', 'polling'],
      upgrade: !isDev,
      rememberUpgrade: !isDev,
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('Conectado ao servidor WebSocket');
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

    return () => {
      socketInstance.disconnect();
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
