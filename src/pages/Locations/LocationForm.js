import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Divider
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const LocationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    city: '',
    state: '',
    address: '',
    timezone: 'America/Sao_Paulo',
    network_bandwidth_mbps: 100,
    peak_hours_start: '08:00',
    peak_hours_end: '18:00',
    is_active: true
  });

  const [timezones, setTimezones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchTimezones();
    if (isEdit) {
      fetchLocation();
    }
  }, [id, isEdit]);

  const fetchTimezones = async () => {
    try {
      const response = await axios.get('/api/locations/timezones');
      setTimezones(response.data.timezones);
    } catch (err) {
      console.error('Erro ao carregar timezones:', err);
    }
  };

  const fetchLocation = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/locations/${id}`);
      const location = response.data.location;
      
      setFormData({
        name: location.name || '',
        city: location.city || '',
        state: location.state || '',
        address: location.address || '',
        timezone: location.timezone || 'America/Sao_Paulo',
        network_bandwidth_mbps: location.network_bandwidth_mbps || 100,
        peak_hours_start: location.peak_hours_start || '08:00',
        peak_hours_end: location.peak_hours_end || '18:00',
        is_active: location.is_active !== undefined ? location.is_active : true
      });
    } catch (err) {
      setError('Erro ao carregar sede: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (event) => {
    const value = field === 'is_active' ? event.target.checked : event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    
    if (!formData.city.trim()) {
      setError('Cidade é obrigatória');
      return;
    }
    
    if (!formData.state.trim()) {
      setError('Estado é obrigatório');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const payload = {
        ...formData,
        network_bandwidth_mbps: Number(formData.network_bandwidth_mbps)
      };

      if (isEdit) {
        await axios.put(`/api/locations/${id}`, payload);
        setSuccess('Sede atualizada com sucesso!');
      } else {
        await axios.post('/api/locations/', payload);
        setSuccess('Sede criada com sucesso!');
      }
      
      setTimeout(() => {
        navigate('/locations');
      }, 1500);
      
    } catch (err) {
      setError('Erro ao salvar sede: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const brazilianStates = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  if (loading && isEdit) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Typography>Carregando sede...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" mb={3}>
          <LocationIcon sx={{ mr: 2, fontSize: 32 }} color="primary" />
          <Typography variant="h4" component="h1">
            {isEdit ? 'Editar Sede' : 'Nova Sede'}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Informações Básicas */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Informações Básicas
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome da Sede"
                value={formData.name}
                onChange={handleChange('name')}
                required
                placeholder="Ex: Sede São Paulo Centro"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={handleChange('is_active')}
                    color="primary"
                  />
                }
                label="Sede Ativa"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Cidade"
                value={formData.city}
                onChange={handleChange('city')}
                required
                placeholder="Ex: São Paulo"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Estado</InputLabel>
                <Select
                  value={formData.state}
                  onChange={handleChange('state')}
                  label="Estado"
                >
                  {brazilianStates.map((state) => (
                    <MenuItem key={state} value={state}>
                      {state}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Endereço Completo"
                value={formData.address}
                onChange={handleChange('address')}
                placeholder="Ex: Rua das Flores, 123 - Centro"
                multiline
                rows={2}
              />
            </Grid>

            {/* Configurações de Rede */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Configurações de Rede
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={formData.timezone}
                  onChange={handleChange('timezone')}
                  label="Timezone"
                >
                  {timezones.map((tz) => (
                    <MenuItem key={tz} value={tz}>
                      {tz}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Largura de Banda (Mbps)"
                type="number"
                value={formData.network_bandwidth_mbps}
                onChange={handleChange('network_bandwidth_mbps')}
                inputProps={{ min: 1, max: 10000 }}
                placeholder="100"
              />
            </Grid>

            {/* Horários de Pico */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Horários de Pico
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Durante estes horários, a distribuição de conteúdo será otimizada para reduzir o impacto na rede.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Início do Horário de Pico"
                type="time"
                value={formData.peak_hours_start}
                onChange={handleChange('peak_hours_start')}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Fim do Horário de Pico"
                type="time"
                value={formData.peak_hours_end}
                onChange={handleChange('peak_hours_end')}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>

            {/* Botões de Ação */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={() => navigate('/locations')}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar Sede')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default LocationForm;
