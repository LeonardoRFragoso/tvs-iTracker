import React, { useState, useEffect } from 'react';
import {
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
  Alert,
  IconButton,
  Divider,
  Chip,
  Switch,
  FormHelperText,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Repeat as RepeatIcon,
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import axios from '../../config/axios';

const API_BASE_URL = `${axios.defaults.baseURL}/api`;

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

  const [formData, setFormData] = useState({
    name: '',
    campaign_id: '',
    player_id: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    days_of_week: [1, 2, 3, 4, 5], // Monday to Friday
    repeat_type: 'daily',
    repeat_interval: 1,
    priority: 1,
    is_persistent: false,
    content_type: 'main',
    is_active: true,
    is_all_day: false,
  });

  const [campaigns, setCampaigns] = useState([]);
  const [players, setPlayers] = useState([]);
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
    if (isEdit) {
      loadSchedule();
    }
  }, [id, isEdit]);

  const loadSchedule = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/schedules/${id}`);
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
      });
    } catch (err) {
      setError('Erro ao carregar agendamento');
      console.error('Load schedule error:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/campaigns`);
      setCampaigns(response.data.campaigns || []);
    } catch (err) {
      console.error('Load campaigns error:', err);
    }
  };

  const loadPlayers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/players`);
      setPlayers(response.data.players || []);
    } catch (err) {
      console.error('Load players error:', err);
    }
  };

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

      const response = await axios.post(`${API_BASE_URL}/schedules/conflicts`, conflictData);
      setConflicts(response.data.conflicts || []);
    } catch (err) {
      console.error('Check conflicts error:', err);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(checkConflicts, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.player_id, formData.start_date, formData.end_date, formData.start_time, formData.end_time, formData.days_of_week]);

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
      if (!formData.player_id) {
        throw new Error('Player é obrigatório');
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
        player_id: formData.player_id,
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
        response = await axios.put(`${API_BASE_URL}/schedules/${id}`, submitData);
      } else {
        response = await axios.post(`${API_BASE_URL}/schedules`, submitData);
      }

      setSuccess(isEdit ? 'Agendamento atualizado com sucesso!' : 'Agendamento criado com sucesso!');
      
      setTimeout(() => {
        navigate('/schedules');
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
      <Box>
        <Box display="flex" alignItems="center" mb={3}>
          <IconButton onClick={() => navigate('/schedules')} sx={{ mr: 2 }}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {conflicts.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
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
            {/* Basic Information */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <EventIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Informações Básicas
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Nome do Agendamento"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        required
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Campanha</InputLabel>
                        <Select
                          value={formData.campaign_id}
                          onChange={(e) => handleInputChange('campaign_id', e.target.value)}
                          label="Campanha"
                        >
                          {campaigns.map(campaign => (
                            <MenuItem key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Player</InputLabel>
                        <Select
                          value={formData.player_id}
                          onChange={(e) => handleInputChange('player_id', e.target.value)}
                          label="Player"
                        >
                          {players.map(player => (
                            <MenuItem key={player.id} value={player.id}>
                              {player.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Date and Time */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Período e Horário
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        label="Data de Início"
                        value={formData.start_date}
                        onChange={(date) => handleInputChange('start_date', date)}
                        renderInput={(params) => <TextField {...params} fullWidth required />}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        label="Data de Fim"
                        value={formData.end_date}
                        onChange={(date) => handleInputChange('end_date', date)}
                        renderInput={(params) => <TextField {...params} fullWidth required />}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <TimePicker
                        label="Horário de Início (opcional)"
                        value={formData.start_time}
                        onChange={(time) => handleInputChange('start_time', time)}
                        disabled={formData.is_all_day}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <TimePicker
                        label="Horário de Fim (opcional)"
                        value={formData.end_time}
                        onChange={(time) => handleInputChange('end_time', time)}
                        disabled={formData.is_all_day}
                        renderInput={(params) => <TextField {...params} fullWidth />}
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
              </Card>
            </Grid>

            {/* Days of Week */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Dias da Semana
                  </Typography>
                  
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
              </Card>
            </Grid>

            {/* Advanced Settings */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <RepeatIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Configurações Avançadas
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Prioridade"
                        type="number"
                        value={formData.priority}
                        onChange={(e) => handleInputChange('priority', parseInt(e.target.value) || 1)}
                        inputProps={{ min: 1, max: 10 }}
                        helperText="1 = Baixa, 10 = Alta"
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Tipo de Conteúdo</InputLabel>
                        <Select
                          value={formData.content_type}
                          onChange={(e) => handleInputChange('content_type', e.target.value)}
                          label="Tipo de Conteúdo"
                        >
                          <MenuItem value="main">Principal (Vídeos)</MenuItem>
                          <MenuItem value="overlay">Overlay (Logos/Imagens)</MenuItem>
                        </Select>
                        <FormHelperText>
                          Overlay fica fixo na tela, Principal reproduz por período
                        </FormHelperText>
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
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Actions */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/schedules')}
                  startIcon={<CancelIcon />}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={<SaveIcon />}
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
