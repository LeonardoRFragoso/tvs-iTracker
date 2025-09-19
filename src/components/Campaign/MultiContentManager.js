import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Grid,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  DragHandle as DragIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Visibility as PreviewIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  Timer as TimerIcon,
  BuildCircle as CompileIcon,
  CloudDone as ReadyIcon,
  WarningAmber as StaleIcon,
  Autorenew as RecompileIcon,
  OndemandVideo as VideoCompiledIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import axios from 'axios';
import PlaybackPreview from './PlaybackPreview';
import { useSocket } from '../../contexts/SocketContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;
const API_HOST = API_BASE_URL.replace(/\/api$/, '');

const MultiContentManager = ({ campaignId, onContentChange }) => {
  const [campaignContents, setCampaignContents] = useState([]);
  const [availableContents, setAvailableContents] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [compiledInfo, setCompiledInfo] = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState('');
  const [compileProgress, setCompileProgress] = useState(0);
  const [compileMessage, setCompileMessage] = useState('');
  const [preset, setPreset] = useState('1080p');
  const [customResolution, setCustomResolution] = useState('1920x1080');
  const [customFps, setCustomFps] = useState(30);

  const [addContentDialog, setAddContentDialog] = useState(false);
  const [editContentDialog, setEditContentDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [compiledPreviewOpen, setCompiledPreviewOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);

  const [contentFormData, setContentFormData] = useState({
    content_id: '',
    duration_override: '',
    location_filter: [],
    schedule_filter: {
      hours: [],
      weekdays: []
    },
    is_active: true
  });

  const { socket } = useSocket();

  useEffect(() => {
    if (campaignId) {
      loadCampaignContents();
      loadAvailableContents();
      fetchCompiledStatus();
    }
  }, [campaignId]);

  useEffect(() => {
    if (!socket || !campaignId) return;
    const onProgress = (data) => {
      if (data?.campaign_id !== campaignId) return;
      setCompiling(true);
      setCompileProgress(typeof data.progress === 'number' ? data.progress : 0);
      setCompileMessage(data.message || '');
    };
    const onComplete = (data) => {
      if (data?.campaign_id !== campaignId) return;
      setCompiling(false);
      setCompileProgress(100);
      setCompileMessage(data.message || '');
      fetchCompiledStatus();
    };
    socket.on('campaign_compile_progress', onProgress);
    socket.on('campaign_compile_complete', onComplete);
    return () => {
      socket.off('campaign_compile_progress', onProgress);
      socket.off('campaign_compile_complete', onComplete);
    };
  }, [socket, campaignId]);

  const loadCampaignContents = async () => {
    try {
      setLoading(true);
      const [contentsResp, campaignResp] = await Promise.all([
        axios.get(`${API_BASE_URL}/campaigns/${campaignId}/contents`),
        axios.get(`${API_BASE_URL}/campaigns/${campaignId}`)
      ]);
      const data = contentsResp.data || {};
      const items = data.contents || data.campaign_contents || [];
      setCampaignContents(items);
      setCampaign((campaignResp.data && campaignResp.data.campaign) || data.campaign || null);
      setError('');
    } catch (err) {
      setError('Erro ao carregar conteúdos da campanha');
      console.error('Load campaign contents error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableContents = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/content?per_page=1000`);
      setAvailableContents(response.data.contents || []);
    } catch (err) {
      console.error('Load available contents error:', err);
    }
  };

  const fetchCompiledStatus = async () => {
    if (!campaignId) return null;
    try {
      const resp = await axios.get(`${API_BASE_URL}/campaigns/${campaignId}/compile/status`);
      const data = resp.data || null;
      setCompiledInfo(data);
      setCompileError('');
      return data;
    } catch (err) {
      setCompileError('Não foi possível obter status do vídeo compilado');
      return null;
    }
  };

  const startCompilation = async () => {
    try {
      setCompiling(true);
      setCompileError('');
      setSuccess('Compilação iniciada, isso pode levar alguns minutos...');
      setCompileProgress(1);
      const body = preset === 'custom'
        ? { resolution: customResolution, fps: Number(customFps) || 30 }
        : { preset };
      await axios.post(`${API_BASE_URL}/campaigns/${campaignId}/compile`, body);
      const poll = async (retries = 120) => {
        const statusData = await fetchCompiledStatus();
        const s = statusData?.compiled_video_status || null;
        if (s === 'ready' || s === 'failed') {
          setCompiling(false);
          return;
        }
        if (retries <= 0) {
          setCompiling(false);
          return;
        }
        await new Promise(r => setTimeout(r, 2000));
        return poll(retries - 1);
      };
      poll();
    } catch (err) {
      setCompiling(false);
      setCompileError(err.response?.data?.error || 'Falha ao iniciar compilação');
    }
  };

  const handleAddContent = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/campaigns/${campaignId}/contents`, contentFormData);
      setSuccess('Conteúdo adicionado com sucesso!');
      setAddContentDialog(false);
      resetForm();
      loadCampaignContents();
      if (onContentChange) onContentChange();
      fetchCompiledStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao adicionar conteúdo');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContent = async () => {
    try {
      setLoading(true);
      await axios.put(
        `${API_BASE_URL}/campaigns/${campaignId}/contents/${selectedContent.content_id}`,
        contentFormData
      );
      setSuccess('Conteúdo atualizado com sucesso!');
      setEditContentDialog(false);
      resetForm();
      loadCampaignContents();
      if (onContentChange) onContentChange();
      fetchCompiledStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar conteúdo');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveContent = async (contentId) => {
    if (!window.confirm('Tem certeza que deseja remover este conteúdo da campanha?')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_BASE_URL}/campaigns/${campaignId}/contents/${contentId}`);
      setSuccess('Conteúdo removido com sucesso!');
      loadCampaignContents();
      if (onContentChange) onContentChange();
      fetchCompiledStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao remover conteúdo');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (contentId, isActive) => {
    try {
      await axios.put(`${API_BASE_URL}/campaigns/${campaignId}/contents/${contentId}`, {
        is_active: !isActive
      });
      loadCampaignContents();
      if (onContentChange) onContentChange();
    } catch (err) {
      setError('Erro ao alterar status do conteúdo');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(campaignContents);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setCampaignContents(items);

    const content_orders = items.map((item, index) => ({
      content_id: item.content_id,
      order_index: index + 1
    }));
    const content_order = items.map((item) => item.content_id);

    try {
      await axios.put(`${API_BASE_URL}/campaigns/${campaignId}/contents/reorder`, {
        content_orders,
        content_order
      });
      if (onContentChange) onContentChange();
      fetchCompiledStatus();
    } catch (err) {
      setError('Erro ao reordenar conteúdos');
      loadCampaignContents();
    }
  };

  const openAddDialog = () => {
    resetForm();
    setAddContentDialog(true);
  };

  const openEditDialog = (content) => {
    setSelectedContent(content);
    setContentFormData({
      content_id: content.content_id,
      duration_override: content.duration_override || '',
      location_filter: content.location_filter || [],
      schedule_filter: content.schedule_filter || { hours: [], weekdays: [] },
      is_active: content.is_active
    });
    setEditContentDialog(true);
  };

  const resetForm = () => {
    setContentFormData({
      content_id: '',
      duration_override: '',
      location_filter: [],
      schedule_filter: { hours: [], weekdays: [] },
      is_active: true
    });
    setSelectedContent(null);
  };

  const getContentIcon = (contentType) => {
    switch (contentType) {
      case 'video':
        return '🎬';
      case 'image':
        return '🖼️';
      case 'audio':
        return '🎵';
      default:
        return '📄';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Padrão';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && campaignContents.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Conteúdos da Campanha ({campaignContents.length})
        </Typography>
        <Box display="flex" gap={1}>
          {/* Preset selection */}
          <TextField
            select
            size="small"
            label="Preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="1080p">1080p</MenuItem>
            <MenuItem value="720p">720p</MenuItem>
            <MenuItem value="360p">360p</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </TextField>
          {preset === 'custom' && (
            <>
              <TextField
                size="small"
                label="Resolução"
                value={customResolution}
                onChange={(e) => setCustomResolution(e.target.value)}
                sx={{ width: 140 }}
                placeholder="1920x1080"
              />
              <TextField
                size="small"
                type="number"
                label="FPS"
                value={customFps}
                onChange={(e) => setCustomFps(e.target.value)}
                sx={{ width: 90 }}
              />
            </>
          )}
          {/* Compiled video quick actions */}
          <Button
            variant="outlined"
            startIcon={<VideoCompiledIcon />}
            onClick={() => setCompiledPreviewOpen(true)}
            disabled={!compiledInfo || compiledInfo.compiled_video_status !== 'ready'}
          >
            Ver Compilado
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={compiling ? <RecompileIcon /> : <CompileIcon />}
            onClick={startCompilation}
            disabled={compiling}
          >
            {compiling ? 'Compilando...' : (compiledInfo?.compiled_stale || compiledInfo?.compiled_video_status !== 'ready') ? 'Compilar' : 'Recompilar'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<PreviewIcon />}
            onClick={() => setPreviewDialog(true)}
            disabled={loading || campaignContents.length === 0}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAddDialog}
            disabled={loading}
          >
            Adicionar Conteúdo
          </Button>
        </Box>
      </Box>
      {compiling && (
        <Box mb={2}>
          <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, compileProgress))} />
          {compileMessage && (
            <Typography variant="caption" color="text.secondary">{compileMessage}</Typography>
          )}
        </Box>
      )}
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

      {/* Campaign Info */}
      {campaign && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Modo de Reprodução
                </Typography>
                <Chip 
                  label={campaign.playback_mode || 'sequential'} 
                  size="small" 
                  color="primary" 
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Duração Padrão
                </Typography>
                <Typography variant="body2">
                  {formatDuration(campaign.content_duration)}
                </Typography>
              </Grid>
              {/* Compiled status */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Vídeo Compilado:
                  </Typography>
                  {compiledInfo ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      {compiledInfo.compiled_video_status === 'ready' ? (
                        <Chip size="small" color="success" icon={<ReadyIcon />} label="Pronto" />
                      ) : compiledInfo.compiled_video_status === 'processing' ? (
                        <Chip size="small" color="warning" icon={<RecompileIcon />} label="Processando" />
                      ) : compiledInfo.compiled_video_status === 'stale' ? (
                        <Chip size="small" color="default" icon={<StaleIcon />} label="Desatualizado" />
                      ) : compiledInfo.compiled_video_status === 'failed' ? (
                        <Chip size="small" color="error" icon={<StaleIcon />} label="Falhou" />
                      ) : (
                        <Chip size="small" color="default" icon={<CompileIcon />} label="Não Gerado" />
                      )}
                      {compiledInfo.compiled_video_duration ? (
                        <Chip size="small" label={`Duração: ${formatDuration(compiledInfo.compiled_video_duration)}`} />
                      ) : null}
                      {compiledInfo.compiled_video_updated_at ? (
                        <Chip size="small" variant="outlined" label={`Atualizado: ${compiledInfo.compiled_video_updated_at}`} />
                      ) : null}
                    </Box>
                  ) : (
                    <Chip size="small" variant="outlined" label="Status indisponível" />
                  )}
                </Box>
                {compileError && (
                  <Alert severity="error" sx={{ mt: 1 }} onClose={() => setCompileError('')}>
                    {compileError}
                  </Alert>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Content List */}
      <Card>
        <CardContent>
          {campaignContents.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                Nenhum conteúdo adicionado à campanha
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={openAddDialog}
                sx={{ mt: 2 }}
              >
                Adicionar Primeiro Conteúdo
              </Button>
            </Box>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="contents">
                {(provided) => (
                  <List {...provided.droppableProps} ref={provided.innerRef}>
                    {campaignContents.map((item, index) => (
                      <Draggable
                        key={item.content_id}
                        draggableId={item.content_id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <ListItem
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            sx={{
                              mb: 1,
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                              opacity: item.is_active ? 1 : 0.6
                            }}
                          >
                            <Box {...provided.dragHandleProps} sx={{ mr: 1 }}>
                              <DragIcon color="action" />
                            </Box>
                            
                            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                              {getContentIcon(item.content?.content_type)}
                            </Avatar>
                            
                            <ListItemText
                              primary={
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Typography variant="subtitle1">
                                    {item.content?.title || 'Conteúdo sem título'}
                                  </Typography>
                                  {!item.is_active && (
                                    <Chip label="Inativo" size="small" color="default" />
                                  )}
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    Tipo: {item.content?.content_type} • 
                                    Duração: {formatDuration(item.duration_override || item.content?.duration)}
                                  </Typography>
                                  {item.location_filter && item.location_filter.length > 0 && (
                                    <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                                      <LocationIcon fontSize="small" color="action" />
                                      <Typography variant="caption">
                                        Localizações: {item.location_filter.join(', ')}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              }
                            />
                            
                            <ListItemSecondaryAction>
                              <Box display="flex" gap={1}>
                                <Tooltip title={item.is_active ? 'Desativar' : 'Ativar'}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleToggleActive(item.content_id, item.is_active)}
                                  >
                                    {item.is_active ? <PauseIcon /> : <PlayIcon />}
                                  </IconButton>
                                </Tooltip>
                                
                                <Tooltip title="Editar">
                                  <IconButton
                                    size="small"
                                    onClick={() => openEditDialog(item)}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                
                                <Tooltip title="Remover">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveContent(item.content_id)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Box>
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
          )}
        </CardContent>
      </Card>

      {/* Add Content Dialog */}
      <Dialog open={addContentDialog} onClose={() => setAddContentDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Adicionar Conteúdo à Campanha</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              select
              label="Conteúdo"
              value={contentFormData.content_id}
              onChange={(e) => setContentFormData(prev => ({ ...prev, content_id: e.target.value }))}
              sx={{ mb: 2 }}
              required
            >
              {availableContents
                .filter(content => !campaignContents.find(cc => cc.content_id === content.id))
                .map(content => (
                  <MenuItem key={content.id} value={content.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <span>{getContentIcon(content.content_type)}</span>
                      <span>{content.title}</span>
                      <Chip label={content.content_type} size="small" />
                    </Box>
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              fullWidth
              type="number"
              label="Duração Override (segundos)"
              value={contentFormData.duration_override}
              onChange={(e) => setContentFormData(prev => ({ ...prev, duration_override: e.target.value }))}
              sx={{ mb: 2 }}
              helperText="Deixe vazio para usar duração padrão"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={contentFormData.is_active}
                  onChange={(e) => setContentFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Conteúdo Ativo"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddContentDialog(false)}>Cancelar</Button>
          <Button 
            onClick={handleAddContent} 
            variant="contained"
            disabled={!contentFormData.content_id || loading}
          >
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Content Dialog */}
      <Dialog open={editContentDialog} onClose={() => setEditContentDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Editar Conteúdo da Campanha</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {selectedContent && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Editando: {selectedContent.content?.title}
              </Alert>
            )}

            <TextField
              fullWidth
              type="number"
              label="Duração Override (segundos)"
              value={contentFormData.duration_override}
              onChange={(e) => setContentFormData(prev => ({ ...prev, duration_override: e.target.value }))}
              sx={{ mb: 2 }}
              helperText="Deixe vazio para usar duração padrão"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={contentFormData.is_active}
                  onChange={(e) => setContentFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Conteúdo Ativo"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditContentDialog(false)}>Cancelar</Button>
          <Button 
            onClick={handleUpdateContent} 
            variant="contained"
            disabled={loading}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Playback Preview Dialog */}
      <PlaybackPreview
        open={previewDialog}
        onClose={() => setPreviewDialog(false)}
        campaignId={campaignId}
      />

      {/* Compiled Video Preview */}
      <Dialog open={compiledPreviewOpen} onClose={() => setCompiledPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Preview do Vídeo Compilado</DialogTitle>
        <DialogContent>
          {compiledInfo?.compiled_video_status === 'ready' && compiledInfo?.compiled_video_url ? (
            <Box>
              <video
                controls
                style={{ width: '100%', borderRadius: 8 }}
                src={`${API_HOST}${compiledInfo.compiled_video_url}`}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Duração: {formatDuration(compiledInfo.compiled_video_duration)}
              </Typography>
            </Box>
          ) : (
            <Alert severity="info">O vídeo compilado não está pronto.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompiledPreviewOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MultiContentManager;
