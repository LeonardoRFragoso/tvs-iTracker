import React, { useState, useEffect, useRef } from 'react';
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
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
  LinearProgress,
  Divider,
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
  Assessment as AnalyticsIcon,
  Settings as SettingsIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
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
import axios from '../../config/axios';
import MultiContentManager from '../../components/Campaign/MultiContentManager';
import CampaignAnalytics from '../../components/Campaign/CampaignAnalytics';

const API_HOST = axios.defaults.baseURL;

// BR datetime helpers
const pad2 = (n) => String(n).padStart(2, '0');
const toBRDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
};
const parseDateTimeFlexible = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.includes('/')) {
      const [datePart, timePart] = s.split(' ');
      const [dd, mm, yyyy] = datePart.split('/').map(v => parseInt(v, 10));
      let hh = 0, mi = 0, ss = 0;
      if (timePart) {
        const t = timePart.split(':');
        hh = parseInt(t[0] || '0', 10);
        mi = parseInt(t[1] || '0', 10);
        ss = parseInt(t[2] || '0', 10);
      }
      return new Date(yyyy, mm - 1, dd, hh, mi, ss);
    }
    const iso = new Date(s);
    if (!isNaN(iso.getTime())) return iso;
  }
  return null;
};

const CampaignForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'inactive',
    is_active: false,
    start_date: null,
    end_date: null,
    playback_mode: 'sequential',
    content_duration: 10,
    loop_enabled: false,
    shuffle_enabled: false,
  });
  const [campaignContents, setCampaignContents] = useState([]);
  const [availableContents, setAvailableContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contentDialog, setContentDialog] = useState(false);
  const [selectedContents, setSelectedContents] = useState([]);
  const [currentTab, setCurrentTab] = useState(0);

  // Helpers for ordered selection inside the modal
  const getSelectedContentObjects = () =>
    selectedContents
      .map(id => availableContents.find(c => c.id === id))
      .filter(Boolean);

  const moveSelected = (id, direction) => {
    setSelectedContents(prev => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? Math.max(0, idx - 1) : Math.min(prev.length - 1, idx + 1);
      if (newIdx === idx) return prev;
      const arr = [...prev];
      const [item] = arr.splice(idx, 1);
      arr.splice(newIdx, 0, item);
      return arr;
    });
  };

  const removeFromSelected = (id) => {
    setSelectedContents(prev => prev.filter(x => x !== id));
  };

  const getSelectedTotalDuration = () => {
    return getSelectedContentObjects().reduce((sum, c) => sum + (c?.duration || 0), 0);
  };

  // Inline preview state (modal)
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewElapsed, setPreviewElapsed] = useState(0);
  const videoRef = useRef(null);

  // Reset preview when dialog closes or selection changes significantly
  useEffect(() => {
    setPreviewPlaying(false);
    setPreviewIndex(0);
    setPreviewElapsed(0);
  }, [contentDialog, selectedContents.length]);

  // Playback tick (images only). Videos are driven by <video> events.
  useEffect(() => {
    if (!previewPlaying) return;
    const list = getSelectedContentObjects();
    if (list.length === 0) return;
    const current = list[previewIndex] || null;
    const type = getTypeFor(current);
    if (type === 'video') {
      // Let the <video> element drive progress
      const el = videoRef.current;
      if (el) {
        try { el.play(); } catch (_) {}
      }
      return;
    }
    const currentDur = getContentDuration(current);
    if (!current || currentDur <= 0) return;

    const timer = setInterval(() => {
      setPreviewElapsed((prev) => {
        if (prev + 1 >= currentDur) {
          const next = previewIndex + 1;
          if (next >= list.length) {
            setPreviewPlaying(false);
            setPreviewIndex(0);
            return 0;
          }
          setPreviewIndex(next);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [previewPlaying, previewIndex, selectedContents, availableContents, formData.content_duration]);

  // Keep video element play/pause in sync with preview state
  useEffect(() => {
    const list = getSelectedContentObjects();
    const current = list[previewIndex] || null;
    const type = getTypeFor(current);
    const el = videoRef.current;
    if (!el) return;
    if (type === 'video') {
      if (previewPlaying) {
        try { el.play(); } catch (_) {}
      } else {
        try { el.pause(); } catch (_) {}
      }
    } else {
      // Not a video, ensure any current video is paused
      try { el.pause(); } catch (_) {}
    }
  }, [previewPlaying, previewIndex, selectedContents]);

  // Reset timers and seek to start when switching items
  useEffect(() => {
    setPreviewElapsed(0);
    const list = getSelectedContentObjects();
    const current = list[previewIndex] || null;
    if (getTypeFor(current) === 'video' && videoRef.current) {
      try {
        videoRef.current.currentTime = 0;
        if (previewPlaying) videoRef.current.play();
      } catch (_) {}
    } else if (videoRef.current) {
      try { videoRef.current.pause(); } catch (_) {}
    }
  }, [previewIndex]);

  // Wire timeupdate/ended to progress and auto-advance for videos
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTimeUpdate = () => {
      setPreviewElapsed(Math.floor(el.currentTime || 0));
    };
    const onEnded = () => {
      const list = getSelectedContentObjects();
      const next = previewIndex + 1;
      if (next >= list.length) {
        setPreviewPlaying(false);
        setPreviewIndex(0);
        setPreviewElapsed(0);
      } else {
        setPreviewIndex(next);
        setPreviewElapsed(0);
      }
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  }, [previewIndex]);

  // Add: Add selected contents to campaign respecting the chosen order
  const handleAddContents = () => {
    const contentsToAdd = selectedContents
      .map(id => availableContents.find(c => c.id === id))
      .filter(content => content && !campaignContents.find(cc => cc.id === content.id));

    const newCampaignContents = contentsToAdd.map((content, index) => ({
      ...content,
      order: campaignContents.length + index,
      duration: content?.duration ?? formData?.content_duration ?? 10,
    }));

    setCampaignContents(prev => [...prev, ...newCampaignContents]);
    setSelectedContents([]);
    setContentDialog(false);
  };

  // DnD sensors for campaign content reordering (inline list)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Helpers to normalize content fields
  const getTypeFor = (content) => {
    if (!content) return null;
    return content.type || content.content_type || null;
  };
  const getThumbUrlFor = (content) => {
    if (!content) return null;
    const t = content.thumbnail_path || content.thumbnail;
    if (t) return `${API_HOST}/api/content/thumbnails/${encodeURIComponent(t)}`;
    const fp = content.file_path || content.path;
    const type = getTypeFor(content);
    if (fp && type === 'image') return `${API_HOST}/api/content/media/${encodeURIComponent(fp)}`;
    return null;
  };
  const getMediaUrlFor = (content) => {
    if (!content) return null;
    const fp = content.file_path || content.path;
    if (fp) return `${API_HOST}/api/content/media/${encodeURIComponent(fp)}`;
    return null;
  };
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '0:00';
    const s = Math.max(0, parseInt(seconds, 10) || 0);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };
  const getContentDuration = (content) => {
    if (!content) return 0;
    const d = content.duration;
    return (typeof d === 'number' && d > 0) ? d : (parseInt(formData?.content_duration, 10) || 10);
  };
  const getTotalDuration = () => {
    return (campaignContents || []).reduce((sum, c) => sum + (c?.duration || 0), 0);
  };

  const getMimeTypeFor = (content) => {
    if (!content) return undefined;
    const type = getTypeFor(content);
    const fp = (content.file_path || '').toLowerCase();
    if (type === 'video') {
      if (fp.endsWith('.mp4') || fp.endsWith('.m4v')) return 'video/mp4';
      if (fp.endsWith('.webm')) return 'video/webm';
      if (fp.endsWith('.ogg') || fp.endsWith('.ogv')) return 'video/ogg';
    }
    if (type === 'audio') {
      if (fp.endsWith('.mp3')) return 'audio/mpeg';
      if (fp.endsWith('.ogg')) return 'audio/ogg';
      if (fp.endsWith('.wav')) return 'audio/wav';
    }
    return undefined;
  };

  // Generic input handlers
  const handleInputChange = (arg1, arg2) => {
    // Supports both handleInputChange(event) and handleInputChange('field', value)
    if (typeof arg1 === 'string') {
      const key = arg1;
      const value = arg2;
      setFormData((prev) => ({ ...prev, [key]: value }));
      return;
    }
    const e = arg1;
    if (!e || !e.target) return;
    const { name, value, type, checked } = e.target;
    if (!name) return;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleDateChange = (field, value) => {
    const d = value instanceof Date ? value : parseDateTimeFlexible(value);
    setFormData((prev) => ({ ...prev, [field]: d }));
  };

  // DnD reorder handler for inline list
  const handleDragEnd = (event) => {
    const { active, over } = event || {};
    if (!active || !over || active.id === over.id) return;
    setCampaignContents((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleRemoveContent = (id) => {
    setCampaignContents((prev) => prev.filter((c) => c.id !== id));
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setSuccess('');
    try {
      // Client-side validation
      const name = (formData.name || '').trim();
      const sd = formData.start_date ? parseDateTimeFlexible(formData.start_date) : null;
      const ed = formData.end_date ? parseDateTimeFlexible(formData.end_date) : null;
      if (!name) {
        setError('Nome da campanha é obrigatório.');
        return;
      }
      if (!sd || !ed) {
        setError('Data de início e data de fim são obrigatórias.');
        return;
      }
      if (sd >= ed) {
        setError('Data de início deve ser anterior à data de fim.');
        return;
      }

      setLoading(true);

      const submitData = {
        name,
        description: formData.description || '',
        start_date: toBRDateTime(sd),
        end_date: toBRDateTime(ed),
        is_active: !!formData.is_active,
        playback_mode: formData.playback_mode || 'sequential',
        content_duration: parseInt(formData.content_duration, 10) || 10,
        loop_enabled: !!formData.loop_enabled,
        shuffle_enabled: !!formData.shuffle_enabled,
      };

      // Include content_ids only for creation flow
      if (!isEdit && campaignContents && campaignContents.length > 0) {
        submitData.content_ids = campaignContents.map((c) => c.id);
      }

      // Debug log AFTER defining submitData (avoid reference errors)
      // console.log('Submitting campaign:', submitData);

      if (isEdit) {
        await axios.put(`/campaigns/${id}`, submitData);
        setSuccess('Campanha atualizada com sucesso!');
      } else {
        await axios.post('/campaigns', submitData);
        setSuccess('Campanha criada com sucesso!');
      }

      // Navigate back after short delay
      setTimeout(() => navigate('/campaigns'), 600);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao salvar campanha';
      setError(msg);
      console.error('Campaign submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Data loading
  const loadAvailableContents = async () => {
    try {
      const resp = await axios.get('/content?per_page=1000');
      setAvailableContents(resp.data?.contents || []);
    } catch (err) {
      console.error('Erro ao carregar conteúdos disponíveis:', err);
    }
  };

  const loadCampaignIfEdit = async () => {
    if (!isEdit) return;
    try {
      const resp = await axios.get(`/campaigns/${id}`);
      const c = resp.data?.campaign || null;
      if (c) {
        setFormData((prev) => ({
          ...prev,
          name: c.name || '',
          description: c.description || '',
          is_active: !!c.is_active,
          start_date: parseDateTimeFlexible(c.start_date),
          end_date: parseDateTimeFlexible(c.end_date),
          playback_mode: c.playback_mode || 'sequential',
          content_duration: parseInt(c.content_duration, 10) || 10,
          loop_enabled: !!c.loop_enabled,
          shuffle_enabled: !!c.shuffle_enabled,
        }));
        // Map existing contents for inline list visualization (optional)
        const cc = Array.isArray(c.contents) ? c.contents : [];
        const mapped = cc
          .map((ccItem) => ccItem?.content)
          .filter(Boolean)
          .map((content, idx) => ({ ...content, order: idx, duration: content?.duration }));
        setCampaignContents(mapped);
      }
    } catch (err) {
      console.error('Erro ao carregar campanha:', err);
    }
  };

  const handleContentChange = () => {
    // When content changes in MultiContentManager, refresh inline list state
    loadCampaignIfEdit();
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        loadAvailableContents(),
        loadCampaignIfEdit(),
      ]);
      setInitialLoading(false);
    };
    init();
  }, [id]);

  // Sortable item for inline list
  const SortableContentItem = ({ content, onRemove }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: content.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      background: isDragging ? 'rgba(255, 119, 48, 0.08)' : 'transparent',
      borderRadius: 8,
      border: '1px solid',
      borderColor: 'divider',
      marginBottom: 8,
    };
    return (
      <ListItem ref={setNodeRef} style={style} {...attributes}>
        <ListItemAvatar>
          {getThumbUrlFor(content) ? (
            <Avatar variant="rounded" src={getThumbUrlFor(content)} alt={content.title} />
          ) : (
            <Avatar>
              <ContentIcon fontSize="small" />
            </Avatar>
          )}
        </ListItemAvatar>
        <ListItemText
          primary={content.title || 'Conteúdo'}
          secondary={`${getTypeFor(content) || 'desconhecido'} • ${formatDuration(content.duration || 0)}`}
        />
        <Box {...listeners} sx={{ mr: 1, cursor: 'grab', color: 'text.secondary' }}>
          <DragIcon />
        </Box>
        <ListItemSecondaryAction>
          <IconButton size="small" color="error" onClick={() => onRemove(content.id)}>
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
                            disabled={loading}
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
                      disabled={loading || !formData.name || !formData.start_date || !formData.end_date}
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
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '20px',
              backdropFilter: 'blur(20px)',
              background: (theme) => theme.palette.mode === 'dark' 
                ? 'rgba(30, 30, 30, 0.95)' 
                : 'rgba(255, 255, 255, 0.95)',
              border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
            },
          }}
        >
          <DialogTitle sx={{ 
            background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
            color: 'white',
            fontWeight: 700,
            fontSize: '1.5rem',
            py: 3,
            px: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderBottom: 'none',
          }}>
            <Avatar sx={{ 
              background: 'rgba(255, 255, 255, 0.2)',
              width: 48,
              height: 48,
            }}>
              <ContentIcon sx={{ fontSize: 28 }} />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                Adicionar Conteúdos à Campanha
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Selecione os conteúdos que deseja incluir na campanha
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {availableContents.filter(content => !campaignContents.find(cc => cc.id === content.id)).length === 0 ? (
              <Box sx={{ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                py: 8, px: 4, textAlign: 'center'
              }}>
                <Avatar sx={{ width: 80, height: 80, mb: 3, background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)', opacity: 0.7 }}>
                  <ContentIcon sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  Nenhum conteúdo disponível
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Todos os conteúdos já foram adicionados à campanha
                </Typography>
              </Box>
            ) : (
              <Box sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  {/* Coluna esquerda: lista de conteúdos disponíveis */}
                  <Grid item xs={12} md={7}>
                    <Box sx={{ maxHeight: 460, overflow: 'auto', pr: 1 }}>
                      <Grid container spacing={2}>
                        {availableContents
                          .filter(content => !campaignContents.find(cc => cc.id === content.id))
                          .map((content, index) => (
                            <Grid item xs={12} sm={6} key={content.id}>
                              <Grow in timeout={300 + index * 50}>
                                <Card
                                  sx={{
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    border: selectedContents.includes(content.id) ? '2px solid #ff7730' : '2px solid transparent',
                                    background: (theme) => selectedContents.includes(content.id)
                                      ? (theme.palette.mode === 'dark' 
                                        ? 'linear-gradient(135deg, rgba(255, 119, 48, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)'
                                        : 'linear-gradient(135deg, rgba(255, 119, 48, 0.05) 0%, rgba(255, 152, 0, 0.02) 100%)')
                                      : (theme.palette.mode === 'dark' 
                                        ? 'rgba(40, 40, 40, 0.8)'
                                        : 'rgba(255, 255, 255, 0.8)'),
                                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(255, 119, 48, 0.2)', border: '2px solid rgba(255, 119, 48, 0.5)' },
                                  }}
                                  onClick={() => {
                                    if (selectedContents.includes(content.id)) {
                                      setSelectedContents(prev => prev.filter(id => id !== content.id));
                                    } else {
                                      setSelectedContents(prev => [...prev, content.id]);
                                    }
                                  }}
                                >
                                  <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                      <Checkbox
                                        checked={selectedContents.includes(content.id)}
                                        sx={{ color: '#ff7730', '&.Mui-checked': { color: '#ff7730' }, mt: -1 }}
                                      />
                                      {getThumbUrlFor(content) ? (
                                        <Box
                                          component="img"
                                          src={getThumbUrlFor(content)}
                                          alt={content.title}
                                          sx={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: 1,
                                            objectFit: 'cover',
                                            boxShadow: '0 4px 12px rgba(255, 119, 48, 0.3)'
                                          }}
                                        />
                                      ) : (
                                        <Avatar sx={{ width: 56, height: 56, background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)', boxShadow: '0 4px 12px rgba(255, 119, 48, 0.3)' }}>
                                          <ContentIcon sx={{ fontSize: 28 }} />
                                        </Avatar>
                                      )}
                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {content.title}
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                          <Chip label={formatDuration(content.duration)} size="small" sx={{ background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)', color: 'white', fontWeight: 600, fontSize: '0.75rem' }} />
                                          <Chip label={content.type} size="small" variant="outlined" sx={{ borderColor: '#ff7730', color: '#ff7730', fontWeight: 600, fontSize: '0.75rem' }} />
                                          <Chip label={content.category || 'Sem categoria'} size="small" sx={{ backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', fontSize: '0.75rem' }} />
                                        </Box>
                                        {content.description && (
                                          <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
                                            {content.description}
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grow>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    </Grid>

                    {/* Coluna direita: fila ordenável dos selecionados */}
                    <Grid item xs={12} md={5}>
                      <Paper sx={{ p: 2, height: '100%', maxHeight: 460, overflow: 'auto', borderRadius: 2 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            Selecionados ({selectedContents.length})
                          </Typography>
                          <Chip label={`Duração: ${formatDuration(getSelectedTotalDuration())}`} size="small" />
                        </Box>
                        {selectedContents.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">Nenhum conteúdo selecionado</Typography>
                        ) : (
                          <List dense>
                            {selectedContents.map((id, index) => {
                              const content = availableContents.find(c => c.id === id);
                              if (!content) return null;
                              return (
                                <ListItem key={id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                                  <ListItemAvatar>
                                    {getThumbUrlFor(content) ? (
                                      <Avatar
                                        variant="rounded"
                                        src={getThumbUrlFor(content)}
                                        alt={content.title}
                                        sx={{ width: 40, height: 40 }}
                                      />
                                    ) : (
                                      <Avatar sx={{ width: 40, height: 40 }}>
                                        <ContentIcon fontSize="small" />
                                      </Avatar>
                                    )}
                                  </ListItemAvatar>
                                  <ListItemText
                                    primary={`${index + 1}. ${content.title}`}
                                    secondary={`${formatDuration(content.duration || 0)} • ${getTypeFor(content) || 'desconhecido'}`}
                                  />
                                  <IconButton size="small" onClick={() => moveSelected(id, 'up')} disabled={index === 0}>
                                    <ArrowUpIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" onClick={() => moveSelected(id, 'down')} disabled={index === selectedContents.length - 1}>
                                    <ArrowDownIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" onClick={() => removeFromSelected(id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </ListItem>
                              );
                            })}
                          </List>
                        )}
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ 
              p: 4, 
              background: (theme) => theme.palette.mode === 'dark' 
                ? 'rgba(40, 40, 40, 0.8)' 
                : 'rgba(250, 250, 250, 0.8)',
              borderTop: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              gap: 2,
              justifyContent: 'space-between'
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {selectedContents.length > 0 
                  ? `${selectedContents.length} conteúdo${selectedContents.length > 1 ? 's' : ''} selecionado${selectedContents.length > 1 ? 's' : ''} • Duração: ${formatDuration(getSelectedTotalDuration())}`
                  : 'Nenhum conteúdo selecionado'
                }
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button 
                  onClick={() => setContentDialog(false)}
                  variant="outlined"
                  sx={{
                    borderRadius: '12px',
                    px: 4,
                    py: 1.5,
                    fontWeight: 600,
                    textTransform: 'none',
                    borderColor: '#ff7730',
                    color: '#ff7730',
                    '&:hover': {
                      borderColor: '#ff9800',
                      background: 'rgba(255, 119, 48, 0.05)',
                      transform: 'translateY(-2px)',
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
                    borderRadius: '12px',
                    px: 4,
                    py: 1.5,
                    fontWeight: 600,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                    boxShadow: '0 4px 12px rgba(255, 119, 48, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 20px rgba(255, 119, 48, 0.4)',
                    },
                    '&:disabled': {
                      background: 'rgba(0, 0, 0, 0.12)',
                      color: 'rgba(0, 0, 0, 0.26)',
                    },
                  }}
                >
                  Adicionar {selectedContents.length > 0 && `(${selectedContents.length})`}
                </Button>
              </Box>
            </DialogActions>

            {/* Inline Preview */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, px: 4 }}>
              Preview
            </Typography>
            {selectedContents.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 4 }}>
                Selecione conteúdos para pré-visualizar.
              </Typography>
            ) : (
              <Box sx={{ p: 4 }}>
                {(() => {
                  const selected = getSelectedContentObjects();
                  const current = selected[previewIndex] || null;
                  const currentDur = getContentDuration(current);
                  const elapsedBefore = selected.slice(0, previewIndex).reduce((s, c) => s + getContentDuration(c), 0);
                  const totalDur = selected.reduce((s, c) => s + getContentDuration(c), 0) || 0;
                  const itemPct = currentDur ? Math.min(100, Math.round((previewElapsed / currentDur) * 100)) : 0;
                  const totalPct = totalDur ? Math.min(100, Math.round(((elapsedBefore + previewElapsed) / totalDur) * 100)) : 0;
                  const currentType = getTypeFor(current);
                  const thumbUrl = getThumbUrlFor(current);
                  const mediaUrl = getMediaUrlFor(current);
                  return (
                    <Box>
                      {/* Media area */}
                      <Box sx={{
                        width: '100%',
                        height: 220,
                        mb: 1,
                        borderRadius: 1,
                        overflow: 'hidden',
                        bgcolor: 'black',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {currentType === 'video' && mediaUrl ? (
                          <video
                            key={mediaUrl}
                            ref={videoRef}
                            poster={thumbUrl || undefined}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            controls
                            muted
                            playsInline
                            preload="auto"
                            autoPlay={previewPlaying}
                            crossOrigin="anonymous"
                            onLoadedMetadata={(e) => {
                              try { e.currentTarget.currentTime = 0; } catch (_) {}
                              if (previewPlaying) {
                                try { e.currentTarget.play(); } catch (_) {}
                              }
                              setPreviewElapsed(0);
                            }}
                            onError={(e) => {
                              console.error('Video load error for URL:', mediaUrl, e);
                            }}
                          >
                            <source src={mediaUrl} type={getMimeTypeFor(current) || 'video/mp4'} />
                          </video>
                        ) : thumbUrl || mediaUrl ? (
                          <img
                            src={thumbUrl || mediaUrl}
                            alt={current?.title || 'preview'}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            loading="lazy"
                          />
                        ) : (
                          <Box sx={{ color: 'text.secondary' }}>Sem mídia para pré-visualizar</Box>
                        )}
                      </Box>
                      {/* Filmstrip with thumbnails of the sequence */}
                      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1, mb: 1 }}>
                        {selected.map((c, idx) => {
                          const t = getThumbUrlFor(c) || getMediaUrlFor(c);
                          return (
                            <Box
                              key={c?.id || idx}
                              onClick={() => { setPreviewIndex(idx); setPreviewElapsed(0); setPreviewPlaying(true); }}
                              sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 1,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                outline: idx === previewIndex ? '2px solid #ff7730' : '1px solid',
                                outlineColor: (theme) => idx === previewIndex ? '#ff7730' : (theme.palette.divider),
                                bgcolor: 'black',
                                flex: '0 0 auto',
                              }}
                            >
                              {t ? (
                                <Box component="img" src={t} alt={c?.title || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                                  <ContentIcon fontSize="small" />
                                </Box>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" fontWeight={600}>
                          {current ? `${previewIndex + 1}/${selected.length} • ${current.title}` : '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(() => {
                            const videoDur = (currentType === 'video' && videoRef.current && !Number.isNaN(videoRef.current.duration)) ? Math.floor(videoRef.current.duration) : currentDur;
                            return current ? `${previewElapsed}s / ${videoDur}s` : '';
                          })()}
                        </Typography>
                      </Box>
                      {(() => {
                        const effectiveDur = (currentType === 'video' && videoRef.current && !Number.isNaN(videoRef.current.duration)) ? Math.floor(videoRef.current.duration) : currentDur;
                        const effItemPct = effectiveDur ? Math.min(100, Math.round((previewElapsed / effectiveDur) * 100)) : 0;
                        const elapsedBefore = selected.slice(0, previewIndex).reduce((s, c) => s + getContentDuration(c), 0);
                        const totalDur = selected.reduce((s, c) => s + getContentDuration(c), 0) || 0;
                        const effTotalPct = totalDur ? Math.min(100, Math.round(((elapsedBefore + Math.min(previewElapsed, effectiveDur)) / totalDur) * 100)) : 0;
                        return (
                          <>
                            <LinearProgress variant="determinate" value={effItemPct} sx={{ height: 8, borderRadius: 1, mb: 1 }} />
                            <LinearProgress variant="determinate" value={effTotalPct} sx={{ height: 6, borderRadius: 1, mb: 1, bgcolor: 'action.hover' }} />
                          </>
                        );
                      })()}
                      <Box display="flex" gap={1}>
                        {!previewPlaying ? (
                          <Button size="small" startIcon={<PlayIcon />} onClick={() => setPreviewPlaying(true)} disabled={selected.length === 0}>
                            Reproduzir
                          </Button>
                        ) : (
                          <Button size="small" startIcon={<PauseIcon />} onClick={() => setPreviewPlaying(false)}>
                            Pausar
                          </Button>
                        )}
                        <Button size="small" startIcon={<StopIcon />} onClick={() => { setPreviewPlaying(false); setPreviewIndex(0); setPreviewElapsed(0); }}>
                          Parar
                        </Button>
                      </Box>
                    </Box>
                  );
                })()}
              </Box>
            )}
          </Dialog>

        {/* Tabs */}
        <Paper sx={{ mt: 3 }}>
          <Tabs 
            value={currentTab} 
            onChange={(e, newValue) => setCurrentTab(newValue)}
            variant="fullWidth"
          >
            <Tab icon={<SettingsIcon />} label="Configurações Gerais" />
            {isEdit && <Tab icon={<ContentIcon />} label="Conteúdos" />}
            {isEdit && <Tab icon={<AnalyticsIcon />} label="Analytics" />}
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {currentTab === 0 && (
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Informações Básicas */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Informações Básicas
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Nome da Campanha"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          required
                          disabled={loading}
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
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.is_active}
                              onChange={(e) => handleInputChange('is_active', e.target.checked)}
                              disabled={loading}
                            />
                          }
                          label="Campanha Ativa"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          label="Descrição"
                          value={formData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          disabled={loading}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Configurações de Reprodução */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Configurações de Reprodução
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          select
                          label="Modo de Reprodução"
                          value={formData.playback_mode}
                          onChange={(e) => handleInputChange('playback_mode', e.target.value)}
                          disabled={loading}
                        >
                          <MenuItem value="sequential">Sequencial</MenuItem>
                          <MenuItem value="random">Aleatório</MenuItem>
                          <MenuItem value="single">Único</MenuItem>
                          <MenuItem value="loop">Loop</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Duração Padrão (segundos)"
                          value={formData.content_duration}
                          onChange={(e) => handleInputChange('content_duration', parseInt(e.target.value) || 10)}
                          disabled={loading}
                          inputProps={{ min: 1, max: 3600 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.loop_enabled}
                              onChange={(e) => handleInputChange('loop_enabled', e.target.checked)}
                              disabled={loading}
                            />
                          }
                          label="Loop Habilitado"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.shuffle_enabled}
                              onChange={(e) => handleInputChange('shuffle_enabled', e.target.checked)}
                              disabled={loading}
                            />
                          }
                          label="Embaralhar Conteúdos"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Actions */}
              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/campaigns')}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={loading || !formData.name || !formData.start_date || !formData.end_date}
                  >
                    {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar Campanha')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        )}

        {/* Tab de Conteúdos */}
        {currentTab === 1 && isEdit && (
          <MultiContentManager 
            campaignId={id} 
            onContentChange={handleContentChange}
          />
        )}

        {/* Tab de Analytics */}
        {currentTab === 2 && isEdit && (
          <CampaignAnalytics campaignId={id} />
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default CampaignForm;
