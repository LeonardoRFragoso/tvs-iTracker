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
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import axios from '../../config/axios';
import PageTitle from '../../components/Common/PageTitle';

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
        is_active: location.is_active !== undefined ? location.is_active : true
      });
    } catch (err) {
      setError('Erro ao carregar empresa: ' + (err.response?.data?.error || err.message));
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
        ...formData
      };

      if (isEdit) {
        await axios.put(`/locations/${id}`, payload);
        setSuccess('Empresa atualizada com sucesso!');
      } else {
        await axios.post('/locations/', payload);
        setSuccess('Empresa criada com sucesso!');
      }
      
      setTimeout(() => {
        navigate('/locations');
      }, 1500);
      
    } catch (err) {
      setError('Erro ao salvar empresa: ' + (err.response?.data?.error || err.message));
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
          ? theme.palette.background.default
          : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        minHeight: '100vh',
        p: 3,
      }}
    >
      {/* Header com PageTitle */}
      <PageTitle 
        title={isEdit ? 'Editar Empresa' : 'Nova Empresa'}
        subtitle={isEdit ? 'Atualize as informações da empresa' : 'Cadastre uma nova empresa no sistema'}
        backTo="/locations"
      />

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
            <Grid item xs={12}>
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
                          label="Nome da Empresa"
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
                        <Box display="flex" alignItems="center" justifyContent="center">
                          <FormControlLabel
                            control={
                              <Switch
                                checked={formData.is_active}
                                onChange={handleChange('is_active')}
                              />
                            }
                            label="Empresa ativa"
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
