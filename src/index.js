import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './config/axios'; // Import axios configuration
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import App from './App';

const AppWithTheme = () => {
  const { theme } = useTheme();
  
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </MuiThemeProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));

// Detect base path: production is served under /app, dev usually at /
const baseName = window.location.pathname.startsWith('/app') ? '/app' : '/';

root.render(
  <React.StrictMode>
    <BrowserRouter
      basename={baseName}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <AppWithTheme />
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register Service Worker for offline media caching (uploads)
// Use root scope so the SW can intercept /uploads/* even when the SPA runs under /app
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    try {
      const swPath = '/sw.js';
      navigator.serviceWorker
        .register(swPath, { scope: '/' })
        .then((reg) => {
          console.log('[SW] Registered:', swPath, 'scope:', reg.scope);
        })
        .catch((err) => {
          // Em dev (porta 3000) esse caminho pode não existir; é ok falhar silenciosamente
          console.log('[SW] Registration failed:', err?.message || err);
        });
    } catch (e) {
      // silencioso
    }
  });
}
