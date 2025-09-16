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
} from 'chart.js';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
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
    } catch (err) {
      setError('Erro ao carregar dados do dashboard');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
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
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Atividade dos Últimos 7 Dias',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const chartData = performance ? {
    labels: performance.content_per_day?.map(item => 
      new Date(item.date).toLocaleDateString('pt-BR')
    ) || [],
    datasets: [
      {
        label: 'Conteúdo Criado',
        data: performance.content_per_day?.map(item => item.count) || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
      {
        label: 'Campanhas Criadas',
        data: performance.campaigns_per_day?.map(item => item.count) || [],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      },
    ],
  } : null;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <IconButton color="inherit" size="small" onClick={loadDashboardData}>
          <RefreshIcon />
        </IconButton>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Tooltip title="Atualizar dados">
          <IconButton onClick={loadDashboardData}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Status de Saúde do Sistema */}
      {health && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="h6">Status do Sistema</Typography>
              <Chip 
                label={health.status === 'healthy' ? 'Saudável' : 
                      health.status === 'warning' ? 'Atenção' : 'Crítico'}
                color={getHealthColor(health.status)}
              />
              <Typography variant="body2" color="text.secondary">
                {health.overall_health}% de saúde geral
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas Principais */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <ContentIcon color="primary" />
                <Box>
                  <Typography variant="h4">
                    {stats?.overview.total_content || 0}
                  </Typography>
                  <Typography color="text.secondary">
                    Conteúdos
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <CampaignIcon color="primary" />
                <Box>
                  <Typography variant="h4">
                    {stats?.overview.total_campaigns || 0}
                  </Typography>
                  <Typography color="text.secondary">
                    Campanhas
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <PlayerIcon color="primary" />
                <Box>
                  <Typography variant="h4">
                    {stats?.overview.online_players || 0}/{stats?.overview.total_players || 0}
                  </Typography>
                  <Typography color="text.secondary">
                    Players Online
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <StorageIcon color="primary" />
                <Box>
                  <Typography variant="h4">
                    {stats?.storage.percentage.toFixed(1) || 0}%
                  </Typography>
                  <Typography color="text.secondary">
                    Armazenamento
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Gráfico de Performance */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Atividade Recente
              </Typography>
              {chartData && (
                <Box height={300}>
                  <Line options={chartOptions} data={chartData} />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Alertas do Sistema */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Alertas do Sistema
              </Typography>
              {alerts.length === 0 ? (
                <Typography color="text.secondary">
                  Nenhum alerta no momento
                </Typography>
              ) : (
                <List dense>
                  {alerts.slice(0, 5).map((alert, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {getAlertIcon(alert.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={alert.title}
                        secondary={alert.message}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
