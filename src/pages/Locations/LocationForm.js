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
  Divider,
  IconButton,
  Fade,
  Grow,
  Avatar,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  LocationOn as LocationIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
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

  const { isDarkMode } = useTheme();

  useEffect(() => {
    fetchTimezones();
    if (isEdit) {
      fetchLocation();
    }
  }, [id, isEdit]);

  const fetchTimezones = async () => {
    try {
      const response = await axios.get('/locations/timezones');
      setTimezones(response.data.timezones);
    } catch (err) {
      console.error('Erro ao carregar timezones:', err);
    }
  };

  const fetchLocation = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/locations/${id}`);
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
        await axios.put(`/locations/${id}`, payload);
        setSuccess('Sede atualizada com sucesso!');
      } else {
        await axios.post('/locations/', payload);
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
      <Fade in={true} timeout={800}>
        <Box 
          sx={{ 
            textAlign: 'center', 
            mt: 8,
            background: isDarkMode 
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            borderRadius: 3,
            p: 4,
            mx: 'auto',
            maxWidth: 400,
          }}
        >
          <Avatar
            sx={{
              width: 60,
              height: 60,
              mx: 'auto',
              mb: 2,
              background: isDarkMode
                ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            }}
          >
            <LocationIcon sx={{ fontSize: 30 }} />
          </Avatar>
          <Typography variant="h6" gutterBottom>
            Carregando sede...
          </Typography>
        </Box>
      </Fade>
    );
  }

  return (
    <Fade in={true} timeout={1000}>
      <Box
        sx={{
          background: isDarkMode 
            ? 'linear-gradient(135deg, #121212 0%, #1e1e1e 100%)'
            : 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
          minHeight: '100vh',
          py: 4,
        }}
      >
        <Container maxWidth="md">
          <Grow in={true} timeout={1200}>
            <Paper 
              sx={{ 
                p: 4,
                borderRadius: 3,
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: isDarkMode
                    ? 'radial-gradient(circle at 30% 20%, rgba(255, 152, 0, 0.1) 0%, transparent 50%)'
                    : 'radial-gradient(circle at 30% 20%, rgba(25, 118, 210, 0.1) 0%, transparent 50%)',
                  pointerEvents: 'none',
                },
              }}
            >
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <Box display="flex" alignItems="center" mb={4}>
                  <IconButton 
                    onClick={() => navigate('/locations')} 
                    sx={{ 
                      mr: 2,
                      background: isDarkMode
                        ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                        : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                      color: 'white',
                      '&:hover': {
                        background: isDarkMode
                          ? 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)'
                          : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                        transform: 'scale(1.1)',
                      },
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <BackIcon />
                  </IconButton>
                  <Avatar
                    sx={{
                      mr: 2,
                      width: 48,
                      height: 48,
                      background: isDarkMode
                        ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                        : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                    }}
                  >
                    <LocationIcon sx={{ fontSize: 24 }} />
                  </Avatar>
                  <Typography 
                    variant="h4" 
                    component="h1"
                    sx={{
                      fontWeight: 'bold',
                      background: isDarkMode
                        ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                        : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {isEdit ? 'Editar Sede' : 'Nova Sede'}
                  </Typography>
                </Box>

                {error && (
                  <Fade in={true} timeout={800}>
                    <Alert 
                      severity="error" 
                      sx={{ 
                        mb: 3,
                        borderRadius: 3,
                        border: `1px solid ${isDarkMode ? '#d32f2f' : '#f44336'}`,
                      }} 
                      onClose={() => setError('')}
                    >
                      {error}
                    </Alert>
                  </Fade>
                )}

                {success && (
                  <Fade in={true} timeout={800}>
                    <Alert 
                      severity="success" 
                      sx={{ 
                        mb: 3,
                        borderRadius: 3,
                        border: `1px solid ${isDarkMode ? '#2e7d32' : '#4caf50'}`,
                      }}
                    >
                      {success}
                    </Alert>
                  </Fade>
                )}

                <form onSubmit={handleSubmit}>
                  <Grid container spacing={4}>
                    {/* Informações Básicas */}
                    <Grid item xs={12}>
                      <Grow in={true} timeout={1400}>
                        <Box>
                          <Typography variant="h6" gutterBottom fontWeight="bold">
                            Informações Básicas
                          </Typography>
                          <Divider 
                            sx={{ 
                              mb: 3,
                              background: isDarkMode
                                ? 'linear-gradient(90deg, #ff9800 0%, transparent 100%)'
                                : 'linear-gradient(90deg, #1976d2 0%, transparent 100%)',
                              height: 2,
                            }} 
                          />
                        </Box>
                      </Grow>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Grow in={true} timeout={1600}>
                        <TextField
                          fullWidth
                          label="Nome da Sede"
                          value={formData.name}
                          onChange={handleChange('name')}
                          required
                          placeholder="Ex: Sede São Paulo Centro"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover fieldset': {
                                borderColor: 'primary.main',
                              },
                            },
                          }}
                        />
                      </Grow>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Grow in={true} timeout={1800}>
                        <Box display="flex" alignItems="center" height="100%">
                          <FormControlLabel
                            control={
                              <Switch
                                checked={formData.is_active}
                                onChange={handleChange('is_active')}
                                color="primary"
                                sx={{
                                  '& .MuiSwitch-thumb': {
                                    background: isDarkMode
                                      ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                                      : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                  },
                                }}
                              />
                            }
                            label={
                              <Typography variant="body1" fontWeight="medium">
                                Sede Ativa
                              </Typography>
                            }
                          />
                        </Box>
                      </Grow>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Grow in={true} timeout={2000}>
                        <TextField
                          fullWidth
                          label="Cidade"
                          value={formData.city}
                          onChange={handleChange('city')}
                          required
                          placeholder="Ex: São Paulo"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover fieldset': {
                                borderColor: 'primary.main',
                              },
                            },
                          }}
                        />
                      </Grow>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Grow in={true} timeout={2200}>
                        <FormControl fullWidth required>
                          <InputLabel>Estado</InputLabel>
                          <Select
                            value={formData.state}
                            onChange={handleChange('state')}
                            label="Estado"
                            sx={{
                              borderRadius: 2,
                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'primary.main',
                              },
                            }}
                          >
                            {brazilianStates.map((state) => (
                              <MenuItem key={state} value={state}>
                                {state}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grow>
                    </Grid>

                    <Grid item xs={12}>
                      <Grow in={true} timeout={2400}>
                        <TextField
                          fullWidth
                          label="Endereço Completo"
                          value={formData.address}
                          onChange={handleChange('address')}
                          placeholder="Ex: Rua das Flores, 123 - Centro"
                          multiline
                          rows={2}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover fieldset': {
                                borderColor: 'primary.main',
                              },
                            },
                          }}
                        />
                      </Grow>
                    </Grid>

                    {/* Configurações de Rede */}
                    <Grid item xs={12}>
                      <Grow in={true} timeout={2600}>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="h6" gutterBottom fontWeight="bold">
                            Configurações de Rede
                          </Typography>
                          <Divider 
                            sx={{ 
                              mb: 3,
                              background: isDarkMode
                                ? 'linear-gradient(90deg, #ff9800 0%, transparent 100%)'
                                : 'linear-gradient(90deg, #1976d2 0%, transparent 100%)',
                              height: 2,
                            }} 
                          />
                        </Box>
                      </Grow>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Grow in={true} timeout={2800}>
                        <FormControl fullWidth>
                          <InputLabel>Timezone</InputLabel>
                          <Select
                            value={formData.timezone}
                            onChange={handleChange('timezone')}
                            label="Timezone"
                            sx={{
                              borderRadius: 2,
                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'primary.main',
                              },
                            }}
                          >
                            {timezones.map((tz) => (
                              <MenuItem key={tz} value={tz}>
                                {tz}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grow>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Grow in={true} timeout={3000}>
                        <TextField
                          fullWidth
                          label="Largura de Banda (Mbps)"
                          type="number"
                          value={formData.network_bandwidth_mbps}
                          onChange={handleChange('network_bandwidth_mbps')}
                          inputProps={{ min: 1, max: 10000 }}
                          placeholder="100"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover fieldset': {
                                borderColor: 'primary.main',
                              },
                            },
                          }}
                        />
                      </Grow>
                    </Grid>

                    {/* Horários de Pico */}
                    <Grid item xs={12}>
                      <Grow in={true} timeout={3200}>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="h6" gutterBottom fontWeight="bold">
                            Horários de Pico
                          </Typography>
                          <Divider 
                            sx={{ 
                              mb: 2,
                              background: isDarkMode
                                ? 'linear-gradient(90deg, #ff9800 0%, transparent 100%)'
                                : 'linear-gradient(90deg, #1976d2 0%, transparent 100%)',
                              height: 2,
                            }} 
                          />
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Durante estes horários, a distribuição de conteúdo será otimizada para reduzir o impacto na rede.
                          </Typography>
                        </Box>
                      </Grow>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Grow in={true} timeout={3400}>
                        <TextField
                          fullWidth
                          label="Início do Horário de Pico"
                          type="time"
                          value={formData.peak_hours_start}
                          onChange={handleChange('peak_hours_start')}
                          InputLabelProps={{
                            shrink: true,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover fieldset': {
                                borderColor: 'primary.main',
                              },
                            },
                          }}
                        />
                      </Grow>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Grow in={true} timeout={3600}>
                        <TextField
                          fullWidth
                          label="Fim do Horário de Pico"
                          type="time"
                          value={formData.peak_hours_end}
                          onChange={handleChange('peak_hours_end')}
                          InputLabelProps={{
                            shrink: true,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover fieldset': {
                                borderColor: 'primary.main',
                              },
                            },
                          }}
                        />
                      </Grow>
                    </Grid>

                    {/* Botões de Ação */}
                    <Grid item xs={12}>
                      <Grow in={true} timeout={3800}>
                        <Box display="flex" justifyContent="flex-end" gap={2} mt={4}>
                          <Button
                            variant="outlined"
                            startIcon={<CancelIcon />}
                            onClick={() => navigate('/locations')}
                            disabled={loading}
                            sx={{
                              borderRadius: 3,
                              px: 4,
                              py: 1.5,
                              border: `2px solid ${isDarkMode ? '#555' : '#e0e0e0'}`,
                              '&:hover': {
                                border: `2px solid ${isDarkMode ? '#ff9800' : '#1976d2'}`,
                                transform: 'translateY(-2px)',
                              },
                              transition: 'all 0.3s ease',
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            variant="contained"
                            startIcon={<SaveIcon />}
                            disabled={loading}
                            sx={{
                              borderRadius: 3,
                              px: 4,
                              py: 1.5,
                              background: isDarkMode
                                ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                                : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                              '&:hover': {
                                background: isDarkMode
                                  ? 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)'
                                  : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                                transform: 'translateY(-2px)',
                              },
                              '&:disabled': {
                                background: isDarkMode ? '#333' : '#e0e0e0',
                                color: isDarkMode ? '#666' : '#999',
                              },
                              transition: 'all 0.3s ease',
                            }}
                          >
                            {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar Sede')}
                          </Button>
                        </Box>
                      </Grow>
                    </Grid>
                  </Grid>
                </form>
              </Box>
            </Paper>
          </Grow>
        </Container>
      </Box>
    </Fade>
  );
};

export default LocationForm;
