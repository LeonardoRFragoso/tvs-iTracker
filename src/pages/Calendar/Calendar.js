import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  ToggleButton, 
  ToggleButtonGroup, 
  LinearProgress, 
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Stack,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Badge
} from '@mui/material';
import { 
  CalendarToday, 
  Schedule, 
  PlayArrow, 
  Pause, 
  Refresh,
  Info,
  ViewWeek,
  ViewDay,
  ViewModule,
  FilterList,
  Tv,
  Image,
  VideoLibrary,
  MusicNote,
  ChevronLeft,
  ChevronRight,
  Today
} from '@mui/icons-material';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import axios from '../../config/axios';
import PageTitle from '../../components/Common/PageTitle';
import './Calendar.css';

const isoDate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Função para formatar data no padrão brasileiro
const formatBRDateTime = (date) => {
  if (!date) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const expandScheduleToEvents = (schedule, rangeStart, rangeEnd) => {
  if (!schedule || !schedule.start_date || !schedule.end_date) {
    return [];
  }
  const events = [];
  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0);
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59);

  // Converter datas do formato brasileiro para Date
  const parseBrDate = (dateStr) => {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');
    return new Date(year, month - 1, day, hour, minute, second);
  };

  const schedStart = parseBrDate(schedule.start_date);
  const schedEnd = parseBrDate(schedule.end_date);
  const effectiveStart = new Date(Math.max(start.getTime(), schedStart.getTime()));
  const effectiveEnd = new Date(Math.min(end.getTime(), schedEnd.getTime()));
  
  if (isNaN(effectiveStart) || isNaN(effectiveEnd) || effectiveStart > effectiveEnd) {
    return events;
  }

  const allowedDays = (schedule.days_of_week || '1,2,3,4,5')
    .split(',')
    .map((d) => {
      const day = parseInt(d.trim(), 10);
      if (day === 0) return 6; // Domingo
      return day; // Segunda=1, Terça=2, etc.
    })
    .filter((n) => !isNaN(n));

  const isAllDay = schedule.start_time === '00:00:00' && schedule.end_time === '23:59:59';
  
  // Parse dos horários com validação
  const startTimeParts = (schedule.start_time || '00:00:00').split(':');
  const endTimeParts = (schedule.end_time || '23:59:59').split(':');
  
  const [sh, sm, ss] = startTimeParts.map((v) => parseInt(v, 10) || 0);
  const [eh, em, es] = endTimeParts.map((v) => parseInt(v, 10) || 0);
  
  // Validação dos horários
  if (sh < 0 || sh > 23 || sm < 0 || sm > 59 || ss < 0 || ss > 59) {
    console.error('Horário de início inválido:', schedule.start_time);
    return [];
  }
  if (eh < 0 || eh > 23 || em < 0 || em > 59 || es < 0 || es > 59) {
    console.error('Horário de fim inválido:', schedule.end_time);
    return [];
  }

  // Função para obter ícone baseado no tipo de conteúdo
  const getContentIcon = () => {
    if (schedule.content_type === 'overlay') return '📌';
    if (schedule.campaign_name?.toLowerCase().includes('video')) return '🎬';
    if (schedule.campaign_name?.toLowerCase().includes('audio')) return '🎵';
    if (schedule.campaign_name?.toLowerCase().includes('image')) return '🖼️';
    return '📺';
  };

  // Função para calcular duração do evento
  const getEventDuration = () => {
    const [sh, sm] = (schedule.start_time || '00:00:00').split(':').map(Number);
    const [eh, em] = (schedule.end_time || '23:59:59').split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    const durationMinutes = endMinutes - startMinutes;
    
    if (durationMinutes >= 60) {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
    }
    return `${durationMinutes}m`;
  };

  // Função para aplicar cores baseada na lógica do SchedulesCalendar
  const getEventColors = () => {
    // Cores pastéis muito suaves e agradáveis
    const conflictColors = [
      { bg: '#bbdefb', border: '#90caf9' },  // Azul pastel
      { bg: '#f8bbd9', border: '#f48fb1' },  // Rosa pastel
      { bg: '#c8e6c9', border: '#a5d6a7' },  // Verde pastel
      { bg: '#ffe0b2', border: '#ffcc80' },  // Laranja pastel
      { bg: '#e1bee7', border: '#ce93d8' },  // Roxo pastel
      { bg: '#b2dfdb', border: '#80cbc4' },  // Ciano pastel
      { bg: '#d7ccc8', border: '#bcaaa4' },  // Marrom pastel
      { bg: '#cfd8dc', border: '#b0bec5' },  // Cinza pastel
      { bg: '#ffcdd2', border: '#ef9a9a' },  // Coral pastel
      { bg: '#dcedc8', border: '#c5e1a5' },  // Verde claro pastel
      { bg: '#fff9c4', border: '#fff176' },  // Amarelo pastel
      { bg: '#d1c4e9', border: '#b39ddb' }   // Violeta pastel
    ];
    
    // Overlay com cor pastel suave
    if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
      return { bg: '#d1c4e9', border: '#b39ddb' };
    }
    
    // Se tem color_index do backend, usar cores diferenciadas
    if (schedule.color_index !== undefined && schedule.color_index > 0) {
      const colorObj = conflictColors[schedule.color_index % conflictColors.length];
      return { bg: colorObj.bg, border: colorObj.border };
    }
    
    // Conflitos críticos com vermelho pastel
    if (schedule.conflict_type === 'conflict') {
      return { bg: '#ffcdd2', border: '#ef9a9a' };
    }
    
    // Cores baseadas na prioridade (pastéis)
    if (schedule.overlap_priority === 'overlap_top') {
      return { bg: '#c8e6c9', border: '#a5d6a7' };
    }
    
    if (schedule.overlap_priority === 'overlap_bottom') {
      return { bg: '#ffe0b2', border: '#ffcc80' };
    }
    
    // Cor padrão pastel
    return { bg: '#bbdefb', border: '#90caf9' };
  };

  const colors = getEventColors();

  for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    
    if (!allowedDays.includes(weekday)) continue;

    const icon = getContentIcon();
    const duration = getEventDuration();
    
    const baseEvent = {
      title: `${icon} ${schedule.name} (${schedule.player_name})`,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      extendedProps: {
        schedule_id: schedule.id,
        player_id: schedule.player_id,
        player_name: schedule.player_name,
        content_type: schedule.content_type,
        has_conflicts: schedule.has_conflicts,
        conflict_type: schedule.conflict_type,
        campaign_name: schedule.campaign_name,
        start_date: schedule.start_date,
        end_date: schedule.end_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        days_of_week: schedule.days_of_week,
        priority: schedule.priority,
        is_persistent: schedule.is_persistent,
        location_name: schedule.location_name,
        colorIndex: schedule.color_index,
        duration: duration,
        icon: icon
      },
      classNames: [
        schedule.color_index > 0 ? `color-index-${schedule.color_index}` : '',
        `event-type-${schedule.content_type || 'main'}`,
        schedule.has_conflicts ? 'has-conflict' : '',
        schedule.priority ? `priority-${schedule.priority}` : 'priority-medium',
        'high-contrast' // Para melhor acessibilidade
      ].filter(Boolean)
    };

    if (isAllDay) {
      events.push({
        ...baseEvent,
        id: `${schedule.id}-${isoDate(d)}-allday`,
        start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        allDay: true
      });
    } else if (sh <= eh) {
      // Janela no mesmo dia
      const startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, ss);
      const endDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em, es);
      
      console.log(`Criando evento: ${schedule.name} de ${formatBRDateTime(startDate)} até ${formatBRDateTime(endDate)}`);
      console.log(`Horários originais: ${schedule.start_time} até ${schedule.end_time}`);
      console.log(`Parsed: ${sh}:${sm}:${ss} até ${eh}:${em}:${es}`);
      
      events.push({
        ...baseEvent,
        id: `${schedule.id}-${isoDate(d)}`,
        start: startDate,
        end: endDate,
        allDay: false
      });
    } else {
      // Overnight: parte 1 no dia D
      const startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, ss);
      const endDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      
      events.push({
        ...baseEvent,
        id: `${schedule.id}-${isoDate(d)}-p1`,
        start: startDate,
        end: endDate,
        allDay: false
      });
      
      // Parte 2 no dia D+1
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      if (next <= effectiveEnd) {
        const nextStartDate = new Date(next.getFullYear(), next.getMonth(), next.getDate(), 0, 0, 0);
        const nextEndDate = new Date(next.getFullYear(), next.getMonth(), next.getDate(), eh, em, es);
        
        events.push({
          ...baseEvent,
          id: `${schedule.id}-${isoDate(next)}-p2`,
          start: nextStartDate,
          end: nextEndDate,
          allDay: false
        });
      }
    }
  }

  // Debug: log dos dados do schedule e eventos criados
  console.log('Schedule data:', {
    name: schedule.name,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    start_date: schedule.start_date,
    end_date: schedule.end_date,
    parsed_times: { sh, sm, ss, eh, em, es }
  });
  
  if (events.length > 0) {
    console.log('Eventos criados para o calendário:', events.slice(0, 2));
    console.log('Primeiro evento detalhado:', {
      id: events[0].id,
      title: events[0].title,
      start: events[0].start,
      end: events[0].end,
      allDay: events[0].allDay,
      startType: typeof events[0].start,
      endType: typeof events[0].end
    });
  }

  return events;
}

// Função para calcular o horário de scroll baseado no horário atual
const getCurrentTimeForScroll = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Se for muito cedo (antes das 6h), mostrar 6h
  if (currentHour < 6) {
    return '06:00:00';
  }
  
  // Se for muito tarde (depois das 22h), mostrar 18h
  if (currentHour > 22) {
    return '18:00:00';
  }
  
  // Arredondar para a hora mais próxima, mas mostrar 1h antes para contexto
  let scrollHour = currentHour;
  if (currentMinute > 30) {
    scrollHour = Math.min(currentHour, 23); // Não passar das 23h
  } else {
    scrollHour = Math.max(currentHour - 1, 0); // Não ir abaixo de 0h
  }
  
  return `${String(scrollHour).padStart(2, '0')}:00:00`;
};

const Calendar = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [view, setView] = useState('timeGridWeek');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(() => {
    // Recuperar filtro salvo do localStorage
    return localStorage.getItem('calendar-selected-player') || '';
  });
  const [totalSchedules, setTotalSchedules] = useState(0);
  const calendarRef = useRef(null);

  // Buscar lista de players
  const fetchPlayers = async () => {
    try {
      const res = await axios.get('/players?per_page=1000');
      const playersList = res.data.players || [];
      setPlayers(playersList);
      
      // Verificar se o player selecionado ainda existe
      if (selectedPlayer && !playersList.find(p => p.id === selectedPlayer)) {
        console.log('[Calendar] Player selecionado não existe mais, limpando filtro');
        setSelectedPlayer('');
        localStorage.removeItem('calendar-selected-player');
      }
    } catch (err) {
      console.error('[Calendar] Error fetching players:', err);
    }
  };

  const fetchRange = async (start, end, playerIdOverride) => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        start: `${start.getDate().toString().padStart(2,'0')}/${(start.getMonth()+1).toString().padStart(2,'0')}/${start.getFullYear()}`,
        end: `${end.getDate().toString().padStart(2,'0')}/${(end.getMonth()+1).toString().padStart(2,'0')}/${end.getFullYear()}`,
        is_active: 'true'
      });

      const effectivePlayerId = (playerIdOverride ?? selectedPlayer);
      if (effectivePlayerId) {
        params.append('player_id', effectivePlayerId);
      }

      console.log('[Calendar] Fazendo requisição:', `/schedules/range?${params.toString()}`);
      console.log('[Calendar] Player efetivo para filtro:', effectivePlayerId);
      console.log('[Calendar] Player selecionado (state):', selectedPlayer);
      console.log('[Calendar] Tipo do selectedPlayer:', typeof selectedPlayer);
      console.log('[Calendar] selectedPlayer vazio?', !selectedPlayer);
      console.log('[Calendar] Parâmetros da URL:', Object.fromEntries(params));

      const res = await axios.get(`/schedules/range?${params.toString()}`);
      const schedules = res.data.schedules || [];
      
      console.log('[Calendar] Agendamentos recebidos:', schedules.length);
      schedules.forEach(s => {
        console.log(`[Calendar] - ${s.name} (Player: ${s.player_name}, ID: ${s.player_id})`);
      });
      
      setTotalSchedules(schedules.length);

      const expanded = schedules.flatMap((s) => expandScheduleToEvents(s, start, end));
      setEvents(expanded);
    } catch (err) {
      console.error('[Calendar] Error fetching schedules:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao carregar calendário');
    } finally {
      setLoading(false);
    }
  };

  const handleDatesSet = (arg) => {
    const start = new Date(arg.start);
    const end = new Date(arg.end);
    end.setDate(end.getDate() - 1);
    fetchRange(start, end, selectedPlayer);
  };

  const handleViewChange = (newView) => {
    if (!newView) return;
    setView(newView);

    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      if (calendarApi) {
        calendarApi.changeView(newView);
      }
    }
    
    // Após mudar a view, rolar para o horário atual se for uma view de tempo
    setTimeout(() => {
      if (calendarRef.current && (newView === 'timeGridWeek' || newView === 'timeGridDay')) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.scrollToTime(getCurrentTimeForScroll());
      }
    }, 100);
  };

  const handlePlayerFilter = (playerId) => {
    console.log('[Calendar] Filtro alterado para player:', playerId);
    setSelectedPlayer(playerId);
    
    // Salvar filtro no localStorage
    if (playerId) {
      localStorage.setItem('calendar-selected-player', playerId);
    } else {
      localStorage.removeItem('calendar-selected-player');
    }
    
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const start = new Date(calendarApi.view.activeStart);
      const end = new Date(calendarApi.view.activeEnd);
      end.setDate(end.getDate() - 1);
      console.log('[Calendar] Recarregando calendário com novo filtro...', playerId);
      fetchRange(start, end, playerId);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  // Scroll inicial para o horário atual quando o calendário carrega
  useEffect(() => {
    const timer = setTimeout(() => {
      if (calendarRef.current && (view === 'timeGridWeek' || view === 'timeGridDay')) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.scrollToTime(getCurrentTimeForScroll());
      }
    }, 500); // Aguarda o calendário renderizar completamente

    return () => clearTimeout(timer);
  }, [view, events]); // Executa quando a view ou eventos mudam

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: theme.palette.background.default,
        p: 2
      }}
    >
      {/* Header Compacto estilo Teams */}
      <Box
        sx={{
          background: theme.palette.background.paper,
          borderRadius: 2,
          p: 2,
          mb: 2,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.shadows[1],
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarToday sx={{ fontSize: 20, color: 'white' }} />
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 600,
                color: theme.palette.text.primary,
                mb: 0.5,
              }}
            >
              Calendário de Agendamentos
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.secondary,
                fontWeight: 400,
              }}
            >
              Visualize e gerencie todos os agendamentos
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Chip
              icon={<Schedule />}
              label={`${totalSchedules}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <IconButton
              size="small"
              onClick={() => window.location.reload()}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  color: theme.palette.primary.main,
                },
              }}
            >
              <Refresh fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Filtros e Controles */}
      <Paper 
        elevation={1} 
        sx={{ 
          mb: 2, 
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ position: 'relative' }}>
                <Typography
                  variant="body2"
                  sx={{
                    mb: 1,
                    fontWeight: 500,
                    color: theme.palette.text.secondary,
                  }}
                >
                  Filtrar por Player
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={selectedPlayer}
                    onChange={(e) => handlePlayerFilter(e.target.value)}
                    displayEmpty
                    sx={{ 
                      borderRadius: 2,
                    }}
                  >
                    <MenuItem value="">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tv sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                        <Typography variant="body2">
                          Todos os Players
                        </Typography>
                      </Box>
                    </MenuItem>
                    {players.map(player => (
                      <MenuItem key={player.id} value={player.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                          <Tv sx={{ 
                            fontSize: 16, 
                            color: player.is_online ? 'success.main' : 'text.secondary' 
                          }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2">
                              {player.name}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: player.is_online ? 'success.main' : 'grey.400',
                            }}
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={1}>
                  {selectedPlayer && (
                    <Chip 
                      label={players.find(p => p.id === selectedPlayer)?.name || 'Player'} 
                      size="small"
                      onDelete={() => handlePlayerFilter('')}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  
                  <Typography variant="body2" color="text.secondary">
                    {totalSchedules} eventos
                  </Typography>
                </Stack>
                
                <ToggleButtonGroup
                  value={view}
                  exclusive
                  onChange={(e, v) => v && handleViewChange(v)}
                  size="small"
                >
                  <ToggleButton value="dayGridMonth">
                    <ViewModule sx={{ fontSize: 16 }} />
                  </ToggleButton>
                  <ToggleButton value="timeGridWeek">
                    <ViewWeek sx={{ fontSize: 16 }} />
                  </ToggleButton>
                  <ToggleButton value="timeGridDay">
                    <ViewDay sx={{ fontSize: 16 }} />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Paper>

      {/* Estados de Loading e Erro */}
      {loading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: 'text.secondary' }}>
            Carregando agendamentos...
          </Typography>
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Calendário Principal */}
      <Paper 
        elevation={1} 
        sx={{ 
          borderRadius: 2, 
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          headerToolbar={{ 
            left: 'prev,next today', 
            center: 'title', 
            right: '' 
          }}
          datesSet={handleDatesSet}
          events={events}
          height="calc(100vh - 240px)"
          locale="pt-br"
          allDaySlot={true}
          nowIndicator={true}
          slotMinTime={'00:00:00'}
          slotMaxTime={'24:00:00'}
          slotDuration={view === 'timeGridDay' ? '00:15:00' : '00:30:00'}
          slotLabelInterval={'01:00:00'}
          firstDay={1}
          expandRows={true}
          eventMinHeight={20}
          eventShortHeight={20}
          displayEventTime={true}
          displayEventEnd={true}
          scrollTime={getCurrentTimeForScroll()}
          dayMaxEvents={view === 'dayGridMonth' ? 4 : false}
          moreLinkClick={view === 'dayGridMonth' ? 'popover' : undefined}
          eventClick={(info) => {
            const scheduleId = info.event.extendedProps?.schedule_id 
              || (info.event.id ? String(info.event.id).split('-')[0] : null);
            if (scheduleId) {
              try {
                localStorage.setItem('schedule_returnTo', '/calendar');
                localStorage.setItem('schedule_from', 'calendar');
              } catch (e) {}
              const editPath = `/schedules/${scheduleId}/edit?from=calendar&returnTo=${encodeURIComponent('/calendar')}`;
              navigate(editPath, {
                state: {
                  returnTo: '/calendar',
                  from: 'calendar',
                  calendar: { selectedPlayer }
                }
              });
            } else {
              navigate('/schedules');
            }
          }}
          eventDidMount={(info) => {
            // Adicionar tooltip com informações detalhadas
            const props = info.event.extendedProps;
            const tooltip = [
              `📺 Player: ${props.player_name}`,
              `🎬 Campanha: ${props.campaign_name || 'N/A'}`,
              `⏱️ Duração: ${props.duration}`,
              `📍 Local: ${props.location_name || 'N/A'}`,
              `🔄 Tipo: ${props.content_type === 'overlay' ? 'Sobreposição' : 'Principal'}`,
              props.has_conflicts ? '⚠️ Possui conflitos' : '✅ Sem conflitos'
            ].join('\n');
            
            info.el.setAttribute('title', tooltip);
            
            // Adicionar badge de duração para eventos não all-day
            if (!info.event.allDay && props.duration) {
              const durationBadge = document.createElement('span');
              durationBadge.className = 'event-duration-badge';
              durationBadge.textContent = props.duration;
              
              const titleEl = info.el.querySelector('.fc-event-title');
              if (titleEl) {
                titleEl.appendChild(durationBadge);
              }
            }
          }}
          buttonText={{
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia'
          }}
          dayHeaderFormat={{ weekday: 'short' }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
          eventContent={(arg) => {
            const props = arg.event.extendedProps;
            return {
              html: `
                <div class="fc-event-main">
                  <div class="event-status-indicator event-status-active"></div>
                  <span class="event-icon">${props.icon}</span>
                  <span class="fc-event-title">${arg.event.title.replace(props.icon + ' ', '')}</span>
                  ${!arg.event.allDay && props.duration ? `<span class="event-duration-badge">${props.duration}</span>` : ''}
                </div>
              `
            };
          }}
        />
      </Paper>
    </Box>
  );
};

export default Calendar;
