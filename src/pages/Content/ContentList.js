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
  Paper,
  Avatar,
  Fade,
  Grow,
  Skeleton,
  Badge,
  LinearProgress,
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
  Refresh as RefreshIcon,
  GridView as GridViewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../../contexts/ThemeContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Skeleton loading component for content cards
const ContentCardSkeleton = ({ delay = 0 }) => (
  <Grow in={true} timeout={1000 + delay * 100}>
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 3,
      }}
    >
      <Skeleton variant="rectangular" height={200} />
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Skeleton variant="text" width="70%" height={28} />
          <Skeleton variant="circular" width={24} height={24} />
        </Box>
        <Skeleton variant="text" width="90%" height={20} sx={{ mb: 2 }} />
        <Box display="flex" gap={1} mb={2}>
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={80} height={24} />
        </Box>
        <Skeleton variant="text" width="60%" height={16} />
        <Skeleton variant="text" width="50%" height={16} />
      </CardContent>
    </Card>
  </Grow>
);

const ContentList = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
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
      <Fade in={true} timeout={800}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography 
              variant="h3" 
              component="h1" 
              fontWeight="bold" 
              gutterBottom
              sx={{
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              Gerenciar Conteúdo
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Organize e gerencie sua biblioteca de mídia digital
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Atualizar lista">
              <IconButton 
                onClick={loadContents}
                sx={{
                  bgcolor: 'info.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'info.dark',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/content/new')}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 'bold',
                px: 3,
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                  : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Novo Conteúdo
            </Button>
          </Box>
        </Box>
      </Fade>

      {/* Filtros e Busca */}
      <Fade in={true} timeout={1000}>
        <Paper
          elevation={0}
          sx={{
            mb: 4,
            p: 3,
            borderRadius: 3,
            background: isDarkMode 
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: 0,
              width: 100,
              height: 100,
              background: `radial-gradient(circle, ${isDarkMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(25, 118, 210, 0.1)'} 0%, transparent 70%)`,
            },
          }}
        >
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <FilterIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Filtros e Busca
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Encontre o conteúdo que você precisa
              </Typography>
            </Box>
          </Box>
          <Grid container spacing={3} alignItems="center">
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover': {
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s ease',
                  },
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
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
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 'bold',
                  height: 56,
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                Filtrar
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Fade>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Lista de Conteúdos */}
      <Grid container spacing={3}>
        {loading ? (
          Array.from({ length: 12 }, (_, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
              <ContentCardSkeleton delay={index} />
            </Grid>
          ))
        ) : (
          contents.map((content, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={content.id}>
              <Grow in={true} timeout={1200 + index * 100}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderRadius: 3,
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode 
                        ? '0 12px 35px rgba(255, 152, 0, 0.2)'
                        : '0 12px 35px rgba(0, 0, 0, 0.15)',
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(255, 255, 255, 0.05)',
                      opacity: 0,
                      transition: 'opacity 0.3s ease',
                      zIndex: 1,
                    },
                    '&:hover::before': {
                      opacity: 1,
                    },
                  }}
                >
                  <CardMedia
                    sx={{
                      height: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isDarkMode ? '#2a2a2a' : 'grey.100',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: `linear-gradient(135deg, ${
                          content.content_type === 'video' ? 'rgba(244, 67, 54, 0.1)' :
                          content.content_type === 'image' ? 'rgba(76, 175, 80, 0.1)' :
                          content.content_type === 'audio' ? 'rgba(255, 152, 0, 0.1)' :
                          'rgba(33, 150, 243, 0.1)'
                        } 0%, transparent 100%)`,
                      },
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
                          transition: 'transform 0.3s ease',
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
                        color: isDarkMode ? '#666' : 'grey.400',
                        display: content.thumbnail_path ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        zIndex: 2,
                      }}
                    >
                      {getContentIcon(content.content_type)}
                    </Box>
                    
                    {/* Content Type Badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        zIndex: 3,
                      }}
                    >
                      <Chip
                        size="small"
                        label={content.content_type.toUpperCase()}
                        color={getContentTypeColor(content.content_type)}
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                          height: 24,
                          backdropFilter: 'blur(10px)',
                          bgcolor: 'rgba(255, 255, 255, 0.9)',
                        }}
                      />
                    </Box>
                  </CardMedia>
                  
                  <CardContent sx={{ flexGrow: 1, position: 'relative', zIndex: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography 
                        variant="h6" 
                        component="h3" 
                        noWrap 
                        sx={{ 
                          flexGrow: 1, 
                          mr: 1,
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                        }}
                      >
                        {content.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuClick(e, content)}
                        sx={{
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.1)',
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        <MoreIcon />
                      </IconButton>
                    </Box>
                    
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.4,
                      }}
                    >
                      {content.description || 'Sem descrição disponível'}
                    </Typography>
                    
                    <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                      {content.category && (
                        <Chip
                          size="small"
                          label={content.category}
                          variant="outlined"
                          sx={{
                            borderRadius: 2,
                            fontSize: '0.75rem',
                          }}
                        />
                      )}
                    </Box>
                    
                    <Box 
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 'auto',
                        pt: 1,
                        borderTop: `1px solid ${isDarkMode ? '#333' : '#f0f0f0'}`,
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" fontWeight="bold">
                          {formatFileSize(content.file_size)}
                          {content.duration && ` • ${formatDuration(content.duration)}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {new Date(content.created_at).toLocaleDateString('pt-BR')}
                        </Typography>
                      </Box>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: `${
                            content.content_type === 'video' ? '#f44336' :
                            content.content_type === 'image' ? '#4caf50' :
                            content.content_type === 'audio' ? '#ff9800' :
                            '#2196f3'
                          }20`,
                          color: content.content_type === 'video' ? '#f44336' :
                                 content.content_type === 'image' ? '#4caf50' :
                                 content.content_type === 'audio' ? '#ff9800' :
                                 '#2196f3',
                        }}
                      >
                        {getContentIcon(content.content_type)}
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grow>
            </Grid>
          ))
        )}
      </Grid>

      {contents.length === 0 && !loading && (
        <Fade in={true} timeout={1400}>
          <Paper
            elevation={0}
            sx={{
              textAlign: 'center',
              py: 8,
              px: 4,
              borderRadius: 3,
              background: isDarkMode 
                ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -50,
                right: -50,
                width: 100,
                height: 100,
                background: `radial-gradient(circle, ${isDarkMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(25, 118, 210, 0.1)'} 0%, transparent 70%)`,
              },
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: 'primary.main',
                mx: 'auto',
                mb: 3,
                fontSize: '2rem',
              }}
            >
              <VideoIcon />
            </Avatar>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Nenhum conteúdo encontrado
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={4}>
              Comece adicionando seu primeiro conteúdo à biblioteca
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => navigate('/content/new')}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 'bold',
                px: 4,
                py: 1.5,
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                  : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Adicionar Primeiro Conteúdo
            </Button>
          </Paper>
        </Fade>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <Fade in={true} timeout={1600}>
          <Box 
            display="flex" 
            justifyContent="center" 
            mt={6}
            sx={{
              '& .MuiPagination-root': {
                '& .MuiPaginationItem-root': {
                  borderRadius: 2,
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  },
                  '&.Mui-selected': {
                    background: isDarkMode 
                      ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                      : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                    color: 'white',
                    '&:hover': {
                      background: isDarkMode 
                        ? 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)'
                        : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                    },
                  },
                },
              },
            }}
          >
            <Pagination
              count={totalPages}
              page={page}
              onChange={(e, value) => setPage(value)}
              color="primary"
              size="large"
            />
          </Box>
        </Fade>
      )}

      {/* Menu de Ações */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 200,
            background: isDarkMode 
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
            '& .MuiMenuItem-root': {
              borderRadius: 1,
              mx: 1,
              my: 0.5,
              transition: 'all 0.2s ease',
              '&:hover': {
                background: isDarkMode ? '#333' : '#f5f5f5',
                transform: 'translateX(4px)',
              },
            },
          },
        }}
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
      <Tooltip title="Adicionar novo conteúdo" placement="left">
        <Fab
          color="primary"
          aria-label="add"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: isDarkMode 
              ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
              : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            '&:hover': {
              transform: 'scale(1.1) translateY(-2px)',
              boxShadow: isDarkMode 
                ? '0 12px 35px rgba(255, 152, 0, 0.4)'
                : '0 12px 35px rgba(25, 118, 210, 0.4)',
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1000,
          }}
          onClick={() => navigate('/content/new')}
        >
          <AddIcon />
        </Fab>
      </Tooltip>
    </Box>
  );
};

export default ContentList;
