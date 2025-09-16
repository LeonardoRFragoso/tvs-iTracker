import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
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
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  VideoLibrary as VideoIcon,
  Image as ImageIcon,
  AudioFile as AudioIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ContentList = () => {
  const navigate = useNavigate();
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, content: null });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [previewDialog, setPreviewDialog] = useState({ open: false, content: null });

  useEffect(() => {
    loadContents();
  }, [page, searchTerm, filterType, filterCategory]);

  const loadContents = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: 12,
        search: searchTerm || undefined,
        type: filterType !== 'all' ? filterType : undefined,
        category: filterCategory !== 'all' ? filterCategory : undefined,
      };

      const response = await axios.get(`${API_BASE_URL}/content`, { params });
      setContents(response.data.contents);
      setTotalPages(response.data.pages);
    } catch (err) {
      setError('Erro ao carregar conteúdos');
      console.error('Load contents error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/content/${deleteDialog.content.id}`);
      setDeleteDialog({ open: false, content: null });
      loadContents();
    } catch (err) {
      setError('Erro ao deletar conteúdo');
      console.error('Delete content error:', err);
    }
  };

  const handleMenuClick = (event, content) => {
    setAnchorEl(event.currentTarget);
    setSelectedContent(content);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedContent(null);
  };

  const getContentIcon = (type) => {
    switch (type) {
      case 'video':
        return <VideoIcon />;
      case 'image':
        return <ImageIcon />;
      case 'audio':
        return <AudioIcon />;
      default:
        return <DocumentIcon />;
    }
  };

  const getContentTypeColor = (type) => {
    switch (type) {
      case 'video':
        return 'error';
      case 'image':
        return 'success';
      case 'audio':
        return 'warning';
      default:
        return 'default';
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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gerenciar Conteúdo
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/content/new')}
        >
          Novo Conteúdo
        </Button>
      </Box>

      {/* Filtros e Busca */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Buscar conteúdo..."
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
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Tipo"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <MenuItem value="all">Todos os tipos</MenuItem>
                <MenuItem value="video">Vídeo</MenuItem>
                <MenuItem value="image">Imagem</MenuItem>
                <MenuItem value="audio">Áudio</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Categoria"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <MenuItem value="all">Todas as categorias</MenuItem>
                <MenuItem value="promocional">Promocional</MenuItem>
                <MenuItem value="institucional">Institucional</MenuItem>
                <MenuItem value="entretenimento">Entretenimento</MenuItem>
                <MenuItem value="informativo">Informativo</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={loadContents}
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

      {/* Lista de Conteúdos */}
      <Grid container spacing={3}>
        {contents.map((content) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={content.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardMedia
                sx={{
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.100',
                }}
              >
                {content.thumbnail_path ? (
                  <img
                    src={`${API_BASE_URL}/content/thumbnails/${content.thumbnail_path}`}
                    alt={content.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <Box 
                  sx={{ 
                    fontSize: 60, 
                    color: 'grey.400',
                    display: content.thumbnail_path ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%'
                  }}
                >
                  {getContentIcon(content.content_type)}
                </Box>
              </CardMedia>
              
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography variant="h6" component="h3" noWrap sx={{ flexGrow: 1, mr: 1 }}>
                    {content.title}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuClick(e, content)}
                  >
                    <MoreIcon />
                  </IconButton>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {content.description}
                </Typography>
                
                <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={content.content_type}
                    color={getContentTypeColor(content.content_type)}
                  />
                  {content.category && (
                    <Chip
                      size="small"
                      label={content.category}
                      variant="outlined"
                    />
                  )}
                </Box>
                
                <Typography variant="caption" color="text.secondary" display="block">
                  {formatFileSize(content.file_size)}
                  {content.duration && ` • ${formatDuration(content.duration)}`}
                </Typography>
                
                <Typography variant="caption" color="text.secondary" display="block">
                  Criado em {new Date(content.created_at).toLocaleDateString('pt-BR')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {contents.length === 0 && !loading && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary">
            Nenhum conteúdo encontrado
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/content/new')}
            sx={{ mt: 2 }}
          >
            Adicionar Primeiro Conteúdo
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
          navigate(`/content/${selectedContent?.id}`);
          handleMenuClose();
        }}>
          <ViewIcon sx={{ mr: 1 }} />
          Visualizar
        </MenuItem>
        <MenuItem onClick={() => {
          navigate(`/content/${selectedContent?.id}/edit`);
          handleMenuClose();
        }}>
          <EditIcon sx={{ mr: 1 }} />
          Editar
        </MenuItem>
        <MenuItem onClick={() => {
          window.open(`${API_BASE_URL}/content/media/${selectedContent?.file_path}`, '_blank');
          handleMenuClose();
        }}>
          <DownloadIcon sx={{ mr: 1 }} />
          Download
        </MenuItem>
        <MenuItem onClick={() => {
          setDeleteDialog({ open: true, content: selectedContent });
          handleMenuClose();
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Deletar
        </MenuItem>
        <MenuItem onClick={() => {
          setPreviewDialog({ open: true, content: selectedContent });
          handleMenuClose();
        }}>
          <ViewIcon sx={{ mr: 1 }} />
          Preview
        </MenuItem>
      </Menu>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, content: null })}
      >
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja deletar o conteúdo "{deleteDialog.content?.title}"?
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, content: null })}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Deletar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Preview */}
      <Dialog
        open={previewDialog.open}
        onClose={() => setPreviewDialog({ open: false, content: null })}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{previewDialog.content?.title}</Typography>
            <IconButton onClick={() => setPreviewDialog({ open: false, content: null })}>
              <DeleteIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {previewDialog.content?.content_type === 'video' && (
            <video
              src={`${API_BASE_URL}/content/media/${previewDialog.content?.file_path}`}
              controls
              style={{
                width: '100%',
                maxHeight: '500px',
              }}
            />
          )}
          {previewDialog.content?.content_type === 'image' && (
            <img
              src={`${API_BASE_URL}/content/media/${previewDialog.content?.file_path}`}
              alt={previewDialog.content?.title}
              style={{
                width: '100%',
                maxHeight: '500px',
                objectFit: 'contain',
              }}
            />
          )}
          {previewDialog.content?.content_type === 'audio' && (
            <audio
              src={`${API_BASE_URL}/content/media/${previewDialog.content?.file_path}`}
              controls
              style={{ width: '100%' }}
            />
          )}
          {previewDialog.content?.content_type === 'html' && (
            <iframe
              src={`${API_BASE_URL}/content/media/${previewDialog.content?.file_path}`}
              title={previewDialog.content?.title}
              style={{
                width: '100%',
                height: '500px',
                border: 'none',
              }}
            />
          )}
          <Box mt={2}>
            <Typography variant="body2" color="text.secondary">
              <strong>Descrição:</strong> {previewDialog.content?.description || 'Sem descrição'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Tipo:</strong> {previewDialog.content?.content_type}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Tamanho:</strong> {formatFileSize(previewDialog.content?.file_size || 0)}
            </Typography>
            {previewDialog.content?.duration && (
              <Typography variant="body2" color="text.secondary">
                <strong>Duração:</strong> {formatDuration(previewDialog.content?.duration)}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => window.open(`${API_BASE_URL}/content/media/${previewDialog.content?.file_path}`, '_blank')}
            startIcon={<DownloadIcon />}
          >
            Download
          </Button>
          <Button onClick={() => setPreviewDialog({ open: false, content: null })}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB para adicionar conteúdo */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => navigate('/content/new')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default ContentList;
