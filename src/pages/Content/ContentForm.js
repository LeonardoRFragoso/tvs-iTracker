import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
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
import PageTitle from '../../components/Common/PageTitle';

// Limite total por lote (50 MB)
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const ContentForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: [],
    duration: '',
    filename: '',
    content_type: '',
    thumbnail_path: '',
  });
  const [files, setFiles] = useState([]); // suporta múltiplos arquivos
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [totalBytesSelected, setTotalBytesSelected] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
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
        tags: Array.isArray(content.tags) ? content.tags : (content.tags ? [content.tags] : []),
        duration: content.duration || '',
        filename: content.filename || '',
        content_type: content.content_type || '',
        thumbnail_path: content.thumbnail_path || '',
      });
      
      // Set preview using the correct backend endpoints
      if (content.thumbnail_path) {
        setPreview(`${axios.defaults.baseURL}/content/thumbnails/${content.thumbnail_path}`);
      } else if (content.filename && content.content_type?.startsWith('image/')) {
        setPreview(`${axios.defaults.baseURL}/content/media/${content.filename}`);
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

  // Normaliza um content-type (MIME ou simples) para 'image' | 'video' | 'audio' | 'unknown'
  const normalizeContentKind = (t) => {
    if (!t) return 'unknown';
    const s = String(t).toLowerCase();
    if (s.startsWith('image/') || s === 'image') return 'image';
    if (s.startsWith('video/') || s === 'video') return 'video';
    if (s.startsWith('audio/') || s === 'audio') return 'audio';
    return 'unknown';
  };

  // Tipo efetivo para controlar UI (campo de duração)
  const effectiveKind = normalizeContentKind(detectedContentType || formData.content_type || '');
  const showDurationInput = effectiveKind === 'video' || effectiveKind === 'audio';

  const onDrop = (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    // Validação: tamanho total do lote não pode exceder 50MB
    const totalBytes = acceptedFiles.reduce((sum, f) => sum + (f?.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      setError('O tamanho total dos arquivos selecionados excede 50 MB. Selecione um lote menor.');
      setFiles([]);
      setPreview(null);
      return;
    }

    setError('');
    setFiles(acceptedFiles);
    setTotalBytesSelected(totalBytes);
    setCompletedCount(0);
    setSuccessCount(0);
    setErrorCount(0);
    setUploadProgress(0);

    // Para pré-visualização mostramos apenas o primeiro arquivo se for imagem
    const selectedFile = acceptedFiles[0];
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
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv'],
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a']
    },
    multiple: !isEdit, // Múltiplos arquivos apenas para criação, não para edição
    maxFiles: isEdit ? 1 : undefined,
    disabled: loading
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

  const handleRemoveFile = (indexToRemove) => {
    const newFiles = files.filter((_, index) => index !== indexToRemove);
    setFiles(newFiles);
    
    // Recalcular tamanho total
    const totalBytes = newFiles.reduce((sum, f) => sum + (f?.size || 0), 0);
    setTotalBytesSelected(totalBytes);
    
    // Se não há mais arquivos, limpar preview
    if (newFiles.length === 0) {
      setPreview(null);
      setDetectedContentType('');
    } else {
      // Atualizar preview para o primeiro arquivo se for imagem
      const firstFile = newFiles[0];
      if (firstFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result);
        reader.readAsDataURL(firstFile);
      } else {
        setPreview(null);
      }
      setDetectedContentType(firstFile.type);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setCompletedCount(0);
    setSuccessCount(0);
    setErrorCount(0);
    setCurrentIndex(0);
    setUploadProgress(0);

    try {
      // Edição continua permitindo apenas um arquivo
      const targetFiles = isEdit ? (files[0] ? [files[0]] : []) : files;

      // Tags finais: existing chips + texto pendente no campo (se não adicionado como chip)
      const normalizedTags = Array.isArray(formData.tags) ? formData.tags : (formData.tags ? [formData.tags] : []);
      const pending = (tagInput || '').trim();
      const finalTags = Array.from(new Set([...normalizedTags, ...(pending ? [pending] : [])]));

      // Validação: tamanho total do lote
      const totalBytes = targetFiles.reduce((sum, f) => sum + (f?.size || 0), 0);
      if (totalBytes > MAX_TOTAL_BYTES) {
        setError('O tamanho total dos arquivos deste envio excede 50 MB. Divida em lotes menores.');
        return;
      }
      setTotalBytesSelected(totalBytes);

      if (isEdit && targetFiles.length === 0) {
        const payload = {
          title: (formData.title || '').trim(),
          description: formData.description || '',
          tags: finalTags,
        };
        if (formData.duration !== '' && formData.duration !== null && formData.duration !== undefined) {
          payload.duration = formData.duration;
        }
        await axios.put(`/content/${id}`, payload);
        setSuccess('Conteúdo atualizado com sucesso!');
        setTimeout(() => { navigate('/content'); }, 1200);
        return;
      }

      let uploadedSoFar = 0;
      for (let idx = 0; idx < targetFiles.length; idx++) {
        const f = targetFiles[idx];
        const submitData = new FormData();

        const contentType = f ? getContentTypeFromFile(f) : normalizeContentKind(formData.content_type || '');

        Object.keys(formData).forEach(key => {
          if (key === 'tags') {
            submitData.append('tags', JSON.stringify(finalTags));
          } else if (key === 'duration') {
            if (isDurationRequired(contentType) && formData[key]) {
              submitData.append(key, formData[key]);
            }
          } else if (key === 'title') {
            // Se múltiplos arquivos e título vazio, usa nome do arquivo (sem extensão)
            const val = (formData.title || '').trim() || f.name.replace(/\.[^.]+$/, '');
            submitData.append('title', val);
          } else {
            submitData.append(key, formData[key]);
          }
        });

        if (f) submitData.append('file', f);

        const config = {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (pe) => {
            try {
              const overall = Math.round(((uploadedSoFar + pe.loaded) / Math.max(1, totalBytes)) * 100);
              setUploadProgress(Math.min(100, Math.max(0, overall)));
              setCurrentIndex(idx + 1);
            } catch (_) {}
          }
        };

        try {
          if (isEdit) {
            await axios.put(`/content/${id}`, submitData, config);
          } else {
            await axios.post('/content', submitData, config);
          }
          setSuccessCount((s) => s + 1);
        } catch (reqErr) {
          setErrorCount((e) => e + 1);
          // Continua com os demais arquivos
        }

        uploadedSoFar += f?.size || 0;
        setCompletedCount((c) => c + 1);
        setUploadProgress(Math.round((uploadedSoFar / Math.max(1, totalBytes)) * 100));
      }

      setSuccess(isEdit ? 'Conteúdo atualizado com sucesso!' : `Carregado ${targetFiles.length} conteúdo(s) com sucesso!`);
      
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
          ? theme.palette.background.default
          : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        minHeight: '100vh',
        p: 3,
      }}
    >
      {/* Header com PageTitle */}
      <PageTitle 
        title={isEdit ? 'Editar Conteúdo' : 'Novo Conteúdo'}
        subtitle={isEdit ? 'Atualize as informações do conteúdo' : 'Adicione um novo conteúdo à biblioteca de mídia'}
        backTo="/content"
      />

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
                    backgroundColor: (theme) => theme.palette.background.paper,
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
                      background: (theme) => theme.palette.primary.main,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          bgcolor: 'primary.main',
                          color: '#000',
                          mr: 2,
                        }}
                      >
                        <UploadIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {isEdit ? 'Selecionar Arquivo' : 'Selecionar Arquivos'}
                      </Typography>
                    </Box>
                    
                    <Box
                      {...getRootProps()}
                      sx={(theme) => ({
                        border: '2px dashed',
                        borderColor: isDragActive ? theme.palette.primary.main : theme.palette.divider,
                        borderRadius: 3,
                        p: 4,
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: isDragActive
                          ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : theme.palette.action.hover)
                          : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : theme.palette.background.default),
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          borderColor: theme.palette.primary.main,
                          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : theme.palette.action.hover,
                          transform: 'translateY(-2px)',
                          boxShadow: theme.palette.mode === 'dark' ? '0 8px 25px rgba(0,0,0,0.35)' : '0 8px 25px rgba(0,0,0,0.1)',
                        },
                      })}
                    >
                      <input {...getInputProps()} />
                      <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                      {files.length > 0 ? (
                          <Box>
                          <Typography variant="h6" gutterBottom>
                            {files.length === 1 ? files[0].name : `${files.length} arquivos selecionados`}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Tamanho total: {formatFileSize(files.reduce((s,f)=>s+(f?.size||0),0))} (limite: 50 MB)
                            </Typography>
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFiles([]);
                                setPreview(null);
                                setDetectedContentType('');
                                setTotalBytesSelected(0);
                              }}
                              sx={{ 
                                minWidth: 'auto',
                                px: 1,
                                fontSize: '0.75rem',
                                textTransform: 'none'
                              }}
                            >
                              Limpar todos
                            </Button>
                          </Box>
                          {files.length > 1 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                Arquivos selecionados:
                              </Typography>
                              <Box sx={{ mt: 1, maxHeight: 120, overflowY: 'auto' }}>
                                {files.map((file, index) => (
                                  <Box key={index} sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    py: 0.5,
                                    px: 1,
                                    borderRadius: 1,
                                    '&:hover': {
                                      backgroundColor: 'action.hover'
                                    }
                                  }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                      • {file.name} ({formatFileSize(file.size)})
                                    </Typography>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveFile(index);
                                      }}
                                      sx={{ 
                                        ml: 1, 
                                        width: 20, 
                                        height: 20,
                                        '&:hover': {
                                          color: 'error.main'
                                        }
                                      }}
                                    >
                                      <CancelIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          )}
                          </Box>
                      ) : (
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {isEdit ? 'Arraste e solte um arquivo aqui' : 'Arraste e solte arquivos aqui'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {isEdit ? 'Suporte: Imagens, Vídeos, Áudios' : 'Suporte: Múltiplos arquivos • Imagens, Vídeos, Áudios'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {isEdit ? 'Ou clique para selecionar um arquivo' : 'Ou clique para selecionar múltiplos arquivos'}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Botão alternativo para seleção de arquivos */}
                    {!isEdit && (
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.multiple = true;
                            input.accept = 'image/*,video/*,audio/*';
                            input.onchange = (e) => {
                              const selectedFiles = Array.from(e.target.files);
                              if (selectedFiles.length > 0) {
                                onDrop(selectedFiles);
                              }
                            };
                            input.click();
                          }}
                          startIcon={<UploadIcon />}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                            },
                          }}
                        >
                          Selecionar Múltiplos Arquivos
                        </Button>
                      </Box>
                    )}

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
                          sx={(theme) => ({ 
                            height: 8, 
                            borderRadius: 4,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : theme.palette.grey[200],
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 4,
                            }
                          })}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                          Envio do lote: {uploadProgress}% • {completedCount}/{files.length || 1} concluído(s)
                          {successCount + errorCount > 0 && ` • OK: ${successCount} • Erros: ${errorCount}`}
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
                    backgroundColor: (theme) => theme.palette.background.paper,
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
                      background: (theme) => theme.palette.primary.main,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar
                        sx={{
                          bgcolor: 'primary.main',
                          color: '#000',
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
                      
                      
                      
                      {showDurationInput && (
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="duration"
                            label="Duração (segundos)"
                            type="number"
                            value={formData.duration}
                            onChange={handleInputChange}
                            placeholder="Ex: 30"
                            helperText={"Duração em segundos (detectada automaticamente para vídeo/áudio quando possível)"}
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
                      )}
                      
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
                  disabled={loading || (files.length === 0 && !isEdit)}
                  startIcon={<SaveIcon />}
                  sx={{
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                    backgroundColor: 'primary.main',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      transition: 'transform 0.2s ease-in-out',
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
