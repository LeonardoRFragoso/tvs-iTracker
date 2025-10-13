import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
  useTheme
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
  Warning
} from '@mui/icons-material';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import axios from '../../config/axios';

const isoDate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Função para verificar se dois eventos se sobrepõem
const eventsOverlap = (event1, event2) => {
  const start1 = new Date(event1.start).getTime();
  const end1 = new Date(event1.end).getTime();
  const start2 = new Date(event2.start).getTime();
  const end2 = new Date(event2.end).getTime();
  
  // Eventos se sobrepõem se:
  // - start1 está entre start2 e end2, OU
  // - start2 está entre start1 e end1, OU
  // - um contém completamente o outro
  return (start1 < end2 && start2 < end1);
};

// Função para detectar e marcar sobreposições
const detectOverlaps = (events) => {
  console.log(`[Calendar] Detecting overlaps for ${events.length} events`);
  
  const eventsWithOverlap = events.map((event, index) => ({
    ...event,
    hasOverlap: false,
    overlapLevel: 0,
    originalIndex: index,
    overlappingWith: []
  }));

  // Comparar cada evento com todos os outros
  for (let i = 0; i < eventsWithOverlap.length; i++) {
    for (let j = i + 1; j < eventsWithOverlap.length; j++) {
      if (eventsOverlap(eventsWithOverlap[i], eventsWithOverlap[j])) {
        eventsWithOverlap[i].hasOverlap = true;
        eventsWithOverlap[j].hasOverlap = true;
        eventsWithOverlap[i].overlapLevel++;
        eventsWithOverlap[j].overlapLevel++;
        eventsWithOverlap[i].overlappingWith.push(eventsWithOverlap[j].scheduleId);
        eventsWithOverlap[j].overlappingWith.push(eventsWithOverlap[i].scheduleId);
      }
    }
  }

  // Aplicar cores baseadas na sobreposição
  return eventsWithOverlap.map(event => {
    if (!event.hasOverlap) {
      // Evento sem sobreposição - azul padrão
      return {
        ...event,
        color: '#1976d2',
        backgroundColor: '#1976d2',
        borderColor: '#1565c0',
        textColor: '#ffffff'
      };
    } else {
      // Eventos com sobreposição - cores diferentes baseadas no índice original
      const colors = [
        { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'vermelho' },    // Primeiro evento sobreposto
        { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'verde' },        // Segundo evento sobreposto
        { bg: '#ff9800', border: '#f57c00', text: '#ffffff', name: 'laranja' },      // Terceiro evento sobreposto
        { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'roxo' },         // Quarto evento sobreposto
        { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'ciano' },        // Quinto evento sobreposto
        { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'rosa' },         // Sexto evento sobreposto
        { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'marrom' },       // Sétimo evento sobreposto
        { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'cinza-azul' },   // Oitavo evento sobreposto
      ];
      
      // Usar scheduleId para consistência de cores entre o mesmo agendamento
      const colorIndex = (event.scheduleId || event.originalIndex) % colors.length;
      const selectedColor = colors[colorIndex] || colors[0];
      
      return {
        ...event,
        color: selectedColor.bg,
        backgroundColor: selectedColor.bg,
        borderColor: selectedColor.border,
        textColor: selectedColor.text,
        extendedProps: {
          ...event.extendedProps,
          hasOverlap: true,
          overlapLevel: event.overlapLevel,
          colorName: selectedColor.name,
          overlappingWith: event.overlappingWith
        }
      };
    }
  });
};

function expandScheduleToEvents(schedule, rangeStart, rangeEnd) {
  console.log(`[Calendar] Expanding schedule "${schedule.name}":`, {
    id: schedule.id,
    start_date: schedule.start_date,
    end_date: schedule.end_date,
    days_of_week: schedule.days_of_week,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    rangeStart,
    rangeEnd
  });
  
  const events = [];
  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0);
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59);

  // Converter datas do formato brasileiro para Date
  const parseBrDate = (dateStr) => {
    // Formato: "09/10/2025 00:00:00" ou "16/10/2025 23:59:59"
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');
    return new Date(year, month - 1, day, hour, minute, second);
  };

  const schedStart = parseBrDate(schedule.start_date);
  const schedEnd = parseBrDate(schedule.end_date);
  const effectiveStart = new Date(Math.max(start.getTime(), schedStart.getTime()));
  const effectiveEnd = new Date(Math.min(end.getTime(), schedEnd.getTime()));
  
  console.log(`[Calendar] Date ranges:`, {
    start,
    end,
    schedStart,
    schedEnd,
    effectiveStart,
    effectiveEnd
  });
  
  if (isNaN(effectiveStart) || isNaN(effectiveEnd) || effectiveStart > effectiveEnd) {
    console.log(`[Calendar] No overlap or invalid dates, returning empty events`);
    return events;
  }

  // Converter dias da semana do formato do banco (1=Segunda, 2=Terça, etc.) 
  // para o formato JavaScript (0=Domingo, 1=Segunda, etc.)
  const allowedDays = (schedule.days_of_week || '1,2,3,4,5')
    .split(',')
    .map((d) => {
      const day = parseInt(d.trim(), 10);
      // Manter o formato: se 0 = Domingo, converter para 0 no JS
      // Se 1-6, manter (1=Segunda, ..., 6=Sábado no formato do banco)
      if (day === 0) return 0; // Domingo
      return day; // 1=Segunda, 2=Terça, etc.
    })
    .filter((n) => !isNaN(n));

  console.log(`[Calendar] Allowed days:`, allowedDays);

  const isAllDay = schedule.start_time === '00:00:00' && schedule.end_time === '23:59:59';
  const [sh, sm, ss] = (schedule.start_time || '00:00:00').split(':').map((v) => parseInt(v, 10) || 0);
  const [eh, em, es] = (schedule.end_time || '23:59:59').split(':').map((v) => parseInt(v, 10) || 0);

  console.log(`[Calendar] Time settings:`, {
    isAllDay,
    startTime: `${sh}:${sm}:${ss}`,
    endTime: `${eh}:${em}:${es}`
  });

  for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    console.log(`[Calendar] Checking day ${d.toDateString()}, weekday: ${weekday}, allowed: ${allowedDays.includes(weekday)}`);
    
    if (!allowedDays.includes(weekday)) continue;

    if (isAllDay) {
      events.push({
        id: `${schedule.id}-${isoDate(d)}-allday`,
        title: schedule.name,
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        allDay: true,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
      });
    } else if (sh <= eh) {
      // Janela no mesmo dia
      events.push({
        id: `${schedule.id}-${isoDate(d)}`,
        title: schedule.name,
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, ss),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em, es),
        allDay: false,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
      });
    } else {
      // Overnight: parte 1 no dia D
      events.push({
        id: `${schedule.id}-${isoDate(d)}-p1`,
        title: schedule.name,
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, ss),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        allDay: false,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
      });
      // Parte 2 no dia D+1
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
      if (next <= effectiveEnd) {
        events.push({
          id: `${schedule.id}-${isoDate(next)}-p2`,
          title: schedule.name,
          start: new Date(next.getFullYear(), next.getMonth(), next.getDate(), 0, 0, 0),
          end: new Date(next.getFullYear(), next.getMonth(), next.getDate(), eh, em, es),
          allDay: false,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
        });
      }
    }
  }

  console.log(`[Calendar] Generated ${events.length} events for schedule "${schedule.name}"`);
  return events;
}

const ScheduleCalendar = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const [view, setView] = useState('timeGridWeek');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [playerInfo, setPlayerInfo] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [totalSchedules, setTotalSchedules] = useState(0);
  const [overlapCount, setOverlapCount] = useState(0);
  const calendarRef = useRef(null);

  const initialDate = useMemo(() => new Date(), []);

  // Buscar informações do player
  const fetchPlayerInfo = async () => {
    try {
      const res = await axios.get(`/players/${id}`);
      setPlayerInfo(res.data.player);
    } catch (err) {
      console.error('[Calendar] Error fetching player info:', err);
    }
  };

  const fetchRange = async (start, end) => {
    try {
      setLoading(true);
      setError('');
      setCurrentDate(start);
      
      const params = new URLSearchParams({
        start: `${start.getDate().toString().padStart(2,'0')}/${(start.getMonth()+1).toString().padStart(2,'0')}/${start.getFullYear()}`,
        end: `${end.getDate().toString().padStart(2,'0')}/${(end.getMonth()+1).toString().padStart(2,'0')}/${end.getFullYear()}`,
        is_active: 'true'
      });
      console.log(`[Calendar] Fetching schedules for player ${id} with params:`, params.toString());
      const res = await axios.get(`/schedules/player/${id}/range?${params.toString()}`);
      const schedules = res.data.schedules || [];
      console.log(`[Calendar] Received ${schedules.length} schedules:`, schedules);
      
      setTotalSchedules(schedules.length);
      
      // Expandir schedules em eventos do calendário
      const expanded = schedules.flatMap((s) => {
        const events = expandScheduleToEvents(s, start, end);
        console.log(`[Calendar] Schedule "${s.name}" expanded to ${events.length} events:`, events);
        return events;
      });
      console.log(`[Calendar] Total events before overlap detection: ${expanded.length}`, expanded);
      
      // Detectar e marcar sobreposições
      const eventsWithOverlap = detectOverlaps(expanded);
      
      // Contar eventos com sobreposição
      const overlappingEvents = eventsWithOverlap.filter(e => e.hasOverlap);
      setOverlapCount(overlappingEvents.length);
      
      console.log(`[Calendar] Final events:`, eventsWithOverlap);
      setEvents(eventsWithOverlap);
    } catch (err) {
      console.error('[Calendar] Error fetching schedules:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao carregar calendário');
    } finally {
      setLoading(false);
    }
  };

  // FullCalendar callback quando muda de intervalo
  const handleDatesSet = (arg) => {
    const start = new Date(arg.start);
    const end = new Date(arg.end);
    console.log(`[Calendar] handleDatesSet called with:`, { start, end, argStart: arg.start, argEnd: arg.end });
    // Ajuste: reduzir 1 dia do end porque o FullCalendar usa fim exclusivo
    end.setDate(end.getDate() - 1);
    console.log(`[Calendar] Adjusted end date:`, end);
    fetchRange(start, end);
  };

  // Função para mudar a visualização do calendário
  const handleViewChange = (newView) => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
    }
    setView(newView);
  };

  // Carregar informações do player na inicialização
  useEffect(() => {
    fetchPlayerInfo();
  }, [id]);

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.background.default, minHeight: '100vh' }}>
      {/* Cabeçalho Principal */}
      <Paper elevation={2} sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent sx={{ pb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ 
                fontWeight: 600, 
                color: theme.palette.primary.main,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <CalendarToday sx={{ fontSize: 32 }} />
                Calendário de Agendamentos
              </Typography>
              
              {playerInfo && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="h6" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
                    Player: {playerInfo.name}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip 
                      label={playerInfo.is_active ? 'Online' : 'Offline'} 
                      color={playerInfo.is_active ? 'success' : 'error'}
                      size="small"
                    />
                    <Chip 
                      label={`${totalSchedules} agendamentos`} 
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                    {overlapCount > 0 && (
                      <Chip 
                        icon={<Warning />}
                        label={`${overlapCount} conflitos`} 
                        color="warning"
                        variant="filled"
                        size="small"
                      />
                    )}
                  </Stack>
                </Box>
              )}
            </Box>

            <Stack direction="row" spacing={1}>
              <Tooltip title="Atualizar calendário">
                <IconButton 
                  onClick={() => window.location.reload()} 
                  color="primary"
                  sx={{ 
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : '#e3f2fd',
                    '&:hover': { 
                      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.2)' : '#bbdefb' 
                    }
                  }}
                >
                  <Refresh />
                </IconButton>
              </Tooltip>
              
              <Button
                variant="contained"
                startIcon={<Schedule />}
                onClick={() => navigate(`/schedules?player=${id}`)}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                Gerenciar Agendamentos
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Paper>

      {/* Legenda de Cores */}
      {overlapCount > 0 && (
        <Alert 
          severity="warning" 
          icon={<Warning />}
          sx={{ 
            mb: 2, 
            borderRadius: 2,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              ⚠️ {overlapCount} Conflitos de Agendamento Detectados
            </Typography>
            <Typography variant="body2">
              Eventos com <strong>cores diferentes</strong> indicam agendamentos que se sobrepõem no mesmo horário. 
              Cada cor representa um agendamento diferente para facilitar a visualização dos conflitos.
            </Typography>
          </Stack>
        </Alert>
      )}

      {/* Controles de Visualização */}
      <Paper elevation={1} sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 500, color: theme.palette.text.primary }}>
              Visualização do Calendário
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip 
                label={
                  view === 'dayGridMonth' ? 'Visualização Mensal' :
                  view === 'timeGridWeek' ? 'Visualização Semanal' :
                  'Visualização Diária'
                }
                color="primary"
                variant="outlined"
                size="small"
                sx={{ 
                  fontSize: '0.75rem',
                  height: 24
                }}
              />
              
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={(e, v) => v && handleViewChange(v)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 500,
                    px: 2,
                    py: 1
                  }
                }}
              >
                <ToggleButton value="dayGridMonth">
                  <ViewModule sx={{ mr: 1 }} />
                  Mês
                </ToggleButton>
                <ToggleButton value="timeGridWeek">
                  <ViewWeek sx={{ mr: 1 }} />
                  Semana
                </ToggleButton>
                <ToggleButton value="timeGridDay">
                  <ViewDay sx={{ mr: 1 }} />
                  Dia
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Stack>
        </CardContent>
      </Paper>

      {/* Estados de Loading e Erro */}
      {loading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress 
            sx={{ 
              height: 4, 
              borderRadius: 2,
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : '#e3f2fd',
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.palette.primary.main
              }
            }} 
          />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: theme.palette.text.secondary }}>
            Carregando agendamentos e detectando conflitos...
          </Typography>
        </Box>
      )}
      
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 2, 
            borderRadius: 2,
            '& .MuiAlert-message': {
              fontWeight: 500
            }
          }}
        >
          {error}
        </Alert>
      )}

      {/* Calendário Principal */}
      <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
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
          height="calc(100vh - 400px)"
          locale="pt-br"
          allDaySlot={true}
          nowIndicator={true}
          slotMinTime={'00:00:00'}
          slotMaxTime={'24:00:00'}
          slotDuration={view === 'timeGridDay' ? '00:15:00' : '00:30:00'}
          firstDay={1}
          expandRows={true}
          dayMaxEvents={view === 'dayGridMonth' ? 3 : false}
          moreLinkClick={view === 'dayGridMonth' ? 'popover' : undefined}
          eventClick={(info) => {
            const hasOverlap = info.event.extendedProps?.hasOverlap;
            if (hasOverlap) {
              console.log('Evento com sobreposição clicado:', {
                title: info.event.title,
                overlapLevel: info.event.extendedProps?.overlapLevel,
                overlappingWith: info.event.extendedProps?.overlappingWith
              });
            }
            navigate(`/schedules?player=${id}`);
          }}
          eventClassNames={(info) => {
            const classes = ['custom-event'];
            if (info.event.extendedProps?.hasOverlap) {
              classes.push('overlap-event');
            }
            return classes;
          }}
          themeSystem="standard"
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
            const hasOverlap = arg.event.extendedProps?.hasOverlap;
            const overlapLevel = arg.event.extendedProps?.overlapLevel || 0;
            return (
              <div style={{ 
                padding: '4px 8px', 
                overflow: 'hidden',
                borderLeft: hasOverlap ? '4px solid rgba(255,255,255,0.9)' : 'none',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{ 
                  fontWeight: hasOverlap ? '700' : '600', 
                  fontSize: '0.85rem',
                  lineHeight: '1.2'
                }}>
                  {arg.event.title}
                </div>
                {!arg.event.allDay && (
                  <div style={{ 
                    fontSize: '0.75rem', 
                    opacity: 0.95,
                    marginTop: '2px'
                  }}>
                    {arg.timeText}
                  </div>
                )}
                {hasOverlap && (
                  <div style={{ 
                    fontSize: '0.7rem', 
                    marginTop: '2px', 
                    opacity: 0.95,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    ⚠️ Conflito ({overlapLevel})
                  </div>
                )}
              </div>
            );
          }}
        />
      </Paper>

      {/* Estilos CSS customizados */}
      <style jsx global>{`
        .fc {
          font-family: 'Roboto', sans-serif;
        }
        
        .fc-header-toolbar {
          padding: 16px;
          background: ${theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #ff9800, #f57c00)' 
            : 'linear-gradient(135deg, #1976d2, #1565c0)'};
          color: white;
          border-radius: 8px 8px 0 0;
        }
        
        .fc-toolbar-title {
          font-size: 1.5rem !important;
          font-weight: 600 !important;
        }
        
        .fc-button {
          background-color: rgba(255, 255, 255, 0.2) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          color: white !important;
          font-weight: 500 !important;
          border-radius: 6px !important;
          padding: 8px 16px !important;
        }
        
        .fc-button:hover {
          background-color: rgba(255, 255, 255, 0.3) !important;
        }
        
        .fc-button:focus {
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5) !important;
        }
        
        .fc-daygrid-day-number {
          font-weight: 500;
          color: ${theme.palette.text.primary};
        }
        
        .fc-timegrid-slot-label {
          font-weight: 500;
          color: ${theme.palette.text.secondary};
        }
        
        .fc-timegrid-axis {
          color: ${theme.palette.text.secondary};
        }
        
        .fc-daygrid-day {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.primary};
        }
        
        .fc-timegrid-slot {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.primary};
        }
        
        .fc-timegrid-slot-minor {
          border-color: ${theme.palette.divider};
        }
        
        .custom-event {
          border-radius: 6px !important;
          border: 2px solid rgba(255, 255, 255, 0.3) !important;
          font-weight: 500 !important;
          box-shadow: ${theme.palette.mode === 'dark' 
            ? '0 2px 6px rgba(0, 0, 0, 0.4)' 
            : '0 2px 6px rgba(0, 0, 0, 0.15)'} !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        
        .overlap-event {
          border: 3px solid rgba(255, 255, 255, 0.9) !important;
          box-shadow: ${theme.palette.mode === 'dark' 
            ? '0 4px 12px rgba(0, 0, 0, 0.6)' 
            : '0 4px 12px rgba(0, 0, 0, 0.25)'} !important;
          font-weight: 700 !important;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            box-shadow: ${theme.palette.mode === 'dark' 
              ? '0 4px 12px rgba(0, 0, 0, 0.6)' 
              : '0 4px 12px rgba(0, 0, 0, 0.25)'};
          }
          50% {
            box-shadow: ${theme.palette.mode === 'dark' 
              ? '0 6px 16px rgba(0, 0, 0, 0.8)' 
              : '0 6px 16px rgba(0, 0, 0, 0.35)'};
          }
        }
        
        .fc-event:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: ${theme.palette.mode === 'dark' 
            ? '0 6px 16px rgba(0, 0, 0, 0.5)' 
            : '0 6px 16px rgba(0, 0, 0, 0.2)'} !important;
          transition: all 0.2s ease;
          z-index: 999 !important;
        }
        
        .fc-daygrid-event {
          margin: 1px 0 !important;
        }
        
        .fc-timegrid-event {
          margin: 1px 2px !important;
        }
        
        .fc-now-indicator-line {
          border-color: #f44336 !important;
          border-width: 2px !important;
        }
        
        .fc-day-today {
          background-color: ${theme.palette.mode === 'dark' 
            ? 'rgba(255, 152, 0, 0.1)' 
            : 'rgba(25, 118, 210, 0.05)'} !important;
        }
        
        .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
          background-color: ${theme.palette.primary.main} !important;
          color: white !important;
          border-radius: 50% !important;
          width: 28px !important;
          height: 28px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-weight: 600 !important;
        }
        
        .fc-scrollgrid {
          border: none !important;
          background-color: ${theme.palette.background.paper};
        }
        
        .fc-scrollgrid-section > * {
          border-color: ${theme.palette.divider} !important;
        }
        
        .fc-timegrid-slot {
          height: ${view === 'timeGridDay' ? '2em' : '2.5em'} !important;
        }
        
        .fc-timegrid-slot-minor {
          border-color: ${theme.palette.divider} !important;
        }
        
        .fc-col-header-cell {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.primary};
        }
        
        .fc-daygrid-day-frame {
          background-color: ${theme.palette.background.paper};
          border-color: ${theme.palette.divider};
        }
        
        .fc-timegrid-body {
          background-color: ${theme.palette.background.paper};
        }
        
        .fc-timegrid-axis {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.secondary};
        }
        
        .fc-timegrid-slot-label {
          font-size: ${view === 'timeGridDay' ? '0.8rem' : '0.9rem'};
          color: ${theme.palette.text.secondary};
        }
        
        .fc-daygrid-day-events {
          margin-top: 2px;
        }
        
        .fc-daygrid-event {
          margin: 1px 0;
          border-radius: 4px;
          font-size: 0.75rem;
          padding: 2px 4px;
        }
        
        .fc-daygrid-event-harness {
          margin: 1px 0;
        }
        
        .fc-event-title {
          font-weight: 500;
          font-size: 0.85rem;
        }
        
        .fc-event-time {
          font-weight: 400;
          font-size: 0.75rem;
        }
        
        .fc-popover {
          background-color: ${theme.palette.background.paper};
          border: 1px solid ${theme.palette.divider};
          box-shadow: ${theme.palette.mode === 'dark' 
            ? '0 4px 12px rgba(0, 0, 0, 0.4)' 
            : '0 4px 12px rgba(0, 0, 0, 0.15)'};
        }
        
        .fc-popover-header {
          background-color: ${theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5'};
          color: ${theme.palette.text.primary};
          border-bottom: 1px solid ${theme.palette.divider};
        }
        
        .fc-popover-body {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.primary};
        }
        
        .fc-popover-close {
          color: ${theme.palette.text.secondary};
        }
        
        .fc-popover-close:hover {
          color: ${theme.palette.text.primary};
        }
      `}</style>
    </Box>
  );
};

export default ScheduleCalendar;

