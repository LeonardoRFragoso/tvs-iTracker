import React, { useState, useEffect, useRef } from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  FormGroup,
  IconButton,
  Divider,
  Chip,
  Switch,
  FormHelperText,
  CircularProgress,
  Alert,
  Grow,
  
  Paper,
  Fade,
  Skeleton,
  Autocomplete,
  Slider,
  Stack,
  Pagination,
  PaginationItem,
  Breadcrumbs,
  Link,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  AlertTitle,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListSubheader,
  Drawer,
  AppBar,
  Toolbar,
  Menu,
  MenuList,
  Popper,
  Popover,
  Tabs,
  Tab,
  TabPanel,
  TabList,
  TabPanels,
  TabContext,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Repeat as RepeatIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import axios from '../../config/axios';

// Helpers for BR datetime handling
const pad2 = (n) => String(n).padStart(2, '0');
const toBRDateTime = (date, { endOfDay = false } = {}) => {
  if (!date) return '';
  const d = new Date(date);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  let hh = d.getHours();
  let min = d.getMinutes();
  let ss = d.getSeconds();
  if (endOfDay) { hh = 23; min = 59; ss = 59; }
  return `${dd}/${mm}/${yyyy} ${pad2(hh)}:${pad2(min)}:${pad2(ss)}`;
};
const parseDateStringFlexible = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const s = value.trim();
    // BR "DD/MM/YYYY [HH:MM:SS]"
    if (s.includes('/')) {
      const datePart = s.split(' ')[0];
      const [dd, mm, yyyy] = datePart.split('/').map((x) => parseInt(x, 10));
      if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
        return new Date(yyyy, mm - 1, dd, 0, 0, 0);
      }
    }
    // ISO fallback
    const iso = new Date(s);
    if (!isNaN(iso.getTime())) return iso;
  }
  return null;
};

const ScheduleForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const searchParams = new URLSearchParams(location.search || '');
  const queryReturnTo = searchParams.get('returnTo');
  // localStorage fallback (in case state/query are lost by refresh/build)
  let storageReturnTo = null;
  let storageFrom = null;
  try {
    storageReturnTo = localStorage.getItem('schedule_returnTo');
    storageFrom = localStorage.getItem('schedule_from');
  } catch (e) {}
  const returnToPath = (location.state?.returnTo || queryReturnTo || storageReturnTo || '/schedules');
  const [formData, setFormData] = useState({
    name: '',
    campaign_id: '',
    player_id: '',
    start_date: new Date(),
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    start_time: new Date(new Date().setHours(9, 0, 0, 0)),
    end_time: new Date(new Date().setHours(18, 0, 0, 0)),
    days_of_week: [1, 2, 3, 4, 5], // Monday to Friday
    repeat_type: 'daily',
    repeat_interval: 1,
    priority: 1,
    is_persistent: false,
    content_type: 'main',
    is_active: true,
    is_all_day: false,
    // CONFIGURAÇÕES UNIFICADAS DE REPRODUÇÃO (simplificadas)
    playback_mode: 'sequential',
    loop_behavior: 'until_next',
    loop_duration_minutes: null,
    content_selection: 'all',
    // auto_skip_errors agora é obrigatório e sempre true
    auto_skip_errors: true,
    device_type_compatibility: 'legacy',
  });

  const [campaigns, setCampaigns] = useState([]);
  const [players, setPlayers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [targetMode, setTargetMode] = useState('single'); // single | location | multi
  const [targetLocationId, setTargetLocationId] = useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const originalPlayerIdRef = useRef('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [conflicts, setConflicts] = useState([]);

  const daysOfWeek = [
    { value: 1, label: 'Segunda' },
    { value: 2, label: 'Terça' },
    { value: 3, label: 'Quarta' },
    { value: 4, label: 'Quinta' },
    { value: 5, label: 'Sexta' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
  ];

  const repeatTypes = [
    { value: 'daily', label: 'Diário' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'monthly', label: 'Mensal' },
  ];

  useEffect(() => {
    loadCampaigns();
    loadPlayers();
    loadLocations();
    if (isEdit) {
      loadSchedule();
    }
  }, [id, isEdit]);

  const loadSchedule = async () => {
    try {
      const response = await axios.get(`/schedules/${id}`);
      const schedule = response.data.schedule;
      
      // Função para converter string de tempo (HH:MM:SS) em objeto Date
      const parseTimeString = (timeString) => {
        if (!timeString) return null;
        try {
          if (timeString instanceof Date) return timeString;
          if (typeof timeString === 'string') {
            const timeParts = timeString.split(':');
            if (timeParts.length >= 2) {
              const today = new Date();
              const hours = parseInt(timeParts[0], 10);
              const minutes = parseInt(timeParts[1], 10);
              const seconds = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
              return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds);
            }
          }
          return null;
        } catch (error) {
          console.error('Erro ao fazer parse do tempo:', timeString, error);
          return null;
        }
      };
      
      const isAllDayDetected = (schedule.start_time === '00:00:00' && schedule.end_time === '23:59:59');
      
      setFormData({
        name: schedule.name || '',
        campaign_id: schedule.campaign_id || '',
        player_id: schedule.player_id || '',
        start_date: parseDateStringFlexible(schedule.start_date),
        end_date: parseDateStringFlexible(schedule.end_date),
        start_time: parseTimeString(schedule.start_time),
        end_time: parseTimeString(schedule.end_time),
        days_of_week: schedule.days_of_week ? schedule.days_of_week.split(',').map(d => parseInt(d.trim())) : [1,2,3,4,5],
        repeat_type: schedule.repeat_type || 'daily',
        repeat_interval: schedule.repeat_interval || 1,
        priority: schedule.priority || 1,
        is_persistent: schedule.is_persistent || false,
        content_type: schedule.content_type || 'main',
        is_active: schedule.is_active !== false,
        is_all_day: isAllDayDetected,
        // CONFIGURAÇÕES UNIFICADAS DE REPRODUÇÃO
        playback_mode: schedule.playback_mode || 'sequential',
        loop_behavior: schedule.loop_behavior || 'until_next',
        loop_duration_minutes: schedule.loop_duration_minutes || null,
        content_selection: schedule.content_selection || 'all',
        auto_skip_errors: true, // obrigatório
        // Forçar compatibilidade única: legado (recursos mínimos)
        device_type_compatibility: 'legacy',
      });
      setSelectedPlayerIds([schedule.player_id || '']);
      originalPlayerIdRef.current = schedule.player_id || '';
    } catch (err) {
      setError('Erro ao carregar agendamento');
      console.error('Load schedule error:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const response = await axios.get('/campaigns');
      setCampaigns(response.data.campaigns || []);
    } catch (err) {
      console.error('Load campaigns error:', err);
    }
  };

  const loadPlayers = async () => {
    try {
      const response = await axios.get('/players');
      setPlayers(response.data.players || []);
    } catch (err) {
      console.error('Load players error:', err);
    }
  };

  const loadLocations = async () => {
    try {
      const response = await axios.get('/locations');
      const list = response.data.locations || response.data || [];
      setLocations(list);
    } catch (err) {
      console.error('Load locations error:', err);
    }
  };

  useEffect(() => {
    if (targetMode === 'single') {
      checkConflicts();
    }
  }, [targetMode, formData.player_id, formData.start_date, formData.end_date, formData.start_time, formData.end_time, formData.days_of_week]);

  const checkConflicts = async () => {
    if (!formData.player_id || !formData.start_date || !formData.end_date) return;

    try {
      const conflictData = {
        player_id: formData.player_id,
        campaign_id: formData.campaign_id,
        start_date: toBRDateTime(formData.start_date, { endOfDay: false }),
        end_date: toBRDateTime(formData.end_date, { endOfDay: true }),
        days_of_week: formData.days_of_week.join(','),
        is_all_day: formData.is_all_day,
      };

      if (formData.start_time) {
        conflictData.start_time = formatTime(formData.start_time);
      }
      if (formData.end_time) {
        conflictData.end_time = formatTime(formData.end_time);
      }
      if (isEdit) {
        conflictData.exclude_schedule_id = id;
      }

      const response = await axios.post('/schedules/conflicts', conflictData);
      setConflicts(response.data.conflicts || []);
    } catch (err) {
      console.error('Check conflicts error:', err);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort()
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validation
      if (!formData.name.trim()) {
        throw new Error('Nome é obrigatório');
      }
      if (!formData.campaign_id) {
        throw new Error('Campanha é obrigatória');
      }
      if (targetMode === 'single' && !formData.player_id) {
        throw new Error('Player é obrigatório');
      }
      if (targetMode === 'location' && !targetLocationId) {
        throw new Error('Empresa (location) é obrigatória');
      }
      if (targetMode === 'multi' && selectedPlayerIds.length === 0) {
        throw new Error('Selecione ao menos um player');
      }
      if (formData.start_date >= formData.end_date) {
        throw new Error('Data de início deve ser anterior à data de fim');
      }
      if (formData.days_of_week.length === 0) {
        throw new Error('Selecione pelo menos um dia da semana');
      }

      const submitData = {
        name: formData.name,
        campaign_id: formData.campaign_id,
        start_date: toBRDateTime(formData.start_date, { endOfDay: false }),
        end_date: toBRDateTime(formData.end_date, { endOfDay: true }),
        days_of_week: formData.days_of_week.join(','),
        repeat_type: formData.repeat_type,
        repeat_interval: formData.repeat_interval,
        priority: formData.priority,
        is_persistent: formData.is_persistent,
        content_type: formData.content_type,
        is_active: formData.is_active,
        is_all_day: formData.is_all_day,
        // CONFIGURAÇÕES UNIFICADAS DE REPRODUÇÃO
        playback_mode: formData.playback_mode,
        loop_behavior: formData.loop_behavior,
        loop_duration_minutes: formData.loop_duration_minutes ? parseInt(formData.loop_duration_minutes, 10) : null,
        content_selection: formData.content_selection,
        // Forçar políticas: sem embaralhar e sempre pular conteúdos com erro
        shuffle_enabled: false,
        auto_skip_errors: true,
        device_type_compatibility: 'legacy',
      };

      // Include times only if set, to avoid sending empty strings
      if (formData.start_time) {
        submitData.start_time = formatTime(formData.start_time);
      }
      if (formData.end_time) {
        submitData.end_time = formatTime(formData.end_time);
      }

      let response;
      if (isEdit) {
        if (targetMode === 'multi') {
          const selected = (selectedPlayerIds && selectedPlayerIds.length > 0) ? selectedPlayerIds : [formData.player_id].filter(Boolean);
          const basePlayerId = (selected.includes(originalPlayerIdRef.current) ? originalPlayerIdRef.current : selected[0]) || formData.player_id;
          await axios.put(`/schedules/${id}`, { ...submitData, player_id: basePlayerId });
          const otherPlayers = selected.filter(pid => pid && pid !== basePlayerId);
          if (otherPlayers.length > 0) {
            await axios.post('/schedules/bulk', { ...submitData, player_ids: otherPlayers });
          }
          response = { status: 200 };
        } else if (targetMode === 'location') {
          await axios.put(`/schedules/${id}`, { ...submitData, player_id: formData.player_id });
          if (targetLocationId) {
            await axios.post('/schedules/bulk', { ...submitData, location_id: targetLocationId });
          }
          response = { status: 200 };
        } else {
          response = await axios.put(`/schedules/${id}`, { ...submitData, player_id: formData.player_id });
        }
      } else {
        if (targetMode === 'single') {
          response = await axios.post('/schedules', { ...submitData, player_id: formData.player_id });
        } else if (targetMode === 'location') {
          response = await axios.post('/schedules/bulk', { ...submitData, location_id: targetLocationId });
        } else {
          response = await axios.post('/schedules/bulk', { ...submitData, player_ids: selectedPlayerIds });
        }
      }

      setSuccess(isEdit ? 'Agendamento atualizado com sucesso!' : 'Agendamento criado com sucesso!');
      
      setTimeout(() => {
        try { localStorage.removeItem('schedule_returnTo'); localStorage.removeItem('schedule_from'); } catch (e) {}
        navigate(returnToPath);
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar agendamento');
      console.error('Submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format a Date object (time) into 'HH:MM:SS' string
  const formatTime = (time) => {
    if (!time) return '';
    if (typeof time === 'string') {
      const parts = time.split(':');
      if (parts.length >= 2) {
        const hh = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        const ss = parts[2] ? parts[2].padStart(2, '0') : '00';
        return `${hh}:${mm}:${ss}`;
      }
      return time;
    }
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Apply prefilled values when navigating from 'Duplicate as Overlay' (creation mode only)
  useEffect(() => {
    if (isEdit) return;
    const prefill = location.state?.prefill;
    if (!prefill) return;

    const parseTimeString = (timeString) => {
      if (!timeString) return null;
      try {
        if (timeString instanceof Date) return timeString;
        if (typeof timeString === 'string') {
          const parts = timeString.split(':');
          if (parts.length >= 2) {
            const today = new Date();
            const hours = parseInt(parts[0], 10) || 0;
            const minutes = parseInt(parts[1], 10) || 0;
            const seconds = parts[2] ? parseInt(parts[2], 10) : 0;
            return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds);
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    const daysArray = Array.isArray(prefill.days_of_week)
      ? prefill.days_of_week
      : typeof prefill.days_of_week === 'string'
        ? prefill.days_of_week.split(',').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n))
        : [1,2,3,4,5];

    const isAllDayDetected = prefill.start_time === '00:00:00' && prefill.end_time === '23:59:59';

    setFormData(prev => ({
      ...prev,
      name: prefill.name ?? prev.name,
      campaign_id: prefill.campaign_id ?? prev.campaign_id,
      player_id: prefill.player_id ?? prev.player_id,
      start_date: parseDateStringFlexible(prefill.start_date) ?? prev.start_date,
      end_date: parseDateStringFlexible(prefill.end_date) ?? prev.end_date,
      start_time: parseTimeString(prefill.start_time) ?? prev.start_time,
      end_time: parseTimeString(prefill.end_time) ?? prev.end_time,
      days_of_week: daysArray.length ? daysArray : prev.days_of_week,
      repeat_type: prefill.repeat_type ?? prev.repeat_type,
      repeat_interval: prefill.repeat_interval ?? prev.repeat_interval,
      priority: prefill.priority ?? prev.priority,
      is_persistent: prefill.is_persistent ?? prev.is_persistent,
      content_type: prefill.content_type ?? prev.content_type,
      is_active: typeof prefill.is_active === 'boolean' ? prefill.is_active : prev.is_active,
      is_all_day: isAllDayDetected || prev.is_all_day,
    }));
  }, [isEdit, location.state]);

  if (initialLoading) {
    return (
      <Box sx={{ textAlign: 'center', mt: 5 }}>
        <Typography>Carregando...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box
        sx={{
          backgroundColor: (theme) => theme.palette.background.default,
          minHeight: '100vh',
          p: 3,
        }}
      >
        {/* Enhanced Header */}
        <Fade in timeout={800}>
          <Box display="flex" alignItems="center" mb={4}>
            <IconButton 
              onClick={() => {
                try { localStorage.removeItem('schedule_returnTo'); localStorage.removeItem('schedule_from'); } catch (e) {}
                const fromState = location.state?.from;
                const fromQuery = searchParams.get('from');
                if (fromState === 'calendar' || fromQuery === 'calendar') {
                  navigate(-1);
                } else {
                  navigate(returnToPath);
                }
              }} 
              sx={{ 
                mr: 2,
                color: 'primary.main',
                border: '1px solid',
                borderColor: 'primary.main',
                backgroundColor: 'transparent',
                '&:hover': {
                  transform: 'scale(1.1)',
                  transition: 'transform 0.2s ease-in-out',
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,152,0,0.12)' : 'rgba(25,118,210,0.1)',
                },
              }}
            >
              <BackIcon />
            </IconButton>
            <Box>
              <Typography 
                variant="h3" 
                component="h1" 
                sx={{ 
                  fontWeight: 'bold',
                  color: 'text.primary',
                }}
              >
                {isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {isEdit ? 'Modifique as configurações do agendamento' : 'Configure um novo agendamento para suas campanhas'}
              </Typography>
            </Box>
          </Box>
        </Fade>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {conflicts.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Conflitos detectados:
            </Typography>
            {conflicts.map((conflict, index) => (
              <Typography key={index} variant="body2">
                • {conflict.name} ({conflict.start_date} - {conflict.end_date})
              </Typography>
            ))}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Informações Básicas */}
            <Grid item xs={12} md={6}>
              <Grow in timeout={1000}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    backgroundColor: (theme) => theme.palette.background.paper,
                    backdropFilter: 'blur(10px)',
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: (theme) => theme.palette.primary.main,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          bgcolor: 'primary.main',
                          color: '#000',
                          mr: 2,
                        }}
                      >
                        <EventIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Informações Básicas
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Nome do Agendamento"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          required
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            },
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <FormControl fullWidth required>
                          <InputLabel>Campanha</InputLabel>
                          <Select
                            value={formData.campaign_id}
                            onChange={(e) => handleInputChange('campaign_id', e.target.value)}
                            label="Campanha"
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            }}
                          >
                            {campaigns.map(campaign => (
                              <MenuItem key={campaign.id} value={campaign.id}>
                                {campaign.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <FormControl fullWidth>
                          <InputLabel>Destino</InputLabel>
                          <Select
                            value={targetMode}
                            onChange={(e) => setTargetMode(e.target.value)}
                            label="Destino"
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            }}
                          >
                            <MenuItem value="single">Um player</MenuItem>
                            <MenuItem value="location">Todos os players de uma empresa</MenuItem>
                            <MenuItem value="multi">Vários players selecionados</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      {targetMode === 'single' && (
                        <Grid item xs={12}>
                          <FormControl fullWidth required>
                            <InputLabel>Player</InputLabel>
                            <Select
                              value={formData.player_id}
                              onChange={(e) => handleInputChange('player_id', e.target.value)}
                              label="Player"
                              sx={{
                                borderRadius: 2,
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  transition: 'transform 0.2s ease-in-out',
                                },
                              }}
                            >
                              {players.map(player => (
                                <MenuItem key={player.id} value={player.id}>
                                  {player.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      )}

                      {targetMode === 'location' && (
                        <Grid item xs={12}>
                          <FormControl fullWidth required>
                            <InputLabel>Empresa (Location)</InputLabel>
                            <Select
                              value={targetLocationId}
                              onChange={(e) => setTargetLocationId(e.target.value)}
                              label="Empresa (Location)"
                              sx={{
                                borderRadius: 2,
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  transition: 'transform 0.2s ease-in-out',
                                },
                              }}
                            >
                              {locations.map(loc => (
                                <MenuItem key={loc.id} value={loc.id}>
                                  {loc.name} {loc.company ? `- ${loc.company}` : ''}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      )}

                      {targetMode === 'multi' && (
                        <Grid item xs={12}>
                          <Autocomplete
                            multiple
                            options={players}
                            getOptionLabel={(option) => option.name || ''}
                            value={players.filter(p => selectedPlayerIds.includes(p.id))}
                            onChange={(e, value) => setSelectedPlayerIds(value.map(v => v.id))}
                            renderInput={(params) => (
                              <TextField {...params} label="Players" placeholder="Selecione players" />
                            )}
                          />
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Período e Horário */}
            <Grid item xs={12} md={6}>
              <Grow in timeout={1200}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    backgroundColor: (theme) => theme.palette.background.paper,
                    backdropFilter: 'blur(10px)',
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: (theme) => theme.palette.primary.main,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          bgcolor: 'primary.main',
                          color: '#000',
                          mr: 2,
                        }}
                      >
                        <CalendarIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Período e Horário
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <DatePicker
                          label="Data de Início"
                          value={formData.start_date}
                          onChange={(date) => handleInputChange('start_date', date)}
                          renderInput={(params) => (
                            <TextField 
                              {...params} 
                              fullWidth 
                              required 
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 2,
                                  '&:hover': {
                                    transform: 'translateY(-2px)',
                                    transition: 'transform 0.2s ease-in-out',
                                  },
                                },
                              }}
                            />
                          )}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <DatePicker
                          label="Data de Fim"
                          value={formData.end_date}
                          onChange={(date) => handleInputChange('end_date', date)}
                          renderInput={(params) => (
                            <TextField 
                              {...params} 
                              fullWidth 
                              required 
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 2,
                                  '&:hover': {
                                    transform: 'translateY(-2px)',
                                    transition: 'transform 0.2s ease-in-out',
                                  },
                                },
                              }}
                            />
                          )}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TimePicker
                          label="Horário de Início (opcional)"
                          value={formData.start_time}
                          onChange={(time) => handleInputChange('start_time', time)}
                          disabled={formData.is_all_day}
                          renderInput={(params) => (
                            <TextField 
                              {...params} 
                              fullWidth 
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 2,
                                  '&:hover': {
                                    transform: 'translateY(-2px)',
                                    transition: 'transform 0.2s ease-in-out',
                                  },
                                },
                              }}
                            />
                          )}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TimePicker
                          label="Horário de Fim (opcional)"
                          value={formData.end_time}
                          onChange={(time) => handleInputChange('end_time', time)}
                          disabled={formData.is_all_day}
                          renderInput={(params) => (
                            <TextField 
                              {...params} 
                              fullWidth 
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 2,
                                  '&:hover': {
                                    transform: 'translateY(-2px)',
                                    transition: 'transform 0.2s ease-in-out',
                                  },
                                },
                              }}
                            />
                          )}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.is_all_day}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                handleInputChange('is_all_day', checked);
                                const today = new Date();
                                if (checked) {
                                  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
                                  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
                                  handleInputChange('start_time', start);
                                  handleInputChange('end_time', end);
                                } else {
                                  handleInputChange('start_time', null);
                                  handleInputChange('end_time', null);
                                }
                              }}
                            />
                          }
                          label="Dia inteiro (24/7)"
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Box display="flex" gap={1} mt={1}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              const today = new Date();
                              const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
                              const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
                              handleInputChange('is_all_day', true);
                              handleInputChange('start_time', start);
                              handleInputChange('end_time', end);
                            }}
                          >
                            24/7
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              const today = new Date();
                              const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0);
                              const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0, 0);
                              handleInputChange('is_all_day', false);
                              handleInputChange('start_time', start);
                              handleInputChange('end_time', end);
                            }}
                          >
                            Horário Comercial (09–18)
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Dias da Semana */}
            <Grid item xs={12} md={6}>
              <Grow in timeout={1400}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    backgroundColor: (theme) => theme.palette.background.paper,
                    backdropFilter: 'blur(10px)',
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: (theme) => theme.palette.primary.main,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          bgcolor: 'primary.main',
                          color: '#000',
                          mr: 2,
                        }}
                      >
                        <TimeIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Dias da Semana
                      </Typography>
                    </Box>
                    
                    <FormGroup row>
                      {daysOfWeek.map(day => (
                        <FormControlLabel
                          key={day.value}
                          control={
                            <Checkbox
                              checked={formData.days_of_week.includes(day.value)}
                              onChange={() => handleDayToggle(day.value)}
                            />
                          }
                          label={day.label}
                        />
                      ))}
                    </FormGroup>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Configurações Avançadas */}
            <Grid item xs={12} md={6}>
              <Grow in timeout={1600}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    backgroundColor: (theme) => theme.palette.background.paper,
                    backdropFilter: 'blur(10px)',
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: (theme) => theme.palette.primary.main,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          bgcolor: 'primary.main',
                          color: '#000',
                          mr: 2,
                        }}
                      >
                        <SettingsIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Configurações Avançadas
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Prioridade"
                          type="number"
                          value={formData.priority}
                          onChange={(e) => handleInputChange('priority', parseInt(e.target.value) || 1)}
                          inputProps={{ min: 1, max: 10 }}
                          helperText="1 = Baixa, 10 = Alta"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            },
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <FormControl fullWidth>
                          <InputLabel>Tipo de Conteúdo</InputLabel>
                          <Select
                            value={formData.content_type}
                            onChange={(e) => handleInputChange('content_type', e.target.value)}
                            label="Tipo de Conteúdo"
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            }}
                          >
                            <MenuItem value="main">Principal (Vídeos)</MenuItem>
                            <MenuItem value="overlay">Overlay (Logos/Imagens)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.is_persistent}
                              onChange={(e) => handleInputChange('is_persistent', e.target.checked)}
                            />
                          }
                          label="Agendamento Persistente"
                        />
                        <FormHelperText>
                          Conteúdo fica fixo na tela até ser substituído por outro agendamento
                        </FormHelperText>
                      </Grid>
                      
                      {/* Compatibilidade de Dispositivos removida — sempre 'legacy' por padrão */}
                    </Grid>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Configurações de Reprodução */}
            <Grid item xs={12}>
              <Grow in timeout={1800}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    backgroundColor: (theme) => theme.palette.background.paper,
                    backdropFilter: 'blur(10px)',
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: 'linear-gradient(45deg, #ff7730, #ff9800)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          background: 'linear-gradient(45deg, #ff7730, #ff9800)',
                          color: '#000',
                          mr: 2,
                        }}
                      >
                        <RepeatIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          Configurações de Reprodução
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Configure como o conteúdo será reproduzido neste agendamento
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Modo de Reprodução</InputLabel>
                          <Select
                            value={formData.playback_mode}
                            onChange={(e) => handleInputChange('playback_mode', e.target.value)}
                            label="Modo de Reprodução"
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            }}
                          >
                            <MenuItem value="sequential">Sequencial</MenuItem>
                            <MenuItem value="random">Aleatório</MenuItem>
                            <MenuItem value="single">Único (primeiro conteúdo)</MenuItem>
                            <MenuItem value="loop_infinite">Loop Infinito</MenuItem>
                          </Select>
                          <FormHelperText>
                            Como os conteúdos da campanha serão reproduzidos
                          </FormHelperText>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Comportamento do Loop</InputLabel>
                          <Select
                            value={formData.loop_behavior}
                            onChange={(e) => handleInputChange('loop_behavior', e.target.value)}
                            label="Comportamento do Loop"
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            }}
                          >
                            <MenuItem value="until_next">Até próximo agendamento</MenuItem>
                            <MenuItem value="time_limited">Por tempo limitado</MenuItem>
                            <MenuItem value="infinite">Infinito</MenuItem>
                          </Select>
                          <FormHelperText>
                            Quando parar de reproduzir o conteúdo
                          </FormHelperText>
                        </FormControl>
                      </Grid>

                      

                      {formData.loop_behavior === 'time_limited' && (
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Duração do Loop (minutos)"
                            value={formData.loop_duration_minutes || ''}
                            onChange={(e) => handleInputChange('loop_duration_minutes', parseInt(e.target.value) || null)}
                            inputProps={{ min: 1, max: 1440 }}
                            required={formData.loop_behavior === 'time_limited'}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  transition: 'transform 0.2s ease-in-out',
                                },
                              },
                            }}
                          />
                          <FormHelperText>
                            Por quanto tempo o loop deve durar
                          </FormHelperText>
                        </Grid>
                      )}

                      {/* Políticas fixas: sem embaralhar; pular conteúdos com erro sempre habilitado */}
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Este agendamento reproduz o vídeo já compilado da campanha. Embaralhamento não é aplicável e conteúdos com erro serão pulados automaticamente.
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Ações */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => {
                    try { localStorage.removeItem('schedule_returnTo'); localStorage.removeItem('schedule_from'); } catch (e) {}
                    const fromState = location.state?.from;
                    const fromQuery = searchParams.get('from');
                    if (fromState === 'calendar' || fromQuery === 'calendar') {
                      navigate(-1);
                    } else {
                      navigate(returnToPath);
                    }
                  }}
                  startIcon={<CancelIcon />}
                  sx={{
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      transition: 'transform 0.2s ease-in-out',
                    },
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={<SaveIcon />}
                  sx={{
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      transition: 'transform 0.2s ease-in-out',
                    },
                  }}
                >
                  {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Box>
    </LocalizationProvider>
  );
};

export default ScheduleForm;
