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
  Card,
  CardContent,
  Skeleton,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  LocationOn as LocationIcon,
  ArrowBack as BackIcon,
  Business as BusinessIcon,
  NetworkWifi as NetworkIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import axios from '../../config/axios';

const DEFAULT_COMPANIES = ['iTracker', 'Rio Brasil Terminal - RBT', 'CLIA'];

const LocationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [companiesOptions, setCompaniesOptions] = useState(DEFAULT_COMPANIES);

  const [formData, setFormData] = useState({
    name: '',
    city: '',
    state: '',
    address: '',
    company: DEFAULT_COMPANIES[0],
    timezone: 'America/Sao_Paulo',
    network_bandwidth_mbps: 100,
    peak_hours_start: '08:00',
    peak_hours_end: '18:00',
    is_active: true
  });

  const [timezones, setTimezones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const init = async () => {
      await fetchTimezones();
      await fetchCompanies();
      if (isEdit) {
        await fetchLocation();
      }
      setInitialLoading(false);
    };
    init();
  }, [id, isEdit]);

  const fetchTimezones = async () => {
    try {
      const response = await axios.get('/locations/timezones');
      setTimezones(response.data.timezones);
    } catch (err) {
      console.error('Erro ao carregar timezones:', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await axios.get('/auth/companies');
      const list = Array.isArray(res.data?.companies) && res.data.companies.length
        ? res.data.companies
        : DEFAULT_COMPANIES;
      setCompaniesOptions(list);
      // Se não for edição, alinhar o default com a primeira opção dinâmica
      if (!isEdit) {
        setFormData(prev => ({ ...prev, company: list[0] }));
      }
    } catch (e) {
      setCompaniesOptions(DEFAULT_COMPANIES);
      if (!isEdit) {
        setFormData(prev => ({ ...prev, company: DEFAULT_COMPANIES[0] }));
      }
    }
  };

  const fetchLocation = async () => {
    try {
      const response = await axios.get(`/locations/${id}`);
      const location = response.data.location;
      
      setFormData({
        name: location.name || '',
        city: location.city || '',
        state: location.state || '',
        address: location.address || '',
        company: location.company || DEFAULT_COMPANIES[0],
        timezone: location.timezone || 'America/Sao_Paulo',
        network_bandwidth_mbps: location.network_bandwidth_mbps || 100,
        peak_hours_start: location.peak_hours_start || '08:00',
        peak_hours_end: location.peak_hours_end || '18:00',
        is_active: location.is_active !== undefined ? location.is_active : true
      });
    } catch (err) {
      setError('Erro ao carregar sede: ' + (err.response?.data?.error || err.message));
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

    if (!formData.company || !companiesOptions.includes(formData.company)) {
      setError('Empresa é obrigatória');
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

  return (
    <Box
      sx={{
        background: (theme) => theme.palette.mode === 'dark' 
          ? 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)'
          : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        minHeight: '100vh',
        p: 3,
      }}
    >
      {/* Enhanced Header */}
      <Fade in timeout={800}>
        <Box display="flex" alignItems="center" mb={4}>
          <IconButton 
            onClick={() => navigate('/locations')} 
            sx={{ 
              mr: 2,
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                : 'linear-gradient(45deg, #2196F3, #21CBF3)',
              color: 'white',
              '&:hover': {
                transform: 'scale(1.1)',
                transition: 'transform 0.2s ease-in-out',
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
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                  : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {isEdit ? 'Editar Sede' : 'Nova Sede'}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {isEdit ? 'Modifique as configurações da sede' : 'Configure uma nova sede para sua empresa'}
            </Typography>
          </Box>
        </Box>
      </Fade>

      {error && (
        <Fade in timeout={600}>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        </Fade>
      )}

      {success && (
        <Fade in timeout={600}>
          <Alert severity="success" sx={{ mb: 2, borderRadius: 3 }}>
            {success}
          </Alert>
        </Fade>
      )}

      {initialLoading ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />
          </Grid>
        </Grid>
      ) : (
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Informações Básicas */}
            <Grid item xs={12} md={6}>
              <Grow in timeout={1000}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    background: (theme) => theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(255, 119, 48, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)'
                      : 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 203, 243, 0.05) 100%)',
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
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(90deg, #ff7730, #ff9800)'
                        : 'linear-gradient(90deg, #2196F3, #21CBF3)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          background: (theme) => theme.palette.mode === 'dark'
                            ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                            : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                          mr: 2,
                        }}
                      >
                        <BusinessIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Informações Básicas
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          required
                          label="Nome da Sede"
                          value={formData.name}
                          onChange={handleChange('name')}
                          placeholder="Ex: Matriz São Paulo"
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
                          <InputLabel>Empresa</InputLabel>
                          <Select
                            value={formData.company}
                            onChange={handleChange('company')}
                            label="Empresa"
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            }}
                          >
                            {companiesOptions.map((company) => (
                              <MenuItem key={company} value={company}>
                                {company}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          required
                          label="Cidade"
                          value={formData.city}
                          onChange={handleChange('city')}
                          placeholder="Ex: São Paulo"
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
                          <InputLabel>Estado</InputLabel>
                          <Select
                            value={formData.state}
                            onChange={handleChange('state')}
                            label="Estado"
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
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
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Endereço Completo"
                          value={formData.address}
                          onChange={handleChange('address')}
                          placeholder="Rua, número, bairro, CEP"
                          multiline
                          rows={2}
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
                    </Grid>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Configurações de Rede */}
            <Grid item xs={12} md={6}>
              <Grow in timeout={1200}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    background: (theme) => theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(255, 119, 48, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)'
                      : 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 203, 243, 0.05) 100%)',
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
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(90deg, #ff7730, #ff9800)'
                        : 'linear-gradient(90deg, #2196F3, #21CBF3)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          background: (theme) => theme.palette.mode === 'dark'
                            ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                            : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                          mr: 2,
                        }}
                      >
                        <NetworkIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Configurações de Rede
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <FormControl fullWidth>
                          <InputLabel>Fuso Horário</InputLabel>
                          <Select
                            value={formData.timezone}
                            onChange={handleChange('timezone')}
                            label="Fuso Horário"
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
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
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Largura de Banda (Mbps)"
                          value={formData.network_bandwidth_mbps}
                          onChange={handleChange('network_bandwidth_mbps')}
                          inputProps={{ min: 1, max: 1000 }}
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
                    </Grid>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Horários de Pico */}
            <Grid item xs={12}>
              <Grow in timeout={1400}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    background: (theme) => theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(255, 119, 48, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)'
                      : 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 203, 243, 0.05) 100%)',
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
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(90deg, #ff7730, #ff9800)'
                        : 'linear-gradient(90deg, #2196F3, #21CBF3)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          background: (theme) => theme.palette.mode === 'dark'
                            ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                            : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                          mr: 2,
                        }}
                      >
                        <ScheduleIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Horários de Pico
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Defina o horário comercial da sede para otimização de conteúdo
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          type="time"
                          label="Início do Horário de Pico"
                          value={formData.peak_hours_start}
                          onChange={handleChange('peak_hours_start')}
                          InputLabelProps={{ shrink: true }}
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
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          type="time"
                          label="Fim do Horário de Pico"
                          value={formData.peak_hours_end}
                          onChange={handleChange('peak_hours_end')}
                          InputLabelProps={{ shrink: true }}
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
                      <Grid item xs={12} md={4}>
                        <Box display="flex" alignItems="center" height="100%">
                          <FormControlLabel
                            control={
                              <Switch
                                checked={formData.is_active}
                                onChange={handleChange('is_active')}
                              />
                            }
                            label="Sede ativa"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Actions */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/locations')}
                  disabled={loading}
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
                    background: (theme) => theme.palette.mode === 'dark'
                      ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                      : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      transition: 'transform 0.2s ease-in-out',
                    },
                    '&:disabled': {
                      background: 'rgba(0, 0, 0, 0.12)',
                    },
                  }}
                >
                  {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      )}
    </Box>
  );
};

export default LocationForm;
