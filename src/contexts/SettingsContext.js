import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from '../config/axios';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings deve ser usado dentro de um SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [settings, setSettings] = useState({});
  const [uiPreferences, setUiPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar preferências de UI (disponíveis para todos os usuários)
  const loadUiPreferences = async () => {
    try {
      const response = await axios.get('/settings/ui-preferences');
      const preferences = response.data.preferences || {};
      setUiPreferences(preferences);
      return preferences;
    } catch (err) {
      console.error('Erro ao carregar preferências de UI:', err);
      return {};
    }
  };

  // Carregar todas as configurações (apenas para admin)
  const loadAllSettings = async () => {
    if (!isAdmin) return;
    
    try {
      // Evitar flicker do skeleton em recarregamentos subsequentes
      if (Object.keys(settings).length === 0) setLoading(true);
      const response = await axios.get('/settings');
      setSettings(response.data.settings || {});
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      setError('Falha ao carregar configurações do sistema');
    } finally {
      setLoading(false);
    }
  };

  // Atualizar configurações
  const updateSettings = async (newSettings) => {
    if (!isAdmin) {
      setError('Apenas administradores podem atualizar configurações');
      return { success: false, error: 'Acesso negado' };
    }

    try {
      setLoading(true);
      const response = await axios.put('/settings', newSettings);
      
      // Atualizar estado local com as configurações atualizadas
      setSettings(prev => ({
        ...prev,
        ...response.data.updated
      }));
      
      // Se alguma configuração de UI foi atualizada, recarregar preferências
      const uiKeys = Object.keys(newSettings).filter(key => key.startsWith('ui.'));
      if (uiKeys.length > 0) {
        await loadUiPreferences();
      }
      
      setError(null);
      return { success: true, updated: response.data.updated };
    } catch (err) {
      const message = err.response?.data?.error || 'Erro ao atualizar configurações';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Redefinir configurações para os valores padrão
  const resetSettings = async () => {
    if (!isAdmin) {
      setError('Apenas administradores podem redefinir configurações');
      return { success: false, error: 'Acesso negado' };
    }

    try {
      setLoading(true);
      const response = await axios.post('/settings/reset');
      
      // Atualizar estado local com as configurações redefinidas
      setSettings(response.data.settings || {});
      
      // Recarregar preferências de UI
      await loadUiPreferences();
      
      setError(null);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Erro ao redefinir configurações';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Obter valor de uma configuração específica
  const getSetting = (key, defaultValue = null) => {
    if (key.startsWith('ui.')) {
      return uiPreferences[key] !== undefined ? uiPreferences[key] : defaultValue;
    }
    return settings[key] !== undefined ? settings[key] : defaultValue;
  };

  // Recarregar configurações quando o usuário mudar (consolida carregamentos)
  useEffect(() => {
    if (user) {
      // Sempre carregar preferências de UI
      loadUiPreferences();
      
      // Carregar todas as configurações apenas para admin
      if (isAdmin) {
        loadAllSettings();
      } else {
        setLoading(false);
      }
    }
  }, [user, isAdmin]);

  const value = {
    settings,
    uiPreferences,
    loading,
    error,
    getSetting,
    updateSettings,
    resetSettings,
    loadAllSettings,
    loadUiPreferences
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsContext;
