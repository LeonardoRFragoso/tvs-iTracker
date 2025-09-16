import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  LinearProgress,
  Avatar,
  Fade,
  Grow,
  Paper,
  Divider,
  Fab,
  Skeleton,
  Badge,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Snackbar,
  AlertTitle,
  Button,
  Menu,
  MenuItem,
  ListItemButton,
} from '@mui/material';
import {
  VideoLibrary as ContentIcon,
  Campaign as CampaignIcon,
  Tv as PlayerIcon,
  Schedule as ScheduleIcon,
  RssFeed as EditorialIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Storage as StorageIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  PlayArrow as PlayIcon,
  Settings as SettingsIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  GetApp as ExportIcon,
  Notifications as NotificationIcon,
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
} from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Skeleton loading component for stat cards
const StatCardSkeleton = ({ delay = 0 }) => (
  <Grow in={true} timeout={1000 + delay * 200}>
    <Card sx={{ height: '100%', p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Skeleton variant="circular" width={56} height={56} />
        <Skeleton variant="text" width={60} height={20} />
      </Box>
      <Skeleton variant="text" width="80%" height={40} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="40%" height={16} />
    </Card>
  </Grow>
);

// Enhanced StatCard component with animations and gradients
const StatCard = ({ icon, title, value, subtitle, color, trend, delay = 0, previousValue }) => {
  const { isDarkMode } = useTheme();
  
  const gradients = {
    primary: isDarkMode 
      ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
      : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
    success: isDarkMode
      ? 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)'
      : 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
    warning: isDarkMode
      ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
      : 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
    info: isDarkMode
      ? 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)'
      : 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)',
  };

  // Calculate trend direction
  const getTrendIcon = () => {
    if (!trend) return null;
    const isPositive = trend.includes('+') || trend.includes('↑');
    const isNegative = trend.includes('-') || trend.includes('↓');
    
    if (isPositive) return <TrendingUpIcon fontSize="small" />;
    if (isNegative) return <TrendingDownIcon fontSize="small" />;
    return <RemoveIcon fontSize="small" />;
  };

  const getTrendColor = () => {
    if (!trend) return 'inherit';
    const isPositive = trend.includes('+') || trend.includes('↑');
    const isNegative = trend.includes('-') || trend.includes('↓');
    
    if (isPositive) return '#4caf50';
    if (isNegative) return '#f44336';
    return 'inherit';
  };

  return (
    <Grow in={true} timeout={1000 + delay * 200}>
      <Card
        sx={{
          height: '100%',
          background: gradients[color] || gradients.primary,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px) scale(1.02)',
            boxShadow: isDarkMode 
              ? '0 12px 35px rgba(255, 152, 0, 0.4)'
              : '0 12px 35px rgba(0, 0, 0, 0.25)',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.1)',
            opacity: 0,
            transition: 'opacity 0.3s ease',
          },
          '&:hover::before': {
            opacity: 1,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: -50,
            right: -50,
            width: 100,
            height: 100,
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            transition: 'all 0.5s ease',
          },
          '&:hover::after': {
            transform: 'scale(1.5)',
            opacity: 0,
          },
        }}
      >
        <CardContent sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Avatar
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                width: 56,
                height: 56,
                transition: 'all 0.3s ease',
              }}
            >
              {icon}
            </Avatar>
            {trend && (
              <Box 
                display="flex" 
                alignItems="center" 
                gap={0.5}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 2,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Box sx={{ color: getTrendColor() }}>
                  {getTrendIcon()}
                </Box>
                <Typography variant="caption" fontWeight="bold">
                  {trend}
                </Typography>
              </Box>
            )}
          </Box>
          <Typography 
            variant="h3" 
            component="div" 
            fontWeight="bold" 
            mb={1}
            sx={{
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              transition: 'all 0.3s ease',
              color: isDarkMode ? '#ffffff' : 'inherit',
            }}
          >
            {value}
          </Typography>
          <Typography variant="h6" mb={1} sx={{ opacity: 0.95 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              {subtitle}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Grow>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const { user } = useAuth();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    let interval;
    if (autoRefresh && user) {
      interval = setInterval(() => {
        loadDashboardData(true); // Silent refresh
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, user]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'r':
            event.preventDefault();
            loadDashboardData();
            showNotification('Dashboard atualizado!', 'success');
            break;
          case 'e':
            event.preventDefault();
            exportData('json');
            break;
          case 'h':
            event.preventDefault();
            setKeyboardShortcutsOpen(true);
            break;
          case '1':
            event.preventDefault();
            window.location.href = '/content/new';
            break;
          case '2':
            event.preventDefault();
            window.location.href = '/campaigns/new';
            break;
          case '3':
            event.preventDefault();
            window.location.href = '/players/new';
            break;
          case '4':
            event.preventDefault();
            window.location.href = '/schedules/new';
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Show notification function
  const showNotification = (message, severity = 'info', duration = 4000) => {
    const id = Date.now();
    const notification = {
      id,
      message,
      severity,
      open: true,
    };
    
    setNotifications(prev => [...prev, notification]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  };

  // Close notification
  const handleCloseNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Export data functionality
  const exportData = (format) => {
    try {
      const exportData = {
        stats,
        alerts,
        performance,
        health,
        timestamp: new Date().toISOString(),
      };

      if (format === 'json') {
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `dashboard-data-${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        showNotification('Dados exportados com sucesso!', 'success');
      } else if (format === 'csv') {
        // Simple CSV export for stats
        const csvContent = [
          ['Métrica', 'Valor'],
          ['Total de Conteúdos', stats?.overview.total_content || 0],
          ['Total de Campanhas', stats?.overview.total_campaigns || 0],
          ['Players Online', `${stats?.overview.online_players || 0}/${stats?.overview.total_players || 0}`],
          ['Armazenamento Usado', `${stats?.storage.percentage?.toFixed(1) || 0}%`],
          ['Status do Sistema', health?.status || 'N/A'],
          ['Saúde Geral', `${health?.overall_health || 0}%`],
        ].map(row => row.join(',')).join('\n');
        
        const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        const exportFileDefaultName = `dashboard-stats-${new Date().toISOString().split('T')[0]}.csv`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        showNotification('Relatório CSV exportado!', 'success');
      }
    } catch (error) {
      showNotification('Erro ao exportar dados', 'error');
    }
    setExportMenuAnchor(null);
  };

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [statsRes, alertsRes, performanceRes, healthRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/dashboard/stats`),
        axios.get(`${API_BASE_URL}/dashboard/alerts`),
        axios.get(`${API_BASE_URL}/dashboard/performance`),
        axios.get(`${API_BASE_URL}/dashboard/health`),
      ]);

      setStats(statsRes.data);
      setAlerts(alertsRes.data.alerts);
      setPerformance(performanceRes.data);
      setHealth(healthRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Erro ao carregar dados do dashboard');
      console.error('Dashboard error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: isDarkMode ? '#ff9800' : '#000000',
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: 'bold',
          },
        },
      },
      title: {
        display: true,
        text: 'Atividade dos Últimos 7 Dias',
        color: isDarkMode ? '#ff9800' : '#000000',
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: 20,
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        titleColor: isDarkMode ? '#ff9800' : '#000000',
        bodyColor: isDarkMode ? '#ffffff' : '#666666',
        borderColor: isDarkMode ? '#333333' : '#e0e0e0',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: isDarkMode ? '#ffffff' : '#666666',
          font: {
            size: 11,
          },
        },
        grid: {
          color: isDarkMode ? '#333333' : '#e0e0e0',
          drawBorder: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: isDarkMode ? '#ffffff' : '#666666',
          font: {
            size: 11,
          },
        },
        grid: {
          color: isDarkMode ? '#333333' : '#e0e0e0',
          drawBorder: false,
        },
      },
    },
    elements: {
      line: {
        tension: 0.4,
      },
      point: {
        radius: 6,
        hoverRadius: 8,
        borderWidth: 2,
      },
    },
  };

  const chartData = performance ? {
    labels: performance.content_per_day?.map(item => 
      new Date(item.date).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      })
    ) || [],
    datasets: [
      {
        label: 'Conteúdo Criado',
        data: performance.content_per_day?.map(item => item.count) || [],
        borderColor: isDarkMode ? '#ff9800' : '#1976d2',
        backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(25, 118, 210, 0.1)',
        fill: true,
        borderWidth: 3,
      },
      {
        label: 'Campanhas Criadas',
        data: performance.campaigns_per_day?.map(item => item.count) || [],
        borderColor: isDarkMode ? '#ffffff' : '#dc004e',
        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(220, 0, 78, 0.1)',
        fill: true,
        borderWidth: 3,
      },
    ],
  } : null;

  const speedDialActions = [
    { icon: <UploadIcon />, name: 'Novo Conteúdo', onClick: () => window.location.href = '/content/new' },
    { icon: <CampaignIcon />, name: 'Nova Campanha', onClick: () => window.location.href = '/campaigns/new' },
    { icon: <PlayerIcon />, name: 'Novo Player', onClick: () => window.location.href = '/players/new' },
    { icon: <ScheduleIcon />, name: 'Novo Agendamento', onClick: () => window.location.href = '/schedules/new' },
  ];

  if (loading) {
    return (
      <Box>
        <Fade in={true} timeout={800}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
            <Box>
              <Skeleton variant="text" width={200} height={48} />
              <Skeleton variant="text" width={300} height={24} />
            </Box>
            <Skeleton variant="circular" width={56} height={56} />
          </Box>
        </Fade>

        <Skeleton variant="rectangular" width="100%" height={120} sx={{ mb: 4, borderRadius: 3 }} />

        <Grid container spacing={3} mb={4}>
          {[0, 1, 2, 3].map((index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <StatCardSkeleton delay={index} />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 3 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ borderRadius: 2 }}
        action={
          <IconButton color="inherit" size="small" onClick={loadDashboardData}>
            <RefreshIcon />
          </IconButton>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Fade in={true} timeout={800}>
        <Grow in={true} timeout={1000}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
            <Box display="flex" alignItems="center">
              <Avatar
                sx={{
                  background: 'linear-gradient(135deg, #ff7730 0%, #ff9800 100%)',
                  mr: 2,
                  width: 48,
                  height: 48,
                }}
              >
                <TimelineIcon />
              </Avatar>
              <Typography 
                variant="h4" 
                component="h1"
                sx={{
                  fontWeight: 700,
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)'
                    : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Dashboard
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <Tooltip title="Atalhos do teclado (Ctrl+H)">
                <IconButton 
                  onClick={() => setKeyboardShortcutsOpen(true)}
                  sx={{
                    bgcolor: 'info.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'info.dark',
                    },
                  }}
                >
                  <KeyboardIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Exportar dados">
                <IconButton 
                  onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                  sx={{
                    bgcolor: 'secondary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'secondary.dark',
                    },
                  }}
                >
                  <ExportIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={autoRefresh ? 'Desativar atualização automática' : 'Ativar atualização automática'}>
                <IconButton 
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  sx={{
                    bgcolor: autoRefresh ? 'success.main' : 'action.disabled',
                    color: 'white',
                    '&:hover': {
                      bgcolor: autoRefresh ? 'success.dark' : 'action.hover',
                    },
                  }}
                >
                  <PlayIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Atualizar dados">
                <IconButton 
                  onClick={() => loadDashboardData()}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      transform: 'rotate(180deg)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Grow>
      </Fade>

      {/* Status de Saúde do Sistema */}
      {health && (
        <Fade in={true} timeout={1000}>
          <Paper
            elevation={0}
            sx={{
              mb: 4,
              p: 3,
              borderRadius: 3,
              background: isDarkMode 
                ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
              border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: health.status === 'healthy' ? 'linear-gradient(90deg, #4caf50, #81c784)' :
                           health.status === 'warning' ? 'linear-gradient(90deg, #ff9800, #ffb74d)' :
                           'linear-gradient(90deg, #f44336, #e57373)',
              },
            }}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={3}>
                <Badge
                  badgeContent={health.overall_health}
                  color={health.status === 'healthy' ? 'success' : 
                         health.status === 'warning' ? 'warning' : 'error'}
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: health.status === 'healthy' ? 'success.main' : 
                              health.status === 'warning' ? 'warning.main' : 'error.main',
                      width: 56,
                      height: 56,
                    }}
                  >
                    <CheckCircleIcon />
                  </Avatar>
                </Badge>
                <Box>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Status do Sistema
                  </Typography>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Chip 
                      label={health.status === 'healthy' ? 'Saudável' : 
                            health.status === 'warning' ? 'Atenção' : 'Crítico'}
                      color={getHealthColor(health.status)}
                      sx={{ fontWeight: 'bold' }}
                    />
                    <Typography variant="body1" color="text.secondary">
                      {health.overall_health}% de saúde geral
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ width: 200 }}>
                <LinearProgress
                  variant="determinate"
                  value={health.overall_health}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: isDarkMode ? '#333' : '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                    },
                  }}
                />
              </Box>
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Estatísticas Principais */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<ContentIcon />}
            title="Conteúdos"
            value={stats?.overview.total_content || 0}
            subtitle="Total de mídias"
            color="primary"
            trend="+12%"
            delay={0}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<CampaignIcon />}
            title="Campanhas"
            value={stats?.overview.total_campaigns || 0}
            subtitle="Campanhas ativas"
            color="success"
            trend="+8%"
            delay={1}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<PlayerIcon />}
            title="Players Online"
            value={`${stats?.overview.online_players || 0}/${stats?.overview.total_players || 0}`}
            subtitle="Dispositivos conectados"
            color="info"
            trend="98%"
            delay={2}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<StorageIcon />}
            title="Armazenamento"
            value={`${stats?.storage.percentage.toFixed(1) || 0}%`}
            subtitle="Espaço utilizado"
            color="warning"
            trend="Normal"
            delay={3}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Gráfico de Performance */}
        <Grid item xs={12} md={8}>
          <Fade in={true} timeout={1200}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                height: 400,
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
                  <TimelineIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    Atividade Recente
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Evolução de conteúdo e campanhas
                  </Typography>
                </Box>
              </Box>
              {chartData && (
                <Box height={300}>
                  <Line options={chartOptions} data={chartData} />
                </Box>
              )}
            </Paper>
          </Fade>
        </Grid>

        {/* Alertas do Sistema */}
        <Grid item xs={12} md={4}>
          <Fade in={true} timeout={1400}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                height: 400,
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
              }}
            >
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Badge badgeContent={alerts.length} color="error">
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <WarningIcon />
                  </Avatar>
                </Badge>
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    Alertas do Sistema
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Notificações importantes
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {alerts.length === 0 ? (
                <Box 
                  display="flex" 
                  flexDirection="column" 
                  alignItems="center" 
                  justifyContent="center"
                  height={200}
                >
                  <CheckCircleIcon 
                    sx={{ 
                      fontSize: 48, 
                      color: 'success.main',
                      mb: 2 
                    }} 
                  />
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    Tudo funcionando!
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Nenhum alerta no momento
                  </Typography>
                </Box>
              ) : (
                <List dense sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {alerts.slice(0, 5).map((alert, index) => (
                    <Grow in={true} timeout={1000 + index * 100} key={index}>
                      <ListItem
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          bgcolor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
                          '&:hover': {
                            bgcolor: isDarkMode ? '#333' : '#e0e0e0',
                            transform: 'translateX(4px)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <ListItemIcon>
                          {getAlertIcon(alert.type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" fontWeight="bold">
                              {alert.title}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {alert.message}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </Grow>
                  ))}
                </List>
              )}
            </Paper>
          </Fade>
        </Grid>
      </Grid>

      {/* Speed Dial for Quick Actions */}
      <SpeedDial
        ariaLabel="Ações rápidas"
        sx={{ 
          position: 'fixed', 
          bottom: 24, 
          right: 24,
          '& .MuiFab-primary': {
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          },
        }}
        icon={<SpeedDialIcon />}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
            sx={{
              '& .MuiFab-primary': {
                bgcolor: isDarkMode ? '#333' : '#fff',
                color: isDarkMode ? '#ff9800' : '#1976d2',
                '&:hover': {
                  bgcolor: isDarkMode ? '#444' : '#f5f5f5',
                },
              },
            }}
          />
        ))}
      </SpeedDial>

      {/* Notifications */}
      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={notification.open}
          autoHideDuration={6000}
          onClose={() => handleCloseNotification(notification.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            severity={notification.severity} 
            variant="filled" 
            sx={{ borderRadius: 2 }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 200,
            background: isDarkMode 
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
          },
        }}
      >
        <MenuItem onClick={() => exportData('json')}>
          <ListItemIcon>
            <ExportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Exportar JSON" secondary="Dados completos" />
        </MenuItem>
        <MenuItem onClick={() => exportData('csv')}>
          <ListItemIcon>
            <ExportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Exportar CSV" secondary="Relatório resumido" />
        </MenuItem>
      </Menu>

      {/* Keyboard Shortcuts Dialog */}
      <Snackbar
        open={keyboardShortcutsOpen}
        autoHideDuration={8000}
        onClose={() => setKeyboardShortcutsOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity="info" 
          variant="filled"
          sx={{ 
            borderRadius: 2,
            minWidth: 400,
          }}
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setKeyboardShortcutsOpen(false)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <AlertTitle>Atalhos do Teclado</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            <li><strong>Ctrl+R:</strong> Atualizar dashboard</li>
            <li><strong>Ctrl+E:</strong> Exportar dados (JSON)</li>
            <li><strong>Ctrl+H:</strong> Mostrar atalhos</li>
            <li><strong>Ctrl+1:</strong> Novo conteúdo</li>
            <li><strong>Ctrl+2:</strong> Nova campanha</li>
            <li><strong>Ctrl+3:</strong> Novo player</li>
            <li><strong>Ctrl+4:</strong> Novo agendamento</li>
          </Box>
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;
