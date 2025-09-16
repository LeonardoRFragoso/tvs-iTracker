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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ScheduleList = () => {
  const navigate = useNavigate();
  
  const [schedules, setSchedules] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    campaign_id: '',
    player_id: '',
    is_active: '',
  });
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);

  useEffect(() => {
    loadSchedules();
    loadCampaigns();
    loadPlayers();
  }, [page, filters]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '12',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      });
      
      const response = await axios.get(`${API_BASE_URL}/schedules?${params}`);
      setSchedules(response.data.schedules);
      setTotalPages(response.data.pages);
      setTotal(response.data.total);
    } catch (err) {
      setError('Erro ao carregar agendamentos');
      console.error('Load schedules error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/campaigns`);
      setCampaigns(response.data.campaigns || []);
    } catch (err) {
      console.error('Load campaigns error:', err);
    }
  };

  const loadPlayers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/players`);
      setPlayers(response.data.players || []);
    } catch (err) {
      console.error('Load players error:', err);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const handleMenuClick = (event, schedule) => {
    setAnchorEl(event.currentTarget);
    setSelectedSchedule(schedule);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedSchedule(null);
  };

  const handleToggleActive = async (schedule) => {
    try {
      await axios.put(`${API_BASE_URL}/schedules/${schedule.id}`, {
        is_active: !schedule.is_active
      });
      setSuccess(`Agendamento ${schedule.is_active ? 'desativado' : 'ativado'} com sucesso`);
      loadSchedules();
    } catch (err) {
      setError('Erro ao alterar status do agendamento');
    }
    handleMenuClose();
  };

  const handleDeleteClick = (schedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/schedules/${scheduleToDelete.id}`);
      setSuccess('Agendamento deletado com sucesso');
      loadSchedules();
    } catch (err) {
      setError('Erro ao deletar agendamento');
    }
    setDeleteDialogOpen(false);
    setScheduleToDelete(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatTime = (timeString) => {
    return timeString || 'Todo o dia';
  };

  const getDaysOfWeekText = (daysString) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const selectedDays = daysString.split(',').map(d => parseInt(d.trim()));
    return selectedDays.map(day => days[day === 7 ? 0 : day]).join(', ');
  };

  const getStatusColor = (schedule) => {
    if (!schedule.is_active) return 'default';
    const now = new Date();
    const startDate = new Date(schedule.start_date);
    const endDate = new Date(schedule.end_date);
    
    if (now < startDate) return 'info';
    if (now > endDate) return 'error';
    return 'success';
  };

  const getStatusText = (schedule) => {
    if (!schedule.is_active) return 'Inativo';
    const now = new Date();
    const startDate = new Date(schedule.start_date);
    const endDate = new Date(schedule.end_date);
    
    if (now < startDate) return 'Agendado';
    if (now > endDate) return 'Expirado';
    return 'Ativo';
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Agendamentos
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/schedules/new')}
        >
          Novo Agendamento
        </Button>
      </Box>

      {/* Alerts */}
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

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Buscar agendamentos"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Campanha</InputLabel>
                <Select
                  value={filters.campaign_id}
                  onChange={(e) => handleFilterChange('campaign_id', e.target.value)}
                  label="Campanha"
                >
                  <MenuItem value="">Todas as campanhas</MenuItem>
                  {campaigns.map(campaign => (
                    <MenuItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Player</InputLabel>
                <Select
                  value={filters.player_id}
                  onChange={(e) => handleFilterChange('player_id', e.target.value)}
                  label="Player"
                >
                  <MenuItem value="">Todos os players</MenuItem>
                  {players.map(player => (
                    <MenuItem key={player.id} value={player.id}>
                      {player.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.is_active}
                  onChange={(e) => handleFilterChange('is_active', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="true">Ativos</MenuItem>
                  <MenuItem value="false">Inativos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Schedules Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Campanha</TableCell>
                  <TableCell>Player</TableCell>
                  <TableCell>Período</TableCell>
                  <TableCell>Horário</TableCell>
                  <TableCell>Dias</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <ScheduleIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="subtitle2">
                          {schedule.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {schedule.campaign?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {schedule.player?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {formatDate(schedule.start_date)} - {formatDate(schedule.end_date)}
                    </TableCell>
                    <TableCell>
                      {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                    </TableCell>
                    <TableCell>
                      {getDaysOfWeekText(schedule.days_of_week)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(schedule)}
                        color={getStatusColor(schedule)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={(e) => handleMenuClick(e, schedule)}
                        size="small"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {schedules.length === 0 && !loading && (
            <Box textAlign="center" py={4}>
              <EventIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Nenhum agendamento encontrado
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/schedules/new')}
                sx={{ mt: 2 }}
              >
                Criar Primeiro Agendamento
              </Button>
            </Box>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          navigate(`/schedules/${selectedSchedule?.id}/edit`);
          handleMenuClose();
        }}>
          <EditIcon sx={{ mr: 1 }} />
          Editar
        </MenuItem>
        <MenuItem onClick={() => handleToggleActive(selectedSchedule)}>
          {selectedSchedule?.is_active ? (
            <>
              <PauseIcon sx={{ mr: 1 }} />
              Desativar
            </>
          ) : (
            <>
              <PlayIcon sx={{ mr: 1 }} />
              Ativar
            </>
          )}
        </MenuItem>
        <MenuItem onClick={() => handleDeleteClick(selectedSchedule)}>
          <DeleteIcon sx={{ mr: 1 }} />
          Deletar
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja deletar o agendamento "{scheduleToDelete?.name}"?
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Deletar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScheduleList;
