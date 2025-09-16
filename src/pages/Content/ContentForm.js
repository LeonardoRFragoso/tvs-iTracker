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
  LinearProgress,
  Chip,
  IconButton,
  Fade,
  Grow,
  Avatar,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useTheme } from '../../contexts/ThemeContext';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ContentForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: [],
    duration: '',
    filename: '',
    content_type: '',
    thumbnail_path: '',
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tagInput, setTagInput] = useState('');

  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (isEdit) {
      loadContent();
    }
  }, [id, isEdit]);

  const loadContent = async () => {
    try {
      console.log('Loading content for ID:', id);
      const response = await axios.get(`${API_BASE_URL}/content/${id}`);
      console.log('API Response:', response.data);
      
      const content = response.data.content || response.data; // Handle both formats
      console.log('Content data:', content);
      
      setFormData({
        title: content.title || '',
        description: content.description || '',
        category: content.category || '',
        tags: Array.isArray(content.tags) ? content.tags : (content.tags ? [content.tags] : []),
        duration: content.duration || '',
        filename: content.filename || '',
        content_type: content.content_type || '',
        thumbnail_path: content.thumbnail_path || '',
      });
      
      // Set preview using the correct backend endpoints
      if (content.thumbnail_path) {
        setPreview(`${API_BASE_URL}/content/thumbnails/${content.thumbnail_path}`);
      } else if (content.filename && content.content_type?.startsWith('image/')) {
        setPreview(`${API_BASE_URL}/content/media/${content.filename}`);
      }
    } catch (err) {
      console.error('Load content error:', err);
      console.error('Error response:', err.response?.data);
      setError('Erro ao carregar conteúdo');
    } finally {
      setInitialLoading(false);
    }
  };

  const onDrop = (acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Create preview for images
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv'],
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a'],
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false,
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const submitData = new FormData();
      
      // Add form fields
      Object.keys(formData).forEach(key => {
        if (key === 'tags') {
          submitData.append('tags', JSON.stringify(formData.tags));
        } else {
          submitData.append(key, formData[key]);
        }
      });

      // Add file if present
      if (file) {
        submitData.append('file', file);
      }

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      };

      let response;
      if (isEdit) {
        response = await axios.put(`${API_BASE_URL}/content/${id}`, submitData, config);
      } else {
        response = await axios.post(`${API_BASE_URL}/content`, submitData, config);
      }

      setSuccess(isEdit ? 'Conteúdo atualizado com sucesso!' : 'Conteúdo criado com sucesso!');
      
      // Redirect after success
      setTimeout(() => {
        navigate('/content');
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar conteúdo');
      console.error('Submit error:', err);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (initialLoading) {
    return (
      <Box sx={{ textAlign: 'center', mt: 5 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Fade in={true} timeout={1000}>
      <Box
        sx={{
          background: isDarkMode 
            ? 'linear-gradient(135deg, #121212 0%, #1e1e1e 100%)'
            : 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
          minHeight: '100vh',
          py: 4,
        }}
      >
        <Box
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            px: 3,
          }}
        >
          <Grow in={true} timeout={1200}>
            <Box display="flex" alignItems="center" mb={4}>
              <IconButton 
                onClick={() => navigate('/content')} 
                sx={{ 
                  mr: 2,
                  background: isDarkMode
                    ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                    : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  color: 'white',
                  '&:hover': {
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)'
                      : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                    transform: 'scale(1.1)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <BackIcon />
              </IconButton>
              <Typography 
                variant="h4" 
                component="h1"
                sx={{
                  fontWeight: 'bold',
                  background: isDarkMode
                    ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                    : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {isEdit ? 'Editar Conteúdo' : 'Novo Conteúdo'}
              </Typography>
            </Box>
          </Grow>

          {error && (
            <Fade in={true} timeout={800}>
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 3,
                  border: `1px solid ${isDarkMode ? '#d32f2f' : '#f44336'}`,
                }}
              >
                {error}
              </Alert>
            </Fade>
          )}

          {success && (
            <Fade in={true} timeout={800}>
              <Alert 
                severity="success" 
                sx={{ 
                  mb: 3,
                  borderRadius: 3,
                  border: `1px solid ${isDarkMode ? '#2e7d32' : '#4caf50'}`,
                }}
              >
                {success}
              </Alert>
            </Fade>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Upload Area */}
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1400}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      background: isDarkMode 
                        ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                        : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                      overflow: 'hidden',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: isDarkMode
                          ? 'radial-gradient(circle at 20% 80%, rgba(255, 152, 0, 0.1) 0%, transparent 50%)'
                          : 'radial-gradient(circle at 20% 80%, rgba(25, 118, 210, 0.1) 0%, transparent 50%)',
                        pointerEvents: 'none',
                      },
                    }}
                  >
                    <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                      <Typography variant="h6" gutterBottom fontWeight="bold">
                        {isEdit ? 'Alterar Arquivo' : 'Upload de Arquivo'}
                      </Typography>
                      
                      <Box
                        {...getRootProps()}
                        sx={{
                          border: '2px dashed',
                          borderColor: isDragActive ? 'primary.main' : (isDarkMode ? '#555' : 'grey.300'),
                          borderRadius: 3,
                          p: 4,
                          textAlign: 'center',
                          cursor: 'pointer',
                          bgcolor: isDragActive ? 'action.hover' : 'transparent',
                          mb: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'action.hover',
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        <input {...getInputProps()} />
                        <Avatar
                          sx={{
                            width: 64,
                            height: 64,
                            mx: 'auto',
                            mb: 2,
                            background: isDarkMode
                              ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                              : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                          }}
                        >
                          <UploadIcon sx={{ fontSize: 32 }} />
                        </Avatar>
                        
                        {isDragActive ? (
                          <Typography variant="h6" color="primary">
                            Solte o arquivo aqui...
                          </Typography>
                        ) : (
                          <Box>
                            <Typography variant="h6" gutterBottom fontWeight="bold">
                              Arraste e solte um arquivo aqui
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={1}>
                              ou clique para selecionar
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Suporte: Imagens, Vídeos, Áudios (máx. 500MB)
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {file && (
                        <Fade in={true} timeout={600}>
                          <Box
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              bgcolor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
                              border: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}`,
                            }}
                          >
                            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                              Arquivo Selecionado:
                            </Typography>
                            <Typography variant="body2">
                              {file.name} ({formatFileSize(file.size)})
                            </Typography>
                          </Box>
                        </Fade>
                      )}

                      {preview && (
                        <Fade in={true} timeout={800}>
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                              Preview:
                            </Typography>
                            <Box
                              sx={{
                                borderRadius: 3,
                                overflow: 'hidden',
                                border: `2px solid ${isDarkMode ? '#444' : '#e0e0e0'}`,
                              }}
                            >
                              <img
                                src={preview}
                                alt="Preview"
                                style={{
                                  width: '100%',
                                  maxHeight: 200,
                                  objectFit: 'contain',
                                  display: 'block',
                                }}
                              />
                            </Box>
                          </Box>
                        </Fade>
                      )}

                      {uploadProgress > 0 && (
                        <Fade in={true} timeout={600}>
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" gutterBottom fontWeight="medium">
                              Upload: {uploadProgress}%
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={uploadProgress}
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                bgcolor: isDarkMode ? '#333' : '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 4,
                                  background: isDarkMode
                                    ? 'linear-gradient(90deg, #ff9800 0%, #f57c00 100%)'
                                    : 'linear-gradient(90deg, #1976d2 0%, #1565c0 100%)',
                                },
                              }}
                            />
                          </Box>
                        </Fade>
                      )}
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>

              {/* Form Fields */}
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={1600}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      background: isDarkMode 
                        ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                        : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                      overflow: 'hidden',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: isDarkMode
                          ? 'radial-gradient(circle at 80% 20%, rgba(255, 152, 0, 0.1) 0%, transparent 50%)'
                          : 'radial-gradient(circle at 80% 20%, rgba(25, 118, 210, 0.1) 0%, transparent 50%)',
                        pointerEvents: 'none',
                      },
                    }}
                  >
                    <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                      <Typography variant="h6" gutterBottom fontWeight="bold">
                        Informações do Conteúdo
                      </Typography>

                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Título"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                '&:hover fieldset': {
                                  borderColor: 'primary.main',
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
                                '&:hover fieldset': {
                                  borderColor: 'primary.main',
                                },
                              },
                            }}
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <FormControl fullWidth>
                            <InputLabel>Categoria</InputLabel>
                            <Select
                              name="category"
                              value={formData.category}
                              onChange={handleInputChange}
                              label="Categoria"
                              sx={{
                                borderRadius: 2,
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                  borderColor: 'primary.main',
                                },
                              }}
                            >
                              <MenuItem value="">Selecione uma categoria</MenuItem>
                              <MenuItem value="promocional">Promocional</MenuItem>
                              <MenuItem value="institucional">Institucional</MenuItem>
                              <MenuItem value="entretenimento">Entretenimento</MenuItem>
                              <MenuItem value="informativo">Informativo</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Duração (segundos)"
                            name="duration"
                            type="number"
                            value={formData.duration}
                            onChange={handleInputChange}
                            helperText="Para vídeos e áudios"
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                '&:hover fieldset': {
                                  borderColor: 'primary.main',
                                },
                              },
                            }}
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <Box display="flex" gap={1} mb={2}>
                            <TextField
                              fullWidth
                              label="Adicionar Tag"
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddTag();
                                }
                              }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 2,
                                  '&:hover fieldset': {
                                    borderColor: 'primary.main',
                                  },
                                },
                              }}
                            />
                            <Button 
                              variant="outlined" 
                              onClick={handleAddTag}
                              sx={{
                                borderRadius: 2,
                                px: 3,
                                '&:hover': {
                                  transform: 'scale(1.05)',
                                },
                                transition: 'all 0.2s ease',
                              }}
                            >
                              Adicionar
                            </Button>
                          </Box>
                          
                          <Box display="flex" flexWrap="wrap" gap={1}>
                            {Array.isArray(formData.tags) && formData.tags.map((tag, index) => (
                              <Chip
                                key={index}
                                label={tag}
                                onDelete={() => handleRemoveTag(tag)}
                                size="small"
                                sx={{
                                  borderRadius: 2,
                                  '&:hover': {
                                    transform: 'scale(1.05)',
                                  },
                                  transition: 'all 0.2s ease',
                                }}
                              />
                            ))}
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>

              {/* Actions */}
              <Grid item xs={12}>
                <Grow in={true} timeout={1800}>
                  <Box display="flex" gap={2} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      onClick={() => navigate('/content')}
                      startIcon={<CancelIcon />}
                      sx={{
                        borderRadius: 3,
                        px: 4,
                        py: 1.5,
                        border: `2px solid ${isDarkMode ? '#555' : '#e0e0e0'}`,
                        '&:hover': {
                          border: `2px solid ${isDarkMode ? '#ff9800' : '#1976d2'}`,
                          transform: 'translateY(-2px)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading || (!file && !isEdit) || !formData.title}
                      startIcon={<SaveIcon />}
                      sx={{
                        borderRadius: 3,
                        px: 4,
                        py: 1.5,
                        background: isDarkMode
                          ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                          : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                        '&:hover': {
                          background: isDarkMode
                            ? 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)'
                            : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                          transform: 'translateY(-2px)',
                        },
                        '&:disabled': {
                          background: isDarkMode ? '#333' : '#e0e0e0',
                          color: isDarkMode ? '#666' : '#999',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar')}
                    </Button>
                  </Box>
                </Grow>
              </Grid>
            </Grid>
          </form>
        </Box>
      </Box>
    </Fade>
  );
};

export default ContentForm;
