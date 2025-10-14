import React from 'react';
import {
  Box,
  IconButton,
  Typography,
  Chip,
  Stack,
  useTheme,
  Tooltip,
  Fade
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today,
  CalendarMonth,
  ViewWeek,
  ViewDay
} from '@mui/icons-material';

const CalendarNavigation = ({ 
  currentDate, 
  view, 
  onPrevious, 
  onNext, 
  onToday, 
  onViewChange,
  totalEvents = 0,
  activeFilters = []
}) => {
  const theme = useTheme();

  const formatTitle = () => {
    const options = {
      dayGridMonth: { month: 'long', year: 'numeric' },
      timeGridWeek: { day: 'numeric', month: 'long', year: 'numeric' },
      timeGridDay: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    };

    const formatter = new Intl.DateTimeFormat('pt-BR', options[view] || options.dayGridMonth);
    return formatter.format(currentDate);
  };

  const getViewIcon = (viewType) => {
    switch (viewType) {
      case 'dayGridMonth': return <CalendarMonth />;
      case 'timeGridWeek': return <ViewWeek />;
      case 'timeGridDay': return <ViewDay />;
      default: return <CalendarMonth />;
    }
  };

  const isToday = () => {
    const today = new Date();
    const current = new Date(currentDate);
    
    if (view === 'dayGridMonth') {
      return today.getMonth() === current.getMonth() && today.getFullYear() === current.getFullYear();
    } else if (view === 'timeGridDay') {
      return today.toDateString() === current.toDateString();
    } else {
      // timeGridWeek
      const startOfWeek = new Date(current);
      startOfWeek.setDate(current.getDate() - current.getDay() + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      return today >= startOfWeek && today <= endOfWeek;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)'
          : 'linear-gradient(135deg, rgba(33,150,243,0.08) 0%, rgba(33,203,243,0.02) 100%)',
        borderRadius: 2,
        mb: 2,
        border: `1px solid ${theme.palette.divider}`,
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Navegação Esquerda */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title="Período anterior">
          <IconButton
            onClick={onPrevious}
            sx={{
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
              color: theme.palette.primary.contrastText,
              '&:hover': {
                background: `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                transform: 'translateY(-1px)',
                boxShadow: theme.shadows[4]
              },
              transition: 'all 0.2s ease'
            }}
          >
            <ChevronLeft />
          </IconButton>
        </Tooltip>

        <Tooltip title={isToday() ? 'Já está no período atual' : 'Ir para hoje'}>
          <span>
            <IconButton
              onClick={onToday}
              disabled={isToday()}
              sx={{
                background: isToday() 
                  ? theme.palette.action.disabled
                  : `linear-gradient(45deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`,
                color: isToday() 
                  ? theme.palette.action.disabled
                  : theme.palette.secondary.contrastText,
                '&:hover': !isToday() && {
                  background: `linear-gradient(45deg, ${theme.palette.secondary.dark}, ${theme.palette.secondary.main})`,
                  transform: 'translateY(-1px)',
                  boxShadow: theme.shadows[4]
                },
                transition: 'all 0.2s ease'
              }}
            >
              <Today />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Próximo período">
          <IconButton
            onClick={onNext}
            sx={{
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
              color: theme.palette.primary.contrastText,
              '&:hover': {
                background: `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                transform: 'translateY(-1px)',
                boxShadow: theme.shadows[4]
              },
              transition: 'all 0.2s ease'
            }}
          >
            <ChevronRight />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Título Central */}
      <Box sx={{ textAlign: 'center', flex: 1 }}>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            fontWeight: 700,
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            textTransform: 'capitalize',
            mb: 0.5
          }}
        >
          {formatTitle()}
        </Typography>
        
        {/* Indicadores de Status */}
        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
          {totalEvents > 0 && (
            <Fade in timeout={500}>
              <Chip
                label={`${totalEvents} eventos`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontSize: '11px', height: 24 }}
              />
            </Fade>
          )}
          
          {activeFilters.map((filter, index) => (
            <Fade in timeout={500 + index * 100} key={filter.id}>
              <Chip
                label={filter.label}
                size="small"
                color="secondary"
                variant="filled"
                onDelete={filter.onRemove}
                sx={{ fontSize: '11px', height: 24 }}
              />
            </Fade>
          ))}

          {isToday() && (
            <Fade in timeout={800}>
              <Chip
                label="Atual"
                size="small"
                color="success"
                variant="outlined"
                sx={{ 
                  fontSize: '11px', 
                  height: 24,
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                    '100%': { opacity: 1 }
                  }
                }}
              />
            </Fade>
          )}
        </Stack>
      </Box>

      {/* Seletor de Visualização */}
      <Stack direction="row" spacing={0.5}>
        {['dayGridMonth', 'timeGridWeek', 'timeGridDay'].map((viewType) => (
          <Tooltip 
            key={viewType} 
            title={
              viewType === 'dayGridMonth' ? 'Visualização mensal' :
              viewType === 'timeGridWeek' ? 'Visualização semanal' :
              'Visualização diária'
            }
          >
            <IconButton
              onClick={() => onViewChange(viewType)}
              sx={{
                background: view === viewType 
                  ? `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`
                  : 'transparent',
                color: view === viewType 
                  ? theme.palette.primary.contrastText
                  : theme.palette.text.secondary,
                border: view === viewType 
                  ? 'none'
                  : `1px solid ${theme.palette.divider}`,
                '&:hover': {
                  background: view === viewType
                    ? `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`
                    : theme.palette.action.hover,
                  transform: 'translateY(-1px)',
                  boxShadow: theme.shadows[2]
                },
                transition: 'all 0.2s ease',
                minWidth: 40,
                height: 40
              }}
            >
              {getViewIcon(viewType)}
            </IconButton>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
};

export default CalendarNavigation;
