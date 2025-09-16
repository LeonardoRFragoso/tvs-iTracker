import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  ListItemAvatar,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  VideoLibrary as ContentIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CampaignForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'inactive',
    start_date: null,
    end_date: null,
  });
  const [campaignContents, setCampaignContents] = useState([]);
  const [availableContents, setAvailableContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contentDialog, setContentDialog] = useState(false);
  const [selectedContents, setSelectedContents] = useState([]);

  useEffect(() => {
    loadAvailableContents();
    if (isEdit) {
      loadCampaign();
    }
  }, [id, isEdit]);

  const loadCampaign = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/campaigns/${id}`);
      const campaign = response.data;
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        status: campaign.status,
        start_date: campaign.start_date ? new Date(campaign.start_date) : null,
        end_date: campaign.end_date ? new Date(campaign.end_date) : null,
      });
      setCampaignContents(campaign.contents || []);
    } catch (err) {
      setError('Erro ao carregar campanha');
      console.error('Load campaign error:', err);
    }
  };

  const loadAvailableContents = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/content`, {
        params: { per_page: 100 }
      });
      setAvailableContents(response.data.contents);
    } catch (err) {
      console.error('Load contents error:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDateChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddContents = () => {
    const contentsToAdd = availableContents.filter(content => 
      selectedContents.includes(content.id) && 
      !campaignContents.find(cc => cc.id === content.id)
    );
    
    const newCampaignContents = contentsToAdd.map((content, index) => ({
      ...content,
      order: campaignContents.length + index,
      duration: content.duration || 10,
    }));

    setCampaignContents(prev => [...prev, ...newCampaignContents]);
    setSelectedContents([]);
    setContentDialog(false);
  };

  const handleRemoveContent = (contentId) => {
    setCampaignContents(prev => 
      prev.filter(content => content.id !== contentId)
        .map((content, index) => ({ ...content, order: index }))
    );
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(campaignContents);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order
    const reorderedItems = items.map((item, index) => ({
      ...item,
      order: index,
    }));

    setCampaignContents(reorderedItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        start_date: formData.start_date ? formData.start_date.toISOString() : null,
        end_date: formData.end_date ? formData.end_date.toISOString() : null,
        contents: campaignContents.map(content => ({
          content_id: content.id,
          order: content.order,
          duration: content.duration,
        })),
      };

      let response;
      if (isEdit) {
        response = await axios.put(`${API_BASE_URL}/campaigns/${id}`, submitData);
      } else {
        response = await axios.post(`${API_BASE_URL}/campaigns`, submitData);
      }

      setSuccess(isEdit ? 'Campanha atualizada com sucesso!' : 'Campanha criada com sucesso!');
      
      setTimeout(() => {
        navigate('/campaigns');
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar campanha');
      console.error('Submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getTotalDuration = () => {
    return campaignContents.reduce((total, content) => total + (content.duration || 0), 0);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box>
        <Box display="flex" alignItems="center" mb={3}>
          <IconButton onClick={() => navigate('/campaigns')} sx={{ mr: 2 }}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {isEdit ? 'Editar Campanha' : 'Nova Campanha'}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Informações Básicas */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Informações da Campanha
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Nome da Campanha"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Descrição"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        multiline
                        rows={3}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          name="status"
                          value={formData.status}
                          onChange={handleInputChange}
                          label="Status"
                        >
                          <MenuItem value="inactive">Inativa</MenuItem>
                          <MenuItem value="active">Ativa</MenuItem>
                          <MenuItem value="scheduled">Agendada</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <DateTimePicker
                        label="Data de Início"
                        value={formData.start_date}
                        onChange={(value) => handleDateChange('start_date', value)}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <DateTimePicker
                        label="Data de Fim"
                        value={formData.end_date}
                        onChange={(value) => handleDateChange('end_date', value)}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Conteúdos da Campanha */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      Conteúdos ({campaignContents.length})
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => setContentDialog(true)}
                    >
                      Adicionar
                    </Button>
                  </Box>

                  {campaignContents.length > 0 && (
                    <Box mb={2}>
                      <Chip
                        label={`Duração total: ${formatDuration(getTotalDuration())}`}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  )}

                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="campaign-contents">
                      {(provided) => (
                        <List
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          dense
                        >
                          {campaignContents.map((content, index) => (
                            <Draggable
                              key={content.id}
                              draggableId={content.id}
                              index={index}
                            >
                              {(provided) => (
                                <ListItem
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    mb: 1,
                                  }}
                                >
                                  <Box
                                    {...provided.dragHandleProps}
                                    sx={{ mr: 1, cursor: 'grab' }}
                                  >
                                    <DragIcon color="action" />
                                  </Box>
                                  <ListItemAvatar>
                                    <Avatar>
                                      <ContentIcon />
                                    </Avatar>
                                  </ListItemAvatar>
                                  <ListItemText
                                    primary={content.title}
                                    secondary={`${formatDuration(content.duration)} • ${content.type}`}
                                  />
                                  <ListItemSecondaryAction>
                                    <IconButton
                                      edge="end"
                                      onClick={() => handleRemoveContent(content.id)}
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </ListItemSecondaryAction>
                                </ListItem>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </List>
                      )}
                    </Droppable>
                  </DragDropContext>

                  {campaignContents.length === 0 && (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                      Nenhum conteúdo adicionado à campanha
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Actions */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/campaigns')}
                  startIcon={<CancelIcon />}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !formData.name}
                  startIcon={<SaveIcon />}
                >
                  {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>

        {/* Dialog para Adicionar Conteúdos */}
        <Dialog
          open={contentDialog}
          onClose={() => setContentDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Adicionar Conteúdos à Campanha</DialogTitle>
          <DialogContent>
            <List>
              {availableContents
                .filter(content => !campaignContents.find(cc => cc.id === content.id))
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
                        <ContentIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={content.title}
                      secondary={`${formatDuration(content.duration)} • ${content.type} • ${content.category || 'Sem categoria'}`}
                    />
                  </ListItem>
                ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setContentDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddContents}
              variant="contained"
              disabled={selectedContents.length === 0}
            >
              Adicionar ({selectedContents.length})
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default CampaignForm;
