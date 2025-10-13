import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { Fade } from '@mui/material';
import { useNavigate } from 'react-router-dom';

/**
 * Componente de título de página padronizado com estilo visual consistente
 * 
 * @param {Object} props - Propriedades do componente
 * @param {string} props.title - Título principal da página
 * @param {string} [props.subtitle] - Subtítulo opcional da página
 * @param {React.ReactNode} [props.icon] - Ícone a ser exibido ao lado do título
 * @param {string} [props.backTo] - Caminho para navegação do botão voltar (se não fornecido, o botão não será exibido)
 * @param {React.ReactNode} [props.actions] - Ações adicionais a serem exibidas no cabeçalho (botões, etc)
 * @param {Object} [props.sx] - Estilos adicionais para o container
 */
const PageTitle = ({ title, subtitle, icon, backTo, actions, sx = {} }) => {
  const navigate = useNavigate();

  return (
    <Fade in timeout={800}>
      <Box 
        sx={{ 
          mb: 3, 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          ...sx
        }}
      >
        {backTo && (
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate(backTo)}
            variant="outlined"
            sx={{
              borderRadius: 2,
              background: (theme) => theme.palette.mode === 'dark' 
                ? 'linear-gradient(45deg, rgba(255,119,48,0.1) 0%, rgba(255,152,0,0.1) 100%)' 
                : 'linear-gradient(45deg, rgba(33,150,243,0.1) 0%, rgba(33,203,243,0.1) 100%)',
              border: (theme) => theme.palette.mode === 'dark'
                ? '1px solid rgba(255,119,48,0.3)'
                : '1px solid rgba(33,150,243,0.3)',
              color: (theme) => theme.palette.mode === 'dark' ? '#ff7730' : '#2196f3',
              '&:hover': {
                transform: 'scale(1.05)',
                background: (theme) => theme.palette.mode === 'dark' 
                  ? 'linear-gradient(45deg, rgba(255,119,48,0.2) 0%, rgba(255,152,0,0.2) 100%)' 
                  : 'linear-gradient(45deg, rgba(33,150,243,0.2) 0%, rgba(33,203,243,0.2) 100%)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            Voltar
          </Button>
        )}
        
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {icon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: (theme) => theme.palette.mode === 'dark' 
                    ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                    : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                  color: 'white',
                  fontSize: '20px',
                }}
              >
                {icon}
              </Box>
            )}
            <Typography 
              variant="h4" 
              component="h1"
              sx={{
                fontWeight: 600,
                background: (theme) => theme.palette.mode === 'dark' 
                  ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                  : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {title}
            </Typography>
          </Box>
          
          {subtitle && (
            <Typography 
              variant="subtitle1" 
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        
        {actions && (
          <Box sx={{ 
            display: 'flex', 
            gap: 1,
            alignSelf: { xs: 'flex-end', sm: 'center' },
            mt: { xs: 1, sm: 0 }
          }}>
            {actions}
          </Box>
        )}
      </Box>
    </Fade>
  );
};

export default PageTitle;
