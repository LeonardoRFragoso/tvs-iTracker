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
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Storage as StorageIcon,
  Network as NetworkIcon,
  Monitor as DisplayIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Settings = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    company_name: 'Controle de Televisões iTracker',
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR',
    date_format: 'DD/MM/YYYY',
    time_format: '24h',
    auto_refresh_interval: 30,
    max_upload_size: 500,
    session_timeout: 60,
  });

  // Display Settings
  const [displaySettings, setDisplaySettings] = useState({
    default_resolution: '1920x1080',
    default_orientation: 'landscape',
    default_volume: 50,
    screen_saver_timeout: 300,
    transition_effect: 'fade',
    transition_duration: 1000,
    show_clock: true,
    show_weather: false,
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    system_alerts: true,
    player_offline_alert: true,
    content_expiry_alert: true,
    low_storage_alert: true,
    failed_upload_alert: true,
    alert_email: 'admin@company.com',
  });

  // Storage Settings
  const [storageSettings, setStorageSettings] = useState({
    auto_cleanup: true,
    cleanup_days: 30,
    max_storage_gb: 100,
    backup_enabled: false,
    backup_frequency: 'daily',
    backup_retention_days: 7,
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    password_min_length: 8,
    password_require_special: true,
    password_require_numbers: true,
    password_require_uppercase: true,
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    two_factor_auth: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // In a real app, you would load settings from the backend
      // For now, we'll use the default values
      console.log('Loading settings...');
    } catch (err) {
      setError('Erro ao carregar configurações');
      console.error('Load settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (settingsType, settings) => {
    try {
      setLoading(true);
      setError('');
      
      // In a real app, you would save to backend
      // await axios.put(`${API_BASE_URL}/settings/${settingsType}`, settings);
      
      setSuccess('Configurações salvas com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao salvar configurações');
      console.error('Save settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <SettingsIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" component="h1">
          Configurações do Sistema
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Geral" />
            <Tab label="Exibição" />
            <Tab label="Notificações" />
            <Tab label="Armazenamento" />
            <Tab label="Segurança" />
          </Tabs>
        </Box>

        {/* General Settings Tab */}
        <TabPanel value={activeTab} index={0}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configurações Gerais
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nome da Empresa"
                  value={generalSettings.company_name}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, company_name: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Fuso Horário</InputLabel>
                  <Select
                    value={generalSettings.timezone}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, timezone: e.target.value }))}
                    label="Fuso Horário"
                  >
                    <MenuItem value="America/Sao_Paulo">São Paulo (GMT-3)</MenuItem>
                    <MenuItem value="America/New_York">Nova York (GMT-5)</MenuItem>
                    <MenuItem value="Europe/London">Londres (GMT+0)</MenuItem>
                    <MenuItem value="Asia/Tokyo">Tóquio (GMT+9)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Idioma</InputLabel>
                  <Select
                    value={generalSettings.language}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, language: e.target.value }))}
                    label="Idioma"
                  >
                    <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
                    <MenuItem value="en-US">English (US)</MenuItem>
                    <MenuItem value="es-ES">Español</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Formato de Data</InputLabel>
                  <Select
                    value={generalSettings.date_format}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, date_format: e.target.value }))}
                    label="Formato de Data"
                  >
                    <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
                    <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
                    <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Intervalo de Atualização (segundos)"
                  type="number"
                  value={generalSettings.auto_refresh_interval}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, auto_refresh_interval: parseInt(e.target.value) }))}
                  inputProps={{ min: 10, max: 300 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Tamanho Máximo de Upload (MB)"
                  type="number"
                  value={generalSettings.max_upload_size}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, max_upload_size: parseInt(e.target.value) }))}
                  inputProps={{ min: 10, max: 2000 }}
                />
              </Grid>
            </Grid>
            
            <Box mt={3}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => saveSettings('general', generalSettings)}
                disabled={loading}
              >
                Salvar Configurações Gerais
              </Button>
            </Box>
          </CardContent>
        </TabPanel>

        {/* Display Settings Tab */}
        <TabPanel value={activeTab} index={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <DisplayIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Configurações de Exibição
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Resolução Padrão</InputLabel>
                  <Select
                    value={displaySettings.default_resolution}
                    onChange={(e) => setDisplaySettings(prev => ({ ...prev, default_resolution: e.target.value }))}
                    label="Resolução Padrão"
                  >
                    <MenuItem value="1920x1080">Full HD (1920x1080)</MenuItem>
                    <MenuItem value="1366x768">HD (1366x768)</MenuItem>
                    <MenuItem value="3840x2160">4K (3840x2160)</MenuItem>
                    <MenuItem value="1280x720">HD Ready (1280x720)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Orientação Padrão</InputLabel>
                  <Select
                    value={displaySettings.default_orientation}
                    onChange={(e) => setDisplaySettings(prev => ({ ...prev, default_orientation: e.target.value }))}
                    label="Orientação Padrão"
                  >
                    <MenuItem value="landscape">Paisagem</MenuItem>
                    <MenuItem value="portrait">Retrato</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Volume Padrão (%)"
                  type="number"
                  value={displaySettings.default_volume}
                  onChange={(e) => setDisplaySettings(prev => ({ ...prev, default_volume: parseInt(e.target.value) }))}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Timeout da Proteção de Tela (segundos)"
                  type="number"
                  value={displaySettings.screen_saver_timeout}
                  onChange={(e) => setDisplaySettings(prev => ({ ...prev, screen_saver_timeout: parseInt(e.target.value) }))}
                  inputProps={{ min: 60, max: 3600 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Efeito de Transição</InputLabel>
                  <Select
                    value={displaySettings.transition_effect}
                    onChange={(e) => setDisplaySettings(prev => ({ ...prev, transition_effect: e.target.value }))}
                    label="Efeito de Transição"
                  >
                    <MenuItem value="fade">Fade</MenuItem>
                    <MenuItem value="slide">Slide</MenuItem>
                    <MenuItem value="zoom">Zoom</MenuItem>
                    <MenuItem value="none">Nenhum</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Duração da Transição (ms)"
                  type="number"
                  value={displaySettings.transition_duration}
                  onChange={(e) => setDisplaySettings(prev => ({ ...prev, transition_duration: parseInt(e.target.value) }))}
                  inputProps={{ min: 100, max: 5000 }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={displaySettings.show_clock}
                      onChange={(e) => setDisplaySettings(prev => ({ ...prev, show_clock: e.target.checked }))}
                    />
                  }
                  label="Mostrar relógio nas telas"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={displaySettings.show_weather}
                      onChange={(e) => setDisplaySettings(prev => ({ ...prev, show_weather: e.target.checked }))}
                    />
                  }
                  label="Mostrar informações do clima"
                />
              </Grid>
            </Grid>
            
            <Box mt={3}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => saveSettings('display', displaySettings)}
                disabled={loading}
              >
                Salvar Configurações de Exibição
              </Button>
            </Box>
          </CardContent>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={activeTab} index={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Configurações de Notificações
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email para Alertas"
                  type="email"
                  value={notificationSettings.alert_email}
                  onChange={(e) => setNotificationSettings(prev => ({ ...prev, alert_email: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Tipos de Notificação
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.email_notifications}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, email_notifications: e.target.checked }))}
                    />
                  }
                  label="Notificações por email"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.system_alerts}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, system_alerts: e.target.checked }))}
                    />
                  }
                  label="Alertas do sistema"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.player_offline_alert}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, player_offline_alert: e.target.checked }))}
                    />
                  }
                  label="Alerta de player offline"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.content_expiry_alert}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, content_expiry_alert: e.target.checked }))}
                    />
                  }
                  label="Alerta de conteúdo expirado"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.low_storage_alert}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, low_storage_alert: e.target.checked }))}
                    />
                  }
                  label="Alerta de armazenamento baixo"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.failed_upload_alert}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, failed_upload_alert: e.target.checked }))}
                    />
                  }
                  label="Alerta de falha no upload"
                />
              </Grid>
            </Grid>
            
            <Box mt={3}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => saveSettings('notifications', notificationSettings)}
                disabled={loading}
              >
                Salvar Configurações de Notificações
              </Button>
            </Box>
          </CardContent>
        </TabPanel>

        {/* Storage Tab */}
        <TabPanel value={activeTab} index={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Configurações de Armazenamento
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Armazenamento Máximo (GB)"
                  type="number"
                  value={storageSettings.max_storage_gb}
                  onChange={(e) => setStorageSettings(prev => ({ ...prev, max_storage_gb: parseInt(e.target.value) }))}
                  inputProps={{ min: 10, max: 1000 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Dias para Limpeza Automática"
                  type="number"
                  value={storageSettings.cleanup_days}
                  onChange={(e) => setStorageSettings(prev => ({ ...prev, cleanup_days: parseInt(e.target.value) }))}
                  inputProps={{ min: 1, max: 365 }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={storageSettings.auto_cleanup}
                      onChange={(e) => setStorageSettings(prev => ({ ...prev, auto_cleanup: e.target.checked }))}
                    />
                  }
                  label="Limpeza automática de arquivos antigos"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={storageSettings.backup_enabled}
                      onChange={(e) => setStorageSettings(prev => ({ ...prev, backup_enabled: e.target.checked }))}
                    />
                  }
                  label="Backup automático"
                />
              </Grid>
              
              {storageSettings.backup_enabled && (
                <>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Frequência do Backup</InputLabel>
                      <Select
                        value={storageSettings.backup_frequency}
                        onChange={(e) => setStorageSettings(prev => ({ ...prev, backup_frequency: e.target.value }))}
                        label="Frequência do Backup"
                      >
                        <MenuItem value="daily">Diário</MenuItem>
                        <MenuItem value="weekly">Semanal</MenuItem>
                        <MenuItem value="monthly">Mensal</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Retenção do Backup (dias)"
                      type="number"
                      value={storageSettings.backup_retention_days}
                      onChange={(e) => setStorageSettings(prev => ({ ...prev, backup_retention_days: parseInt(e.target.value) }))}
                      inputProps={{ min: 1, max: 365 }}
                    />
                  </Grid>
                </>
              )}
            </Grid>
            
            <Box mt={3}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => saveSettings('storage', storageSettings)}
                disabled={loading}
                sx={{ mr: 2 }}
              >
                Salvar Configurações de Armazenamento
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  // Trigger manual cleanup
                  setSuccess('Limpeza manual iniciada');
                }}
              >
                Executar Limpeza Manual
              </Button>
            </Box>
          </CardContent>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={activeTab} index={4}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Configurações de Segurança
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Comprimento Mínimo da Senha"
                  type="number"
                  value={securitySettings.password_min_length}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, password_min_length: parseInt(e.target.value) }))}
                  inputProps={{ min: 6, max: 20 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Timeout da Sessão (minutos)"
                  type="number"
                  value={securitySettings.session_timeout_minutes}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, session_timeout_minutes: parseInt(e.target.value) }))}
                  inputProps={{ min: 15, max: 480 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Máximo de Tentativas de Login"
                  type="number"
                  value={securitySettings.max_login_attempts}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, max_login_attempts: parseInt(e.target.value) }))}
                  inputProps={{ min: 3, max: 10 }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Requisitos de Senha
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.password_require_special}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, password_require_special: e.target.checked }))}
                    />
                  }
                  label="Exigir caracteres especiais"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.password_require_numbers}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, password_require_numbers: e.target.checked }))}
                    />
                  }
                  label="Exigir números"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.password_require_uppercase}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, password_require_uppercase: e.target.checked }))}
                    />
                  }
                  label="Exigir letras maiúsculas"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.two_factor_auth}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, two_factor_auth: e.target.checked }))}
                    />
                  }
                  label="Autenticação de dois fatores"
                />
              </Grid>
            </Grid>
            
            <Box mt={3}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => saveSettings('security', securitySettings)}
                disabled={loading}
              >
                Salvar Configurações de Segurança
              </Button>
            </Box>
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default Settings;
