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
  Avatar,
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
import axios from '../../config/axios';
import { useTheme } from '../../contexts/ThemeContext';

const ContentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    loadContent();
  }, [id]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/content/${id}`);
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
      await axios.delete(`/content/${id}`);
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
        <Box display="flex" alignItems="center">
          <Avatar
            sx={{
              width: 40,
              height: 40,
              mr: 2,
              bgcolor: isDarkMode ? '#ff9800' : '#1976d2',
              color: 'white',
            }}
          >
            {content.title.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="h4" component="h1">
            {content.title}
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/content/${id}/edit`)}
            sx={{
              mr: 1,
              borderRadius: 2,
              px: 3,
              py: 1,
              fontWeight: 'bold',
              background: isDarkMode
                ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              color: 'white',
              border: 'none',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                background: isDarkMode
                  ? 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)'
                  : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
              },
            }}
          >
            Editar
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialog(true)}
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1,
              fontWeight: 'bold',
              borderColor: '#f44336',
              color: '#f44336',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(244, 67, 54, 0.3)',
                background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                color: 'white',
                borderColor: '#f44336',
              },
            }}
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
                    src={`${axios.defaults.baseURL.replace(/\/api$/, '')}/content/thumbnails/${content.thumbnail_path}`}
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
                  sx={{ 
                    mr: 1,
                    borderRadius: 2,
                    py: 1.5,
                    fontWeight: 'bold',
                    background: isDarkMode 
                      ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                      : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                      background: isDarkMode 
                        ? 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)'
                        : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                    },
                  }}
                >
                  Reproduzir
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => window.open(`${axios.defaults.baseURL.replace(/\/api$/, '')}/uploads/${content.file_path}`, '_blank')}
                  fullWidth
                  sx={{
                    borderRadius: 2,
                    py: 1.5,
                    fontWeight: 'bold',
                    borderColor: isDarkMode ? '#ff9800' : '#1976d2',
                    color: isDarkMode ? '#ff9800' : '#1976d2',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: isDarkMode 
                        ? '0 8px 25px rgba(255, 152, 0, 0.2)'
                        : '0 8px 25px rgba(25, 118, 210, 0.2)',
                      borderColor: isDarkMode ? '#f57c00' : '#1565c0',
                      backgroundColor: isDarkMode 
                        ? 'rgba(255, 152, 0, 0.1)'
                        : 'rgba(25, 118, 210, 0.1)',
                    },
                  }}
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
              <Typography variant="h6" gutterBottom sx={{ 
                fontWeight: 700,
                color: isDarkMode ? '#ff9800' : '#1976d2',
                mb: 3 
              }}>
                Detalhes do Conteúdo
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                  Descrição:
                </Typography>
                <Typography variant="body1" sx={{ 
                  color: 'text.primary',
                  lineHeight: 1.6,
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.05)' : 'rgba(25, 118, 210, 0.05)',
                  border: `1px solid ${isDarkMode ? 'rgba(255, 152, 0, 0.2)' : 'rgba(25, 118, 210, 0.2)'}`,
                }}>
                  {content.description || 'Sem descrição'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                  Tipo:
                </Typography>
                <Chip
                  label={content.content_type.toUpperCase()}
                  color={content.content_type === 'video' ? 'error' : 
                         content.content_type === 'image' ? 'success' : 'default'}
                  size="medium"
                  sx={{
                    fontWeight: 'bold',
                    borderRadius: 2,
                    px: 1,
                  }}
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
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 3,
            background: isDarkMode 
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
          },
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 700,
          color: isDarkMode ? '#ff9800' : '#1976d2',
          borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
        }}>
          {content.title}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {content.content_type === 'video' && (
            <video
              src={`${axios.defaults.baseURL.replace(/\/api$/, '')}/uploads/${content.file_path}`}
              controls
              style={{ 
                width: '100%', 
                maxHeight: '500px',
                borderRadius: '8px',
              }}
            />
          )}
          {content.content_type === 'image' && (
            <img
              src={`${axios.defaults.baseURL.replace(/\/api$/, '')}/uploads/${content.file_path}`}
              alt={content.title}
              style={{ 
                width: '100%', 
                maxHeight: '500px', 
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
          )}
          {content.content_type === 'audio' && (
            <audio
              src={`${axios.defaults.baseURL.replace(/\/api$/, '')}/uploads/${content.file_path}`}
              controls
              style={{ 
                width: '100%',
                borderRadius: '8px',
              }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          borderTop: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
        }}>
          <Button 
            onClick={() => setPreviewDialog(false)}
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1,
              fontWeight: 'bold',
              color: isDarkMode ? '#ff9800' : '#1976d2',
              '&:hover': {
                backgroundColor: isDarkMode 
                  ? 'rgba(255, 152, 0, 0.1)'
                  : 'rgba(25, 118, 210, 0.1)',
              },
            }}
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog 
        open={deleteDialog} 
        onClose={() => setDeleteDialog(false)}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 3,
            background: isDarkMode 
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
          },
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 700,
          color: '#f44336',
          borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
        }}>
          Confirmar Exclusão
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography sx={{ color: 'text.primary', lineHeight: 1.6 }}>
            Tem certeza que deseja deletar o conteúdo "{content.title}"?
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          borderTop: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
          gap: 1,
        }}>
          <Button 
            onClick={() => setDeleteDialog(false)}
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1,
              fontWeight: 'bold',
              color: isDarkMode ? '#ff9800' : '#1976d2',
              '&:hover': {
                backgroundColor: isDarkMode 
                  ? 'rgba(255, 152, 0, 0.1)'
                  : 'rgba(25, 118, 210, 0.1)',
              },
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="contained"
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1,
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 20px rgba(244, 67, 54, 0.3)',
              },
            }}
          >
            Deletar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentDetail;
