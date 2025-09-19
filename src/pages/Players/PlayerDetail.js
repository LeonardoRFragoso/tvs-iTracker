import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Divider,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  PowerSettingsNew as PowerIcon,
  Sync as SyncIcon,
  Schedule as ScheduleIcon,
  Storage as StorageIcon,
  NetworkWifi as NetworkIcon,
  Computer as ComputerIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../../contexts/SocketContext';
import CastManager from '../../components/Cast/CastManager';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

const PlayerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sendPlayerCommand } = useSocket();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const regenerateCode = async () => {
    try {
      await axios.post(`${API_BASE_URL}/players/${id}/regenerate-code`);
      await loadPlayer();
    } catch (err) {
      setError('Erro ao regenerar código');
    }
  };

  useEffect(() => {
    loadPlayer();
  }, [id]);

  const loadPlayer = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/players/${id}`);
      setPlayer(response.data);
    } catch (err) {
      setError('Erro ao carregar player');
      console.error('Load player error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerCommand = async (command) => {
    try {
      if (command === 'sync') {
        // Para sync, usar endpoint HTTP específico
        const response = await axios.post(`${API_BASE_URL}/players/${id}/sync`);
        if (response.data.chromecast_status === 'found') {
          setError(''); // Limpar erros anteriores
        }
        setTimeout(loadPlayer, 1000); // Refresh after sync
      } else {
        // Para outros comandos, usar WebSocket
        await sendPlayerCommand(id, command);
        setTimeout(loadPlayer, 1000); // Refresh after command
      }
    } catch (err) {
      setError(`Erro ao enviar comando: ${command} - ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/players/${id}`);
      navigate('/players');
    } catch (err) {
      setError('Erro ao deletar player');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'error';
      case 'syncing': return 'warning';
      default: return 'default';
    }
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Nunca';
    let date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // Tenta parsear formato BR: dd/mm/yyyy HH:MM:SS
      try {
        const [dpart, tpart = '00:00:00'] = String(dateString).split(' ');
        const [dd, mm, yyyy] = dpart.split(/[\/]/).map((v) => parseInt(v, 10));
        const [hh = 0, mi = 0, ss = 0] = tpart.split(':').map((v) => parseInt(v, 10));
        if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
          date = new Date(yyyy, Math.max(0, (mm || 1) - 1), dd || 1, hh || 0, mi || 0, ss || 0);
        }
      } catch (e) {
        // Mantém date inválido se falhar
      }
    }
    if (isNaN(date.getTime())) return '—';
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `${diffMinutes}min atrás`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) return <LinearProgress />;
  if (!player) return <Alert severity="error">Player não encontrado</Alert>;

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/players')}>
            <BackIcon />
          </IconButton>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <ComputerIcon />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1">
              {player.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {player.location_name} - {player.room_name}
            </Typography>
          </Box>
        </Box>
        
        <Box display="flex" gap={1}>
          <Chip 
            label={player.status} 
            color={getStatusColor(player.status)}
            size="small"
          />
          {player.access_code && (
            <Chip label={`Código: ${player.access_code}`} size="small" />
          )}
          <Button
            variant="contained"
            color="primary"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(`${window.location.origin}/kiosk/player/${id}?fullscreen=true`, '_blank')}
          >
            Abrir Player
          </Button>
          {player.access_code && (
            <Button
              variant="outlined"
              onClick={() => window.open(`${window.location.origin}/k/${player.access_code}`, '_blank')}
            >
              Abrir Link Curto
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadPlayer}
          >
            Atualizar
          </Button>
          <IconButton
            color="primary"
            onClick={() => navigate(`/players/${id}/edit`)}
            sx={{ mr: 1 }}
          >
            <EditIcon />
          </IconButton>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialog(true)}
          >
            Excluir
          </Button>
          <Button
            variant="text"
            onClick={regenerateCode}
          >
            Regenerar Código
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Action Buttons */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Controles do Player
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={() => handlePlayerCommand('start')}
              disabled={player.status === 'online'}
            >
              Iniciar
            </Button>
            <Button
              variant="outlined"
              startIcon={<StopIcon />}
              onClick={() => handlePlayerCommand('stop')}
              disabled={player.status === 'offline'}
            >
              Parar
            </Button>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={() => handlePlayerCommand('sync')}
            >
              Sincronizar
            </Button>
            <Button
              variant="outlined"
              startIcon={<PowerIcon />}
              onClick={() => handlePlayerCommand('restart')}
            >
              Reiniciar
            </Button>
            <Button
              variant="outlined"
              startIcon={<ScheduleIcon />}
              onClick={() => navigate(`/schedules?player=${id}`)}
            >
              Agendamentos
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Cast Manager */}
      <CastManager playerId={id} />

      {/* Tabs */}
      <Card>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Informações Gerais" />
          <Tab label="Configurações" />
          <Tab label="Performance" />
          <Tab label="Conteúdo" />
        </Tabs>

        <CardContent>
          {/* Tab 0: Informações Gerais */}
          {tabValue === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Identificação
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Nome" secondary={player.name} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Código de acesso (link curto)" secondary={player.access_code || '—'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Localização" secondary={player.location_name} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Ambiente" secondary={player.room_name || 'N/A'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="MAC Address" secondary={player.mac_address || 'N/A'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="IP Address" secondary={player.ip_address || 'N/A'} />
                  </ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Status
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Status"
                      primaryTypographyProps={{ component: 'div' }}
                      secondary={
                        <Chip label={player.status} color={getStatusColor(player.status)} size="small" />
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Online" secondary={player.is_online ? 'Sim' : 'Não'} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Último ping" secondary={formatLastSeen(player.last_ping)} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Última sincronização" secondary={formatLastSeen(player.last_content_sync)} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Versão do player" secondary={player.player_version} />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
          )}

          {/* Tab 1: Configurações */}
          {tabValue === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Configurações de Exibição
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Plataforma" secondary={player.platform} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Resolução" secondary={player.resolution} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Orientação" secondary={player.orientation} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Duração padrão" secondary={`${player.default_content_duration}s`} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Efeito de transição" secondary={player.transition_effect} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Volume" secondary={`${player.volume_level}%`} />
                  </ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Armazenamento
                </Typography>
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    {player.storage_used_gb}GB / {player.storage_capacity_gb}GB ({player.storage_percentage}%)
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={player.storage_percentage} 
                    sx={{ mt: 1 }}
                  />
                </Box>
                <List dense>
                  <ListItem>
                    <ListItemIcon><StorageIcon /></ListItemIcon>
                    <ListItemText 
                      primary="Espaço disponível" 
                      secondary={`${player.storage_available_gb}GB`} 
                    />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
          )}

          {/* Tab 2: Performance */}
          {tabValue === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Métricas de Rede
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon><NetworkIcon /></ListItemIcon>
                    <ListItemText 
                      primary="Velocidade da rede" 
                      secondary={`${player.network_speed_mbps} Mbps`} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Velocidade média de download" 
                      secondary={`${player.avg_download_speed_kbps} Kbps`} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Total baixado" 
                      secondary={`${player.total_content_downloaded_gb}GB`} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Uptime" 
                      secondary={`${player.uptime_percentage}%`} 
                    />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
          )}

          {/* Tab 3: Conteúdo */}
          {tabValue === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Conteúdo Atual
              </Typography>
              <Alert severity="info">
                Funcionalidade de listagem de conteúdo será implementada em breve.
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Excluir Player</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja excluir o player "{player.name}"? Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlayerDetail;
