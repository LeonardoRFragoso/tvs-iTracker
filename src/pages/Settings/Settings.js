import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Grid,
  Alert,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Chip,
  Avatar,
  Fade,
  Grow,
  Skeleton,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Monitor as DisplayIcon,
  Notifications as NotificationsIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  Home as GeneralIcon,
  Palette as PaletteIcon,
  VolumeUp as VolumeIcon,
  Wifi as WifiIcon,
  CloudUpload as CloudIcon,
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';

const Settings = () => {
  const { isDarkMode, theme } = useTheme();
  
  const [settings, setSettings] = useState({
    company_name: 'TVS Digital Signage',
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR',
    auto_sync: true,
    auto_update: true,
    debug_mode: false,
    default_resolution: '1920x1080',
    default_volume: 50,
    default_orientation: 'landscape',
    dark_theme: false,
    animations_enabled: true,
    transition_duration: 300,
    email_notifications: true,
    push_notifications: true,
    system_alerts: true,
    max_storage_gb: 100,
    auto_cleanup: true,
    backup_enabled: false,
    two_factor_auth: false,
    session_timeout: 30,
    password_policy: 'medium'
  });
  
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess('Configurações salvas com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao salvar configurações');
      console.error('Settings save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const SettingsSkeleton = () => (
    <Box>
      <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: '16px', mb: 3 }} />
      <Skeleton variant="rectangular" width="100%" height={48} sx={{ borderRadius: '12px', mb: 3 }} />
      <Grid container spacing={3}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card sx={{ borderRadius: '16px' }}>
              <CardContent sx={{ p: 3 }}>
                <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
                <Skeleton variant="text" width="100%" height={20} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" width="100%" height={40} sx={{ borderRadius: '8px' }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const TabPanel = ({ children, value, index, ...other }) => (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Fade in={true} timeout={500}>
          <Box sx={{ pt: 3 }}>
            {children}
          </Box>
        </Fade>
      )}
    </div>
  );

  return (
    <Box>
      {/* Header */}
      <Grow in={true} timeout={1000}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center">
            <Avatar
              sx={{
                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                color: theme.palette.mode === 'dark' ? '#000' : 'inherit',
                mr: 2,
                width: 48,
                height: 48,
              }}
            >
              <SettingsIcon />
            </Avatar>
            <Box>
              <Typography 
                variant="h4" 
                component="h1"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                }}
              >
                Configurações
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Gerencie as configurações do sistema e preferências
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => window.location.reload()}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 600,
                borderColor: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'rgba(255, 119, 48, 0.5)',
                color: theme.palette.mode === 'dark' ? theme.palette.primary.main : '#ff7730',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.08)' : 'rgba(255, 119, 48, 0.05)',
                  transform: 'translateY(-1px)',
                }
              }}
            >
              Atualizar
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{
                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(255, 152, 0, 0.25)' : '0 4px 20px rgba(255, 119, 48, 0.3)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: theme.palette.mode === 'dark' ? '0 6px 25px rgba(255, 152, 0, 0.35)' : '0 6px 25px rgba(255, 119, 48, 0.4)',
                }
              }}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </Box>
        </Box>
      </Grow>

      {/* Alerts */}
      {error && (
        <Fade in={true}>
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              background: theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)',
            }} 
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        </Fade>
      )}
      {success && (
        <Fade in={true}>
          <Alert 
            severity="success" 
            sx={{ 
              mb: 2,
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              background: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)',
            }} 
            onClose={() => setSuccess('')}
          >
            {success}
          </Alert>
        </Fade>
      )}

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <>
          {/* Tabs */}
          <Grow in={true} timeout={1200}>
            <Card 
              sx={{ 
                mb: 3,
                borderRadius: '16px',
                backdropFilter: 'blur(20px)',
                background: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(255, 255, 255, 0.9)',
                border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(e, newValue) => setActiveTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  px: 2,
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 600,
                    minHeight: 64,
                    borderRadius: '12px',
                    mx: 0.5,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.08)' : 'rgba(255, 119, 48, 0.05)',
                      transform: 'translateY(-1px)',
                    },
                    '&.Mui-selected': {
                      background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                      color: theme.palette.mode === 'dark' ? '#000' : 'white',
                    }
                  },
                  '& .MuiTabs-indicator': {
                    display: 'none',
                  }
                }}
              >
                <Tab 
                  icon={<GeneralIcon />} 
                  label="Geral" 
                  iconPosition="start"
                />
                <Tab 
                  icon={<DisplayIcon />} 
                  label="Exibição" 
                  iconPosition="start"
                />
                <Tab 
                  icon={<NotificationsIcon />} 
                  label="Notificações" 
                  iconPosition="start"
                />
                <Tab 
                  icon={<StorageIcon />} 
                  label="Armazenamento" 
                  iconPosition="start"
                />
                <Tab 
                  icon={<SecurityIcon />} 
                  label="Segurança" 
                  iconPosition="start"
                />
              </Tabs>
            </Card>
          </Grow>

          {/* Save Button - Fixed Position */}
          <Fade in={!loading} timeout={2000}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                borderRadius: '16px',
                px: 3,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(255, 152, 0, 0.3)' : '0 8px 32px rgba(255, 119, 48, 0.3)',
                transition: 'all 0.3s ease',
                zIndex: 1000,
                '&:hover': {
                  background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                  transform: 'scale(1.05)',
                  boxShadow: theme.palette.mode === 'dark' ? '0 12px 40px rgba(255, 152, 0, 0.35)' : '0 12px 40px rgba(255, 119, 48, 0.4)',
                }
              }}
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </Fade>

          {/* Tab Panels */}
          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1400}>
                  <Card 
                    sx={{ 
                      borderRadius: '16px',
                      background: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                      boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <Avatar
                          sx={{
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)',
                            color: theme.palette.mode === 'dark' ? '#000' : 'inherit',
                            mr: 2,
                            width: 40,
                            height: 40,
                          }}
                        >
                          <GeneralIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Configurações Gerais
                        </Typography>
                      </Box>
                      
                      <TextField
                        fullWidth
                        label="Nome da Empresa"
                        value={settings.company_name}
                        onChange={(e) => handleSettingChange('company_name', e.target.value)}
                        sx={{ 
                          mb: 3,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                            },
                            '&.Mui-focused': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 20px rgba(255, 119, 48, 0.2)',
                            }
                          }
                        }}
                      />
                      
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Timezone</InputLabel>
                        <Select
                          value={settings.timezone}
                          onChange={(e) => handleSettingChange('timezone', e.target.value)}
                          label="Timezone"
                          sx={{
                            borderRadius: '12px',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                            }
                          }}
                        >
                          <MenuItem value="America/Sao_Paulo">São Paulo (GMT-3)</MenuItem>
                          <MenuItem value="America/New_York">New York (GMT-5)</MenuItem>
                          <MenuItem value="Europe/London">London (GMT+0)</MenuItem>
                        </Select>
                      </FormControl>
                      
                      <FormControl fullWidth>
                        <InputLabel>Idioma</InputLabel>
                        <Select
                          value={settings.language}
                          onChange={(e) => handleSettingChange('language', e.target.value)}
                          label="Idioma"
                          sx={{
                            borderRadius: '12px',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                            }
                          }}
                        >
                          <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
                          <MenuItem value="en-US">English (US)</MenuItem>
                          <MenuItem value="es-ES">Español</MenuItem>
                        </Select>
                      </FormControl>
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1600}>
                  <Card 
                    sx={{ 
                      borderRadius: '16px',
                      background: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                      boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <Avatar
                          sx={{
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
                            color: theme.palette.mode === 'dark' ? '#000' : 'inherit',
                            mr: 2,
                            width: 40,
                            height: 40,
                          }}
                        >
                          <WifiIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Sistema
                        </Typography>
                      </Box>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.auto_sync}
                            onChange={(e) => handleSettingChange('auto_sync', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Sincronização Automática"
                        sx={{ mb: 2, display: 'block' }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.auto_update}
                            onChange={(e) => handleSettingChange('auto_update', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Atualizações Automáticas"
                        sx={{ mb: 2, display: 'block' }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.debug_mode}
                            onChange={(e) => handleSettingChange('debug_mode', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Modo Debug"
                        sx={{ display: 'block' }}
                      />
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Aba Exibição */}
          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1400}>
                  <Card 
                    sx={{ 
                      borderRadius: '16px',
                      background: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                      boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <Avatar
                          sx={{
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)',
                            color: theme.palette.mode === 'dark' ? '#000' : 'inherit',
                            mr: 2,
                            width: 40,
                            height: 40,
                          }}
                        >
                          <DisplayIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Configurações de Display
                        </Typography>
                      </Box>
                      
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Resolução Padrão</InputLabel>
                        <Select
                          value={settings.default_resolution}
                          onChange={(e) => handleSettingChange('default_resolution', e.target.value)}
                          label="Resolução Padrão"
                          sx={{
                            borderRadius: '12px',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                            }
                          }}
                        >
                          <MenuItem value="1920x1080">Full HD (1920x1080)</MenuItem>
                          <MenuItem value="1366x768">HD (1366x768)</MenuItem>
                          <MenuItem value="3840x2160">4K (3840x2160)</MenuItem>
                          <MenuItem value="2560x1440">2K (2560x1440)</MenuItem>
                        </Select>
                      </FormControl>
                      
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Orientação</InputLabel>
                        <Select
                          value={settings.default_orientation}
                          onChange={(e) => handleSettingChange('default_orientation', e.target.value)}
                          label="Orientação"
                          sx={{
                            borderRadius: '12px',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                            }
                          }}
                        >
                          <MenuItem value="landscape">Paisagem</MenuItem>
                          <MenuItem value="portrait">Retrato</MenuItem>
                        </Select>
                      </FormControl>

                      <Box sx={{ mb: 3 }}>
                        <Typography gutterBottom sx={{ fontWeight: 600 }}>
                          Volume Padrão: {settings.default_volume}%
                        </Typography>
                        <Slider
                          value={settings.default_volume}
                          onChange={(e, value) => handleSettingChange('default_volume', value)}
                          valueLabelDisplay="auto"
                          min={0}
                          max={100}
                          sx={{
                            '& .MuiSlider-thumb': {
                              background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                            },
                            '& .MuiSlider-track': {
                              background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                            }
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1600}>
                  <Card 
                    sx={{ 
                      borderRadius: '16px',
                      background: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                      boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <Avatar
                          sx={{
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #e91e63 0%, #f06292 100%)',
                            color: theme.palette.mode === 'dark' ? '#000' : 'inherit',
                            mr: 2,
                            width: 40,
                            height: 40,
                          }}
                        >
                          <PaletteIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Interface
                        </Typography>
                      </Box>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.dark_theme}
                            onChange={(e) => handleSettingChange('dark_theme', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Tema Escuro"
                        sx={{ mb: 2, display: 'block' }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.animations_enabled}
                            onChange={(e) => handleSettingChange('animations_enabled', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Animações Habilitadas"
                        sx={{ mb: 3, display: 'block' }}
                      />

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 600 }}>
                          Duração das Transições: {settings.transition_duration}ms
                        </Typography>
                        <Slider
                          value={settings.transition_duration}
                          onChange={(e, value) => handleSettingChange('transition_duration', value)}
                          valueLabelDisplay="auto"
                          min={100}
                          max={1000}
                          step={50}
                          sx={{
                            '& .MuiSlider-thumb': {
                              background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                            },
                            '& .MuiSlider-track': {
                              background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                            }
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Aba Notificações */}
          <TabPanel value={activeTab} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1400}>
                  <Card 
                    sx={{ 
                      borderRadius: '16px',
                      background: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                      boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <Avatar
                          sx={{
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                            color: theme.palette.mode === 'dark' ? '#000' : 'inherit',
                            mr: 2,
                            width: 40,
                            height: 40,
                          }}
                        >
                          <NotificationsIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Notificações
                        </Typography>
                      </Box>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.email_notifications}
                            onChange={(e) => handleSettingChange('email_notifications', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Notificações por Email"
                        sx={{ mb: 2, display: 'block' }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.push_notifications}
                            onChange={(e) => handleSettingChange('push_notifications', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Notificações Push"
                        sx={{ mb: 2, display: 'block' }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.system_alerts}
                            onChange={(e) => handleSettingChange('system_alerts', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Alertas do Sistema"
                        sx={{ display: 'block' }}
                      />
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Aba Armazenamento */}
          <TabPanel value={activeTab} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1400}>
                  <Card 
                    sx={{ 
                      borderRadius: '16px',
                      background: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                      boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <Avatar
                          sx={{
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #607d8b 0%, #90a4ae 100%)',
                            color: theme.palette.mode === 'dark' ? '#000' : 'inherit',
                            mr: 2,
                            width: 40,
                            height: 40,
                          }}
                        >
                          <StorageIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Gerenciamento de Armazenamento
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 3 }}>
                        <Typography gutterBottom sx={{ fontWeight: 600 }}>
                          Limite de Armazenamento: {settings.max_storage_gb} GB
                        </Typography>
                        <Slider
                          value={settings.max_storage_gb}
                          onChange={(e, value) => handleSettingChange('max_storage_gb', value)}
                          valueLabelDisplay="auto"
                          min={10}
                          max={1000}
                          step={10}
                          sx={{
                            '& .MuiSlider-thumb': {
                              background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                            },
                            '& .MuiSlider-track': {
                              background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                            }
                          }}
                        />
                      </Box>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.auto_cleanup}
                            onChange={(e) => handleSettingChange('auto_cleanup', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Limpeza Automática"
                        sx={{ mb: 2, display: 'block' }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.backup_enabled}
                            onChange={(e) => handleSettingChange('backup_enabled', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Backup Automático"
                        sx={{ display: 'block' }}
                      />
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Aba Segurança */}
          <TabPanel value={activeTab} index={4}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1400}>
                  <Card 
                    sx={{ 
                      borderRadius: '16px',
                      background: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                      boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <Avatar
                          sx={{
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #f44336 0%, #ef5350 100%)',
                            color: theme.palette.mode === 'dark' ? '#000' : 'inherit',
                            mr: 2,
                            width: 40,
                            height: 40,
                          }}
                        >
                          <SecurityIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Configurações de Segurança
                        </Typography>
                      </Box>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.two_factor_auth}
                            onChange={(e) => handleSettingChange('two_factor_auth', e.target.checked)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              },
                              '& .Mui-checked + .MuiSwitch-track': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 119, 48, 0.3)',
                              }
                            }}
                          />
                        }
                        label="Autenticação de Dois Fatores"
                        sx={{ mb: 3, display: 'block' }}
                      />
                      
                      <Box sx={{ mb: 3 }}>
                        <Typography gutterBottom sx={{ fontWeight: 600 }}>
                          Timeout da Sessão: {settings.session_timeout} minutos
                        </Typography>
                        <Slider
                          value={settings.session_timeout}
                          onChange={(e, value) => handleSettingChange('session_timeout', value)}
                          valueLabelDisplay="auto"
                          min={5}
                          max={120}
                          step={5}
                          sx={{
                            '& .MuiSlider-thumb': {
                              background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                            },
                            '& .MuiSlider-track': {
                              background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                            }
                          }}
                        />
                      </Box>
                      
                      <FormControl fullWidth>
                        <InputLabel>Política de Senha</InputLabel>
                        <Select
                          value={settings.password_policy}
                          onChange={(e) => handleSettingChange('password_policy', e.target.value)}
                          label="Política de Senha"
                          sx={{
                            borderRadius: '12px',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                            }
                          }}
                        >
                          <MenuItem value="low">Baixa</MenuItem>
                          <MenuItem value="medium">Média</MenuItem>
                          <MenuItem value="high">Alta</MenuItem>
                        </Select>
                      </FormControl>
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
            </Grid>
          </TabPanel>
        </>
      )}
    </Box>
  );
};

export default Settings;
