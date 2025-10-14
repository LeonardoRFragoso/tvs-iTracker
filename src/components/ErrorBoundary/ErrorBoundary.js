import React from 'react';
import { Box, Typography, Button, Alert, Container } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Ops! Algo deu errado
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Ocorreu um erro inesperado ao carregar esta página.
            </Typography>
          </Alert>
          
          <Box sx={{ mt: 2 }}>
            <Button 
              variant="contained" 
              onClick={() => window.location.reload()}
              startIcon={<RefreshIcon />}
              sx={{ mr: 2 }}
            >
              Recarregar Página
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => window.history.back()}
            >
              Voltar
            </Button>
          </Box>

          {process.env.NODE_ENV === 'development' && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Detalhes do Erro (Desenvolvimento):
              </Typography>
              <Typography variant="body2" component="pre" sx={{ fontSize: '0.8rem', overflow: 'auto' }}>
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo.componentStack}
              </Typography>
            </Box>
          )}
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
