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
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
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
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/content')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Editar Conteúdo' : 'Novo Conteúdo'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Upload Area */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {isEdit ? 'Alterar Arquivo' : 'Upload de Arquivo'}
                </Typography>
                
                <Box
                  {...getRootProps()}
                  sx={{
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                    mb: 2,
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                  
                  {isDragActive ? (
                    <Typography>Solte o arquivo aqui...</Typography>
                  ) : (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Arraste e solte um arquivo aqui
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ou clique para selecionar
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        Suporte: Imagens, Vídeos, Áudios (máx. 500MB)
                      </Typography>
                    </Box>
                  )}
                </Box>

                {file && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Arquivo Selecionado:
                    </Typography>
                    <Typography variant="body2">
                      {file.name} ({formatFileSize(file.size)})
                    </Typography>
                  </Box>
                )}

                {preview && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Preview:
                    </Typography>
                    <img
                      src={preview}
                      alt="Preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        objectFit: 'contain',
                        border: '1px solid #ddd',
                        borderRadius: 4,
                      }}
                    />
                  </Box>
                )}

                {uploadProgress > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Upload: {uploadProgress}%
                    </Typography>
                    <LinearProgress variant="determinate" value={uploadProgress} />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Form Fields */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Informações do Conteúdo
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Título"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
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
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Box display="flex" gap={1} mb={1}>
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
                      />
                      <Button variant="outlined" onClick={handleAddTag}>
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
                        />
                      ))}
                    </Box>
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
                onClick={() => navigate('/content')}
                startIcon={<CancelIcon />}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || (!file && !isEdit) || !formData.title}
                startIcon={<SaveIcon />}
              >
                {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar')}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default ContentForm;
