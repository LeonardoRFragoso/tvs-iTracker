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
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Snackbar,
  AlertTitle,
  Button,
} from '@mui/material';
import {
  VideoLibrary as ContentIcon,
  Campaign as CampaignIcon,
  Tv as PlayerIcon,
  Schedule as ScheduleIcon,
  RssFeed as EditorialIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  Add as AddIcon,
  Keyboard as KeyboardIcon,
  Upload as UploadIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  LocationOn as LocationIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon,
  Dashboard as DashboardIcon,
  Close as CloseIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from '../config/axios';
import PageTitle from '../components/Common/PageTitle';
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

// Skeleton loading component for stat cards
const StatCardSkeleton = ({ delay = 0 }) => (
  <Grow in={true} timeout={1000 + delay * 200}>
    <Card sx={{ height: '100%', p: 1.5 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Skeleton variant="circular" width={44} height={44} />
        <Skeleton variant="text" width={60} height={20} />
      </Box>
      <Skeleton variant="text" width="80%" height={32} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="60%" height={20} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="40%" height={14} />
    </Card>
  </Grow>
);

// Enhanced StatCard component with animations and gradients
const StatCard = ({ icon, title, value, subtitle, color, trend, delay = 0, previousValue, onClick, navigateTo }) => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (navigateTo) {
      navigate(navigateTo);
    }
  };
  
  const gradients = {
    primary: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
    success: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
    warning: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
    info: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)',
  };

  // Calculate trend direction
  const getTrendIcon = () => {
    if (!trend) return null;
    const isPositive = trend.includes('+') || trend.includes('↑');
    const isNegative = trend.includes('-') || trend.includes('↓');
    
    if (isPositive) return <TrendingUpIcon fontSize="small" />;
    if (isNegative) return <TrendingDownIcon fontSize="small" />;
    // Usar o ícone Remove importado
    return <Remove fontSize="small" />;
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
        onClick={handleClick}
        sx={{
          height: '100%',
          background: (theme) => theme.palette.mode === 'dark' ? theme.palette.background.paper : (gradients[color] || gradients.primary),
          cursor: (onClick || navigateTo) ? 'pointer' : 'default',
          color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : 'white',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: (onClick || navigateTo) ? 'translateY(-4px) scale(1.02)' : 'none',
            boxShadow: (onClick || navigateTo) ? 
              ((theme) => theme.palette.mode === 'dark' ? '0 12px 35px rgba(255, 152, 0, 0.3)' : '0 12px 35px rgba(0, 0, 0, 0.25)') : 
              'none',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: (theme) => theme.palette.mode === 'dark' ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
            opacity: (theme) => theme.palette.mode === 'dark' ? 0 : 0,
            transition: 'opacity 0.3s ease',
          },
          '&:hover::before': {
            opacity: (theme) => theme.palette.mode === 'dark' ? 0 : 1,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: -50,
            right: -50,
            width: 100,
            height: 100,
            background: (theme) => theme.palette.mode === 'dark' ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            transition: 'all 0.5s ease',
            display: (theme) => theme.palette.mode === 'dark' ? 'none' : 'block',
          },
          '&:hover::after': {
            transform: (theme) => theme.palette.mode === 'dark' ? 'none' : 'scale(1.5)',
            opacity: (theme) => theme.palette.mode === 'dark' ? 1 : 0,
          },
        }}
      >
        <CardContent sx={{ position: 'relative', zIndex: 1, p: 1.5 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Avatar
              sx={{
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                color: (theme) => theme.palette.mode === 'dark' ? '#ff9800' : 'white',
                width: 36,
                height: 36,
                border: (theme) => theme.palette.mode === 'dark' ? '2px solid rgba(255, 152, 0, 0.3)' : '2px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              {icon}
            </Avatar>
            
            {/* Indicador de navegação */}
            {(onClick || navigateTo) && (
              <ChevronRightIcon 
                sx={{ 
                  color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                  fontSize: 18,
                  opacity: 0.8,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    opacity: 1,
                    transform: 'translateX(2px)',
                  }
                }} 
              />
            )}
            {trend && (
              <Box 
                display="flex" 
                alignItems="center" 
                gap={0.5}
                sx={{
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 1.5,
                  px: 0.75,
                  py: 0.25,
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
            variant="h5" 
            component="div" 
            fontWeight="bold" 
            mb={0.25}
            sx={{
              textShadow: (theme) => theme.palette.mode === 'dark' ? 'none' : '0 2px 4px rgba(0,0,0,0.3)',
              transition: 'all 0.3s ease',
              color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : 'inherit',
              fontSize: '1.5rem',
            }}
          >
            {value}
          </Typography>
          <Typography variant="body1" mb={0.25} sx={{ opacity: 0.95, fontSize: '0.9rem', fontWeight: 500 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ opacity: 0.85, fontSize: '0.75rem' }}>
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
  // Removido: alertas do sistema não são mais exibidos
  // const [alerts, setAlerts] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [health, setHealth] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [playbackStatus, setPlaybackStatus] = useState(null);
  const [diskUsage, setDiskUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const { user } = useAuth();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Auto-refresh removido - apenas refresh manual

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'r':
            event.preventDefault();
            loadDashboardData();
            showNotification('Dashboard atualizado!', 'success');
            break;
          case 'h':
            event.preventDefault();
            setKeyboardShortcutsOpen(true);
            break;
          default:
            break;
        }
      }
    };

    const handleShowShortcuts = () => {
      setKeyboardShortcutsOpen(true);
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('showKeyboardShortcuts', handleShowShortcuts);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('showKeyboardShortcuts', handleShowShortcuts);
    };
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

  // Função de exportação removida - apenas refresh manual disponível

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const requests = [
        axios.get('/dashboard/stats'),
        // Removido: /dashboard/alerts
        axios.get('/dashboard/performance'),
        axios.get('/dashboard/health'),
        axios.get('/dashboard/playback-status'),
        axios.get('/dashboard/disk-usage'),
      ];

      const includeTraffic = user?.role === 'admin';
      if (includeTraffic) {
        requests.push(axios.get('/monitor/traffic'));
      }

      const results = await Promise.allSettled(requests);
      const [statsRes, performanceRes, healthRes, playbackRes, diskUsageRes, trafficRes] = results;

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      // Removido: atualização de estado de alertas
      // if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data.alerts || []);
      if (performanceRes.status === 'fulfilled') {
        console.log('[Dashboard] Performance data loaded:', performanceRes.value.data);
        setPerformance(performanceRes.value.data);
      } else {
        console.error('[Dashboard] Failed to load performance data:', performanceRes.reason);
      }
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
      
      if (playbackRes.status === 'fulfilled') {
        console.log('[Dashboard] Playback status loaded:', playbackRes.value.data);
        setPlaybackStatus(playbackRes.value.data);
      } else {
        console.error('[Dashboard] Failed to load playback status:', playbackRes.reason);
      }

      if (diskUsageRes.status === 'fulfilled') {
        setDiskUsage(diskUsageRes.value.data);
      } else {
        console.error('[Dashboard] Failed to load disk usage:', diskUsageRes.reason);
        // Não bloquear o dashboard se disk usage falhar
        setDiskUsage(null);
      }

      if (includeTraffic) {
        if (trafficRes?.status === 'fulfilled') {
          setTraffic(trafficRes.value.data);
        } else {
          // 403 (FORBIDDEN) ou outro erro de tráfego: não bloquear o dashboard
          setTraffic(null);
        }
      } else {
        // Não-admins (manager/HR) não consultam tráfego admin
        setTraffic(null);
      }

      setError('');
      setLastUpdated(new Date());
    } catch (err) {
      // Como usamos allSettled, só erros inesperados devem cair aqui
      console.error('Dashboard error (fatal):', err);
      setError('Erro ao carregar dados do dashboard');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Removido: ícones de alerta não são mais utilizados

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
          color: isDarkMode ? '#ffffff' : '#000000',
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
        color: isDarkMode ? '#ffffff' : '#000000',
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: 20,
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        titleColor: isDarkMode ? '#ffffff' : '#000000',
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

  const chartData = performance ? (() => {
    // Criar conjunto unificado de datas de ambos os datasets
    const allDates = new Set();
    
    // Adicionar datas de conteúdo
    performance.content_per_day?.forEach(item => allDates.add(item.date));
    
    // Adicionar datas de campanhas
    performance.campaigns_per_day?.forEach(item => allDates.add(item.date));
    
    // Converter para array ordenado
    const sortedDates = Array.from(allDates).sort();
    
    console.log('[Dashboard] Datas disponíveis:', sortedDates);
    console.log('[Dashboard] Dados de conteúdo:', performance.content_per_day);
    console.log('[Dashboard] Dados de campanhas:', performance.campaigns_per_day);
    
    // Criar labels formatados
    const labels = sortedDates.map(date => 
      new Date(date).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      })
    );
    
    // Criar dados de conteúdo alinhados com as datas
    const contentData = sortedDates.map(date => {
      const item = performance.content_per_day?.find(item => item.date === date);
      return item ? item.count : 0;
    });
    
    // Criar dados de campanhas alinhados com as datas
    const campaignData = sortedDates.map(date => {
      const item = performance.campaigns_per_day?.find(item => item.date === date);
      return item ? item.count : 0;
    });
    
    console.log('[Dashboard] Labels:', labels);
    console.log('[Dashboard] Content data:', contentData);
    console.log('[Dashboard] Campaign data:', campaignData);
    
    return {
      labels,
      datasets: [
        {
          label: 'Conteúdo Criado',
          data: contentData,
          borderColor: isDarkMode ? '#ff9800' : '#1976d2',
          backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(25, 118, 210, 0.1)',
          fill: true,
          borderWidth: 3,
        },
        {
          label: 'Campanhas Criadas',
          data: campaignData,
          borderColor: isDarkMode ? '#ffffff' : '#dc004e',
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(220, 0, 78, 0.1)',
          fill: true,
          borderWidth: 3,
        },
      ],
    };
  })() : null;

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
            <Box display="flex" alignItems="center">
              <Skeleton variant="circular" width={48} height={48} sx={{ mr: 2 }} />
              <Skeleton variant="text" width={200} height={40} />
            </Box>
            <Box display="flex" gap={1}>
              <Skeleton variant="circular" width={40} height={40} />
              <Skeleton variant="circular" width={40} height={40} />
              <Skeleton variant="circular" width={40} height={40} />
              <Skeleton variant="circular" width={40} height={40} />
            </Box>
          </Box>
        </Fade>
        <Grid container spacing={2}>
          {Array.from({ length: 8 }, (_, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <StatCardSkeleton delay={index} />
            </Grid>
          ))}
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
          <Button color="inherit" size="small" onClick={() => loadDashboardData()}>
            Tentar novamente
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header com PageTitle */}
      <PageTitle 
        title="Painel de Controle"
        subtitle="Visão geral do sistema e estatísticas em tempo real"
        icon={<DashboardIcon />}
        actions={
          <>
            <Tooltip title="Atalhos do teclado (Ctrl+H)">
              <IconButton 
                onClick={() => setKeyboardShortcutsOpen(true)}
                sx={{
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'info.main',
                  color: (theme) => theme.palette.mode === 'dark' ? 'white' : 'white',
                  '&:hover': {
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'info.dark',
                  },
                }}
              >
                <KeyboardIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Atualizar dados">
              <IconButton 
                onClick={() => loadDashboardData()}
                sx={{
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'primary.dark',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </>
        }
      />

      {/* Estatísticas */}
      <Grid container spacing={1.5} mb={2.5}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            icon={<ContentIcon />}
            title="Conteúdos"
            value={stats?.overview.total_content || 0}
            subtitle="Total de mídias"
            color="primary"
            trend="+12%"
            delay={0}
            navigateTo="/content"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            icon={<CampaignIcon />}
            title="Campanhas"
            value={stats?.overview.total_campaigns || 0}
            subtitle="Campanhas ativas"
            color="success"
            trend="+8%"
            delay={1}
            navigateTo="/campaigns"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            icon={<PlayIcon />}
            title="Players Reproduzindo"
            value={`${playbackStatus?.summary?.playing_players || 0}/${playbackStatus?.summary?.online_players || 0}`}
            subtitle={`Taxa: ${playbackStatus?.summary?.playback_rate || 0}%`}
            color="success"
            trend={playbackStatus?.summary?.ghost_players > 0 ? `⚠ ${playbackStatus?.summary?.ghost_players} fantasma` : "✓ Normal"}
            delay={2}
            navigateTo="/players"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            icon={<StorageIcon />}
            title="Armazenamento"
            value={`${stats?.storage.percentage.toFixed(1) || 0}%`}
            subtitle="Espaço utilizado"
            color="warning"
            trend="Normal"
            delay={3}
            navigateTo="/content"
          />
        </Grid>

        {/* KPI: Status dos Players */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            icon={<PlayerIcon />}
            title="Status dos Players"
            value={`${playbackStatus?.summary?.online_players || 0}/${playbackStatus?.summary?.total_players || 0}`}
            subtitle={`${playbackStatus?.summary?.idle_players || 0} parados, ${playbackStatus?.summary?.offline_players || 0} offline`}
            color="info"
            trend={`${((playbackStatus?.summary?.online_players || 0) / Math.max(playbackStatus?.summary?.total_players || 1, 1) * 100).toFixed(0)}% online`}
            delay={4}
            navigateTo="/players"
          />
        </Grid>

        {/* KPI: Uso de Rede (detecção de sobreuso) */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          {(() => {
            const overuseCount = traffic?.overuse_players?.length || 0;
            const recentPlayers = traffic?.recent?.players || {};
            const totalBytesPerMin = Object.values(recentPlayers).reduce((acc, p) => acc + (p?.bytes_per_min || 0), 0);
            const totalMBPerMin = totalBytesPerMin / (1024 * 1024);
            const windowMin = traffic?.recent_window_min || 1;
            const value = overuseCount > 0 ? `${overuseCount} em excesso` : 'Normal';
            const subtitle = `${totalMBPerMin.toFixed(1)} MB/min (janela ${windowMin}min)`;
            return (
              <StatCard
                icon={<TrendingUpIcon />}
                title="Rede"
                value={value}
                subtitle={subtitle}
                color={overuseCount > 0 ? 'warning' : 'info'}
                trend={overuseCount > 0 ? `↑ ${overuseCount}` : 'OK'}
                delay={5}
                navigateTo="/admin/traffic-monitor"
              />
            );
          })()}
        </Grid>

        {/* KPI: Espaço de Upload */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            icon={<UploadIcon />}
            title="Espaço de Upload"
            value={diskUsage ? `${diskUsage.uploads?.percentage || 0}%` : 'Carregando...'}
            subtitle={diskUsage ? `${diskUsage.uploads?.size_gb || 0}GB / ${diskUsage.uploads?.max_gb || 100}GB` : 'Calculando...'}
            color={
              !diskUsage ? 'info' :
              (diskUsage.uploads?.status === 'critical') ? 'error' :
              (diskUsage.uploads?.status === 'warning') ? 'warning' :
              (diskUsage.uploads?.status === 'caution') ? 'info' : 'success'
            }
            trend={
              !diskUsage ? '⏳ Carregando' :
              diskUsage.uploads?.status === 'critical' ? '🚨 Crítico' :
              diskUsage.uploads?.status === 'warning' ? '⚠️ Alto' :
              diskUsage.uploads?.status === 'caution' ? '📊 Moderado' : '✅ Normal'
            }
            delay={6}
            navigateTo="/content"
          />
        </Grid>

        {/* KPI: Espaço de Vídeos Compilados */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            icon={<CampaignIcon />}
            title="Vídeos Compilados"
            value={diskUsage ? `${diskUsage.compiled_videos?.percentage || 0}%` : 'Carregando...'}
            subtitle={diskUsage ? `${diskUsage.compiled_videos?.size_gb || 0}GB / ${diskUsage.compiled_videos?.max_gb || 100}GB` : 'Calculando...'}
            color={
              !diskUsage ? 'info' :
              (diskUsage.compiled_videos?.status === 'critical') ? 'error' :
              (diskUsage.compiled_videos?.status === 'warning') ? 'warning' :
              (diskUsage.compiled_videos?.status === 'caution') ? 'info' : 'success'
            }
            trend={
              !diskUsage ? '⏳ Carregando' :
              diskUsage.compiled_videos?.status === 'critical' ? '🚨 Crítico' :
              diskUsage.compiled_videos?.status === 'warning' ? '⚠️ Alto' :
              diskUsage.compiled_videos?.status === 'caution' ? '📊 Moderado' : '✅ Normal'
            }
            delay={7}
            navigateTo="/campaigns"
          />
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        {/* Gráfico de Performance */}
        <Grid item xs={12} md={8}>
          <Fade in={true} timeout={1200}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                height: 300,
                background: (theme) => theme.palette.mode === 'dark' ? theme.palette.background.paper : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
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
                  background: (theme) => theme.palette.mode === 'dark' ? 'transparent' : `radial-gradient(circle, rgba(25, 118, 210, 0.1) 0%, transparent 70%)`,
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                  <TimelineIcon sx={{ fontSize: '1.2rem' }} />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Atividade Recente
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Evolução de conteúdo e campanhas
                  </Typography>
                </Box>
              </Box>
              {chartData ? (
                <Box height={240}>
                  <Line options={chartOptions} data={chartData} />
                </Box>
              ) : (
                <Box height={240} display="flex" alignItems="center" justifyContent="center">
                  <Typography variant="body2" color="text.secondary">
                    {performance ? 'Processando dados do gráfico...' : 'Carregando dados de atividade...'}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Fade>
        </Grid>

        {/* Removido: Alertas do Sistema */}

        {/* Detalhes dos Players Reproduzindo */}
        {playbackStatus && playbackStatus.summary?.playing_players > 0 && (
          <Grid item xs={12}>
            <Fade in={true} timeout={1600}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  background: (theme) => theme.palette.mode === 'dark' ? theme.palette.background.paper : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                  border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                }}
              >
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <PlayIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      Players Ativos ({playbackStatus.summary?.playing_players})
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Conteúdo sendo reproduzido em tempo real
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {playbackStatus.players
                    .filter(player => player.status === 'playing')
                    .slice(0, 6) // Mostrar apenas os primeiros 6 para não sobrecarregar
                    .map((player, index) => (
                      <Grid item xs={12} sm={6} md={4} key={player.id}>
                        <Grow in={true} timeout={1000 + index * 100}>
                          <Card
                            sx={{
                              borderRadius: 2,
                              bgcolor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
                              border: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}`,
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: 3,
                              },
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <Avatar sx={{ width: 24, height: 24, bgcolor: 'success.main' }}>
                                  <PlayIcon fontSize="small" />
                                </Avatar>
                                <Typography variant="subtitle2" fontWeight="bold" noWrap>
                                  {player.name}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary" noWrap mb={1}>
                                📍 {player.location_name}
                              </Typography>
                              {player.current_content && (
                                <>
                                  <Typography variant="body2" fontWeight="bold" noWrap mb={0.5}>
                                    🎬 {player.current_content.title}
                                  </Typography>
                                  {player.current_content.campaign_name && (
                                    <Typography variant="caption" color="primary" noWrap mb={0.5}>
                                      📋 {player.current_content.campaign_name}
                                    </Typography>
                                  )}
                                  <Typography variant="caption" color="text.secondary">
                                    {player.current_content.playlist_position} • {player.current_content.type}
                                  </Typography>
                                </>
                              )}
                            </CardContent>
                          </Card>
                        </Grow>
                      </Grid>
                    ))}
                </Grid>
                {playbackStatus.summary?.playing_players > 6 && (
                  <Box textAlign="center" mt={2}>
                    <Typography variant="body2" color="text.secondary">
                      ... e mais {playbackStatus.summary?.playing_players - 6} players reproduzindo
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Grid>
        )}

        {/* Alertas de Players Fantasma */}
        {playbackStatus && playbackStatus.ghost_players?.length > 0 && (
          <Grid item xs={12}>
            <Fade in={true} timeout={1800}>
              <Alert 
                severity="warning" 
                sx={{ 
                  borderRadius: 3,
                  '& .MuiAlert-message': { width: '100%' }
                }}
              >
                <AlertTitle>⚠️ Players Fantasma Detectados ({playbackStatus.ghost_players?.length || 0})</AlertTitle>
                <Typography variant="body2" mb={2}>
                  Os seguintes players estão online mas não estão reproduzindo conteúdo:
                </Typography>
                <Grid container spacing={1}>
                  {playbackStatus.ghost_players?.map((ghost, index) => (
                    <Grid item xs={12} sm={6} md={4} key={ghost.id}>
                      <Box 
                        sx={{ 
                          p: 1, 
                          bgcolor: 'rgba(255, 152, 0, 0.1)', 
                          borderRadius: 1,
                          border: '1px solid rgba(255, 152, 0, 0.3)'
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="bold">
                          {ghost.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {ghost.reason}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Alert>
            </Fade>
          </Grid>
        )}

        {/* Alertas de Espaço em Disco */}
        {diskUsage && diskUsage.alerts?.length > 0 && (
          <Grid item xs={12}>
            <Fade in={true} timeout={2000}>
              <Alert 
                severity={diskUsage.alerts.some(alert => alert.type === 'error') ? 'error' : 'warning'}
                sx={{ 
                  borderRadius: 3,
                  '& .MuiAlert-message': { width: '100%' }
                }}
              >
                <AlertTitle>
                  {diskUsage.alerts.some(alert => alert.type === 'error') ? '🚨' : '⚠️'} 
                  {' '}Alertas de Espaço em Disco ({diskUsage.alerts?.length || 0})
                </AlertTitle>
                <Typography variant="body2" mb={2}>
                  Atenção necessária para evitar problemas de armazenamento:
                </Typography>
                <Grid container spacing={2}>
                  {diskUsage.alerts?.map((alert, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Box 
                        sx={{ 
                          p: 2, 
                          bgcolor: alert.type === 'error' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(255, 152, 0, 0.1)', 
                          borderRadius: 2,
                          border: alert.type === 'error' ? '1px solid rgba(244, 67, 54, 0.3)' : '1px solid rgba(255, 152, 0, 0.3)'
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                          {alert.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={1}>
                          {alert.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          💡 {alert.recommendation}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={Math.min(alert.percentage, 100)}
                            sx={{ 
                              height: 6, 
                              borderRadius: 3,
                              bgcolor: 'rgba(255, 255, 255, 0.3)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                bgcolor: alert.type === 'error' ? '#f44336' : '#ff9800'
                              }
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {alert.percentage.toFixed(1)}% utilizado
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Alert>
            </Fade>
          </Grid>
        )}
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
