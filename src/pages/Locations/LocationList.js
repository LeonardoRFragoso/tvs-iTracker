import React, { useState, useEffect } from 'react';
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
  CardContent
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
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const LocationList = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, location: null });
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/locations/');
      setLocations(response.data.locations);
      
      // Buscar estatísticas para cada location
      const statsPromises = response.data.locations.map(async (location) => {
        try {
          const statsResponse = await axios.get(`/api/locations/${location.id}/stats`);
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
      await axios.delete(`/api/locations/${deleteDialog.location.id}`);
      setDeleteDialog({ open: false, location: null });
      fetchLocations();
    } catch (err) {
      setError('Erro ao deletar sede: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.state.toLowerCase().includes(searchTerm.toLowerCase())
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
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography>Carregando sedes...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gerenciamento de Sedes
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchLocations}
          >
            Atualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/locations/new')}
          >
            Nova Sede
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Search */}
      <Box mb={3}>
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
        />
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <LocationIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{locations.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de Sedes
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <ComputerIcon color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">
                    {Object.values(stats).reduce((acc, stat) => 
                      acc + (stat?.player_stats?.total_players || 0), 0
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de Players
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <WifiIcon color="info" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">
                    {Object.values(stats).reduce((acc, stat) => 
                      acc + (stat?.player_stats?.online_players || 0), 0
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Players Online
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <StorageIcon color="warning" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">
                    {Object.values(stats).reduce((acc, stat) => 
                      acc + (stat?.storage_stats?.total_storage_gb || 0), 0
                    ).toFixed(1)} GB
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Armazenamento Total
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Locations Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Localização</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Players</TableCell>
              <TableCell>Horário de Pico</TableCell>
              <TableCell>Bandwidth</TableCell>
              <TableCell>Armazenamento</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLocations.map((location) => {
              const locationStats = stats[location.id];
              return (
                <TableRow key={location.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">
                        {location.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {location.timezone}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
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
                    <Chip
                      label={location.is_active ? 'Ativa' : 'Inativa'}
                      color={getStatusColor(location.is_active)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {locationStats ? (
                      <Box>
                        <Typography variant="body2">
                          {locationStats.player_stats.online_players}/
                          {locationStats.player_stats.total_players}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getOnlinePercentage(locationStats).toFixed(1)}% online
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Carregando...
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <ScheduleIcon fontSize="small" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        {formatPeakHours(location.peak_hours_start, location.peak_hours_end)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <WifiIcon fontSize="small" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        {location.network_bandwidth_mbps} Mbps
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {locationStats ? (
                      <Box>
                        <Typography variant="body2">
                          {locationStats.storage_stats.used_storage_gb.toFixed(1)}/
                          {locationStats.storage_stats.total_storage_gb.toFixed(1)} GB
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getStorageUsage(locationStats).toFixed(1)}% usado
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Carregando...
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/locations/${location.id}/edit`)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Ver Detalhes">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/locations/${location.id}`)}
                      >
                        <LocationIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deletar">
                      <IconButton
                        size="small"
                        onClick={() => setDeleteDialog({ open: true, location })}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

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
    </Container>
  );
};

export default LocationList;
