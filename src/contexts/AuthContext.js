import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from '../config/axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 401 handling centralized in src/config/axios.js to avoid double redirects

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        // Verificar se o token ainda é válido
        validateToken();
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const validateToken = async () => {
    try {
      const response = await axios.get('/auth/profile');
      setUser(response.data.user);
    } catch (error) {
      console.error('Token inválido:', error);
      logout();
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/auth/login', {
        email,
        password,
      });

      const { access_token, user: userData } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return { success: true, user: userData };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao fazer login';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/auth/profile', profileData);
      const updatedUser = response.data.user;
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao atualizar perfil';
      return { success: false, error: message };
    }
  };

  // Novo: criar usuário (admin)
  const registerUser = async ({ username, email, password, role = 'rh', company = 'iTracker' }) => {
    try {
      const response = await axios.post('/auth/register', {
        username,
        email,
        password,
        role,
        company,
      });
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao criar usuário';
      return { success: false, error: message };
    }
  };

  // Novo: cadastro público (sem senha, fica pendente)
  const publicRegister = async ({ username, email, role = 'rh', company = 'iTracker' }) => {
    try {
      const response = await axios.post('/auth/public-register', {
        username,
        email,
        role,
        company,
      });
      return { success: true, user: response.data.user, message: response.data?.message };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao enviar cadastro';
      return { success: false, error: message };
    }
  };

  // Novo: solicitar recuperação de senha
  const forgotPassword = async (email) => {
    try {
      const response = await axios.post('/auth/forgot-password', { email });
      return { success: true, message: response.data?.message };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao solicitar recuperação de senha';
      return { success: false, error: message };
    }
  };

  // Novo: trocar senha (primeiro acesso)
  const changePassword = async ({ old_password, new_password }) => {
    try {
      const response = await axios.post('/auth/change-password', { old_password, new_password });
      const updatedUser = response.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao alterar senha';
      return { success: false, error: message };
    }
  };

  // Admin: listar usuários pendentes
  const listPendingUsers = async () => {
    try {
      const response = await axios.get('/auth/pending-users');
      return { success: true, users: response.data.users };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao listar pendentes';
      return { success: false, error: message };
    }
  };

  // Admin: aprovar usuário (opcionalmente definindo senha temporária)
  const approveUser = async (userId, temp_password) => {
    try {
      const response = await axios.post(`/auth/users/${userId}/approve`, temp_password ? { temp_password } : {});
      return { success: true, user: response.data.user, temp_password: response.data?.temp_password };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao aprovar usuário';
      return { success: false, error: message };
    }
  };

  // Admin: rejeitar usuário
  const rejectUser = async (userId) => {
    try {
      const response = await axios.post(`/auth/users/${userId}/reject`);
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao rejeitar usuário';
      return { success: false, error: message };
    }
  };

  // Admin: definir/redefinir senha de usuário
  const adminSetPassword = async (userId, { new_password, must_change_password = false }) => {
    try {
      const response = await axios.post(`/auth/users/${userId}/set-password`, { new_password, must_change_password });
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao definir senha';
      return { success: false, error: message };
    }
  };

  // Admin: listar todos os usuários
  const listUsers = async () => {
    try {
      const response = await axios.get('/auth/users');
      return { success: true, users: response.data.users };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao listar usuários';
      return { success: false, error: message };
    }
  };

  // Admin: atualizar usuário (papel, empresa, ativo)
  const updateUser = async (userId, payload) => {
    try {
      const response = await axios.put(`/auth/users/${userId}`, payload);
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao atualizar usuário';
      return { success: false, error: message };
    }
  };

  // Admin: excluir usuário
  const deleteUser = async (userId) => {
    try {
      const response = await axios.delete(`/auth/users/${userId}`);
      return { success: true, message: response.data?.message || 'Usuário excluído' };
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao excluir usuário';
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    login,
    logout,
    updateProfile,
    registerUser,
    publicRegister,
    forgotPassword,
    changePassword,
    listPendingUsers,
    approveUser,
    rejectUser,
    adminSetPassword,
    loading,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager' || user?.role === 'admin',
    isHR: user?.role === 'rh',
    // Expose new admin helpers
    listUsers,
    updateUser,
    deleteUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
