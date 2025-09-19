import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Divider,
  Alert
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Timer as TimerIcon,
  Shuffle as ShuffleIcon,
  Repeat as RepeatIcon,
  Movie as VideoIcon,
  Image as ImageIcon,
  AudioFile as AudioIcon,
  CloudDone as ReadyIcon,
  Autorenew as ProcessingIcon,
  WarningAmber as StaleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

const PlaybackPreview = ({ open, onClose, campaignId }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    content_filter: '',
    location_filter: ''
  });

  useEffect(() => {
    if (open && campaignId) {
      loadPreview();
    }
  }, [open, campaignId, filters]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      if (filters.content_filter) params.append('content_filter', filters.content_filter);
      if (filters.location_filter) params.append('location_filter', filters.location_filter);
      
      const response = await axios.get(
        `${API_BASE_URL}/campaigns/${campaignId}/contents/preview?${params.toString()}`
      );
      setPreview(response.data);
    } catch (err) {
      setError('Erro ao carregar preview da campanha');
      console.error('Load preview error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getContentIcon = (contentType) => {
    switch (contentType) {
      case 'video':
        return <VideoIcon />;
      case 'image':
        return <ImageIcon />;
      case 'audio':
        return <AudioIcon />;
      default:
        return <PlayIcon />;
    }
  };

  const getContentTypeColor = (contentType) => {
    switch (contentType) {
      case 'video':
        return 'primary';
      case 'image':
        return 'secondary';
      case 'audio':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (seconds) => {
    if (!seconds) return '0 segundos';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    let result = [];
    if (hours > 0) result.push(`${hours}h`);
    if (minutes > 0) result.push(`${minutes}m`);
    if (remainingSeconds > 0 || result.length === 0) result.push(`${remainingSeconds}s`);
    
    return result.join(' ');
  };

  const getPlaybackModeIcon = (mode) => {
    switch (mode) {
      case 'random':
        return <ShuffleIcon />;
      case 'loop':
        return <RepeatIcon />;
      default:
        return <PlayIcon />;
    }
  };

  const getPlaybackModeLabel = (mode) => {
    switch (mode) {
      case 'sequential':
        return 'Sequencial';
      case 'random':
        return 'Aleatório';
      case 'single':
        return 'Único';
      case 'loop':
        return 'Loop';
      default:
        return mode;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PlayIcon />
          Preview da Sequência de Reprodução
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* Filtros */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Filtros de Preview
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Conteúdo</InputLabel>
                <Select
                  value={filters.content_filter}
                  onChange={(e) => setFilters(prev => ({ ...prev, content_filter: e.target.value }))}
                  label="Tipo de Conteúdo"
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="video">Apenas Vídeos</MenuItem>
                  <MenuItem value="image">Apenas Imagens</MenuItem>
                  <MenuItem value="audio">Apenas Áudios</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Localização</InputLabel>
                <Select
                  value={filters.location_filter}
                  onChange={(e) => setFilters(prev => ({ ...prev, location_filter: e.target.value }))}
                  label="Localização"
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="matriz">Matriz</MenuItem>
                  <MenuItem value="filial1">Filial 1</MenuItem>
                  <MenuItem value="filial2">Filial 2</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {preview && (
          <Box>
            {/* Resumo */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {preview.total_contents}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Conteúdos
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="primary">
                      {formatTotalDuration(preview.total_duration)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Duração Total
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    {getPlaybackModeIcon(preview.playback_mode)}
                    <Box>
                      <Typography variant="body1">
                        {getPlaybackModeLabel(preview.playback_mode)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Modo
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Box display="flex" justifyContent="center" gap={1} mb={1}>
                      {preview.loop_enabled && <Chip label="Loop" size="small" />}
                      {preview.shuffle_enabled && <Chip label="Shuffle" size="small" />}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Configurações
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Lista de Conteúdos */}
            <Typography variant="h6" gutterBottom>
              Sequência de Reprodução
            </Typography>

            {preview.preview && preview.preview.length > 0 ? (
              <List>
                {preview.preview.map((item, index) => (
                  <ListItem
                    key={`${item.content?.id}-${index}`}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: item.is_active ? 'background.paper' : 'action.hover',
                      opacity: item.is_active ? 1 : 0.6
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar 
                        sx={{ 
                          bgcolor: getContentTypeColor(item.content?.content_type) + '.main',
                          color: 'white'
                        }}
                      >
                        {item.order}
                      </Avatar>
                    </ListItemAvatar>
                    
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          {getContentIcon(item.content?.content_type)}
                          <Typography variant="subtitle1">
                            {item.content?.title || 'Conteúdo sem título'}
                          </Typography>
                          <Chip 
                            label={item.content?.content_type} 
                            size="small" 
                            color={getContentTypeColor(item.content?.content_type)}
                          />
                          {!item.is_active && (
                            <Chip label="Inativo" size="small" color="default" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <TimerIcon fontSize="small" color="action" />
                              <Typography variant="body2">
                                {formatDuration(item.duration)}
                              </Typography>
                            </Box>
                            {item.location_filter && item.location_filter.length > 0 && (
                              <Typography variant="body2" color="text.secondary">
                                Localizações: {item.location_filter.join(', ')}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  Nenhum conteúdo encontrado com os filtros aplicados
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Compiled Section */}
        {preview && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>
              Vídeo Compilado
            </Typography>
            <Card>
              <CardContent>
                {preview.compiled ? (
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      {preview.compiled.status === 'ready' ? (
                        <Chip color="success" icon={<ReadyIcon />} label="Pronto" />
                      ) : preview.compiled.status === 'processing' ? (
                        <Chip color="warning" icon={<ProcessingIcon />} label="Processando" />
                      ) : preview.compiled.status === 'stale' ? (
                        <Chip color="default" icon={<StaleIcon />} label="Desatualizado" />
                      ) : preview.compiled.status === 'failed' ? (
                        <Chip color="error" icon={<ErrorIcon />} label="Falhou" />
                      ) : (
                        <Chip variant="outlined" label="Não gerado" />
                      )}
                      {typeof preview.compiled.duration === 'number' && (
                        <Chip label={`Duração: ${formatDuration(preview.compiled.duration)}`} />
                      )}
                      {preview.compiled.updated_at && (
                        <Chip variant="outlined" label={`Atualizado: ${preview.compiled.updated_at}`} />
                      )}
                      {preview.compiled.resolution && (
                        <Chip variant="outlined" label={preview.compiled.resolution} />
                      )}
                      {preview.compiled.fps && (
                        <Chip variant="outlined" label={`${preview.compiled.fps} fps`} />
                      )}
                    </Box>
                    {preview.compiled.status === 'ready' && preview.compiled.url ? (
                      <video controls style={{ width: '100%', borderRadius: 8 }} src={preview.compiled.url.startsWith('http') ? preview.compiled.url : `${API_BASE_URL.replace(/\/api$/, '')}${preview.compiled.url}`} />
                    ) : (
                      <Alert severity="info">Gere o vídeo compilado na aba de conteúdos da campanha.</Alert>
                    )}
                  </Box>
                ) : (
                  <Alert severity="info">Sem informações de vídeo compilado.</Alert>
                )}
              </CardContent>
            </Card>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          Fechar
        </Button>
        <Button onClick={loadPreview} variant="outlined" disabled={loading}>
          Atualizar Preview
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlaybackPreview;
