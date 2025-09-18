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
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
    platform: 'web',
    resolution: '1920x1080',
    orientation: 'landscape',
    default_content_duration: 10,
    transition_effect: 'fade',
    volume_level: 50,
    storage_capacity_gb: 32,
    is_active: true,
  });
  
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLocations();
    if (isEdit) {
      loadPlayer();
    }
  }, [id]);

  const loadLocations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/players/locations`);
      setLocations(response.data.locations || []);
    } catch (err) {
      console.error('Load locations error:', err);
    }
  };

  const loadPlayer = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/players/${id}`);
      setFormData(response.data);
    } catch (err) {
      setError('Erro ao carregar player');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');

      if (isEdit) {
        await axios.put(`${API_BASE_URL}/players/${id}`, formData);
      } else {
        await axios.post(`${API_BASE_URL}/players`, formData);
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
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/players')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Editar Player' : 'Novo Player'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Informações Básicas */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Informações Básicas
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="Nome do Player"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Ex: TV Recepção BH"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      select
                      label="Localização"
                      value={formData.location_id}
                      onChange={(e) => handleChange('location_id', e.target.value)}
                    >
                      {locations.map((location) => (
                        <MenuItem key={location.id} value={location.id}>
                          {location.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Ambiente/Sala"
                      value={formData.room_name}
                      onChange={(e) => handleChange('room_name', e.target.value)}
                      placeholder="Ex: Recepção, Refeitório, Corredor"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      select
                      label="Plataforma"
                      value={formData.platform}
                      onChange={(e) => handleChange('platform', e.target.value)}
                    >
                      <MenuItem value="web">Web Browser</MenuItem>
                      <MenuItem value="android">Android</MenuItem>
                      <MenuItem value="windows">Windows</MenuItem>
                      <MenuItem value="chromecast">Chromecast</MenuItem>
                    </TextField>
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
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Configurações de Rede */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Configurações de Rede
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="MAC Address"
                      value={formData.mac_address || ''}
                      onChange={(e) => handleChange('mac_address', e.target.value)}
                      placeholder="F4:F5:D8:51:81:20"
                      disabled={loading}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="IP Address"
                      value={formData.ip_address || ''}
                      onChange={(e) => handleChange('ip_address', e.target.value)}
                      placeholder="192.168.0.10"
                      disabled={loading}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {formData.platform === 'chromecast' && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Configurações de Chromecast
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Associe este player a um dispositivo Chromecast para reprodução remota.
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Chromecast ID"
                        value={formData.chromecast_id}
                        onChange={(e) => handleChange('chromecast_id', e.target.value)}
                        placeholder="cc_living_room_001"
                        helperText="ID único do dispositivo Chromecast"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Nome do Chromecast"
                        value={formData.chromecast_name}
                        onChange={(e) => handleChange('chromecast_name', e.target.value)}
                        placeholder="TV Recepção"
                        helperText="Nome amigável do dispositivo"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {formData.platform === 'android' && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Configurações para Android TV
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Após salvar o player, abra na TV Android (ou Smart TV com navegador) o endereço:
                    <br />
                    <strong>Menu Players → selecionar o player → botão "Abrir Player"</strong>
                    <br />
                    A página do player conecta-se ao servidor e recebe automaticamente as campanhas agendadas.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Opcional: informe MAC e IP da TV em "Configurações de Rede" para facilitar identificação.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Configurações de Exibição */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Configurações de Exibição
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      select
                      label="Resolução"
                      value={formData.resolution}
                      onChange={(e) => handleChange('resolution', e.target.value)}
                    >
                      <MenuItem value="1920x1080">1920x1080 (Full HD)</MenuItem>
                      <MenuItem value="1366x768">1366x768 (HD)</MenuItem>
                      <MenuItem value="1280x720">1280x720 (HD Ready)</MenuItem>
                      <MenuItem value="3840x2160">3840x2160 (4K)</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      select
                      label="Orientação"
                      value={formData.orientation}
                      onChange={(e) => handleChange('orientation', e.target.value)}
                    >
                      <MenuItem value="landscape">Paisagem (Horizontal)</MenuItem>
                      <MenuItem value="portrait">Retrato (Vertical)</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Duração padrão (segundos)"
                      value={formData.default_content_duration}
                      onChange={(e) => handleChange('default_content_duration', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 300 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      select
                      label="Efeito de Transição"
                      value={formData.transition_effect}
                      onChange={(e) => handleChange('transition_effect', e.target.value)}
                    >
                      <MenuItem value="fade">Fade</MenuItem>
                      <MenuItem value="slide">Slide</MenuItem>
                      <MenuItem value="none">Nenhum</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Volume (%)"
                      value={formData.volume_level}
                      onChange={(e) => handleChange('volume_level', parseInt(e.target.value))}
                      inputProps={{ min: 0, max: 100 }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Configurações de Armazenamento */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Configurações de Armazenamento
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Capacidade de Armazenamento (GB)"
                      value={formData.storage_capacity_gb}
                      onChange={(e) => handleChange('storage_capacity_gb', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 1000 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" height="100%">
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
            </Card>
          </Grid>

          {/* Botões de Ação */}
          <Grid item xs={12}>
            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={() => navigate('/players')}
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
                {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar Player')}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default PlayerForm;
