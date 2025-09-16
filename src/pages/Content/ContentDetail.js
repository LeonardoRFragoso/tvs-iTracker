import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Chip,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  VideoLibrary as VideoIcon,
  Image as ImageIcon,
  AudioFile as AudioIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ContentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);

  useEffect(() => {
    loadContent();
  }, [id]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/content/${id}`);
      setContent(response.data.content);
    } catch (err) {
      setError('Erro ao carregar conteúdo');
      console.error('Load content error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/content/${id}`);
      navigate('/content');
    } catch (err) {
      setError('Erro ao deletar conteúdo');
      console.error('Delete content error:', err);
    }
  };

  const getContentIcon = (type) => {
    switch (type) {
      case 'video':
        return <VideoIcon sx={{ fontSize: 60 }} />;
      case 'image':
        return <ImageIcon sx={{ fontSize: 60 }} />;
      case 'audio':
        return <AudioIcon sx={{ fontSize: 60 }} />;
      default:
        return <DocumentIcon sx={{ fontSize: 60 }} />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Carregando...</Typography>
      </Box>
    );
  }

  if (error || !content) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Conteúdo não encontrado'}
        </Alert>
        <Button onClick={() => navigate('/content')} startIcon={<ArrowBackIcon />}>
          Voltar para Conteúdos
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/content')}
          sx={{ textDecoration: 'none' }}
        >
          Conteúdos
        </Link>
        <Typography color="text.primary">{content.title}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {content.title}
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/content/${id}/edit`)}
            sx={{ mr: 1 }}
          >
            Editar
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialog(true)}
          >
            Deletar
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Preview Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardMedia
              sx={{
                height: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.100',
                position: 'relative',
              }}
            >
              {content.thumbnail_path ? (
                <>
                  <img
                    src={`${API_BASE_URL}/content/thumbnails/${content.thumbnail_path}`}
                    alt={content.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <IconButton
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      bgcolor: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }
                    }}
                    onClick={() => setPreviewDialog(true)}
                  >
                    <PlayIcon sx={{ fontSize: 40 }} />
                  </IconButton>
                </>
              ) : (
                <Box textAlign="center" color="grey.400">
                  {getContentIcon(content.content_type)}
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {content.content_type.toUpperCase()}
                  </Typography>
                </Box>
              )}
            </CardMedia>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Button
                  variant="contained"
                  startIcon={<PlayIcon />}
                  onClick={() => setPreviewDialog(true)}
                  fullWidth
                  sx={{ mr: 1 }}
                >
                  Reproduzir
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => window.open(`${API_BASE_URL}/content/media/${content.file_path}`, '_blank')}
                  fullWidth
                >
                  Download
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Details Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Detalhes do Conteúdo
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Descrição:</strong>
                </Typography>
                <Typography variant="body1">
                  {content.description || 'Sem descrição'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Tipo:</strong>
                </Typography>
                <Chip
                  label={content.content_type}
                  color={content.content_type === 'video' ? 'error' : 
                         content.content_type === 'image' ? 'success' : 'default'}
                  size="small"
                />
              </Box>

              {content.category && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Categoria:</strong>
                  </Typography>
                  <Chip label={content.category} variant="outlined" size="small" />
                </Box>
              )}

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Tamanho:</strong>
                </Typography>
                <Typography variant="body1">
                  {formatFileSize(content.file_size || 0)}
                </Typography>
              </Box>

              {content.duration && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Duração:</strong>
                  </Typography>
                  <Typography variant="body1">
                    {formatDuration(content.duration)}
                  </Typography>
                </Box>
              )}

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Criado em:</strong>
                </Typography>
                <Typography variant="body1">
                  {new Date(content.created_at).toLocaleString('pt-BR')}
                </Typography>
              </Box>

              {content.updated_at !== content.created_at && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Atualizado em:</strong>
                  </Typography>
                  <Typography variant="body1">
                    {new Date(content.updated_at).toLocaleString('pt-BR')}
                  </Typography>
                </Box>
              )}

              {content.tags && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Tags:</strong>
                  </Typography>
                  <Typography variant="body1">
                    {content.tags}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialog}
        onClose={() => setPreviewDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{content.title}</DialogTitle>
        <DialogContent>
          {content.content_type === 'video' && (
            <video
              src={`${API_BASE_URL}/content/media/${content.file_path}`}
              controls
              style={{ width: '100%', maxHeight: '500px' }}
            />
          )}
          {content.content_type === 'image' && (
            <img
              src={`${API_BASE_URL}/content/media/${content.file_path}`}
              alt={content.title}
              style={{ width: '100%', maxHeight: '500px', objectFit: 'contain' }}
            />
          )}
          {content.content_type === 'audio' && (
            <audio
              src={`${API_BASE_URL}/content/media/${content.file_path}`}
              controls
              style={{ width: '100%' }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja deletar o conteúdo "{content.title}"?
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Deletar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentDetail;
