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
  Grid
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
  FilterList
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

// Função para verificar sobreposição de horários entre dois agendamentos
function hasTimeOverlap(schedule1, schedule2) {
  // Verificar se os períodos de data se sobrepõem
  const parseBrDate = (dateStr) => {
    const [datePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    return new Date(year, month - 1, day);
  };
  
  const start1 = parseBrDate(schedule1.start_date);
  const end1 = parseBrDate(schedule1.end_date);
  const start2 = parseBrDate(schedule2.start_date);
  const end2 = parseBrDate(schedule2.end_date);
  
  // Verificar sobreposição de datas
  if (end1 < start2 || end2 < start1) {
    return false;
  }
  
  // Verificar sobreposição de dias da semana
  const days1 = (schedule1.days_of_week || '1,2,3,4,5').split(',').map(d => parseInt(d.trim()));
  const days2 = (schedule2.days_of_week || '1,2,3,4,5').split(',').map(d => parseInt(d.trim()));
  
  const hasCommonDays = days1.some(day => days2.includes(day));
  if (!hasCommonDays) {
    return false;
  }
  
  // Verificar sobreposição de horários
  const time1Start = schedule1.start_time || '00:00:00';
  const time1End = schedule1.end_time || '23:59:59';
  const time2Start = schedule2.start_time || '00:00:00';
  const time2End = schedule2.end_time || '23:59:59';
  
  // Converter para minutos para facilitar comparação
  const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(n => parseInt(n));
    return h * 60 + m;
  };
  
  const start1Min = timeToMinutes(time1Start);
  const end1Min = timeToMinutes(time1End);
  const start2Min = timeToMinutes(time2Start);
  const end2Min = timeToMinutes(time2End);
  
  // Verificar sobreposição de horários (considerando overnight)
  if (end1Min < start1Min) { // schedule1 é overnight
    if (end2Min < start2Min) { // schedule2 também é overnight
      return true; // Ambos overnight sempre se sobrepõem
    } else {
      return start2Min <= end1Min || start1Min <= end2Min;
    }
  } else if (end2Min < start2Min) { // apenas schedule2 é overnight
    return start1Min <= end2Min || start2Min <= end1Min;
  } else { // nenhum é overnight
    return start1Min < end2Min && start2Min < end1Min;
  }
}

// Função para detectar conflitos de horário entre agendamentos do mesmo player
function detectTimeConflicts(schedules) {
  const conflictAssignments = new Map();
  const playerGroups = new Map();
  
  // Agrupar agendamentos por player
  schedules.forEach(schedule => {
    if (!playerGroups.has(schedule.player_id)) {
      playerGroups.set(schedule.player_id, []);
    }
    playerGroups.get(schedule.player_id).push(schedule);
  });
  
  // Para cada player, detectar conflitos
  playerGroups.forEach((playerSchedules, playerId) => {
    const conflictGroups = [];
    
    playerSchedules.forEach((schedule, index) => {
      const conflicts = [];
      
      // Verificar conflitos com outros agendamentos do mesmo player
      playerSchedules.forEach((otherSchedule, otherIndex) => {
        if (index !== otherIndex && hasTimeOverlap(schedule, otherSchedule)) {
          conflicts.push(otherSchedule);
        }
      });
      
      if (conflicts.length > 0) {
        // Encontrar grupo existente ou criar novo
        let existingGroup = conflictGroups.find(group => 
          group.some(s => s.id === schedule.id || conflicts.some(c => c.id === s.id))
        );
        
        if (existingGroup) {
          // Adicionar ao grupo existente
          if (!existingGroup.some(s => s.id === schedule.id)) {
            existingGroup.push(schedule);
          }
          conflicts.forEach(conflict => {
            if (!existingGroup.some(s => s.id === conflict.id)) {
              existingGroup.push(conflict);
            }
          });
        } else {
          // Criar novo grupo
          conflictGroups.push([schedule, ...conflicts]);
        }
      }
    });
    
    // Atribuir cores para cada grupo de conflito
    conflictGroups.forEach(group => {
      group.forEach((schedule, colorIndex) => {
        conflictAssignments.set(schedule.id, {
          hasConflict: true,
          colorIndex: colorIndex,
          groupSize: group.length,
          conflictType: 'time_overlap'
        });
      });
    });
  });
  
  return conflictAssignments;
}


function expandScheduleToEvents(schedule, rangeStart, rangeEnd, conflictInfo = null) {
  // Gera eventos diários dentro do intervalo com base em days_of_week e horários (suporta overnight)
  console.log(`[SchedulesCalendar] Expanding schedule "${schedule.name}":`, {
    start_date: schedule.start_date,
    end_date: schedule.end_date,
    days_of_week: schedule.days_of_week,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    conflict_type: schedule.conflict_type,
    overlap_priority: schedule.overlap_priority,
    color_index: schedule.color_index,
    content_type: schedule.content_type,
    rangeStart,
    rangeEnd
  });
  
  console.log(`[SchedulesCalendar] Color logic for "${schedule.name}":`, {
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
  
  console.log(`[SchedulesCalendar] Date ranges:`, {
    start,
    end,
    schedStart,
    schedEnd,
    effectiveStart,
    effectiveEnd
  });
  
  if (isNaN(effectiveStart) || isNaN(effectiveEnd) || effectiveStart > effectiveEnd) {
    console.log(`[SchedulesCalendar] No overlap or invalid dates, returning empty events`);
    return events;
  }

  // Converter dias da semana do formato do banco (1=Segunda, 2=Terça, etc.) 
  // para o formato JavaScript (0=Domingo, 1=Segunda, etc.)
  const allowedDays = (schedule.days_of_week || '1,2,3,4,5')
    .split(',')
    .map((d) => {
      const day = parseInt(d.trim(), 10);
      // Converter do formato Python (0=Segunda) para JavaScript (0=Domingo)
      // Python: 0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex, 5=Sab, 6=Dom
      // JavaScript: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
      if (day === 0) return 6; // Domingo
      return day; // Segunda=1, Terça=2, etc.
    })
    .filter((n) => !isNaN(n));

  console.log(`[SchedulesCalendar] Allowed days:`, allowedDays);

  // FullCalendar usa 0=Dom..6=Sab. Nosso schedule também (UI). Já vindo como 0..6.
  const isAllDay = schedule.start_time === '00:00:00' && schedule.end_time === '23:59:59';
  const [sh, sm, ss] = (schedule.start_time || '00:00:00').split(':').map((v) => parseInt(v, 10) || 0);
  const [eh, em, es] = (schedule.end_time || '23:59:59').split(':').map((v) => parseInt(v, 10) || 0);

  console.log(`[SchedulesCalendar] Time settings:`, {
    isAllDay,
    startTime: `${sh}:${sm}:${ss}`,
    endTime: `${eh}:${em}:${es}`
  });

  for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    console.log(`[SchedulesCalendar] Checking day ${d.toDateString()}, weekday: ${weekday}, allowed: ${allowedDays.includes(weekday)}`);
    
    if (!allowedDays.includes(weekday)) continue;

    if (isAllDay) {
      events.push({
        id: `${schedule.id}-${isoDate(d)}-allday`,
        title: `${schedule.name} (${schedule.player_name})`,
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        allDay: true,
        color: (() => {
          // Array de cores para diferenciar agendamentos conflitantes
          const conflictColors = ['#1976d2', '#ff5722', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];
          
          // Overlay sempre roxo
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            return '#6c63ff';
          }
          
          // Conflitos críticos sempre vermelho
          if (schedule.conflict_type === 'conflict') {
            return '#ff5722';
          }
          
          // Se h� conflito de hor�rio detectado, usar cores diferenciadas
          if (conflictInfo && conflictInfo.hasConflict) {
            return conflictColors[conflictInfo.colorIndex % conflictColors.length];
          }
          
          // Se tem color_index (agendamentos sobrepostos), usar cores diferenciadas
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            return conflictColors[schedule.color_index % conflictColors.length];
          }
          
          // Cores baseadas na prioridade de sobreposição
          if (schedule.overlap_priority === 'overlap_top') {
            return '#4caf50'; // Verde para prioridade alta
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            return '#ff9800'; // Laranja para prioridade baixa
          }
          
          // Cor padrão
          return '#1976d2';
        })(),
        extendedProps: {
          player_id: schedule.player_id,
          player_name: schedule.player_name,
          content_type: schedule.content_type,
          has_conflicts: schedule.has_conflicts,
          conflict_type: schedule.conflict_type
        }
      });
    } else if (sh <= eh) {
      // Janela no mesmo dia
      events.push({
        id: `${schedule.id}-${isoDate(d)}`,
        title: `${schedule.name} (${schedule.player_name})`,
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, ss),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em, es),
        allDay: false,
        color: (() => {
          // Array de cores para diferenciar agendamentos conflitantes
          const conflictColors = ['#1976d2', '#ff5722', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];
          
          // Overlay sempre roxo
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            return '#6c63ff';
          }
          
          // Conflitos críticos sempre vermelho
          if (schedule.conflict_type === 'conflict') {
            return '#ff5722';
          }
          
          // Se h� conflito de hor�rio detectado, usar cores diferenciadas
          if (conflictInfo && conflictInfo.hasConflict) {
            return conflictColors[conflictInfo.colorIndex % conflictColors.length];
          }
          
          // Se tem color_index (agendamentos sobrepostos), usar cores diferenciadas
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            return conflictColors[schedule.color_index % conflictColors.length];
          }
          
          // Cores baseadas na prioridade de sobreposição
          if (schedule.overlap_priority === 'overlap_top') {
            return '#4caf50'; // Verde para prioridade alta
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            return '#ff9800'; // Laranja para prioridade baixa
          }
          
          // Cor padrão
          return '#1976d2';
        })(),
        extendedProps: {
          player_id: schedule.player_id,
          player_name: schedule.player_name,
          content_type: schedule.content_type,
          has_conflicts: schedule.has_conflicts,
          conflict_type: schedule.conflict_type
        }
      });
    } else {
      // Overnight: parte 1 no dia D
      events.push({
        id: `${schedule.id}-${isoDate(d)}-p1`,
        title: `${schedule.name} (${schedule.player_name})`,
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, ss),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        allDay: false,
        color: (() => {
          // Array de cores para diferenciar agendamentos conflitantes
          const conflictColors = ['#1976d2', '#ff5722', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];
          
          // Overlay sempre roxo
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            return '#6c63ff';
          }
          
          // Conflitos críticos sempre vermelho
          if (schedule.conflict_type === 'conflict') {
            return '#ff5722';
          }
          
          // Se h� conflito de hor�rio detectado, usar cores diferenciadas
          if (conflictInfo && conflictInfo.hasConflict) {
            return conflictColors[conflictInfo.colorIndex % conflictColors.length];
          }
          
          // Se tem color_index (agendamentos sobrepostos), usar cores diferenciadas
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            return conflictColors[schedule.color_index % conflictColors.length];
          }
          
          // Cores baseadas na prioridade de sobreposição
          if (schedule.overlap_priority === 'overlap_top') {
            return '#4caf50'; // Verde para prioridade alta
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            return '#ff9800'; // Laranja para prioridade baixa
          }
          
          // Cor padrão
          return '#1976d2';
        })(),
        extendedProps: {
          player_id: schedule.player_id,
          player_name: schedule.player_name,
          content_type: schedule.content_type,
          has_conflicts: schedule.has_conflicts,
          conflict_type: schedule.conflict_type
        }
      });
      // Parte 2 no dia D+1
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
      if (next <= effectiveEnd) {
        events.push({
          id: `${schedule.id}-${isoDate(next)}-p2`,
          title: `${schedule.name} (${schedule.player_name})`,
          start: new Date(next.getFullYear(), next.getMonth(), next.getDate(), 0, 0, 0),
          end: new Date(next.getFullYear(), next.getMonth(), next.getDate(), eh, em, es),
          allDay: false,
          color: (() => {
          // Array de cores para diferenciar agendamentos conflitantes
          const conflictColors = ['#1976d2', '#ff5722', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];
          
          // Overlay sempre roxo
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            return '#6c63ff';
          }
          
          // Conflitos críticos sempre vermelho
          if (schedule.conflict_type === 'conflict') {
            return '#ff5722';
          }
          
          // Se h� conflito de hor�rio detectado, usar cores diferenciadas
          if (conflictInfo && conflictInfo.hasConflict) {
            return conflictColors[conflictInfo.colorIndex % conflictColors.length];
          }
          
          // Se tem color_index (agendamentos sobrepostos), usar cores diferenciadas
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            return conflictColors[schedule.color_index % conflictColors.length];
          }
          
          // Cores baseadas na prioridade de sobreposição
          if (schedule.overlap_priority === 'overlap_top') {
            return '#4caf50'; // Verde para prioridade alta
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            return '#ff9800'; // Laranja para prioridade baixa
          }
          
          // Cor padrão
          return '#1976d2';
        })(),
          extendedProps: {
            player_id: schedule.player_id,
            player_name: schedule.player_name,
            content_type: schedule.content_type
          }
        });
      }
    }
  }

  console.log(`[SchedulesCalendar] Generated ${events.length} events for schedule "${schedule.name}"`);
  return events;
}

const SchedulesCalendar = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [view, setView] = useState('timeGridWeek'); // dayGridMonth | timeGridWeek | timeGridDay
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [totalSchedules, setTotalSchedules] = useState(0);
  const calendarRef = useRef(null);

  const initialDate = useMemo(() => new Date(), []);

  // Buscar lista de players
  const fetchPlayers = async () => {
    try {
      const res = await axios.get('/players?per_page=1000');
      setPlayers(res.data.players || []);
    } catch (err) {
      console.error('[SchedulesCalendar] Error fetching players:', err);
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

      // Se um player específico foi selecionado, filtrar por ele
      if (selectedPlayer) {
        params.append('player_id', selectedPlayer);
      }

      console.log(`[SchedulesCalendar] Fetching schedules with params:`, params.toString());
      const res = await axios.get(`/schedules/range?${params.toString()}`);
      const schedules = res.data.schedules || [];
      console.log(`[SchedulesCalendar] Received ${schedules.length} schedules:`, schedules);
      
      setTotalSchedules(schedules.length);

      // Detectar conflitos de hor�rio entre agendamentos
      const conflictInfo = detectTimeConflicts(schedules);
      console.log('[SchedulesCalendar] Conflict detection results:', conflictInfo);
      
      // Expandir schedules em eventos do calendário
      const expanded = schedules.flatMap((s) => {
        const conflict = conflictInfo.get(s.id);
        const events = expandScheduleToEvents(s, start, end, conflict);
        console.log(`[SchedulesCalendar] Schedule "${s.name}" expanded to ${events.length} events:`, events);
        return events;
      });
      console.log(`[SchedulesCalendar] Total events generated: ${expanded.length}`, expanded);
      setEvents(expanded);
    } catch (err) {
      console.error('[SchedulesCalendar] Error fetching schedules:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao carregar calendário');
    } finally {
      setLoading(false);
    }
  };

  // FullCalendar callback quando muda de intervalo
  const handleDatesSet = (arg) => {
    const start = new Date(arg.start);
    const end = new Date(arg.end);
    console.log(`[SchedulesCalendar] handleDatesSet called with:`, { start, end, argStart: arg.start, argEnd: arg.end });
    // Ajuste: reduzir 1 dia do end porque o FullCalendar usa fim exclusivo
    end.setDate(end.getDate() - 1);
    console.log(`[SchedulesCalendar] Adjusted end date:`, end);
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

  // Função para filtrar por player
  const handlePlayerFilter = (playerId) => {
    setSelectedPlayer(playerId);
    // Recarregar dados com o novo filtro
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const start = calendarApi.view.activeStart;
      const end = calendarApi.view.activeEnd;
      end.setDate(end.getDate() - 1);
      fetchRange(start, end);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    fetchPlayers();
  }, []);

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
                Calendário Global de Agendamentos
              </Typography>
              
              <Box sx={{ mt: 1 }}>
                <Typography variant="h6" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
                  Visualize agendamentos de todos os players ou filtre por player específico
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip 
                    label={`${totalSchedules} agendamentos`} 
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                  {selectedPlayer && (
                    <Chip 
                      label={`Filtrado por: ${players.find(p => p.id === selectedPlayer)?.name || 'Player'}`} 
                      color="secondary"
                      variant="outlined"
                      size="small"
                      onDelete={() => handlePlayerFilter('')}
                    />
                  )}
                </Stack>
              </Box>
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
                onClick={() => navigate('/schedules')}
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

      {/* Filtros */}
      <Paper elevation={1} sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por Player</InputLabel>
                <Select
                  value={selectedPlayer}
                  onChange={(e) => handlePlayerFilter(e.target.value)}
                  label="Filtrar por Player"
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">Todos os Players</MenuItem>
                  {players.map(player => (
                    <MenuItem key={player.id} value={player.id}>
                      {player.name} {player.is_online ? '(Online)' : '(Offline)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
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
                
                {/* Legenda de cores */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: 1,
                    background: 'linear-gradient(135deg, #1976d2, #1565c0)',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    Normal
                  </Typography>
                  
                  <Box sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: 1,
                    background: 'linear-gradient(135deg, #6c63ff, #5a52ff)',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    Overlay
                  </Typography>
                  
                  <Box sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: 1,
                    background: 'linear-gradient(135deg, #ff9800, #f57c00)',
                    border: '2px solid #ffcdd2'
                  }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    Sobreposição
                  </Typography>
                </Box>
                
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
            </Grid>
          </Grid>
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
            Carregando agendamentos...
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
            const playerId = info.event.extendedProps?.player_id;
            if (playerId) {
              navigate(`/players/${playerId}/calendar`);
            } else {
              navigate('/schedules');
            }
          }}
          // Estilos customizados
          eventClassNames={(info) => {
            const classes = ['custom-event'];
            const conflictType = info.event.extendedProps?.conflict_type;
            if (conflictType === 'conflict') {
              classes.push('conflict-event');
            } else if (conflictType === 'overlay') {
              classes.push('overlay-event');
            }
            return classes;
          }}
          // Configurações de tema
          themeSystem="standard"
          // Configurações de texto
          buttonText={{
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia'
          }}
          // Configurações de dia da semana
          dayHeaderFormat={{ weekday: 'short' }}
          // Configurações de slot
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
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
        
        .fc-timegrid-slot-label {
          color: ${theme.palette.text.secondary};
        }
        
        .fc-daygrid-day-number {
          color: ${theme.palette.text.primary};
        }
        
        .fc-daygrid-day-events {
          color: ${theme.palette.text.primary};
        }
        
        .fc-daygrid-day-top {
          color: ${theme.palette.text.primary};
        }
        
        .custom-event {
          border-radius: 6px !important;
          border: none !important;
          font-weight: 500 !important;
          font-size: 0.85rem !important;
          padding: 4px 8px !important;
          box-shadow: ${theme.palette.mode === 'dark' 
            ? '0 2px 4px rgba(0, 0, 0, 0.3)' 
            : '0 2px 4px rgba(0, 0, 0, 0.1)'} !important;
        }
        
        .overlay-event {
          background: linear-gradient(135deg, #6c63ff, #5a52ff) !important;
          color: white !important;
        }
        
        .conflict-event {
          background: ${theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #ff5722, #d32f2f)' 
            : 'linear-gradient(135deg, #ff5722, #f44336)'} !important;
          color: white !important;
          border: 2px solid ${theme.palette.mode === 'dark' ? '#ff8a65' : '#ffcdd2'} !important;
        }
        
        .fc-event:not(.overlay-event):not(.conflict-event) {
          background: ${theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #ff9800, #f57c00)' 
            : 'linear-gradient(135deg, #1976d2, #1565c0)'} !important;
          color: white !important;
        }
        
        .fc-event:hover {
          transform: translateY(-1px);
          box-shadow: ${theme.palette.mode === 'dark' 
            ? '0 4px 8px rgba(0, 0, 0, 0.4)' 
            : '0 4px 8px rgba(0, 0, 0, 0.15)'} !important;
          transition: all 0.2s ease;
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
          height: 2.5em !important;
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
        }
        
        .fc-timegrid-body {
          background-color: ${theme.palette.background.paper};
        }
        
        .fc-timegrid-axis {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.secondary};
        }
        
        /* Estilos específicos para visualização de mês */
        .fc-daygrid-day-frame {
          background-color: ${theme.palette.background.paper};
          border-color: ${theme.palette.divider};
        }
        
        .fc-daygrid-day-number {
          color: ${theme.palette.text.primary};
          font-weight: 500;
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
        
        /* Estilos específicos para visualização de dia */
        .fc-timegrid-slot {
          height: ${view === 'timeGridDay' ? '2em' : '2.5em'} !important;
        }
        
        .fc-timegrid-slot-minor {
          border-color: ${theme.palette.divider};
        }
        
        .fc-timegrid-slot-label {
          font-size: ${view === 'timeGridDay' ? '0.8rem' : '0.9rem'};
          color: ${theme.palette.text.secondary};
        }
        
        /* Melhorar aparência dos eventos em todas as visualizações */
        .fc-event-title {
          font-weight: 500;
          font-size: 0.85rem;
        }
        
        .fc-event-time {
          font-weight: 400;
          font-size: 0.75rem;
        }
        
        /* Estilos para popover de eventos extras no mês */
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

export default SchedulesCalendar;














