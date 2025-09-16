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
import { useNavigate, useParams } from 'react-router-dom';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ScheduleForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
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
      
      setFormData({
        name: schedule.name || '',
        campaign_id: schedule.campaign_id || '',
        player_id: schedule.player_id || '',
        start_date: schedule.start_date ? schedule.start_date.split('T')[0] : '',
        end_date: schedule.end_date ? schedule.end_date.split('T')[0] : '',
        start_time: schedule.start_time || '',
        end_time: schedule.end_time || '',
        days_of_week: schedule.days_of_week ? schedule.days_of_week.split(',').map(d => parseInt(d.trim())) : [1,2,3,4,5],
        repeat_type: schedule.repeat_type || 'daily',
        repeat_interval: schedule.repeat_interval || 1,
        priority: schedule.priority || 1,
        is_persistent: schedule.is_persistent || false,
        content_type: schedule.content_type || 'main',
        is_active: schedule.is_active !== false,
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
        start_date: formData.start_date,
        end_date: formData.end_date,
        days_of_week: formData.days_of_week.join(','),
      };

      if (formData.start_time) {
        conflictData.start_time = formData.start_time;
      }
      if (formData.end_time) {
        conflictData.end_time = formData.end_time;
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
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        days_of_week: formData.days_of_week.join(','),
        repeat_type: formData.repeat_type,
        repeat_interval: formData.repeat_interval,
        priority: formData.priority,
        is_persistent: formData.is_persistent,
        content_type: formData.content_type,
        is_active: formData.is_active,
      };

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
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <TimePicker
                        label="Horário de Fim (opcional)"
                        value={formData.end_time}
                        onChange={(time) => handleInputChange('end_time', time)}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
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
