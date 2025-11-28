import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  IconButton,
  Divider,
  Container,
  Avatar,
  Paper,
  Fade,
  Grow,
  Skeleton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Tv as TvIcon,
  Settings as SettingsIcon,
  NetworkWifi as NetworkIcon,
} from '@mui/icons-material';
import axios from '../../config/axios';
import { useTheme } from '../../contexts/ThemeContext';
import PageTitle from '../../components/Common/PageTitle';

const PlayerForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location_id: '',
    room_name: '',
    mac_address: '',
    ip_address: '',
    chromecast_id: '',
    chromecast_name: '',
    // Valores fixos para Chromecast 4
    platform: 'chromecast',
    device_type: 'modern',
    resolution: '1920x1080',
    orientation: 'landscape',
    default_content_duration: 10,
    transition_effect: 'fade',
    volume_level: 100,
    storage_capacity_gb: 8,
    is_active: true,
  });
  
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      await loadLocations();
      if (isEdit) {
        await loadPlayer();
      }
      setInitialLoading(false);
    };
    init();
  }, [id]);

  // Nota: Platform e device_type são fixos para Chromecast 4
  // Não é mais necessário automação de tipo de dispositivo

  const loadLocations = async () => {
    try {
      const response = await axios.get(`/players/locations`);
      setLocations(response.data.locations || []);
    } catch (err) {
      console.error('Load locations error:', err);
    }
  };

  const loadPlayer = async () => {
    try {
      const response = await axios.get(`/players/${id}`);
      const data = response.data || {};
      // Garantir valores fixos para Chromecast 4
      data.platform = 'chromecast';
      data.device_type = 'modern';
      data.resolution = data.resolution || '1920x1080';
      data.orientation = data.orientation || 'landscape';
      data.storage_capacity_gb = 8; // Chromecast 4 tem ~8GB
      setFormData(data);
    } catch (err) {
      setError('Erro ao carregar player');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');

      if (isEdit) {
        await axios.put(`/players/${id}`, formData);
      } else {
        await axios.post(`/players`, formData);
      }
      
      navigate('/players');
    } catch (err) {
      setError(isEdit ? 'Erro ao atualizar player' : 'Erro ao criar player');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
        title={isEdit ? 'Editar Player' : 'Novo Player'}
        subtitle={isEdit ? 'Atualize as informações do player' : 'Configure um novo dispositivo de exibição'}
        backTo="/players"
      />

      {error && (
        <Fade in timeout={600}>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>
            {error}
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
                        <SettingsIcon />
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
                          label="Nome do Player"
                          value={formData.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          placeholder="Ex: TV Recepção BH"
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
                        <TextField
                          fullWidth
                          required
                          select
                          label="Empresa"
                          value={formData.location_id}
                          onChange={(e) => handleChange('location_id', e.target.value)}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            },
                          }}
                        >
                          {locations.map((location) => (
                            <MenuItem key={location.id} value={location.id}>
                              {location.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Ambiente/Sala"
                          value={formData.room_name}
                          onChange={(e) => handleChange('room_name', e.target.value)}
                          placeholder="Ex: Recepção, Refeitório, Corredor"
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
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                          <Typography variant="body2">
                            <strong>Plataforma:</strong> Chromecast 4 (Google TV) - Configurado automaticamente
                          </Typography>
                        </Alert>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          label="Descrição"
                          value={formData.description}
                          onChange={(e) => handleChange('description', e.target.value)}
                          placeholder="Descrição adicional do player..."
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
                        <Box display="flex" alignItems="center" justifyContent="center">
                          <FormControlLabel
                            control={
                              <Switch
                                checked={formData.is_active}
                                onChange={(e) => handleChange('is_active', e.target.checked)}
                              />
                            }
                            label="Player ativo"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Configurações de Rede (Opcional) */}
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
                        <NetworkIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Configurações de Rede (Opcional)
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                        Essas informações serão coletadas automaticamente quando o player for reproduzido
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="MAC Address (opcional)"
                          value={formData.mac_address || ''}
                          onChange={(e) => handleChange('mac_address', e.target.value)}
                          placeholder="F4:F5:D8:51:81:20 - será detectado automaticamente"
                          disabled={loading}
                          helperText="Deixe em branco para detecção automática"
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
                        <TextField
                          fullWidth
                          label="IP Address (opcional)"
                          value={formData.ip_address || ''}
                          onChange={(e) => handleChange('ip_address', e.target.value)}
                          placeholder="192.168.0.10 - será detectado automaticamente"
                          disabled={loading}
                          helperText="Deixe em branco para detecção automática"
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

            
            

            {/* Actions */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/players')}
                  disabled={loading}
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
                  startIcon={<SaveIcon />}
                  disabled={loading}
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
      )}
    </Box>
  );
};

export default PlayerForm;
