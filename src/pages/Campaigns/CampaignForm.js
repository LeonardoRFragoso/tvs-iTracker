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
  Paper,
  Fade,
  Grow,
  Skeleton,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  VideoLibrary as ContentIcon,
  DragIndicator as DragIcon,
  Campaign as CampaignIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contentDialog, setContentDialog] = useState(false);
  const [selectedContents, setSelectedContents] = useState([]);

  useEffect(() => {
    const initializeForm = async () => {
      setInitialLoading(true);
      await loadAvailableContents();
      if (isEdit) {
        await loadCampaign();
      }
      setInitialLoading(false);
    };
    
    initializeForm();
  }, [id, isEdit]);

  const loadCampaign = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/campaigns/${id}`);
      const campaign = response.data;
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        status: campaign.is_active ? 'active' : 'inactive',
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
      setAvailableContents(response.data.contents || []);
    } catch (err) {
      console.error('Load contents error:', err);
      setAvailableContents([]);
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

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setCampaignContents((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        // Update order property
        return reorderedItems.map((item, index) => ({
          ...item,
          order: index,
        }));
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.name) {
        setError('Nome da campanha é obrigatório');
        setLoading(false);
        return;
      }

      if (!formData.start_date) {
        setError('Data de início é obrigatória');
        setLoading(false);
        return;
      }

      if (!formData.end_date) {
        setError('Data de fim é obrigatória');
        setLoading(false);
        return;
      }

      if (formData.start_date >= formData.end_date) {
        setError('Data de início deve ser anterior à data de fim');
        setLoading(false);
        return;
      }

      const submitData = {
        ...formData,
        start_date: formData.start_date ? formData.start_date.toISOString() : null,
        end_date: formData.end_date ? formData.end_date.toISOString() : null,
        is_active: formData.status === 'active', // Map status to is_active boolean
        content_ids: campaignContents.map(content => content.id),
      };
      
      // Remove the status field since backend doesn't expect it
      delete submitData.status;

      console.log('[DEBUG] Submit data being sent:', submitData);

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
      console.error('Submit error:', err);
      console.error('Error response data:', err.response?.data);
      console.error('Error response status:', err.response?.status);
      setError(err.response?.data?.error || 'Erro ao salvar campanha');
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sortable Item Component
  const SortableContentItem = ({ content, onRemove }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: content.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <ListItem
        ref={setNodeRef}
        style={style}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          mb: 1,
          background: isDragging 
            ? (theme) => theme.palette.mode === 'dark'
              ? 'rgba(255, 119, 48, 0.1)'
              : 'rgba(33, 150, 243, 0.1)'
            : 'transparent',
          '&:hover': {
            transform: 'translateY(-2px)',
            transition: 'transform 0.2s ease-in-out',
            boxShadow: (theme) => theme.shadows[4],
          },
        }}
      >
        <Box
          {...attributes}
          {...listeners}
          sx={{ mr: 1, cursor: 'grab' }}
        >
          <DragIcon color="action" />
        </Box>
        <ListItemAvatar>
          <Avatar
            sx={{
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                : 'linear-gradient(45deg, #2196F3, #21CBF3)',
            }}
          >
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
            onClick={() => onRemove(content.id)}
            sx={{
              '&:hover': {
                color: 'error.main',
                transform: 'scale(1.1)',
                transition: 'all 0.2s ease-in-out',
              },
            }}
          >
            <DeleteIcon />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box
        sx={{
          background: (theme) => theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)'
            : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          minHeight: '100vh',
          p: 3,
        }}
      >
        {/* Enhanced Header */}
        <Fade in timeout={800}>
          <Box display="flex" alignItems="center" mb={4}>
            <IconButton 
              onClick={() => navigate('/campaigns')} 
              sx={{ 
                mr: 2,
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                  : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                color: 'white',
                '&:hover': {
                  transform: 'scale(1.1)',
                  transition: 'transform 0.2s ease-in-out',
                },
              }}
            >
              <BackIcon />
            </IconButton>
            <Box>
              <Typography 
                variant="h3" 
                component="h1" 
                sx={{ 
                  fontWeight: 'bold',
                  background: (theme) => theme.palette.mode === 'dark'
                    ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                    : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {isEdit ? 'Editar Campanha' : 'Nova Campanha'}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {isEdit ? 'Modifique as configurações da campanha' : 'Configure uma nova campanha de conteúdo'}
              </Typography>
            </Box>
          </Box>
        </Fade>

        {error && (
          <Fade in timeout={600}>
            <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>
              {error}
            </Alert>
          </Fade>
        )}

        {success && (
          <Fade in timeout={600}>
            <Alert severity="success" sx={{ mb: 2, borderRadius: 3 }}>
              {success}
            </Alert>
          </Fade>
        )}

        {initialLoading ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />
            </Grid>
          </Grid>
        ) : (
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Enhanced Campaign Information Card */}
              <Grid item xs={12} md={6}>
                <Grow in timeout={1000}>
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(255, 119, 48, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)'
                        : 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 203, 243, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      overflow: 'hidden',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: (theme) => theme.palette.mode === 'dark'
                          ? 'linear-gradient(90deg, #ff7730, #ff9800)'
                          : 'linear-gradient(90deg, #2196F3, #21CBF3)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <Avatar
                          sx={{
                            background: (theme) => theme.palette.mode === 'dark'
                              ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                              : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                            mr: 2,
                          }}
                        >
                          <CampaignIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          Informações da Campanha
                        </Typography>
                      </Box>

                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Nome da Campanha"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  transition: 'transform 0.2s ease-in-out',
                                },
                              },
                            }}
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
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  transition: 'transform 0.2s ease-in-out',
                                },
                              },
                            }}
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
                              sx={{
                                borderRadius: 2,
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  transition: 'transform 0.2s ease-in-out',
                                },
                              }}
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
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                sx: {
                                  '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                    '&:hover': {
                                      transform: 'translateY(-2px)',
                                      transition: 'transform 0.2s ease-in-out',
                                    },
                                  },
                                }
                              }
                            }}
                          />
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <DateTimePicker
                            label="Data de Fim"
                            value={formData.end_date}
                            onChange={(value) => handleDateChange('end_date', value)}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                sx: {
                                  '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                    '&:hover': {
                                      transform: 'translateY(-2px)',
                                      transition: 'transform 0.2s ease-in-out',
                                    },
                                  },
                                }
                              }
                            }}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Paper>
                </Grow>
              </Grid>

              {/* Enhanced Content Management Card */}
              <Grid item xs={12} md={6}>
                <Grow in timeout={1200}>
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(255, 119, 48, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)'
                        : 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 203, 243, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      overflow: 'hidden',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: (theme) => theme.palette.mode === 'dark'
                          ? 'linear-gradient(90deg, #ff7730, #ff9800)'
                          : 'linear-gradient(90deg, #2196F3, #21CBF3)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                        <Box display="flex" alignItems="center">
                          <Avatar
                            sx={{
                              background: (theme) => theme.palette.mode === 'dark'
                                ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                                : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                              mr: 2,
                            }}
                          >
                            <ContentIcon />
                          </Avatar>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            Conteúdos ({campaignContents.length})
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={() => setContentDialog(true)}
                          sx={{
                            borderRadius: 2,
                            background: (theme) => theme.palette.mode === 'dark'
                              ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                              : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                            '&:hover': {
                              transform: 'scale(1.05)',
                              transition: 'transform 0.2s ease-in-out',
                            },
                          }}
                        >
                          Adicionar
                        </Button>
                      </Box>

                      {campaignContents.length > 0 && (
                        <Box mb={2}>
                          <Chip
                            label={`Duração total: ${formatDuration(getTotalDuration())}`}
                            sx={{
                              background: (theme) => theme.palette.mode === 'dark'
                                ? 'linear-gradient(45deg, rgba(255, 119, 48, 0.2), rgba(255, 152, 0, 0.2))'
                                : 'linear-gradient(45deg, rgba(33, 150, 243, 0.2), rgba(33, 203, 243, 0.2))',
                              color: (theme) => theme.palette.mode === 'dark' ? '#ff9800' : '#2196F3',
                              fontWeight: 'bold',
                            }}
                          />
                        </Box>
                      )}

                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={campaignContents.map((content) => content.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <List>
                            {campaignContents.map((content, index) => (
                              <SortableContentItem
                                key={content.id}
                                content={content}
                                onRemove={handleRemoveContent}
                              />
                            ))}
                          </List>
                        </SortableContext>
                      </DndContext>

                      {campaignContents.length === 0 && (
                        <Paper
                          sx={{
                            p: 4,
                            textAlign: 'center',
                            background: (theme) => theme.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.02)'
                              : 'rgba(0, 0, 0, 0.02)',
                            borderRadius: 2,
                          }}
                        >
                          <Avatar
                            sx={{
                              mx: 'auto',
                              mb: 2,
                              width: 56,
                              height: 56,
                              background: (theme) => theme.palette.mode === 'dark'
                                ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                                : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                            }}
                          >
                            <ContentIcon />
                          </Avatar>
                          <Typography variant="h6" gutterBottom>
                            Nenhum conteúdo adicionado
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Clique em "Adicionar" para incluir conteúdos na campanha
                          </Typography>
                        </Paper>
                      )}
                    </CardContent>
                  </Paper>
                </Grow>
              </Grid>

              {/* Enhanced Action Buttons */}
              <Grid item xs={12}>
                <Fade in timeout={1400}>
                  <Box display="flex" gap={2} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      onClick={() => navigate('/campaigns')}
                      startIcon={<CancelIcon />}
                      sx={{
                        borderRadius: 2,
                        px: 4,
                        py: 1.5,
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          transition: 'transform 0.2s ease-in-out',
                        },
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading || !formData.name}
                      startIcon={<SaveIcon />}
                      sx={{
                        borderRadius: 2,
                        px: 4,
                        py: 1.5,
                        background: (theme) => theme.palette.mode === 'dark'
                          ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                          : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          transition: 'transform 0.2s ease-in-out',
                        },
                        '&:disabled': {
                          background: 'rgba(0, 0, 0, 0.12)',
                        },
                      }}
                    >
                      {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar')}
                    </Button>
                  </Box>
                </Fade>
              </Grid>
            </Grid>
          </form>
        )}

        {/* Enhanced Content Selection Dialog */}
        <Dialog
          open={contentDialog}
          onClose={() => setContentDialog(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(255, 119, 48, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 203, 243, 0.05) 100%)',
              backdropFilter: 'blur(10px)',
            },
          }}
        >
          <DialogTitle sx={{ 
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(90deg, #ff7730, #ff9800)'
              : 'linear-gradient(90deg, #2196F3, #21CBF3)',
            color: 'white',
            fontWeight: 'bold',
          }}>
            Adicionar Conteúdos à Campanha
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <List>
              {availableContents
                .filter(content => !campaignContents.find(cc => cc.id === content.id))
                .map((content, index) => (
                  <Grow in timeout={300 + index * 100} key={content.id}>
                    <ListItem
                      sx={{
                        '&:hover': {
                          background: (theme) => theme.palette.mode === 'dark'
                            ? 'rgba(255, 119, 48, 0.1)'
                            : 'rgba(33, 150, 243, 0.1)',
                        },
                      }}
                    >
                      <Checkbox
                        checked={selectedContents.includes(content.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedContents(prev => [...prev, content.id]);
                          } else {
                            setSelectedContents(prev => prev.filter(id => id !== content.id));
                          }
                        }}
                        sx={{
                          color: (theme) => theme.palette.mode === 'dark' ? '#ff9800' : '#2196F3',
                          '&.Mui-checked': {
                            color: (theme) => theme.palette.mode === 'dark' ? '#ff9800' : '#2196F3',
                          },
                        }}
                      />
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            background: (theme) => theme.palette.mode === 'dark'
                              ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                              : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                          }}
                        >
                          <ContentIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={content.title}
                        secondary={`${formatDuration(content.duration)} • ${content.type} • ${content.category || 'Sem categoria'}`}
                      />
                    </ListItem>
                  </Grow>
                ))}
            </List>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={() => setContentDialog(false)}
              sx={{
                borderRadius: 2,
                '&:hover': {
                  transform: 'translateY(-2px)',
                  transition: 'transform 0.2s ease-in-out',
                },
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddContents}
              variant="contained"
              disabled={selectedContents.length === 0}
              sx={{
                borderRadius: 2,
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                  : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  transition: 'transform 0.2s ease-in-out',
                },
              }}
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
