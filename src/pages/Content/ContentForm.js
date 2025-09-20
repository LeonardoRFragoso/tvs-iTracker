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
  Container,
  Paper,
  Skeleton,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon,
  VideoLibrary as VideoIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import axios from '../../config/axios';

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
  const [detectedContentType, setDetectedContentType] = useState('');

  useEffect(() => {
    if (isEdit) {
      loadContent();
    }
  }, [id, isEdit]);

  const loadContent = async () => {
    try {
      console.log('Loading content for ID:', id);
      const response = await axios.get(`/content/${id}`);
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
        setPreview(`${axios.defaults.baseURL.replace(/\/api$/, '')}/content/thumbnails/${content.thumbnail_path}`);
      } else if (content.filename && content.content_type?.startsWith('image/')) {
        setPreview(`${axios.defaults.baseURL.replace(/\/api$/, '')}/content/media/${content.filename}`);
      }
    } catch (err) {
      console.error('Load content error:', err);
      console.error('Error response:', err.response?.data);
      setError('Erro ao carregar conteúdo');
    } finally {
      setInitialLoading(false);
    }
  };

  const getContentTypeFromFile = (file) => {
    const type = file.type;
    if (type.startsWith('image/')) {
      return 'image';
    } else if (type.startsWith('video/')) {
      return 'video';
    } else if (type.startsWith('audio/')) {
      return 'audio';
    } else {
      return 'unknown';
    }
  };

  const isDurationRequired = (contentType) => {
    return contentType === 'video' || contentType === 'audio';
  };

  const onDrop = (acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      const contentType = getContentTypeFromFile(selectedFile);
      setDetectedContentType(selectedFile.type);
      
      // Set default duration based on content type
      if (contentType === 'image') {
        setFormData(prev => ({ ...prev, duration: '' })); // Images don't need duration
      } else if (contentType === 'video' || contentType === 'audio') {
        setFormData(prev => ({ ...prev, duration: prev.duration || '' })); // Keep existing or empty for user input
      }
      
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
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a']
    },
    multiple: false
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
      
      // Get content type from file
      const contentType = file ? getContentTypeFromFile(file) : 'text';
      
      // Add form fields
      Object.keys(formData).forEach(key => {
        if (key === 'tags') {
          submitData.append('tags', JSON.stringify(formData.tags));
        } else if (key === 'duration') {
          // Only include duration for video and audio files
          if (isDurationRequired(contentType) && formData[key]) {
            submitData.append(key, formData[key]);
          }
          // For images, don't send duration at all - backend will set default
          return;
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
        response = await axios.put(`/content/${id}`, submitData, config);
      } else {
        response = await axios.post(`/content`, submitData, config);
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

  return (
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
            onClick={() => navigate('/content')} 
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
              {isEdit ? 'Editar Conteúdo' : 'Novo Conteúdo'}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {isEdit ? 'Modifique as configurações do conteúdo' : 'Configure um novo conteúdo para suas campanhas'}
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
            {/* Enhanced Upload Card */}
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
                        <UploadIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Selecionar Arquivo
                      </Typography>
                    </Box>
                    
                    <Box
                      {...getRootProps()}
                      sx={{
                        border: '2px dashed',
                        borderColor: isDragActive ? 'primary.main' : 'grey.300',
                        borderRadius: 3,
                        p: 4,
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: isDragActive ? 'primary.50' : 'grey.50',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                        },
                      }}
                    >
                      <input {...getInputProps()} />
                      <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                      {file ? (
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {file.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatFileSize(file.size)}
                          </Typography>
                        </Box>
                      ) : (
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Arraste e solte um arquivo aqui
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Suporte: Imagens, Vídeos, Áudios
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {preview && (
                      <Box sx={{ mt: 3, textAlign: 'center' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Preview:
                        </Typography>
                        <img
                          src={preview}
                          alt="Preview"
                          style={{
                            maxWidth: '100%',
                            maxHeight: 200,
                            borderRadius: 12,
                            boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                          }}
                        />
                      </Box>
                    )}

                    {uploadProgress > 0 && (
                      <Box sx={{ mt: 3 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={uploadProgress}
                          sx={{ 
                            height: 8, 
                            borderRadius: 4,
                            bgcolor: 'grey.200',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 4,
                            }
                          }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                          Upload: {uploadProgress}%
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Enhanced Information Card */}
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
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          background: (theme) => theme.palette.mode === 'dark'
                            ? 'linear-gradient(45deg, #ff7730, #ff9800)'
                            : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                          mr: 2,
                        }}
                      >
                        <VideoIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Informações do Conteúdo
                      </Typography>
                    </Box>

                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          required
                          name="title"
                          label="Título"
                          value={formData.title}
                          onChange={handleInputChange}
                          placeholder="Ex: Logo da Empresa"
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
                          name="description"
                          label="Descrição"
                          value={formData.description}
                          onChange={handleInputChange}
                          multiline
                          rows={3}
                          placeholder="Descrição do conteúdo..."
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
                        <FormControl fullWidth>
                          <InputLabel>Categoria</InputLabel>
                          <Select
                            name="category"
                            value={formData.category}
                            onChange={handleInputChange}
                            label="Categoria"
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s ease-in-out',
                              },
                            }}
                          >
                            <MenuItem value="institucional">Institucional</MenuItem>
                            <MenuItem value="promocional">Promocional</MenuItem>
                            <MenuItem value="informativo">Informativo</MenuItem>
                            <MenuItem value="entretenimento">Entretenimento</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          name="duration"
                          label="Duração (segundos)"
                          type="number"
                          value={formData.duration}
                          onChange={handleInputChange}
                          placeholder="Ex: 30"
                          helperText={
                            detectedContentType.startsWith('image/') 
                              ? "Imagens têm duração automática" 
                              : "Duração em segundos"
                          }
                          disabled={detectedContentType.startsWith('image/')}
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
                          label="Adicionar Tag"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          placeholder="Digite uma tag e pressione Enter"
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
                        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {formData.tags.map((tag, index) => (
                            <Chip
                              key={index}
                              label={tag}
                              onDelete={() => handleRemoveTag(tag)}
                              color="primary"
                              variant="outlined"
                              sx={{ borderRadius: 2 }}
                            />
                          ))}
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Paper>
              </Grow>
            </Grid>

            {/* Actions */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/content')}
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
                  disabled={loading || (!file && !isEdit)}
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
            </Grid>
          </Grid>
        </form>
      )}
    </Box>
  );
};

export default ContentForm;
