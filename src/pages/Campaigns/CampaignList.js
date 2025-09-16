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
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  Campaign as CampaignIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Schedule as ScheduleIcon,
  VideoLibrary as ContentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CampaignList = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, campaign: null });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  useEffect(() => {
    loadCampaigns();
  }, [page, searchTerm, filterStatus]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: 10,
        search: searchTerm || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      };

      const response = await axios.get(`${API_BASE_URL}/campaigns`, { params });
      setCampaigns(response.data.campaigns);
      setTotalPages(response.data.pages);
    } catch (err) {
      setError('Erro ao carregar campanhas');
      console.error('Load campaigns error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/campaigns/${deleteDialog.campaign.id}`);
      setDeleteDialog({ open: false, campaign: null });
      loadCampaigns();
    } catch (err) {
      setError('Erro ao deletar campanha');
      console.error('Delete campaign error:', err);
    }
  };

  const handleStatusToggle = async (campaign) => {
    try {
      const newStatus = campaign.status === 'active' ? 'inactive' : 'active';
      await axios.put(`${API_BASE_URL}/campaigns/${campaign.id}`, {
        ...campaign,
        status: newStatus,
      });
      loadCampaigns();
    } catch (err) {
      setError('Erro ao alterar status da campanha');
      console.error('Toggle status error:', err);
    }
  };

  const handleMenuClick = (event, campaign) => {
    setAnchorEl(event.currentTarget);
    setSelectedCampaign(campaign);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCampaign(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'scheduled':
        return 'warning';
      case 'expired':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return 'Ativa';
      case 'inactive':
        return 'Inativa';
      case 'scheduled':
        return 'Agendada';
      case 'expired':
        return 'Expirada';
      default:
        return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gerenciar Campanhas
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/campaigns/new')}
        >
          Nova Campanha
        </Button>
      </Box>

      {/* Filtros e Busca */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar campanha..."
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
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">Todos os status</MenuItem>
                <MenuItem value="active">Ativa</MenuItem>
                <MenuItem value="inactive">Inativa</MenuItem>
                <MenuItem value="scheduled">Agendada</MenuItem>
                <MenuItem value="expired">Expirada</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={loadCampaigns}
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

      {/* Lista de Campanhas */}
      <Grid container spacing={3}>
        {campaigns.map((campaign) => (
          <Grid item xs={12} key={campaign.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <CampaignIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" component="h3">
                          {campaign.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {campaign.description}
                        </Typography>
                      </Box>
                      <Chip
                        label={getStatusLabel(campaign.status)}
                        color={getStatusColor(campaign.status)}
                        size="small"
                      />
                    </Box>

                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          Período de Exibição
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {campaign.start_date ? formatDate(campaign.start_date) : 'Não definido'} - {' '}
                          {campaign.end_date ? formatDate(campaign.end_date) : 'Não definido'}
                        </Typography>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          Conteúdos ({campaign.content_count || 0})
                        </Typography>
                        {campaign.contents && campaign.contents.length > 0 ? (
                          <List dense>
                            {campaign.contents.slice(0, 3).map((content) => (
                              <ListItem key={content.id} sx={{ px: 0 }}>
                                <ListItemAvatar>
                                  <Avatar sx={{ width: 32, height: 32 }}>
                                    <ContentIcon fontSize="small" />
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={content.title}
                                  secondary={`${content.duration || 0}s`}
                                />
                              </ListItem>
                            ))}
                            {campaign.contents.length > 3 && (
                              <Typography variant="caption" color="text.secondary">
                                +{campaign.contents.length - 3} mais
                              </Typography>
                            )}
                          </List>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Nenhum conteúdo adicionado
                          </Typography>
                        )}
                      </Grid>
                    </Grid>

                    <Box display="flex" gap={1} mt={2}>
                      <Button
                        size="small"
                        variant={campaign.status === 'active' ? 'contained' : 'outlined'}
                        color={campaign.status === 'active' ? 'error' : 'success'}
                        startIcon={campaign.status === 'active' ? <PauseIcon /> : <PlayIcon />}
                        onClick={() => handleStatusToggle(campaign)}
                      >
                        {campaign.status === 'active' ? 'Pausar' : 'Ativar'}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ScheduleIcon />}
                        onClick={() => navigate(`/schedules?campaign=${campaign.id}`)}
                      >
                        Agendamentos
                      </Button>
                    </Box>
                  </Box>

                  <IconButton
                    onClick={(e) => handleMenuClick(e, campaign)}
                  >
                    <MoreIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {campaigns.length === 0 && !loading && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary">
            Nenhuma campanha encontrada
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/campaigns/new')}
            sx={{ mt: 2 }}
          >
            Criar Primeira Campanha
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
          navigate(`/campaigns/${selectedCampaign?.id}`);
          handleMenuClose();
        }}>
          <ViewIcon sx={{ mr: 1 }} />
          Visualizar
        </MenuItem>
        <MenuItem onClick={() => {
          navigate(`/campaigns/${selectedCampaign?.id}/edit`);
          handleMenuClose();
        }}>
          <EditIcon sx={{ mr: 1 }} />
          Editar
        </MenuItem>
        <MenuItem onClick={() => {
          navigate(`/schedules?campaign=${selectedCampaign?.id}`);
          handleMenuClose();
        }}>
          <ScheduleIcon sx={{ mr: 1 }} />
          Agendamentos
        </MenuItem>
        <MenuItem onClick={() => {
          setDeleteDialog({ open: true, campaign: selectedCampaign });
          handleMenuClose();
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Deletar
        </MenuItem>
      </Menu>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, campaign: null })}
      >
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja deletar a campanha "{deleteDialog.campaign?.name}"?
            Esta ação não pode ser desfeita e removerá todos os agendamentos associados.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, campaign: null })}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Deletar
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB para adicionar campanha */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => navigate('/campaigns/new')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default CampaignList;
