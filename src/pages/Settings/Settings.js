import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
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
  LinearProgress
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
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import PageTitle from '../../components/Common/PageTitle';

// Componente otimizado para o campo de texto do nome da empresa
const CompanyNameField = memo(({ value, onChange, theme }) => {
  // Estado local para edição sem causar re-renders no parent a cada tecla
  const [displayValue, setDisplayValue] = useState(value);
  const lastPropValueRef = useRef(value);

  // Atualizar o valor de exibição quando a prop mudar externamente
  useEffect(() => {
    if (value !== lastPropValueRef.current) {
      setDisplayValue(value);
      lastPropValueRef.current = value;
    }
  }, [value]);

  const commitChange = useCallback(() => {
    // Só propagar se de fato mudou
    if (displayValue !== lastPropValueRef.current) {
      onChange(displayValue);
      lastPropValueRef.current = displayValue;
    }
  }, [displayValue, onChange]);

  return (
    <TextField
      fullWidth
      label="Nome da Empresa"
      value={displayValue}
      onChange={(e) => setDisplayValue(e.target.value)}
      onBlur={commitChange}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitChange();
        }
      }}
      autoComplete="off"
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
  );
});

// Componente otimizado para switches
const SettingSwitch = memo(({ checked, onChange, label, sx, theme }) => {
  return (
    <FormControlLabel
      control={
        <Switch
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
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
      label={label}
      sx={sx}
    />
  );
});

const Settings = () => {
  const { isDarkMode, toggleTheme, theme, animationsEnabled, transitionDuration, toggleAnimations, updateTransitionDuration } = useTheme();
  const { settings, uiPreferences, loading: contextLoading, updateSettings, companyDisplayName, updateCompanyDisplayName } = useSettings();
  const { isAdmin } = useAuth();
  
  // Usar useRef para evitar re-renderizações desnecessárias
  const formSettingsRef = useRef({
    // Configurações Gerais
    'general.company_name': '',
    'general.timezone': 'America/Sao_Paulo',
    'general.language': 'pt-BR',
    'general.auto_sync': true,
    'general.auto_update': true,
    'general.debug_mode': false,
    
    // Configurações de UI
    'ui.dark_theme': isDarkMode,
    'ui.animations_enabled': true,
    'ui.transition_duration': 300,
    
    // Configurações de Display
    'display.default_orientation': 'landscape',
    'display.default_volume': 50,
    
    // Configurações de Armazenamento
    'storage.max_storage_gb': 100,
    'storage.auto_cleanup': true,
    'storage.backup_enabled': false,
    
    // Configurações de Segurança
    'security.session_timeout': 30,
    'security.password_policy': 'medium',
    'security.two_factor_auth': false,
    'security.login_by_trusted_ip': false,
    'security.block_after_failed_attempts': false,
  });
  
  // Estado para UI
  const [formSettings, setFormSettings] = useState(formSettingsRef.current);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [localCompanyDisplayName, setLocalCompanyDisplayName] = useState('');

  // Carregar configurações do contexto quando disponíveis
  useEffect(() => {
    if (!contextLoading && Object.keys(settings).length > 0) {
      const updatedSettings = {
        ...formSettingsRef.current,
        ...settings
      };
      // Enforce fixed values in UI/state
      updatedSettings['general.language'] = 'pt-BR';
      updatedSettings['general.timezone'] = 'America/Sao_Paulo';
      formSettingsRef.current = updatedSettings;
      setFormSettings(updatedSettings);
    }
  }, [contextLoading, settings]);

  // Sincronizar display name da empresa para não-admins
  useEffect(() => {
    if (!isAdmin) {
      setLocalCompanyDisplayName(companyDisplayName || '');
    }
  }, [companyDisplayName, isAdmin]);

  // Sincronizar tema com isDarkMode (fonte da verdade visual)
  useEffect(() => {
    const updatedSettings = {
      ...formSettingsRef.current,
      'ui.dark_theme': isDarkMode,
    };
    formSettingsRef.current = updatedSettings;
    setFormSettings(updatedSettings);
  }, [isDarkMode]);

  // Função memoizada para atualizar configurações
  const handleSettingChange = useCallback((key, value) => {
    // Atualizar a referência primeiro
    formSettingsRef.current = {
      ...formSettingsRef.current,
      [key]: value
    };
    
    // Depois atualizar o estado para UI
    setFormSettings(formSettingsRef.current);
  }, []);

  // Função memoizada para salvar configurações
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      if (!isAdmin) {
        const res = await updateCompanyDisplayName(localCompanyDisplayName);
        if (res.success) {
          setSuccess('Nome da empresa atualizado com sucesso!');
        } else {
          setError(res.error || 'Erro ao atualizar nome da empresa');
        }
      } else {
        // Enforce fixed settings before computing diffs
        formSettingsRef.current['general.language'] = 'pt-BR';
        formSettingsRef.current['general.timezone'] = 'America/Sao_Paulo';
        
        // Enviar apenas configurações que foram alteradas
        const changedSettings = {};
        Object.keys(formSettingsRef.current).forEach(key => {
          if (settings[key] !== formSettingsRef.current[key]) {
            changedSettings[key] = formSettingsRef.current[key];
          }
        });
        
        if (Object.keys(changedSettings).length > 0) {
          await updateSettings(changedSettings);
        }
        
        setSuccess('Configurações salvas com sucesso!');
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao salvar configurações');
      console.error('Settings save error:', err);
    } finally {
      setSaving(false);
    }
  }, [settings, updateSettings, isAdmin, localCompanyDisplayName, updateCompanyDisplayName]);

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
      {/* Header com PageTitle */}
      <PageTitle 
        title="Configurações do Sistema"
        subtitle="Gerencie as configurações do sistema e preferências"
        icon={<SettingsIcon />}
        actions={
          <>
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
          </>
        }
      />

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
                variant="fullWidth"
                centered
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
                {false && (
                  <Tab 
                    icon={<NotificationsIcon />} 
                    label="Notificações" 
                    iconPosition="start"
                  />
                )}
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
                      
                      <CompanyNameField 
                        value={isAdmin ? formSettings['general.company_name'] : localCompanyDisplayName} 
                        onChange={(value) => {
                          if (isAdmin) {
                            handleSettingChange('general.company_name', value);
                          } else {
                            setLocalCompanyDisplayName(value);
                          }
                        }}
                        theme={theme}
                      />
                      
                      <TextField
                        fullWidth
                        label="Timezone"
                        value="São Paulo (GMT-3)"
                        disabled
                        sx={{ 
                          mb: 3,
                          '& .MuiOutlinedInput-root': { borderRadius: '12px' }
                        }}
                      />
                      
                      {false && (
                        <FormControl fullWidth>
                          <InputLabel>Idioma</InputLabel>
                          <Select
                            value={formSettings['general.language']}
                            onChange={(e) => handleSettingChange('general.language', e.target.value)}
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
                      )}
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
                      
                      <SettingSwitch
                        checked={isDarkMode}
                        onChange={(checked) => { handleSettingChange('ui.dark_theme', checked); toggleTheme(); }}
                        label="Tema Escuro"
                        sx={{ mb: 2, display: 'block' }}
                        theme={theme}
                      />
                      
                      <SettingSwitch
                        checked={animationsEnabled}
                        onChange={(checked) => { handleSettingChange('ui.animations_enabled', checked); toggleAnimations(); }}
                        label="Animações Habilitadas"
                        sx={{ mb: 3, display: 'block' }}
                        theme={theme}
                      />

                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Aba Notificações */}
          {false && (
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
                      
                      <Alert severity="info" sx={{ mb: 3, borderRadius: '12px' }}>
                        As configurações de notificações por email requerem configuração adicional do servidor SMTP.
                      </Alert>
                      
                      <SettingSwitch
                        checked={false}
                        onChange={(checked) => {}}
                        label="Notificações por Email"
                        sx={{ mb: 2, display: 'block' }}
                        theme={theme}
                      />
                      
                      <SettingSwitch
                        checked={false}
                        onChange={(checked) => {}}
                        label="Notificações Push"
                        sx={{ mb: 2, display: 'block' }}
                        theme={theme}
                      />
                      
                      <SettingSwitch
                        checked={false}
                        onChange={(checked) => {}}
                        label="Alertas do Sistema"
                        sx={{ display: 'block' }}
                        theme={theme}
                      />
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
            </Grid>
          </TabPanel>
          )}

          {/* Aba Armazenamento */}
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
                          Configurações de Armazenamento
                        </Typography>
                      </Box>
                      
                      <SettingSwitch
                        checked={formSettings['storage.auto_cleanup']}
                        onChange={(checked) => handleSettingChange('storage.auto_cleanup', checked)}
                        label="Limpeza Automática"
                        sx={{ mb: 2, display: 'block' }}
                        theme={theme}
                      />
                      
                      <SettingSwitch
                        checked={formSettings['storage.backup_enabled']}
                        onChange={(checked) => handleSettingChange('storage.backup_enabled', checked)}
                        label="Backup Automático"
                        sx={{ display: 'block' }}
                        theme={theme}
                      />
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
                
              {false && (
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
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'linear-gradient(135deg, #3f51b5 0%, #7986cb 100%)',
                            color: theme.palette.mode === 'dark' ? '#000' : 'inherit',
                            mr: 2,
                            width: 40,
                            height: 40,
                          }}
                        >
                          <CloudIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Uso de Armazenamento
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: '12px' }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Uso atual do armazenamento
                        </Typography>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Typography variant="body1">Conteúdo</Typography>
                          <Typography variant="body1" fontWeight="bold">12.4 GB</Typography>
                        </Box>
                        <Box sx={{ width: '100%', mb: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={25} 
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                              '& .MuiLinearProgress-bar': {
                                background: 'linear-gradient(90deg, #2196f3, #21CBF3)'
                              }
                            }} 
                          />
                        </Box>
                        
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1} mt={2}>
                          <Typography variant="body1">Campanhas</Typography>
                          <Typography variant="body1" fontWeight="bold">5.8 GB</Typography>
                        </Box>
                        <Box sx={{ width: '100%', mb: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={12} 
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                              '& .MuiLinearProgress-bar': {
                                background: 'linear-gradient(90deg, #ff9800, #ff7730)'
                              }
                            }} 
                          />
                        </Box>
                        
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1} mt={2}>
                          <Typography variant="body1">Sistema</Typography>
                          <Typography variant="body1" fontWeight="bold">2.3 GB</Typography>
                        </Box>
                        <Box sx={{ width: '100%', mb: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={5} 
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                              '& .MuiLinearProgress-bar': {
                                background: 'linear-gradient(90deg, #4caf50, #81c784)'
                              }
                            }} 
                          />
                        </Box>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Typography variant="body1" fontWeight="bold">Total</Typography>
                          <Typography variant="body1" fontWeight="bold">20.5 GB / {formSettings['storage.max_storage_gb']} GB</Typography>
                        </Box>
                        <Box sx={{ width: '100%', mt: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={(20.5 / formSettings['storage.max_storage_gb']) * 100} 
                            sx={{ 
                              height: 10, 
                              borderRadius: 4,
                              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                              '& .MuiLinearProgress-bar': {
                                background: 'linear-gradient(90deg, #3f51b5, #7986cb)'
                              }
                            }} 
                          />
                        </Box>
                      </Box>
                      
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        fullWidth
                        sx={{
                          borderRadius: '12px',
                          textTransform: 'none',
                          fontWeight: 600,
                          py: 1,
                        }}
                      >
                        Atualizar Estatísticas
                      </Button>
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
              )}
            </Grid>
          </TabPanel>

          {/* Aba Segurança */}
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
                          Configurações de Sessão
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 3 }}>
                        <Typography gutterBottom sx={{ fontWeight: 600 }}>
                          Timeout da Sessão: {formSettings['security.session_timeout']} minutos
                        </Typography>
                        <Slider
                          value={formSettings['security.session_timeout']}
                          onChange={(e, value) => handleSettingChange('security.session_timeout', value)}
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
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
                
              {false && (
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
                          <SecurityIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Autenticação Avançada
                        </Typography>
                      </Box>
                      
                      <Alert severity="info" sx={{ mb: 3, borderRadius: '12px' }}>
                        Recursos de autenticação avançada serão implementados em uma atualização futura.
                      </Alert>
                      
                      <SettingSwitch
                        checked={false}
                        onChange={(checked) => {}}
                        label="Autenticação de Dois Fatores"
                        sx={{ mb: 2, display: 'block' }}
                        theme={theme}
                      />
                      
                      <SettingSwitch
                        checked={false}
                        onChange={(checked) => {}}
                        label="Login por IP Confiável"
                        sx={{ mb: 2, display: 'block' }}
                        theme={theme}
                      />
                      
                      <SettingSwitch
                        checked={false}
                        onChange={(checked) => {}}
                        label="Bloqueio Após Tentativas Falhas"
                        sx={{ display: 'block' }}
                        theme={theme}
                      />
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
              )}
            </Grid>
          </TabPanel>
        </>
      )}
    </Box>
  );
};

export default Settings;
