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
  Skeleton,
  Avatar,
  Fade,
  Grow,
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
import { useTheme } from '../../contexts/ThemeContext';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ScheduleList = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  
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

  const ScheduleRowSkeleton = ({ delay = 0 }) => (
    <Grow in={true} timeout={1000 + delay * 100}>
      <TableRow>
        <TableCell>
          <Box display="flex" alignItems="center">
            <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
            <Skeleton variant="text" width={120} />
          </Box>
        </TableCell>
        <TableCell><Skeleton variant="text" width={100} /></TableCell>
        <TableCell><Skeleton variant="text" width={80} /></TableCell>
        <TableCell><Skeleton variant="text" width={150} /></TableCell>
        <TableCell><Skeleton variant="text" width={120} /></TableCell>
        <TableCell><Skeleton variant="text" width={100} /></TableCell>
        <TableCell><Skeleton variant="rectangular" width={60} height={24} /></TableCell>
        <TableCell><Skeleton variant="circular" width={32} height={32} /></TableCell>
      </TableRow>
    </Grow>
  );

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
              <ScheduleIcon />
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
              Agendamentos
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/schedules/new')}
            sx={{
              background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
              borderRadius: '12px',
              px: 3,
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
            Novo Agendamento
          </Button>
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
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Buscar agendamentos"
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
                  <InputLabel>Campanha</InputLabel>
                  <Select
                    value={filters.campaign_id}
                    onChange={(e) => handleFilterChange('campaign_id', e.target.value)}
                    label="Campanha"
                    sx={{
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      }
                    }}
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
                    sx={{
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      }
                    }}
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
                    sx={{
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      }
                    }}
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
      </Grow>

      {/* Schedules Table */}
      <Grow in={true} timeout={1400}>
        <Card
          sx={{
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            background: isDarkMode 
              ? 'rgba(255, 255, 255, 0.05)' 
              : 'rgba(255, 255, 255, 0.9)',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
            boxShadow: isDarkMode 
              ? '0 8px 32px rgba(0, 0, 0, 0.3)' 
              : '0 8px 32px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <TableContainer 
              component={Paper} 
              sx={{ 
                background: 'transparent',
                boxShadow: 'none',
              }}
            >
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      background: isDarkMode
                        ? 'linear-gradient(135deg, rgba(255, 119, 48, 0.1) 0%, rgba(255, 152, 0, 0.1) 100%)'
                        : 'linear-gradient(135deg, rgba(255, 119, 48, 0.05) 0%, rgba(255, 152, 0, 0.05) 100%)',
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Nome</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Campanha</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Player</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Período</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Horário</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Dias</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <ScheduleRowSkeleton key={index} delay={index} />
                    ))
                  ) : (
                    schedules.map((schedule, index) => (
                      <Grow in={true} timeout={1600 + index * 100} key={schedule.id}>
                        <TableRow
                          sx={{
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              background: isDarkMode
                                ? 'rgba(255, 119, 48, 0.05)'
                                : 'rgba(255, 119, 48, 0.02)',
                              transform: 'scale(1.01)',
                              boxShadow: '0 4px 20px rgba(255, 119, 48, 0.1)',
                            }
                          }}
                        >
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <Avatar
                                sx={{
                                  mr: 2,
                                  width: 32,
                                  height: 32,
                                  background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                                }}
                              >
                                <ScheduleIcon sx={{ fontSize: 16 }} />
                              </Avatar>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {schedule.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {schedule.campaign?.name || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {schedule.player?.name || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDate(schedule.start_date)} - {formatDate(schedule.end_date)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {getDaysOfWeekText(schedule.days_of_week)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusText(schedule)}
                              color={getStatusColor(schedule)}
                              size="small"
                              sx={{
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              onClick={(e) => handleMenuClick(e, schedule)}
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
                          </TableCell>
                        </TableRow>
                      </Grow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {schedules.length === 0 && !loading && (
              <Fade in={true} timeout={1000}>
                <Box 
                  textAlign="center" 
                  py={8}
                  sx={{
                    background: isDarkMode
                      ? 'radial-gradient(circle, rgba(255, 119, 48, 0.05) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(255, 119, 48, 0.02) 0%, transparent 70%)',
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
                    <EventIcon sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Typography 
                    variant="h6" 
                    color="text.secondary" 
                    sx={{ mb: 2, fontWeight: 600 }}
                  >
                    Nenhum agendamento encontrado
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}
                  >
                    Comece criando seu primeiro agendamento para controlar quando e onde suas campanhas serão exibidas.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/schedules/new')}
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
                    Criar Primeiro Agendamento
                  </Button>
                </Box>
              </Fade>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Fade in={true} timeout={1800}>
                <Box display="flex" justifyContent="center" p={3}>
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
          </CardContent>
        </Card>
      </Grow>

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
            navigate(`/schedules/${selectedSchedule?.id}/edit`);
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
          onClick={() => handleToggleActive(selectedSchedule)}
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
        <MenuItem 
          onClick={() => handleDeleteClick(selectedSchedule)}
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
            Tem certeza que deseja deletar o agendamento "{scheduleToDelete?.name}"?
            Esta ação não pode ser desfeita.
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

export default ScheduleList;
