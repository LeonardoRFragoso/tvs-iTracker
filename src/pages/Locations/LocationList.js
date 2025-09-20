import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Box,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  Grid,
  Card,
  CardContent,
  Avatar,
  Fade,
  Grow,
  Skeleton,
  LinearProgress,
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  LocationOn as LocationIcon,
  Wifi as WifiIcon,
  Schedule as ScheduleIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Close as CloseIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from '../../config/axios';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

// Skeleton loading component for statistics cards
const StatCardSkeleton = ({ delay = 0 }) => (
  <Grow in={true} timeout={1000 + delay * 200}>
    <Card 
      sx={{ 
        height: '100%',
        borderRadius: 3,
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center">
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="text" width="80%" height={20} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  </Grow>
);

// Skeleton loading component for table rows
const TableRowSkeleton = ({ delay = 0 }) => (
  <TableRow>
    {Array.from({ length: 9 }, (_, index) => (
      <TableCell key={index}>
        <Skeleton 
          variant="text" 
          width={index === 0 ? "80%" : index === 8 ? "60%" : "70%"} 
          height={20} 
        />
      </TableCell>
    ))}
  </TableRow>
);

const LocationList = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, location: null });
  const [stats, setStats] = useState({});
  const { isDarkMode } = useTheme();
  const { user } = useAuth();

  const companyOptions = useMemo(() => {
    const set = new Set();
    locations.forEach((l) => { if (l.company) set.add(l.company); });
    return Array.from(set);
  }, [locations]);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (user) {
        fetchLocations();
      }
    }, 300000); // 5 minutes

    return () => clearInterval(intervalId);
  }, [user]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/locations/');
      setLocations(response.data.locations);
      
      // Buscar estatísticas para cada location
      const statsPromises = response.data.locations.map(async (location) => {
        try {
          const statsResponse = await axios.get(`/locations/${location.id}/stats`);
          return { [location.id]: statsResponse.data };
        } catch (err) {
          return { [location.id]: null };
        }
      });
      
      const statsResults = await Promise.all(statsPromises);
      const statsMap = statsResults.reduce((acc, stat) => ({ ...acc, ...stat }), {});
      setStats(statsMap);
      
    } catch (err) {
      setError('Erro ao carregar sedes: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.location) return;
    
    try {
      await axios.delete(`/locations/${deleteDialog.location.id}`);
      setDeleteDialog({ open: false, location: null });
      fetchLocations();
    } catch (err) {
      setError('Erro ao deletar sede: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredLocations = locations.filter(location =>
    (
      location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.state.toLowerCase().includes(searchTerm.toLowerCase())
    ) && (
      !companyFilter || location.company === companyFilter
    )
  );

  const formatPeakHours = (start, end) => {
    if (!start || !end) return 'Não definido';
    return `${start} - ${end}`;
  };

  const getStatusColor = (isActive) => {
    return isActive ? 'success' : 'error';
  };

  const getOnlinePercentage = (locationStats) => {
    if (!locationStats?.player_stats) return 0;
    return locationStats.player_stats.online_percentage || 0;
  };

  const getStorageUsage = (locationStats) => {
    if (!locationStats?.storage_stats) return 0;
    return locationStats.storage_stats.usage_percentage || 0;
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Fade in={true} timeout={800}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
            <Box>
              <Skeleton variant="text" width={300} height={48} />
              <Skeleton variant="text" width={200} height={24} />
            </Box>
            <Box display="flex" gap={1}>
              <Skeleton variant="circular" width={56} height={56} />
              <Skeleton variant="rectangular" width={120} height={56} sx={{ borderRadius: 2 }} />
            </Box>
          </Box>
        </Fade>
        <Skeleton variant="rectangular" width="100%" height={56} sx={{ mb: 3, borderRadius: 2 }} />
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {Array.from({ length: 4 }, (_, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <StatCardSkeleton delay={index} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Fade in={true} timeout={800}>
        <Grow in={true} timeout={1000}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
            <Box display="flex" alignItems="center">
              <Avatar
                sx={{
                  background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                  mr: 2,
                  width: 48,
                  height: 48,
                }}
              >
                <LocationIcon />
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
                Gerenciamento de Sedes
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <Tooltip title="Atualizar dados">
                <IconButton 
                  onClick={fetchLocations}
                  sx={{
                    bgcolor: 'info.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'info.dark',
                      transform: 'rotate(180deg)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/locations/new')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 'bold',
                  px: 3,
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                    : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Nova Sede
              </Button>
            </Box>
          </Box>
        </Grow>
      </Fade>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Search */}
      <Fade in={true} timeout={1000}>
        <Paper
          elevation={0}
          sx={{
            mb: 4,
            p: 3,
            borderRadius: 3,
            background: isDarkMode 
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: 0,
              width: 100,
              height: 100,
              background: `radial-gradient(circle, ${isDarkMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(25, 118, 210, 0.1)'} 0%, transparent 70%)`,
            },
          }}
        >
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <SearchIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Buscar Sedes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Encontre sedes por nome, cidade, estado ou empresa
              </Typography>
            </Box>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Buscar sedes por nome, cidade ou estado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover': {
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s ease',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Empresa</InputLabel>
                <Select
                  label="Empresa"
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value=""><em>Todas</em></MenuItem>
                  {companyOptions.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      </Fade>

      {/* Statistics Cards */}
      <Fade in={true} timeout={1200}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Grow in={true} timeout={1000}>
              <Card 
                sx={{
                  borderRadius: 3,
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                    : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px) scale(1.02)',
                    boxShadow: '0 12px 35px rgba(25, 118, 210, 0.3)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 100,
                    height: 100,
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    transition: 'all 0.5s ease',
                  },
                  '&:hover::before': {
                    transform: 'scale(1.5)',
                    opacity: 0,
                  },
                }}
              >
                <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h3" fontWeight="bold" mb={1}>
                        {locations.length}
                      </Typography>
                      <Typography variant="h6" sx={{ opacity: 0.9 }}>
                        Total de Sedes
                      </Typography>
                    </Box>
                    <Avatar
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        width: 56,
                        height: 56,
                      }}
                    >
                      <LocationIcon fontSize="large" />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grow>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Grow in={true} timeout={1200}>
              <Card 
                sx={{
                  borderRadius: 3,
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)'
                    : 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px) scale(1.02)',
                    boxShadow: '0 12px 35px rgba(76, 175, 80, 0.3)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 100,
                    height: 100,
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    transition: 'all 0.5s ease',
                  },
                  '&:hover::before': {
                    transform: 'scale(1.5)',
                    opacity: 0,
                  },
                }}
              >
                <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h3" fontWeight="bold" mb={1}>
                        {Object.values(stats).reduce((acc, stat) => 
                          acc + (stat?.player_stats?.total_players || 0), 0
                        )}
                      </Typography>
                      <Typography variant="h6" sx={{ opacity: 0.9 }}>
                        Total de Players
                      </Typography>
                    </Box>
                    <Avatar
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        width: 56,
                        height: 56,
                      }}
                    >
                      <ComputerIcon fontSize="large" />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grow>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Grow in={true} timeout={1400}>
              <Card 
                sx={{
                  borderRadius: 3,
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)'
                    : 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px) scale(1.02)',
                    boxShadow: '0 12px 35px rgba(33, 150, 243, 0.3)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 100,
                    height: 100,
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    transition: 'all 0.5s ease',
                  },
                  '&:hover::before': {
                    transform: 'scale(1.5)',
                    opacity: 0,
                  },
                }}
              >
                <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h3" fontWeight="bold" mb={1}>
                        {Object.values(stats).reduce((acc, stat) => 
                          acc + (stat?.player_stats?.online_players || 0), 0
                        )}
                      </Typography>
                      <Typography variant="h6" sx={{ opacity: 0.9 }}>
                        Players Online
                      </Typography>
                    </Box>
                    <Avatar
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        width: 56,
                        height: 56,
                      }}
                    >
                      <WifiIcon fontSize="large" />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grow>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Grow in={true} timeout={1600}>
              <Card 
                sx={{
                  borderRadius: 3,
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                    : 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px) scale(1.02)',
                    boxShadow: '0 12px 35px rgba(255, 152, 0, 0.3)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 100,
                    height: 100,
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    transition: 'all 0.5s ease',
                  },
                  '&:hover::before': {
                    transform: 'scale(1.5)',
                    opacity: 0,
                  },
                }}
              >
                <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h3" fontWeight="bold" mb={1}>
                        {Object.values(stats).reduce((acc, stat) => 
                          acc + (stat?.storage_stats?.total_storage_gb || 0), 0
                        ).toFixed(1)} GB
                      </Typography>
                      <Typography variant="h6" sx={{ opacity: 0.9 }}>
                        Armazenamento Total
                      </Typography>
                    </Box>
                    <Avatar
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        width: 56,
                        height: 56,
                      }}
                    >
                      <StorageIcon fontSize="large" />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grow>
          </Grid>
        </Grid>
      </Fade>

      {/* Locations Table */}
      <Fade in={true} timeout={1400}>
        <TableContainer 
          component={Paper}
          sx={{
            borderRadius: 3,
            background: isDarkMode 
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
            overflow: 'hidden',
            '& .MuiTable-root': {
              '& .MuiTableHead-root': {
                '& .MuiTableRow-root': {
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)'
                    : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                  '& .MuiTableCell-root': {
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    borderBottom: `2px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                  },
                },
              },
              '& .MuiTableBody-root': {
                '& .MuiTableRow-root': {
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: isDarkMode ? '#2a2a2a' : '#f5f5f5',
                    transform: 'scale(1.01)',
                  },
                  '& .MuiTableCell-root': {
                    borderBottom: `1px solid ${isDarkMode ? '#333' : '#f0f0f0'}`,
                  },
                },
              },
            },
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Localização</TableCell>
                <TableCell>Empresa</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Players</TableCell>
                <TableCell>Horário de Pico</TableCell>
                <TableCell>Bandwidth</TableCell>
                <TableCell>Armazenamento</TableCell>
                <TableCell align="center">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLocations.map((location, index) => {
                const locationStats = stats[location.id];
                return (
                  <Grow in={true} timeout={1600 + index * 100} key={location.id}>
                    <TableRow hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar
                            sx={{
                              bgcolor: location.is_active ? 'success.main' : 'error.main',
                              width: 32,
                              height: 32,
                            }}
                          >
                            <BusinessIcon fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {location.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {location.timezone}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {location.city}, {location.state}
                          </Typography>
                          {location.address && (
                            <Typography variant="caption" color="text.secondary">
                              {location.address}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={location.company || '—'} size="small" sx={{ borderRadius: 2 }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={location.is_active ? 'Ativa' : 'Inativa'}
                          color={getStatusColor(location.is_active)}
                          size="small"
                          sx={{
                            fontWeight: 'bold',
                            borderRadius: 2,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {locationStats ? (
                          <Box>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <Typography variant="body2" fontWeight="bold">
                                {locationStats.player_stats.online_players}/
                                {locationStats.player_stats.total_players}
                              </Typography>
                              <Chip
                                label={`${getOnlinePercentage(locationStats).toFixed(0)}%`}
                                size="small"
                                color={getOnlinePercentage(locationStats) > 80 ? 'success' : 
                                       getOnlinePercentage(locationStats) > 50 ? 'warning' : 'error'}
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={getOnlinePercentage(locationStats)}
                              sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: isDarkMode ? '#333' : '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 2,
                                },
                              }}
                            />
                          </Box>
                        ) : (
                          <Skeleton variant="text" width="80%" height={20} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar
                            sx={{
                              bgcolor: 'info.main',
                              width: 24,
                              height: 24,
                            }}
                          >
                            <ScheduleIcon fontSize="small" />
                          </Avatar>
                          <Typography variant="body2" fontWeight="medium">
                            {formatPeakHours(location.peak_hours_start, location.peak_hours_end)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar
                            sx={{
                              bgcolor: 'primary.main',
                              width: 24,
                              height: 24,
                            }}
                          >
                            <WifiIcon fontSize="small" />
                          </Avatar>
                          <Typography variant="body2" fontWeight="bold">
                            {location.network_bandwidth_mbps} Mbps
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {locationStats ? (
                          <Box>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <Typography variant="body2" fontWeight="bold">
                                {locationStats.storage_stats.used_storage_gb.toFixed(1)}/
                                {locationStats.storage_stats.total_storage_gb.toFixed(1)} GB
                              </Typography>
                              <Chip
                                label={`${getStorageUsage(locationStats).toFixed(0)}%`}
                                size="small"
                                color={getStorageUsage(locationStats) < 70 ? 'success' : 
                                       getStorageUsage(locationStats) < 90 ? 'warning' : 'error'}
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={getStorageUsage(locationStats)}
                              sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: isDarkMode ? '#333' : '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 2,
                                },
                              }}
                            />
                          </Box>
                        ) : (
                          <Skeleton variant="text" width="80%" height={20} />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" gap={0.5} justifyContent="center">
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/locations/${location.id}/edit`)}
                              sx={{
                                bgcolor: 'primary.main',
                                color: 'white',
                                '&:hover': {
                                  bgcolor: 'primary.dark',
                                  transform: 'scale(1.1)',
                                },
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ver Detalhes">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/locations/${location.id}`)}
                              sx={{
                                bgcolor: 'info.main',
                                color: 'white',
                                '&:hover': {
                                  bgcolor: 'info.dark',
                                  transform: 'scale(1.1)',
                                },
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <LocationIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Deletar">
                            <IconButton
                              size="small"
                              onClick={() => setDeleteDialog({ open: true, location })}
                              sx={{
                                bgcolor: 'error.main',
                                color: 'white',
                                '&:hover': {
                                  bgcolor: 'error.dark',
                                  transform: 'scale(1.1)',
                                },
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </Grow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Fade>

      {filteredLocations.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            {searchTerm ? 'Nenhuma sede encontrada para a busca.' : 'Nenhuma sede cadastrada.'}
          </Typography>
          {!searchTerm && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/locations/new')}
              sx={{ mt: 2 }}
            >
              Cadastrar Primeira Sede
            </Button>
          )}
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, location: null })}
      >
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja deletar a sede "{deleteDialog.location?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, location: null })}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Deletar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LocationList;
