import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Pagination,
  Fab,
  Avatar,
  Badge,
  Fade,
  Grow,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Computer as ComputerIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Cast as CastIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Sync as SyncIcon,
  PowerSettingsNew as PowerIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from '../../config/axios';

const PlayerList = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { sendPlayerCommand } = useSocket();
  
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [locations, setLocations] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    location_id: ''
  });

  useEffect(() => {
    loadPlayers();
    loadLocations();
  }, [page, filters.search, filters.status, filters.location_id]);

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
        search: filters.search || undefined,
        status: filters.status || undefined,
        location_id: filters.location_id || undefined,
      };

      const response = await axios.get('/players', { params });
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
      const response = await axios.get('/players/locations');
      setLocations(response.data.locations || []);
    } catch (err) {
      console.error('Load locations error:', err);
      setLocations([]); // Set empty array on error
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/players/${playerToDelete.id}`);
      setSuccess(`Player "${playerToDelete.name}" deletado com sucesso`);
      setDeleteDialogOpen(false);
      setPlayerToDelete(null);
      loadPlayers();
    } catch (err) {
      setError('Erro ao deletar player');
      console.error('Delete player error:', err);
    }
  };

  const handlePlayerAction = async (player, action) => {
    try {
      if (action === 'sync') {
        await axios.post(`/players/${player.id}/sync`);
      } else {
        // For restart/stop/start, use WebSocket command
        sendPlayerCommand(player.id, action);
      }
      setSuccess(`Comando ${action} enviado para ${player.name}`);
      handleMenuClose();
      // Reload players to get updated status
      setTimeout(() => {
        loadPlayers();
      }, 1000);
    } catch (error) {
      console.error(`Error sending ${action} command:`, error);
      setError(`Erro ao enviar comando ${action}`);
      handleMenuClose();
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

  const getStatusText = (status) => {
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
        return <ComputerIcon />;
      case 'windows':
        return <ComputerIcon />;
      case 'web':
        return <ComputerIcon />;
      case 'tablet':
        return <ComputerIcon />;
      default:
        return <ComputerIcon />;
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

  const PlayerCardSkeleton = ({ delay = 0 }) => (
    <Grow in={true} timeout={1000 + delay * 100}>
      <Card sx={{ borderRadius: '16px' }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" mb={2}>
            <Skeleton variant="circular" width={48} height={48} sx={{ mr: 2 }} />
            <Box flex={1}>
              <Skeleton variant="text" width="70%" height={28} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="50%" height={20} />
            </Box>
            <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: '12px' }} />
          </Box>
          <Box display="flex" gap={1} mb={2}>
            <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: '12px' }} />
            <Skeleton variant="rectangular" width={100} height={24} sx={{ borderRadius: '12px' }} />
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Skeleton variant="text" width={120} />
            <Skeleton variant="circular" width={32} height={32} />
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    // Also update the existing filter states for compatibility
    if (key === 'search') setSearchTerm(value);
    if (key === 'status') setFilterStatus(value);
    if (key === 'location_id') setFilterLocation(value);
  };

  const handleDeleteClick = (player) => {
    setPlayerToDelete(player);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!playerToDelete) return;
    
    try {
      await axios.delete(`/players/${playerToDelete.id}`);
      setSuccess(`Player "${playerToDelete.name}" deletado com sucesso`);
      setDeleteDialogOpen(false);
      setPlayerToDelete(null);
      loadPlayers();
    } catch (error) {
      console.error('Error deleting player:', error);
      setError('Erro ao deletar player');
    }
  };

  return (
    <Box>
      {/* Header */}
      <Grow in={true} timeout={1000}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center">
            <Avatar
              sx={{
                background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                mr: 2,
                width: 48,
                height: 48,
              }}
            >
              <ComputerIcon />
            </Avatar>
            <Typography 
              variant="h4" 
              component="h1"
              sx={{
                fontWeight: 700,
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)'
                  : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Gerenciar Players
            </Typography>
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
              background: isDarkMode 
                ? 'rgba(244, 67, 54, 0.1)' 
                : 'rgba(244, 67, 54, 0.05)',
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
              background: isDarkMode 
                ? 'rgba(76, 175, 80, 0.1)' 
                : 'rgba(76, 175, 80, 0.05)',
            }} 
            onClose={() => setSuccess('')}
          >
            {success}
          </Alert>
        </Fade>
      )}

      {/* Filters */}
      <Grow in={true} timeout={1200}>
        <Card 
          sx={{ 
            mb: 3,
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            background: isDarkMode 
              ? 'rgba(255, 255, 255, 0.05)' 
              : 'rgba(255, 255, 255, 0.9)',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
            boxShadow: isDarkMode 
              ? '0 8px 32px rgba(0, 0, 0, 0.3)' 
              : '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Buscar players"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                  sx={{
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
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    label="Status"
                    sx={{
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      }
                    }}
                  >
                    <MenuItem value="">Todos os status</MenuItem>
                    <MenuItem value="online">Online</MenuItem>
                    <MenuItem value="offline">Offline</MenuItem>
                    <MenuItem value="syncing">Sincronizando</MenuItem>
                    <MenuItem value="error">Erro</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Localização</InputLabel>
                  <Select
                    value={filters.location_id}
                    onChange={(e) => handleFilterChange('location_id', e.target.value)}
                    label="Localização"
                    sx={{
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      }
                    }}
                  >
                    <MenuItem value="">Todas as localizações</MenuItem>
                    {locations.map(location => (
                      <MenuItem key={location.id} value={location.id}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  variant="outlined"
                  startIcon={<FilterIcon />}
                  fullWidth
                  sx={{
                    borderRadius: '12px',
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: 'rgba(255, 119, 48, 0.5)',
                    color: '#ff7730',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: '#ff7730',
                      background: 'rgba(255, 119, 48, 0.05)',
                      transform: 'translateY(-1px)',
                    }
                  }}
                >
                  Filtrar
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grow>

      {/* Players Grid */}
      <Grid container spacing={3}>
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <PlayerCardSkeleton delay={index} />
            </Grid>
          ))
        ) : players.length > 0 ? (
          players.map((player, index) => (
            <Grid item xs={12} sm={6} md={4} key={player.id}>
              <Grow in={true} timeout={1400 + index * 100}>
                <Card
                  sx={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                    boxShadow: isDarkMode 
                      ? '0 8px 32px rgba(0, 0, 0, 0.3)' 
                      : '0 8px 32px rgba(0, 0, 0, 0.1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode 
                        ? '0 16px 48px rgba(0, 0, 0, 0.4)' 
                        : '0 16px 48px rgba(0, 0, 0, 0.15)',
                    }
                  }}
                  onClick={() => navigate(`/players/${player.id}`)}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: getStatusColor(player.status) === 'success' 
                                ? 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)'
                                : getStatusColor(player.status) === 'warning'
                                ? 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)'
                                : 'linear-gradient(135deg, #f44336 0%, #e57373 100%)',
                              border: '2px solid white',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            }}
                          />
                        }
                      >
                        <Avatar
                          sx={{
                            background: 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)',
                            width: 48,
                            height: 48,
                          }}
                        >
                          <ComputerIcon />
                        </Avatar>
                      </Badge>
                      
                      <Box flex={1} ml={2}>
                        <Typography 
                          variant="h6" 
                          component="h3" 
                          sx={{ 
                            mb: 0.5, 
                            fontWeight: 700,
                            background: isDarkMode 
                              ? 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)'
                              : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >
                          {player.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {player.location?.name || 'Sem localização'}
                        </Typography>
                      </Box>
                      
                      <Chip
                        label={getStatusText(player.status)}
                        color={getStatusColor(player.status)}
                        size="small"
                        sx={{
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      />
                    </Box>
                    
                    <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                      <Chip 
                        icon={player.is_online ? <WifiIcon /> : <WifiOffIcon />}
                        label={player.is_online ? 'Conectado' : 'Desconectado'}
                        size="small"
                        sx={{
                          borderRadius: '8px',
                          background: player.is_online 
                            ? 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)'
                            : 'linear-gradient(135deg, #f44336 0%, #e57373 100%)',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                        }}
                      />
                      {player.current_campaign && (
                        <Chip 
                          icon={<PlayIcon />}
                          label={player.current_campaign.name}
                          size="small"
                          sx={{
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                      {player.supports_chromecast && (
                        <Chip 
                          icon={<CastIcon />}
                          label="Chromecast"
                          size="small"
                          sx={{
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #ff5722 0%, #ff8a65 100%)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                    </Box>
                    
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        IP: {player.ip_address || 'N/A'}
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Tooltip title="Sincronizar" arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handlePlayerAction(player, 'sync'); }}
                            sx={{
                              mr: 0.5,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                background: 'rgba(33, 150, 243, 0.08)',
                                transform: 'scale(1.1)',
                              }
                            }}
                          >
                            <SyncIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reiniciar" arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handlePlayerAction(player, 'restart'); }}
                            sx={{
                              mr: 0.5,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                background: 'rgba(255, 119, 48, 0.10)',
                                transform: 'scale(1.1)',
                              }
                            }}
                          >
                            <PowerIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          onClick={(e) => { e.stopPropagation(); handleMenuClick(e, player); }}
                          size="small"
                          sx={{
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                              color: 'white',
                              transform: 'scale(1.1)',
                            }
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grow>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Fade in={true} timeout={1000}>
              <Box 
                textAlign="center" 
                py={8}
                sx={{
                  background: isDarkMode
                    ? 'radial-gradient(circle, rgba(255, 119, 48, 0.05) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(255, 119, 48, 0.02) 0%, transparent 70%)',
                  borderRadius: '16px',
                }}
              >
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    mx: 'auto',
                    mb: 3,
                    background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                    fontSize: '2rem',
                  }}
                >
                  <ComputerIcon sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography 
                  variant="h6" 
                  color="text.secondary" 
                  sx={{ mb: 2, fontWeight: 600 }}
                >
                  Nenhum player encontrado
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}
                >
                  Comece registrando seu primeiro player para começar a exibir conteúdo em suas telas.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/players/new')}
                  sx={{
                    background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                    borderRadius: '12px',
                    px: 4,
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: '0 4px 20px rgba(255, 119, 48, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 25px rgba(255, 119, 48, 0.4)',
                    }
                  }}
                >
                  Registrar Primeiro Player
                </Button>
              </Box>
            </Fade>
          </Grid>
        )}
      </Grid>

      {/* Pagination */}
      {totalPages > 1 && (
        <Fade in={true} timeout={1800}>
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              color="primary"
              sx={{
                '& .MuiPaginationItem-root': {
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                  },
                  '&.Mui-selected': {
                    background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                    color: 'white',
                  }
                }
              }}
            />
          </Box>
        </Fade>
      )}

      {/* Floating Action Button */}
      <Fade in={true} timeout={2000}>
        <Fab
          color="primary"
          onClick={() => navigate('/players/new')}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
            boxShadow: '0 8px 32px rgba(255, 119, 48, 0.3)',
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
              transform: 'scale(1.1)',
              boxShadow: '0 12px 40px rgba(255, 119, 48, 0.4)',
            }
          }}
        >
          <AddIcon />
        </Fab>
      </Fade>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            backdropFilter: 'blur(20px)',
            background: isDarkMode 
              ? 'rgba(30, 30, 30, 0.9)' 
              : 'rgba(255, 255, 255, 0.9)',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }
        }}
      >
        <MenuItem 
          onClick={() => {
            navigate(`/players/${selectedPlayer?.id}/edit`);
            handleMenuClose();
          }}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(255, 119, 48, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <EditIcon sx={{ mr: 1 }} />
          Editar
        </MenuItem>
        <MenuItem 
          onClick={() => {
            navigate(`/players/${selectedPlayer?.id}/settings`);
            handleMenuClose();
          }}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(255, 119, 48, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <SettingsIcon sx={{ mr: 1 }} />
          Configurações
        </MenuItem>
        <MenuItem 
          onClick={() => handlePlayerAction(selectedPlayer, 'restart')}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(255, 119, 48, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <PowerIcon sx={{ mr: 1 }} />
          Reiniciar
        </MenuItem>
        <MenuItem 
          onClick={() => handlePlayerAction(selectedPlayer, 'stop')}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(255, 152, 0, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <StopIcon sx={{ mr: 1 }} />
          Parar Reprodução
        </MenuItem>
        <MenuItem 
          onClick={() => handleDeleteClick(selectedPlayer)}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(244, 67, 54, 0.1)',
              transform: 'translateX(4px)',
              color: 'error.main',
            }
          }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Deletar
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            background: isDarkMode 
              ? 'rgba(30, 30, 30, 0.9)' 
              : 'rgba(255, 255, 255, 0.9)',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja deletar o player "{playerToDelete?.name}"?
            Esta ação não pode ser desfeita e removerá todos os agendamentos associados.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Deletar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlayerList;
