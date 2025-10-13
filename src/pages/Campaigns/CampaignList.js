import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Pagination,
  Fab,
  Avatar,
  Fade,
  Grow,
  Skeleton,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Campaign as CampaignIcon,
  Visibility as VisibilityIcon,
  Assessment as AnalyticsIcon,
  AccessTime as AccessTimeIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import axios from '../../config/axios';
import PageTitle from '../../components/Common/PageTitle';

// BR datetime helpers for display
const parseDateTimeFlexible = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.includes('/')) {
      // Expecting DD/MM/YYYY [HH:MM[:SS]]
      const [datePart, timePart] = s.split(' ');
      const [dd, mm, yyyy] = datePart.split('/').map(v => parseInt(v, 10));
      let hh = 0, mi = 0, ss = 0;
      if (timePart) {
        const t = timePart.split(':');
        hh = parseInt(t[0] || '0', 10);
        mi = parseInt(t[1] || '0', 10);
        ss = parseInt(t[2] || '0', 10);
      }
      const d = new Date(yyyy, (mm || 1) - 1, dd || 1, hh, mi, ss);
      return isNaN(d.getTime()) ? null : d;
    }
    const iso = new Date(s);
    if (!isNaN(iso.getTime())) return iso;
  }
  return null;
};

const CampaignList = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, campaign: null });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [filterCompany, setFilterCompany] = useState('');
  const [companies, setCompanies] = useState([]);

  const canDeleteCampaign = (campaign) => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'manager' || campaign.user_id === user.id;
  };

  useEffect(() => {
    loadCampaigns();
  }, [page, searchTerm, filterStatus, filterCompany]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: 10,
        search: searchTerm || undefined,
        // Map frontend filter to backend expected param (is_active)
        ...(filterStatus === 'active' ? { is_active: true } : {}),
        ...(filterStatus === 'inactive' ? { is_active: false } : {}),
        ...(filterCompany ? { company: filterCompany } : {}),
      };

      const response = await axios.get('/campaigns', { params });
      setCampaigns(response.data.campaigns);
      setTotalPages(response.data.pages);
      // Build company list from payload for filter options
      const uniq = Array.from(new Set((response.data.campaigns || []).map(c => c.company).filter(Boolean)));
      setCompanies(uniq);
    } catch (err) {
      setError('Erro ao carregar campanhas');
      console.error('Load campaigns error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/campaigns/${deleteDialog.campaign.id}`);
      setDeleteDialog({ open: false, campaign: null });
      loadCampaigns();
    } catch (err) {
      setError('Erro ao deletar campanha');
      console.error('Delete campaign error:', err);
    }
  };

  const handleStatusToggle = async (campaign) => {
    try {
      setActionLoadingId(campaign.id);
      // Prefer boolean is_active if available; otherwise infer from status string
      const currentActive = typeof campaign.is_active === 'boolean'
        ? campaign.is_active
        : (campaign.status === 'active');
      const newIsActive = !currentActive;

      // Close menu immediately for visual feedback
      handleMenuClose();

      await axios.put(`/campaigns/${campaign.id}`, {
        is_active: newIsActive,
      });

      setSnackbar({
        open: true,
        message: newIsActive ? 'Campanha ativada com sucesso' : 'Campanha pausada com sucesso',
        severity: 'success',
      });

      loadCampaigns();
    } catch (err) {
      console.error('Toggle status error:', err);
      setSnackbar({
        open: true,
        message: 'Erro ao alterar status da campanha',
        severity: 'error',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMenuClick = (event, campaign) => {
    event.stopPropagation(); // Prevent card click from firing
    setAnchorEl(event.currentTarget);
    setSelectedCampaign(campaign);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCampaign(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'scheduled':
        return 'warning';
      case 'expired':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Ativa';
      case 'inactive':
        return 'Inativa';
      case 'scheduled':
        return 'Agendada';
      case 'expired':
        return 'Expirada';
      default:
        return status;
    }
  };

  const getStatusGradient = (status) => {
    switch (status) {
      case 'active':
        return '#34C759 0%, #2ECC71 100%';
      case 'inactive':
        return '#FFC107 0%, #FF9800 100%';
      case 'scheduled':
        return '#FF9800 0%, #FFC107 100%';
      case 'expired':
        return '#E74C3C 0%, #C0392B 100%';
      default:
        return '#2ECC71 0%, #34C759 100%';
    }
  };

  const formatDate = (dateString) => {
    const d = parseDateTimeFlexible(dateString);
    if (!d) return '';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h${remainingMinutes.toString().padStart(2, '0')}m${remainingSeconds.toString().padStart(2, '0')}s`;
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const CampaignCardSkeleton = ({ delay = 0 }) => (
    <Grow in={true} timeout={1000 + delay * 100}>
      <Card sx={{ borderRadius: '16px' }}>
        <Skeleton variant="rectangular" height={200} />
        <CardContent>
          <Skeleton variant="text" width="70%" height={28} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="100%" height={20} sx={{ mb: 2 }} />
          <Box display="flex" gap={1} mb={2}>
            <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: '12px' }} />
            <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: '12px' }} />
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Skeleton variant="text" width={100} />
            <Skeleton variant="circular" width={32} height={32} />
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );

  return (
    <Box>
      {/* Header com PageTitle */}
      <PageTitle 
        title="Gerenciar Campanhas"
        subtitle="Organize e controle suas campanhas de conteúdo"
        icon={<CampaignIcon />}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/campaigns/new')}
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.5,
              background: (theme) => theme.palette.mode === 'dark' 
                ? 'linear-gradient(45deg, #ff7730, #ff9800)' 
                : 'linear-gradient(45deg, #2196F3, #21CBF3)',
              '&:hover': {
                background: (theme) => theme.palette.mode === 'dark' 
                  ? 'linear-gradient(45deg, #ff9800, #ff7730)' 
                  : 'linear-gradient(45deg, #21CBF3, #2196F3)',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 15px rgba(0,0,0,0.1)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            Nova Campanha
          </Button>
        }
      />

      {/* Alerts */}
      {error && (
        <Fade in={true}>
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              background: isDarkMode 
                ? 'rgba(244, 67, 54, 0.1)' 
                : 'rgba(244, 67, 54, 0.05)',
            }} 
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        </Fade>
      )}

      {/* Filters */}
      <Grow in={true} timeout={1200}>
        <Card 
          sx={{ 
            mb: 3,
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            background: isDarkMode 
              ? 'rgba(255, 255, 255, 0.05)' 
              : 'rgba(255, 255, 255, 0.9)',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
            boxShadow: isDarkMode 
              ? '0 8px 32px rgba(0, 0, 0, 0.3)' 
              : '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Buscar campanhas"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      },
                      '&.Mui-focused': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 20px rgba(255, 119, 48, 0.2)',
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Status"
                    sx={{
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      }
                    }}
                  >
                    <MenuItem value="">Todos os status</MenuItem>
                    <MenuItem value="active">Ativas</MenuItem>
                    <MenuItem value="inactive">Inativas</MenuItem>
                    <MenuItem value="scheduled">Agendadas</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Empresa</InputLabel>
                  <Select
                    value={filterCompany}
                    onChange={(e) => { setFilterCompany(e.target.value); setPage(1); }}
                    label="Empresa"
                    sx={{
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      '&:hover': { transform: 'translateY(-1px)' }
                    }}
                  >
                    <MenuItem value="">Todas as empresas</MenuItem>
                    {companies.map(c => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="outlined"
                  startIcon={<FilterIcon />}
                  fullWidth
                  sx={{
                    borderRadius: '12px',
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: 'rgba(255, 119, 48, 0.5)',
                    color: '#ff7730',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: '#ff7730',
                      background: 'rgba(255, 119, 48, 0.05)',
                      transform: 'translateY(-1px)',
                    }
                  }}
                  onClick={loadCampaigns}
                >
                  Filtrar
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grow>

      {/* Campaigns Grid */}
      <Grid container spacing={1.5}>
        {loading ? (
          Array.from({ length: 10 }).map((_, index) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={index}>
              <CampaignCardSkeleton delay={index} />
            </Grid>
          ))
        ) : campaigns.length > 0 ? (
          campaigns.map((campaign, index) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={campaign.id}>
              <Grow in={true} timeout={1400 + index * 100}>
                <Card
                  sx={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
                    boxShadow: isDarkMode 
                      ? '0 8px 32px rgba(0, 0, 0, 0.3)' 
                      : '0 8px 32px rgba(0, 0, 0, 0.1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode 
                        ? '0 16px 48px rgba(0, 0, 0, 0.4)' 
                        : '0 16px 48px rgba(0, 0, 0, 0.15)',
                    }
                  }}
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <Box sx={{ position: 'relative' }}>
                    <CardMedia
                      component="img"
                      height="200"
                      image={campaign.thumbnail ? `${axios.defaults.baseURL}${campaign.thumbnail}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjVmNWY1Ii8+CjxwYXRoIGQ9Ik0xNzUgNzVIMjI1VjEyNUgxNzVWNzVaIiBmaWxsPSIjY2NjY2NjIi8+CjxwYXRoIGQ9Ik0xOTAgMTAwTDIwNSA4NUwyMTAgMTAwTDIwNSAxMTVMMTkwIDEwMFoiIGZpbGw9IiNhYWFhYWEiLz4KPHRleHQgeD0iMjAwIiB5PSIxNTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSI+U2VtIEltYWdlbTwvdGV4dD4KPHN2Zz4='}
                      alt={campaign.name}
                      sx={{
                        transition: 'all 0.3s ease',
                        objectFit: 'cover',
                        backgroundColor: '#f5f5f5',
                        '&:hover': {
                          transform: 'scale(1.05)',
                        }
                      }}
                      onError={(e) => {
                        // Fallback to SVG placeholder if thumbnail fails to load
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjVmNWY1Ii8+CjxwYXRoIGQ9Ik0xNzUgNzVIMjI1VjEyNUgxNzVWNzVaIiBmaWxsPSIjY2NjY2NjIi8+CjxwYXRoIGQ9Ik0xOTAgMTAwTDIwNSA4NUwyMTAgMTAwTDIwNSAxMTVMMTkwIDEwMFoiIGZpbGw9IiNhYWFhYWEiLz4KPHRleHQgeD0iMjAwIiB5PSIxNTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSI+U2VtIEltYWdlbTwvdGV4dD4KPHN2Zz4=';
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: `linear-gradient(135deg, ${getStatusGradient(campaign.status || (campaign.is_active ? 'active' : 'inactive'))})`,
                        opacity: 0.1,
                      }}
                    />
                    <Chip
                      label={getStatusText(campaign.status || (campaign.is_active ? 'active' : 'inactive'))}
                      color={getStatusColor(campaign.status || (campaign.is_active ? 'active' : 'inactive'))}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        backdropFilter: 'blur(10px)',
                        background: 'rgba(255, 255, 255, 0.9)',
                      }}
                    />
                  </Box>
                  
                  <CardContent sx={{ p: 3 }}>
                    <Typography 
                      variant="h6" 
                      component="h3" 
                      sx={{ 
                        mb: 1, 
                        fontWeight: 700,
                        background: isDarkMode 
                          ? 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)'
                          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {campaign.name}
                    </Typography>
                    
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
                      {campaign.description || 'Sem descrição disponível'}
                    </Typography>
                    
                    <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                      <Chip 
                        label={`${campaign.contents?.length || 0} conteúdos`}
                        size="small"
                        sx={{
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                        }}
                      />
                      {campaign.total_video_duration > 0 && (
                        <Chip 
                          icon={<VideocamIcon style={{ color: 'white', fontSize: '0.9rem' }} />}
                          label={formatDuration(campaign.total_video_duration)}
                          size="small"
                          sx={{
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #ff5722 0%, #ff9800 100%)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            '& .MuiChip-icon': {
                              color: 'white !important',
                              marginLeft: '4px',
                            }
                          }}
                          title="Duração total dos vídeos"
                        />
                      )}
                      <Chip 
                        label={formatDate(campaign.created_at)}
                        size="small"
                        sx={{
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                        }}
                      />
                      {campaign.company && (
                        <Chip 
                          label={campaign.company}
                          size="small"
                          sx={{
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                      {campaign.creator_name && (
                        <Chip 
                          label={`por ${campaign.creator_name}`}
                          size="small"
                          sx={{
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                    </Box>
                    
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Atualizada {formatDate(campaign.updated_at)}
                      </Typography>
                      <IconButton
                        onClick={(e) => handleMenuClick(e, campaign)}
                        size="small"
                        sx={{
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                            color: 'white',
                            transform: 'scale(1.1)',
                          }
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grow>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Fade in={true} timeout={1000}>
              <Box 
                textAlign="center" 
                py={8}
                sx={{
                  background: isDarkMode
                    ? 'radial-gradient(circle, rgba(255, 119, 48, 0.05) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(255, 119, 48, 0.02) 0%, transparent 70%)',
                  borderRadius: '16px',
                }}
              >
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    mx: 'auto',
                    mb: 3,
                    background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                    fontSize: '2rem',
                  }}
                >
                  <CampaignIcon sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography 
                  variant="h6" 
                  color="text.secondary" 
                  sx={{ mb: 2, fontWeight: 600 }}
                >
                  Nenhuma campanha encontrada
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}
                >
                  Comece criando sua primeira campanha para organizar e gerenciar seus conteúdos de forma eficiente.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/campaigns/new')}
                  sx={{
                    background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                    borderRadius: '12px',
                    px: 4,
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: '0 4px 20px rgba(255, 119, 48, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 25px rgba(255, 119, 48, 0.4)',
                    }
                  }}
                >
                  Criar Primeira Campanha
                </Button>
              </Box>
            </Fade>
          </Grid>
        )}
      </Grid>

      {/* Pagination */}
      {totalPages > 1 && (
        <Fade in={true} timeout={1800}>
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              color="primary"
              sx={{
                '& .MuiPaginationItem-root': {
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                  },
                  '&.Mui-selected': {
                    background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                    color: 'white',
                  }
                }
              }}
            />
          </Box>
        </Fade>
      )}

      {/* Floating Action Button */}
      <Fade in={true} timeout={2000}>
        <Fab
          color="primary"
          onClick={() => navigate('/campaigns/new')}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
            boxShadow: '0 8px 32px rgba(255, 119, 48, 0.3)',
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
              transform: 'scale(1.1)',
              boxShadow: '0 12px 40px rgba(255, 119, 48, 0.4)',
            }
          }}
        >
          <AddIcon />
        </Fab>
      </Fade>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            backdropFilter: 'blur(20px)',
            background: isDarkMode 
              ? 'rgba(30, 30, 30, 0.9)' 
              : 'rgba(255, 255, 255, 0.9)',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }
        }}
      >
        <MenuItem 
          onClick={() => {
            navigate(`/campaigns/${selectedCampaign?.id}`);
            handleMenuClose();
          }}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(255, 119, 48, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <VisibilityIcon sx={{ mr: 1 }} />
          Visualizar
        </MenuItem>
        <MenuItem 
          onClick={() => {
            navigate(`/campaigns/${selectedCampaign?.id}#analytics`);
            handleMenuClose();
          }}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(33, 150, 243, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <AnalyticsIcon sx={{ mr: 1 }} />
          Analytics
        </MenuItem>
        <MenuItem 
          onClick={() => {
            navigate(`/campaigns/${selectedCampaign?.id}/edit`);
            handleMenuClose();
          }}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(255, 119, 48, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <EditIcon sx={{ mr: 1 }} />
          Editar
        </MenuItem>
        {selectedCampaign && canDeleteCampaign(selectedCampaign) && (
          <MenuItem 
            onClick={() => {
              setDeleteDialog({ open: true, campaign: selectedCampaign });
              handleMenuClose();
            }}
            sx={{
              borderRadius: '8px',
              mx: 1,
              my: 0.5,
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'rgba(244, 67, 54, 0.1)',
                transform: 'translateX(4px)',
                color: 'error.main',
              }
            }}
          >
            <DeleteIcon sx={{ mr: 1 }} />
            Deletar
          </MenuItem>
        )}
        <MenuItem 
          onClick={() => handleStatusToggle(selectedCampaign)}
          disabled={Boolean(selectedCampaign && actionLoadingId === selectedCampaign.id)}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(255, 119, 48, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          {(typeof selectedCampaign?.is_active === 'boolean' 
            ? selectedCampaign.is_active 
            : selectedCampaign?.status === 'active') ? (
            <>
              <PauseIcon sx={{ mr: 1 }} />
              Pausar
            </>
          ) : (
            <>
              <PlayIcon sx={{ mr: 1 }} />
              Ativar
            </>
          )}
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialog.open} 
        onClose={() => setDeleteDialog({ open: false, campaign: null })}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            background: isDarkMode 
              ? 'rgba(30, 30, 30, 0.9)' 
              : 'rgba(255, 255, 255, 0.9)',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja deletar a campanha "{deleteDialog.campaign?.name}"?
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setDeleteDialog({ open: false, campaign: null })}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Deletar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CampaignList;
