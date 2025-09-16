import React, { createContext, useContext, useState, useEffect } from 'react';
import { createTheme } from '@mui/material/styles';

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
});

// Dark theme configuration with black background, orange text, white details
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff9800', // Orange
      contrastText: '#000000',
    },
    secondary: {
      main: '#ffffff', // White for details
      contrastText: '#000000',
    },
    background: {
      default: '#000000', // Pure black background
      paper: '#121212', // Slightly lighter black for cards/papers
    },
    text: {
      primary: '#ff9800', // Orange text
      secondary: '#ffffff', // White secondary text
    },
    divider: '#333333',
    action: {
      hover: '#1a1a1a',
      selected: '#2a2a2a',
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
    h1: {
      color: '#ff9800',
    },
    h2: {
      color: '#ff9800',
    },
    h3: {
      color: '#ff9800',
    },
    h4: {
      color: '#ff9800',
    },
    h5: {
      color: '#ff9800',
    },
    h6: {
      color: '#ff9800',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
          color: '#ff9800',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#000000',
          color: '#ff9800',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#121212',
          color: '#ff9800',
          border: '1px solid #333333',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#121212',
          color: '#ff9800',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          '&.MuiButton-contained': {
            backgroundColor: '#ff9800',
            color: '#000000',
            '&:hover': {
              backgroundColor: '#f57c00',
            },
          },
          '&.MuiButton-outlined': {
            borderColor: '#ff9800',
            color: '#ff9800',
            '&:hover': {
              backgroundColor: '#1a1a1a',
              borderColor: '#f57c00',
            },
          },
          '&.MuiButton-text': {
            color: '#ff9800',
            '&:hover': {
              backgroundColor: '#1a1a1a',
            },
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputLabel-root': {
            color: '#ffffff',
          },
          '& .MuiOutlinedInput-root': {
            color: '#ff9800',
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
          borderBottom: '1px solid #333333',
          color: '#ff9800',
        },
        head: {
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          fontWeight: 'bold',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#333333',
          color: '#ff9800',
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
          color: '#ff9800',
          '&:hover': {
            backgroundColor: '#1a1a1a',
          },
          '&.Mui-selected': {
            backgroundColor: '#2a2a2a',
            '&:hover': {
              backgroundColor: '#333333',
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: '#ffffff',
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: '#ff9800',
        },
        secondary: {
          color: '#ffffff',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#1a1a1a',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          '&.MuiAlert-standardError': {
            backgroundColor: '#1a1a1a',
            color: '#f44336',
          },
          '&.MuiAlert-standardWarning': {
            backgroundColor: '#1a1a1a',
            color: '#ff9800',
          },
          '&.MuiAlert-standardInfo': {
            backgroundColor: '#1a1a1a',
            color: '#2196f3',
          },
          '&.MuiAlert-standardSuccess': {
            backgroundColor: '#1a1a1a',
            color: '#4caf50',
          },
        },
      },
    },
  },
});

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme: currentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
