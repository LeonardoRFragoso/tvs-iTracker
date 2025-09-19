import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './config/axios'; // Import axios configuration
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
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
      <ThemeProvider>
        <AppWithTheme />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
