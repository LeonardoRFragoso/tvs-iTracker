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
import axios from '../../config/axios';
import { useSocket } from '../../contexts/SocketContext';
import CastManager from '../../components/Cast/CastManager';
import PageTitle from '../../components/Common/PageTitle';

const PlayerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sendPlayerCommand, socket } = useSocket();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [success, setSuccess] = useState('');
  const [syncing, setSyncing] = useState(false);

  const regenerateCode = async () => {
    try {
      await axios.post(`/players/${id}/regenerate-code`);
      await loadPlayer();
    } catch (err) {
      setError('Erro ao regenerar código');
    }
  };

  useEffect(() => {
    loadPlayer();
  }, [id]);

  // Escutar respostas de comandos via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleCommandResponse = (data) => {
      console.log('[PlayerDetail] Resposta do comando recebida:', data);
      
      if (data.success) {
        // Mostrar mensagem de sucesso (você pode usar um toast/snackbar aqui)
        console.log(`[PlayerDetail] Comando ${data.command} executado com sucesso: ${data.message}`);
        
        // Recarregar dados do player após comando bem-sucedido
        setTimeout(loadPlayer, 500);
      } else {
        setError(`Erro no comando ${data.command}: ${data.message || 'Falha desconhecida'}`);
      }
    };

    const handleCommandError = (data) => {
      console.log('[PlayerDetail] Erro no comando:', data);
      setError(`Erro: ${data.message || 'Falha ao executar comando'}`);
    };

    // Escutar eventos de resposta
    socket.on('player_command_response', handleCommandResponse);
    socket.on('error', handleCommandError);

    return () => {
      socket.off('player_command_response', handleCommandResponse);
      socket.off('error', handleCommandError);
    };
  }, [socket]);

  const loadPlayer = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/players/${id}`);
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
        setSyncing(true);
        setSuccess('');
        setError(''); // Limpar erros anteriores
        const response = await axios.post(`/players/${id}/sync`);
        if (response.data && response.data.chromecast_status === 'found') {
          setSuccess('Sincronização concluída: Chromecast encontrado');
        } else {
          setError('Sincronização concluída: Chromecast não encontrado');
        }
        await loadPlayer();
        setSyncing(false);
      } else {
        // Para outros comandos, usar WebSocket
        await sendPlayerCommand(id, command);
        setTimeout(loadPlayer, 1000); // Refresh after command
      }
    } catch (err) {
      setError(`Erro ao enviar comando: ${command} - ${err.response?.data?.error || err.message}`);
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/players/${id}`);
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
      {/* Header com PageTitle */}
      <PageTitle 
        title={player.name}
        subtitle={`${player.location_name} - ${player.room_name || 'Sem ambiente'}`}
        backTo="/players"
        actions={
          <>
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
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {syncing && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Sincronizando...
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
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
              disabled={syncing}
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
            <Button
              variant="outlined"
              startIcon={<ScheduleIcon />}
              onClick={() => navigate(`/players/${id}/calendar`)}
            >
              Calendário
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Cast Manager */}
      <CastManager playerId={id} suppressLoader={true} />

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
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                  <Typography variant="body2">
                    <strong>Chromecast 4 (Google TV):</strong> Dispositivo configurado para streaming direto. 
                    Resolução e orientação detectadas automaticamente pela TV conectada.
                  </Typography>
                </Alert>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Configurações de Exibição
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Plataforma" secondary="Chromecast 4 (Google TV)" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Tipo de dispositivo" secondary="Moderno (Streaming)" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Duração padrão do conteúdo" secondary={`${player.default_content_duration || 10}s`} />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Resolução" 
                      secondary="Detectada automaticamente (até 4K HDR)" 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Volume" 
                      secondary="Controlado pelo controle remoto da TV" 
                    />
                  </ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Armazenamento e Streaming
                </Typography>
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                  <Typography variant="body2">
                    <strong>Streaming Direto:</strong> Chromecast não armazena conteúdo localmente. 
                    Todo conteúdo é transmitido diretamente do servidor.
                  </Typography>
                </Alert>
                <List dense>
                  <ListItem>
                    <ListItemIcon><StorageIcon /></ListItemIcon>
                    <ListItemText 
                      primary="Armazenamento interno" 
                      secondary="~8GB (sistema operacional)" 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><NetworkIcon /></ListItemIcon>
                    <ListItemText 
                      primary="Modo de operação" 
                      secondary="Streaming em tempo real via rede" 
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
