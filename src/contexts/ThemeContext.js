import React, { createContext, useContext, useState, useEffect } from 'react';
import { createTheme } from '@mui/material/styles';
import { useSettings } from './SettingsContext';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Light theme configuration
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#dc004e',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#000000',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

// Dark theme configuration with clean black/white and orange accents only
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff9800', // Orange accent only
      contrastText: '#000000',
    },
    secondary: {
      main: '#ffffff',
      contrastText: '#000000',
    },
    background: {
      default: '#121212', // Clean dark background
      paper: '#1a1a1a',   // Slightly lighter for surfaces
    },
    text: {
      primary: '#ffffff',     // White text
      secondary: '#b3b3b3',   // Muted secondary text
    },
    divider: '#2a2a2a',
    action: {
      hover: '#1e1e1e',
      selected: '#232323',
      disabled: '#666666',
    },
    error: {
      main: '#f44336',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ff9800',
      contrastText: '#000000',
    },
    info: {
      main: '#2196f3',
      contrastText: '#ffffff',
    },
    success: {
      main: '#4caf50',
      contrastText: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { color: '#ffffff' },
    h2: { color: '#ffffff' },
    h3: { color: '#ffffff' },
    h4: { color: '#ffffff' },
    h5: { color: '#ffffff' },
    h6: { color: '#ffffff' },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#121212',
          color: '#ffffff',
          borderBottom: '1px solid #2a2a2a',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#151515',
          color: '#ffffff',
          borderRight: '1px solid #2a2a2a',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          border: '1px solid #2a2a2a',
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
        containedPrimary: {
          backgroundColor: '#ff9800',
          color: '#000000',
          '&:hover': { backgroundColor: '#f57c00' },
        },
        outlined: {
          borderColor: '#b3b3b3',
          color: '#ffffff',
          '&:hover': {
            borderColor: '#ff9800',
            backgroundColor: '#1e1e1e',
          },
        },
        text: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#1e1e1e',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputLabel-root': {
            color: '#b3b3b3',
          },
          '& .MuiOutlinedInput-root': {
            color: '#ffffff',
            '& fieldset': {
              borderColor: '#333333',
            },
            '&:hover fieldset': {
              borderColor: '#ff9800',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#ff9800',
            },
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #2a2a2a',
          color: '#ffffff',
        },
        head: {
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
          fontWeight: 'bold',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#262626',
          color: '#ffffff',
          '&.MuiChip-colorPrimary': {
            backgroundColor: '#ff9800',
            color: '#000000',
          },
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#1e1e1e',
          },
          '&.Mui-selected': {
            backgroundColor: '#232323',
            '&:hover': { backgroundColor: '#262626' },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { color: '#bdbdbd' },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: { color: '#ffffff' },
        secondary: { color: '#b3b3b3' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&:hover': { backgroundColor: '#1e1e1e' },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
        },
        standardError: { color: '#f44336' },
        standardWarning: { color: '#ff9800' },
        standardInfo: { color: '#2196f3' },
        standardSuccess: { color: '#4caf50' },
      },
    },
  },
});

export const ThemeProvider = ({ children }) => {
  const { getSetting, updateSettings, uiPreferences } = useSettings();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // 1) LocalStorage (persistência imediata entre reloads)
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return JSON.parse(saved);
    // 2) Preferências de UI vindas do backend (sem exigir admin)
    const pref = (uiPreferences && uiPreferences['ui.dark_theme']);
    if (typeof pref === 'boolean') return pref;
    // 3) Fallback via getSetting
    return getSetting('ui.dark_theme', false);
  });

  // Preferências de animação globais
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    const pref = uiPreferences && uiPreferences['ui.animations_enabled'];
    if (typeof pref === 'boolean') return pref;
    return getSetting('ui.animations_enabled', true);
  });
  const [transitionDuration, setTransitionDuration] = useState(() => {
    const pref = uiPreferences && uiPreferences['ui.transition_duration'];
    if (typeof pref === 'number') return pref;
    return getSetting('ui.transition_duration', 300);
  });

  // Efeito para sincronizar o tema sempre que uiPreferences mudar, mas sem sobrepor a escolha local
  useEffect(() => {
    const darkPref = uiPreferences ? uiPreferences['ui.dark_theme'] : undefined;
    const hasLocal = localStorage.getItem('darkMode') !== null;
    if (!hasLocal && typeof darkPref === 'boolean' && darkPref !== isDarkMode) {
      setIsDarkMode(darkPref);
    }
    const animPref = uiPreferences ? uiPreferences['ui.animations_enabled'] : undefined;
    if (typeof animPref === 'boolean') setAnimationsEnabled(animPref);
    const durPref = uiPreferences ? uiPreferences['ui.transition_duration'] : undefined;
    if (typeof durPref === 'number') setTransitionDuration(durPref);
  }, [uiPreferences]);

  // Salvar no localStorage para compatibilidade com versões anteriores
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleTheme = async () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    
    // Atualizar a configuração no sistema (ignorar erros p/ usuários não-admin)
    try {
      await updateSettings({ 'ui.dark_theme': newValue });
    } catch (error) {
      console.error('Erro ao salvar preferência de tema:', error);
    }
  };

  const toggleAnimations = async () => {
    const newValue = !animationsEnabled;
    setAnimationsEnabled(newValue);
    try {
      await updateSettings({ 'ui.animations_enabled': newValue });
    } catch (error) {
      console.error('Erro ao salvar preferência de animações:', error);
    }
  };

  const updateTransitionDuration = async (value) => {
    setTransitionDuration(value);
    try {
      await updateSettings({ 'ui.transition_duration': value });
    } catch (error) {
      console.error('Erro ao salvar duração de transições:', error);
    }
  };

  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme: currentTheme, animationsEnabled, transitionDuration, toggleAnimations, updateTransitionDuration }}>
      {children}
    </ThemeContext.Provider>
  );
};
