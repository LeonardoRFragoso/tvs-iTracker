import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  IconButton,
  Avatar,
  Divider,
  Fade,
  Grow,
  CircularProgress,
  Slider,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  NetworkWifi as NetworkIcon,
  Tv as DisplayIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from '../../config/axios';
import { useTheme } from '../../contexts/ThemeContext';

const PlayerSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    default_content_duration: 10,
    transition_effect: 'fade',
    volume_level: 100,
    orientation: 'landscape',
    resolution: '1920x1080',
    auto_start: true,
    cache_enabled: true,
    debug_mode: false,
    network_timeout: 30,
    retry_interval: 5,
    max_retries: 3,
    storage_limit_gb: 5,
    auto_update: true,
    update_time: '03:00',
    kiosk_mode: true,
  });

  useEffect(() => {
    loadPlayer();
  }, [id]);

  const loadPlayer = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/players/${id}`);
      setPlayer(response.data);
      
      // Inicializar formData com os valores do player
      const playerData = response.data;
      setFormData({
        default_content_duration: playerData.default_content_duration || 10,
        transition_effect: playerData.transition_effect || 'fade',
        volume_level: playerData.volume_level || 100,
        orientation: playerData.orientation || 'landscape',
        resolution: playerData.resolution || '1920x1080',
        auto_start: playerData.auto_start !== false,
        cache_enabled: playerData.cache_enabled !== false,
        debug_mode: playerData.debug_mode === true,
        network_timeout: playerData.network_timeout || 30,
        retry_interval: playerData.retry_interval || 5,
        max_retries: playerData.max_retries || 3,
        storage_limit_gb: playerData.storage_limit_gb || 5,
        auto_update: playerData.auto_update !== false,
        update_time: playerData.update_time || '03:00',
        kiosk_mode: playerData.kiosk_mode !== false,
      });
    } catch (err) {
      console.error('Erro ao carregar player:', err);
      setError('Erro ao carregar informações do player');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSliderChange = (name) => (e, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      await axios.put(`/players/${id}/settings`, formData);
      
      setSuccess('Configurações salvas com sucesso!');
      // Recarregar dados do player para refletir as mudanças
      await loadPlayer();
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      setError('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        mt: 4, 
        display: 'flex', 
        justifyContent: 'center',
        height: '80vh',
        alignItems: 'center'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!player) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error">Player não encontrado</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      background: (theme) => theme.palette.mode === 'dark'
        ? theme.palette.background.default
        : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      minHeight: '100vh',
      p: 3,
    }}>
      <Fade in={true} timeout={800}>
        <Box>
          {/* Header */}
          <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<BackIcon />}
              onClick={() => navigate(`/players/${id}`)}
              variant="outlined"
              sx={{
                borderRadius: 2,
                background: (theme) => theme.palette.mode === 'dark' 
                  ? 'linear-gradient(45deg, rgba(255,119,48,0.1) 0%, rgba(255,152,0,0.1) 100%)' 
                  : 'linear-gradient(45deg, rgba(33,150,243,0.1) 0%, rgba(33,203,243,0.1) 100%)',
                border: (theme) => theme.palette.mode === 'dark'
                  ? '1px solid rgba(255,119,48,0.3)'
                  : '1px solid rgba(33,150,243,0.3)',
                color: (theme) => theme.palette.mode === 'dark' ? '#ff7730' : '#2196f3',
                '&:hover': {
                  transform: 'scale(1.05)',
                  background: (theme) => theme.palette.mode === 'dark' 
                    ? 'linear-gradient(45deg, rgba(255,119,48,0.2) 0%, rgba(255,152,0,0.2) 100%)' 
                    : 'linear-gradient(45deg, rgba(33,150,243,0.2) 0%, rgba(33,203,243,0.2) 100%)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Voltar
            </Button>
            <Typography 
              variant="h3" 
              component="h1"
              sx={{
                fontWeight: 600,
                background: (theme) => theme.palette.mode === 'dark' 
                  ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                  : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Configurações do Player
            </Typography>
          </Box>

          {/* Alerts */}
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Configurações de Exibição */}
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1000}>
                  <Paper 
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      height: '100%',
                      background: (theme) => theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.05)' 
                        : 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(10px)',
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: (theme) => theme.palette.mode === 'dark' 
                          ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                          : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                      <Avatar 
                        sx={{ 
                          background: (theme) => theme.palette.mode === 'dark' 
                            ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                            : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                          width: 48,
                          height: 48,
                        }}
                      >
                        <DisplayIcon />
                      </Avatar>
                      <Typography variant="h6" fontWeight="600">Configurações de Exibição</Typography>
                    </Box>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="outlined" margin="normal">
                          <InputLabel>Orientação</InputLabel>
                          <Select
                            name="orientation"
                            value={formData.orientation}
                            onChange={handleChange}
                            label="Orientação"
                          >
                            <MenuItem value="landscape">Paisagem</MenuItem>
                            <MenuItem value="portrait">Retrato</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="outlined" margin="normal">
                          <InputLabel>Resolução</InputLabel>
                          <Select
                            name="resolution"
                            value={formData.resolution}
                            onChange={handleChange}
                            label="Resolução"
                          >
                            <MenuItem value="1920x1080">Full HD (1920x1080)</MenuItem>
                            <MenuItem value="1280x720">HD (1280x720)</MenuItem>
                            <MenuItem value="3840x2160">4K (3840x2160)</MenuItem>
                            <MenuItem value="1024x768">1024x768</MenuItem>
                            <MenuItem value="800x600">800x600</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography gutterBottom>
                          Volume ({formData.volume_level}%)
                        </Typography>
                        <Slider
                          value={formData.volume_level}
                          onChange={handleSliderChange('volume_level')}
                          aria-labelledby="volume-slider"
                          valueLabelDisplay="auto"
                          step={5}
                          marks
                          min={0}
                          max={100}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Duração padrão do conteúdo (segundos)"
                          name="default_content_duration"
                          type="number"
                          value={formData.default_content_duration}
                          onChange={handleChange}
                          margin="normal"
                          InputProps={{ inputProps: { min: 1, max: 300 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="outlined" margin="normal">
                          <InputLabel>Efeito de transição</InputLabel>
                          <Select
                            name="transition_effect"
                            value={formData.transition_effect}
                            onChange={handleChange}
                            label="Efeito de transição"
                          >
                            <MenuItem value="fade">Fade</MenuItem>
                            <MenuItem value="slide">Slide</MenuItem>
                            <MenuItem value="zoom">Zoom</MenuItem>
                            <MenuItem value="none">Nenhum</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.kiosk_mode}
                              onChange={handleChange}
                              name="kiosk_mode"
                              color="primary"
                            />
                          }
                          label="Modo quiosque (tela cheia)"
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grow>
              </Grid>

              {/* Configurações de Rede */}
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1200}>
                  <Paper 
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      height: '100%',
                      background: (theme) => theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.05)' 
                        : 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(10px)',
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: (theme) => theme.palette.mode === 'dark' 
                          ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                          : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                      <Avatar 
                        sx={{ 
                          background: (theme) => theme.palette.mode === 'dark' 
                            ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                            : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                          width: 48,
                          height: 48,
                        }}
                      >
                        <NetworkIcon />
                      </Avatar>
                      <Typography variant="h6" fontWeight="600">Configurações de Rede</Typography>
                    </Box>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Timeout de rede (segundos)"
                          name="network_timeout"
                          type="number"
                          value={formData.network_timeout}
                          onChange={handleChange}
                          margin="normal"
                          InputProps={{ inputProps: { min: 5, max: 120 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Intervalo de retry (segundos)"
                          name="retry_interval"
                          type="number"
                          value={formData.retry_interval}
                          onChange={handleChange}
                          margin="normal"
                          InputProps={{ inputProps: { min: 1, max: 60 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Máximo de tentativas"
                          name="max_retries"
                          type="number"
                          value={formData.max_retries}
                          onChange={handleChange}
                          margin="normal"
                          InputProps={{ inputProps: { min: 1, max: 10 } }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.cache_enabled}
                              onChange={handleChange}
                              name="cache_enabled"
                              color="primary"
                            />
                          }
                          label="Habilitar cache de conteúdo"
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grow>
              </Grid>

              {/* Configurações de Sistema */}
              <Grid item xs={12}>
                <Grow in={true} timeout={1400}>
                  <Paper 
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      background: (theme) => theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.05)' 
                        : 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(10px)',
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: (theme) => theme.palette.mode === 'dark' 
                          ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                          : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                      <Avatar 
                        sx={{ 
                          background: (theme) => theme.palette.mode === 'dark' 
                            ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                            : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                          width: 48,
                          height: 48,
                        }}
                      >
                        <SettingsIcon />
                      </Avatar>
                      <Typography variant="h6" fontWeight="600">Configurações do Sistema</Typography>
                    </Box>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.auto_start}
                              onChange={handleChange}
                              name="auto_start"
                              color="primary"
                            />
                          }
                          label="Iniciar automaticamente"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.auto_update}
                              onChange={handleChange}
                              name="auto_update"
                              color="primary"
                            />
                          }
                          label="Atualização automática"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.debug_mode}
                              onChange={handleChange}
                              name="debug_mode"
                              color="primary"
                            />
                          }
                          label="Modo de depuração"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          label="Horário de atualização"
                          name="update_time"
                          type="time"
                          value={formData.update_time}
                          onChange={handleChange}
                          margin="normal"
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Limite de armazenamento (GB)"
                          name="storage_limit_gb"
                          type="number"
                          value={formData.storage_limit_gb}
                          onChange={handleChange}
                          margin="normal"
                          InputProps={{ inputProps: { min: 1, max: 50 } }}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grow>
              </Grid>
            </Grid>

            {/* Botões de Ação */}
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={loadPlayer}
                startIcon={<RefreshIcon />}
                disabled={saving}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  color: (theme) => theme.palette.mode === 'dark' ? '#ff7730' : '#1976d2',
                  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,119,48,0.5)' : 'rgba(25,118,210,0.5)',
                  '&:hover': {
                    borderColor: (theme) => theme.palette.mode === 'dark' ? '#ff7730' : '#1976d2',
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,119,48,0.1)' : 'rgba(25,118,210,0.1)',
                  },
                }}
              >
                Restaurar
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                disabled={saving}
                sx={{
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  background: (theme) => theme.palette.mode === 'dark' 
                    ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                    : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                  '&:hover': {
                    background: (theme) => theme.palette.mode === 'dark' 
                      ? 'linear-gradient(45deg, #ff9800, #ff7730)' 
                      : 'linear-gradient(45deg, #21CBF3, #2196F3)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 15px rgba(0,0,0,0.1)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </Box>
          </form>

          <Snackbar
            open={!!success}
            autoHideDuration={6000}
            onClose={() => setSuccess('')}
            message={success}
          />
        </Box>
      </Fade>
    </Box>
  );
};

export default PlayerSettings;
