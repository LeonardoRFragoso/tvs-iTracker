import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  ListItemAvatar,
  Avatar,
  IconButton,
  Snackbar
} from '@mui/material';
import {
  ArrowBack,
  PlayArrow,
  Schedule,
  VideoLibrary,
  CalendarToday,
  LocationOn,
  Edit,
  Delete,
  Add,
  Remove
} from '@mui/icons-material';
import axios from '../../config/axios';
const API_BASE_URL = `${axios.defaults.baseURL}/api`;

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [contents, setContents] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableContents, setAvailableContents] = useState([]);
  const [selectedContents, setSelectedContents] = useState([]);
  const [contentDialog, setContentDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchCampaignDetails();
  }, [id]);

  const fetchCampaignDetails = async () => {
    try {
      setLoading(true);
      
      // Buscar dados da campanha
      const [campaignRes, contentsRes, schedulesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/campaigns/${id}`),
        axios.get(`${API_BASE_URL}/campaigns/${id}/contents`),
        axios.get(`${API_BASE_URL}/schedules/campaign/${id}`)
      ]);

      setCampaign(campaignRes.data.campaign || campaignRes.data);
      setContents(contentsRes.data.contents || contentsRes.data || []);
      setSchedules(schedulesRes.data.schedules || schedulesRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar detalhes da campanha:', err);
      setError('Erro ao carregar detalhes da campanha');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableContents = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/content`, {
        params: { per_page: 100 }
      });
      setAvailableContents(response.data.contents || []);
    } catch (err) {
      console.error('Erro ao carregar conteúdos disponíveis:', err);
      setSnackbar({
        open: true,
        message: 'Erro ao carregar conteúdos disponíveis',
        severity: 'error'
      });
    }
  };

  const handleAddContent = async () => {
    if (selectedContents.length === 0) return;

    setActionLoading(true);
    try {
      const promises = selectedContents.map(contentId =>
        axios.post(`${API_BASE_URL}/campaigns/${id}/contents`, { content_id: contentId })
      );
      
      await Promise.all(promises);
      
      setSnackbar({
        open: true,
        message: `${selectedContents.length} conteúdo(s) adicionado(s) com sucesso!`,
        severity: 'success'
      });
      
      setSelectedContents([]);
      setContentDialog(false);
      fetchCampaignDetails();
    } catch (err) {
      console.error('Erro ao adicionar conteúdo:', err);
      setSnackbar({
        open: true,
        message: 'Erro ao adicionar conteúdo à campanha',
        severity: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveContent = async (contentId) => {
    setActionLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/campaigns/${id}/contents/${contentId}`);
      
      setSnackbar({
        open: true,
        message: 'Conteúdo removido com sucesso!',
        severity: 'success'
      });
      
      fetchCampaignDetails();
    } catch (err) {
      console.error('Erro ao remover conteúdo:', err);
      setSnackbar({
        open: true,
        message: 'Erro ao remover conteúdo da campanha',
        severity: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openContentDialog = () => {
    fetchAvailableContents();
    setContentDialog(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return timeString.slice(0, 5); // HH:MM
  };

  const getStatusColor = (isActive) => {
    return isActive ? 'success' : 'default';
  };

  const getStatusText = (isActive) => {
    return isActive ? 'Ativa' : 'Inativa';
  };

  // Helper: builds the best thumbnail URL or falls back to the original image
  const getContentThumbnailUrl = (item) => {
    try {
      const thumb = item.content?.thumbnail_path || item.thumbnail_path;
      if (thumb) {
        const fname = String(thumb).split('/').pop();
        return `${API_BASE_URL}/content/thumbnails/${fname}`;
      }
      const filePath = item.content?.file_path || item.file_path;
      const type = item.content?.content_type || item.content_type;
      if (filePath && type === 'image') {
        const fname = String(filePath).split('/').pop();
        return `${API_BASE_URL}/content/media/${fname}`;
      }
    } catch (e) {
      // ignore parsing errors and return null
    }
    return null;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!campaign) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="warning">Campanha não encontrada</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/campaigns')}
          variant="outlined"
        >
          Voltar
        </Button>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          {campaign.name}
        </Typography>
        <Chip
          label={getStatusText(campaign.is_active)}
          color={getStatusColor(campaign.is_active)}
          variant="filled"
        />
      </Box>

      <Grid container spacing={3}>
        {/* Informações da Campanha */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Informações da Campanha
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Nome
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {campaign.name}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Prioridade
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {campaign.priority}/10
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Data de Início
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {formatDate(campaign.start_date)}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Data de Fim
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {formatDate(campaign.end_date)}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Descrição
                </Typography>
                <Typography variant="body1">
                  {campaign.description || 'Sem descrição'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Conteúdos */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <VideoLibrary sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Conteúdos ({contents.length})
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={openContentDialog}
                disabled={actionLoading}
                sx={{ borderRadius: 2 }}
              >
                Adicionar Conteúdo
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {contents.length === 0 ? (
              <Alert severity="warning">
                Nenhum conteúdo associado a esta campanha
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {contents.map((content) => (
                  <Grid item xs={12} sm={6} md={4} key={content.id}>
                    <Card sx={{ position: 'relative' }}>
                      <IconButton
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 1)',
                            color: 'error.main'
                          }
                        }}
                        onClick={() => handleRemoveContent(content.content?.id || content.id)}
                        disabled={actionLoading}
                        size="small"
                      >
                        <Remove />
                      </IconButton>
                      {getContentThumbnailUrl(content) && (
                        <CardMedia
                          component="img"
                          height="140"
                          image={getContentThumbnailUrl(content)}
                          alt={content.content?.title || content.title}
                        />
                      )}
                      <CardContent>
                        <Typography variant="h6" component="div" noWrap>
                          {content.content?.title || content.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {content.content?.content_type || content.content_type}
                        </Typography>
                        <Typography variant="caption" display="block">
                          {content.content?.duration || content.duration}s
                        </Typography>
                        <Chip
                          label={(content.content?.is_active || content.is_active) ? 'Ativo' : 'Inativo'}
                          color={(content.content?.is_active || content.is_active) ? 'success' : 'default'}
                          size="small"
                          sx={{ mt: 1 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Estatísticas */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Estatísticas
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Conteúdos:</Typography>
              <Typography variant="body2" fontWeight="bold">
                {contents.length}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Agendamentos:</Typography>
              <Typography variant="body2" fontWeight="bold">
                {schedules.length}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Status:</Typography>
              <Typography variant="body2" fontWeight="bold">
                {getStatusText(campaign.is_active)}
              </Typography>
            </Box>
          </Paper>

          {/* Agendamentos */}
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Schedule sx={{ mr: 1 }} />
              <Typography variant="h6">
                Agendamentos
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {schedules.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                Nenhum agendamento configurado
              </Typography>
            ) : (
              <List dense>
                {schedules.map((schedule) => (
                  <ListItem key={schedule.id} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <CalendarToday fontSize="small" />
                    </ListItemIcon>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {schedule.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </Typography>
                      <Chip
                        label={schedule.is_active ? 'Ativo' : 'Inativo'}
                        color={schedule.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Content Selection Dialog */}
      <Dialog
        open={contentDialog}
        onClose={() => setContentDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle>
          Adicionar Conteúdos à Campanha
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <List>
            {availableContents
              .filter(content => !contents.find(cc => 
                (cc.content?.id || cc.id) === content.id
              ))
              .map((content) => (
                <ListItem key={content.id}>
                  <Checkbox
                    checked={selectedContents.includes(content.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContents(prev => [...prev, content.id]);
                      } else {
                        setSelectedContents(prev => prev.filter(id => id !== content.id));
                      }
                    }}
                  />
                  <ListItemAvatar>
                    <Avatar>
                      <VideoLibrary />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={content.title}
                    secondary={`${content.content_type} • ${content.duration}s • ${content.category || 'Sem categoria'}`}
                  />
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setContentDialog(false)}
            sx={{ borderRadius: 2 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAddContent}
            variant="contained"
            disabled={selectedContents.length === 0 || actionLoading}
            sx={{ borderRadius: 2 }}
          >
            {actionLoading ? <CircularProgress size={20} /> : `Adicionar (${selectedContents.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default CampaignDetail;
