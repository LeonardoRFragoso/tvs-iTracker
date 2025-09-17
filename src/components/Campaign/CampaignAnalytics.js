import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper
} from '@mui/material';
import {
  TrendingUp as TrendingIcon,
  PlayArrow as PlayIcon,
  Timer as TimerIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
  Assessment as AnalyticsIcon,
  Movie as VideoIcon,
  Image as ImageIcon,
  AudioFile as AudioIcon,
  Devices as DevicesIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const CampaignAnalytics = ({ campaignId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    if (campaignId) {
      loadAnalytics();
    }
  }, [campaignId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Simular dados de analytics (em produção, viria de uma API real)
      const mockAnalytics = {
        summary: {
          total_executions: 156,
          total_duration: 2340, // em minutos
          unique_players: 8,
          success_rate: 94.2,
          avg_content_duration: 15
        },
        content_performance: [
          { name: 'Vídeo Promocional', executions: 45, success_rate: 96.8, avg_duration: 30, type: 'video' },
          { name: 'Banner Principal', executions: 38, success_rate: 98.2, avg_duration: 10, type: 'image' },
          { name: 'Música Ambiente', executions: 32, success_rate: 89.5, avg_duration: 120, type: 'audio' },
          { name: 'Slideshow Produtos', executions: 28, success_rate: 92.1, avg_duration: 20, type: 'image' },
          { name: 'Vídeo Institucional', executions: 13, success_rate: 100, avg_duration: 45, type: 'video' }
        ],
        content_type_distribution: [
          { name: 'Vídeos', value: 58, count: 2 },
          { name: 'Imagens', value: 66, count: 2 },
          { name: 'Áudios', value: 32, count: 1 }
        ],
        execution_timeline: [
          { date: '2025-09-10', executions: 12, success: 11 },
          { date: '2025-09-11', executions: 18, success: 17 },
          { date: '2025-09-12', executions: 22, success: 21 },
          { date: '2025-09-13', executions: 25, success: 23 },
          { date: '2025-09-14', executions: 28, success: 26 },
          { date: '2025-09-15', executions: 31, success: 30 },
          { date: '2025-09-16', executions: 20, success: 19 }
        ],
        player_performance: [
          { name: 'Chromecast Escritório', executions: 45, success_rate: 97.8 },
          { name: 'TV Recepção', executions: 38, success_rate: 94.7 },
          { name: 'Monitor Sala 1', executions: 32, success_rate: 90.6 },
          { name: 'Display Entrada', executions: 28, success_rate: 96.4 },
          { name: 'Painel Corredor', executions: 13, success_rate: 100 }
        ],
        peak_hours: [
          { hour: '08:00', executions: 8 },
          { hour: '09:00', executions: 12 },
          { hour: '10:00', executions: 15 },
          { hour: '11:00', executions: 18 },
          { hour: '12:00', executions: 22 },
          { hour: '13:00', executions: 25 },
          { hour: '14:00', executions: 28 },
          { hour: '15:00', executions: 24 },
          { hour: '16:00', executions: 20 },
          { hour: '17:00', executions: 16 },
          { hour: '18:00', executions: 12 }
        ]
      };

      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAnalytics(mockAnalytics);

    } catch (err) {
      setError('Erro ao carregar analytics da campanha');
      console.error('Load analytics error:', err);
    } finally {
      setLoading(false);
    }
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
        return <PlayIcon />;
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatSuccessRate = (rate) => {
    return `${rate.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Box>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary" align="center">
          Carregando analytics...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  if (!analytics) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body1" color="text.secondary">
          Nenhum dado de analytics disponível
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" display="flex" alignItems="center" gap={1}>
          <AnalyticsIcon />
          Analytics da Campanha
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Período</InputLabel>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            label="Período"
          >
            <MenuItem value="1d">Último dia</MenuItem>
            <MenuItem value="7d">Últimos 7 dias</MenuItem>
            <MenuItem value="30d">Últimos 30 dias</MenuItem>
            <MenuItem value="90d">Últimos 90 dias</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Resumo Geral */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {analytics.summary.total_executions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Execuções Totais
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {formatSuccessRate(analytics.summary.success_rate)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Taxa de Sucesso
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {analytics.summary.unique_players}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Players Únicos
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {formatDuration(analytics.summary.total_duration)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tempo Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="secondary.main">
                {analytics.summary.avg_content_duration}s
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Duração Média
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Performance por Conteúdo */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance por Conteúdo
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.content_performance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="executions" fill="#8884d8" name="Execuções" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Distribuição por Tipo */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distribuição por Tipo
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.content_type_distribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.content_type_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Timeline de Execuções */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Timeline de Execuções
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.execution_timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="executions" stackId="1" stroke="#8884d8" fill="#8884d8" name="Total" />
                  <Area type="monotone" dataKey="success" stackId="2" stroke="#82ca9d" fill="#82ca9d" name="Sucesso" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance por Player */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <DevicesIcon />
                Performance por Player
              </Typography>
              <List>
                {analytics.player_performance.map((player, index) => (
                  <ListItem key={index}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {player.name.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={player.name}
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {player.executions} execuções • {formatSuccessRate(player.success_rate)} sucesso
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={player.success_rate}
                            sx={{ mt: 1 }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Horários de Pico */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <ScheduleIcon />
                Horários de Pico
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analytics.peak_hours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="executions" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Conteúdos */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <TrendingIcon />
                Top Conteúdos por Performance
              </Typography>
              <List>
                {analytics.content_performance
                  .sort((a, b) => b.success_rate - a.success_rate)
                  .slice(0, 5)
                  .map((content, index) => (
                    <ListItem key={index}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: getContentTypeColor(content.type) }}>
                          {getContentIcon(content.type)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1">
                              {content.name}
                            </Typography>
                            <Chip 
                              label={`#${index + 1}`} 
                              size="small" 
                              color="primary" 
                            />
                          </Box>
                        }
                        secondary={
                          <Box display="flex" alignItems="center" gap={2}>
                            <Typography variant="body2">
                              {content.executions} execuções
                            </Typography>
                            <Typography variant="body2">
                              {formatSuccessRate(content.success_rate)} sucesso
                            </Typography>
                            <Typography variant="body2">
                              {content.avg_duration}s duração
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

const getContentTypeColor = (type) => {
  switch (type) {
    case 'video':
      return 'primary.main';
    case 'image':
      return 'secondary.main';
    case 'audio':
      return 'success.main';
    default:
      return 'grey.500';
  }
};

export default CampaignAnalytics;
