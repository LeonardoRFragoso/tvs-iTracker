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
    if (user) {
      const token = localStorage.getItem('access_token');
      const socketInstance = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
        auth: {
          token: token
        },
        transports: ['polling'], // Usar apenas polling para evitar problemas de WebSocket
        upgrade: false, // Desabilitar upgrade automático para WebSocket
        rememberUpgrade: false,
        timeout: 20000,
        forceNew: true
      });

      socketInstance.on('connect', () => {
        console.log('Conectado ao servidor WebSocket');
        setConnected(true);
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
        setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Manter apenas 50 notificações
      });

      socketInstance.on('player_status_update', (data) => {
        // Atualizar status do player em tempo real
        console.log('Status do player atualizado:', data);
      });

      socketInstance.on('content_sync', (data) => {
        // Sincronização de conteúdo
        console.log('Sincronização de conteúdo:', data);
      });

      setSocket(socketInstance);

      return () => {
        socketInstance.disconnect();
      };
    }
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
