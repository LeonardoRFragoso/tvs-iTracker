import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Pagination,
  Fab,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  Tv as PlayerIcon,
  PowerSettingsNew as PowerIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Sync as SyncIcon,
  LocationOn as LocationIcon,
  Computer as ComputerIcon,
  Smartphone as SmartphoneIcon,
  Tablet as TabletIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const PlayerList = () => {
  const navigate = useNavigate();
  const { socket, sendPlayerCommand } = useSocket();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, player: null });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    loadPlayers();
    loadLocations();
  }, [page, searchTerm, filterStatus, filterLocation]);

  useEffect(() => {
    if (socket) {
      socket.on('player_status_update', handlePlayerStatusUpdate);
      return () => {
        socket.off('player_status_update');
      };
    }
  }, [socket]);

  const handlePlayerStatusUpdate = (data) => {
    setPlayers(prev => prev.map(player => 
      player.id === data.player_id 
        ? { ...player, status: data.status, last_seen: data.last_seen }
        : player
    ));
  };

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: 12,
        search: searchTerm || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        location: filterLocation !== 'all' ? filterLocation : undefined,
      };

      const response = await axios.get(`${API_BASE_URL}/players`, { params });
      setPlayers(response.data.players);
      setTotalPages(response.data.pages);
    } catch (err) {
      setError('Erro ao carregar players');
      console.error('Load players error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/players/locations`);
      setLocations(response.data.locations || []);
    } catch (err) {
      console.error('Load locations error:', err);
      setLocations([]); // Set empty array on error
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/players/${deleteDialog.player.id}`);
      setDeleteDialog({ open: false, player: null });
      loadPlayers();
    } catch (err) {
      setError('Erro ao deletar player');
      console.error('Delete player error:', err);
    }
  };

  const handlePlayerCommand = async (playerId, command) => {
    try {
      await sendPlayerCommand(playerId, command);
      loadPlayers(); // Refresh to get updated status
    } catch (err) {
      setError(`Erro ao enviar comando: ${command}`);
      console.error('Player command error:', err);
    }
  };

  const handleMenuClick = (event, player) => {
    setAnchorEl(event.currentTarget);
    setSelectedPlayer(player);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPlayer(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'offline':
        return 'error';
      case 'syncing':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'syncing':
        return 'Sincronizando';
      case 'error':
        return 'Erro';
      default:
        return status;
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'android':
        return <SmartphoneIcon />;
      case 'windows':
        return <ComputerIcon />;
      case 'web':
        return <ComputerIcon />;
      case 'tablet':
        return <TabletIcon />;
      default:
        return <PlayerIcon />;
    }
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `${diffMinutes}min atrás`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gerenciar Players
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadPlayers}
          >
            Atualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/players/new')}
          >
            Novo Player
          </Button>
        </Box>
      </Box>

      {/* Filtros e Busca */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Buscar player..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">Todos os status</MenuItem>
                <MenuItem value="online">Online</MenuItem>
                <MenuItem value="offline">Offline</MenuItem>
                <MenuItem value="syncing">Sincronizando</MenuItem>
                <MenuItem value="error">Erro</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Localização"
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
              >
                <MenuItem value="all">Todas as localizações</MenuItem>
                {locations.filter(location => location && typeof location === 'object' && location.name).map((location) => (
                  <MenuItem key={location.id || location.name} value={location.name}>
                    {location.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={loadPlayers}
              >
                Filtrar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Lista de Players */}
      <Grid container spacing={3}>
        {players.map((player) => (
          <Grid item xs={12} sm={6} md={4} key={player.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {getDeviceIcon(player.device_type)}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" component="h3">
                        {player.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {player.description}
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuClick(e, player)}
                  >
                    <MoreIcon />
                  </IconButton>
                </Box>

                <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={getStatusLabel(player.status)}
                    color={getStatusColor(player.status)}
                  />
                  {player.device_type && (
                    <Chip
                      size="small"
                      label={player.device_type}
                      variant="outlined"
                    />
                  )}
                </Box>

                <List dense>
                  {player.location && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <LocationIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Localização"
                        secondary={player.location}
                      />
                    </ListItem>
                  )}
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <RefreshIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Última conexão"
                      secondary={formatLastSeen(player.last_seen)}
                    />
                  </ListItem>

                  {player.current_campaign && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <ScheduleIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Campanha ativa"
                        secondary={player.current_campaign.name}
                      />
                    </ListItem>
                  )}
                </List>

                <Box display="flex" gap={1} mt={2}>
                  {player.status === 'online' && (
                    <>
                      <Tooltip title="Reiniciar Player">
                        <IconButton
                          size="small"
                          onClick={() => handlePlayerCommand(player.id, 'restart')}
                        >
                          <PowerIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sincronizar Conteúdo">
                        <IconButton
                          size="small"
                          onClick={() => handlePlayerCommand(player.id, 'sync')}
                        >
                          <SyncIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/players/${player.id}`)}
                  >
                    Detalhes
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {players.length === 0 && !loading && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary">
            Nenhum player encontrado
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/players/new')}
            sx={{ mt: 2 }}
          >
            Adicionar Primeiro Player
          </Button>
        </Box>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(e, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* Menu de Ações */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          navigate(`/players/${selectedPlayer?.id}`);
          handleMenuClose();
        }}>
          <ViewIcon sx={{ mr: 1 }} />
          Visualizar
        </MenuItem>
        <MenuItem onClick={() => {
          navigate(`/players/${selectedPlayer?.id}/edit`);
          handleMenuClose();
        }}>
          <EditIcon sx={{ mr: 1 }} />
          Editar
        </MenuItem>
        <MenuItem onClick={() => {
          navigate(`/schedules?player=${selectedPlayer?.id}`);
          handleMenuClose();
        }}>
          <ScheduleIcon sx={{ mr: 1 }} />
          Agendamento
        </MenuItem>
        <MenuItem onClick={() => {
          setDeleteDialog({ open: true, player: selectedPlayer });
          handleMenuClose();
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Excluir
        </MenuItem>
      </Menu>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, player: null })}
      >
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja deletar o player "{deleteDialog.player?.name}"?
            Esta ação não pode ser desfeita e removerá todos os agendamentos associados.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, player: null })}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Deletar
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB para adicionar player */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => navigate('/players/new')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default PlayerList;
