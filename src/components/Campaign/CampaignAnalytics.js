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
  Grow
} from '@mui/material';
import {
  TrendingUp as TrendingIcon,
  PlayArrow as PlayIcon,
  Timer as TimerIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
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
import axios from '../../config/axios';
import { useTheme } from '../../contexts/ThemeContext';

const CampaignAnalytics = ({ campaignId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('7d');
  const { theme } = useTheme();

  // Colors for charts
  const chartColors = {
    axis: '#666666',
    grid: '#e0e0e0',
    text: '#000000',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e0e0e0',
  };

  const pieColors = [
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.secondary.main,
  ];

  // Reusable card style
  const cardSx = {
    borderRadius: 2,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    height: '100%',
    transition: 'transform 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
    }
  };

  useEffect(() => {
    if (campaignId) {
      loadAnalytics();
    }
  }, [campaignId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.get(`/campaigns/${campaignId}/analytics`, {
        params: { range: timeRange }
      });

      setAnalytics(response.data || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar analytics da campanha');
      console.error('Load analytics error:', err);
      setAnalytics(null);
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
      <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!analytics) {
    return (
      <Box textAlign="center" py={2}>
        <Typography variant="body1" color="text.secondary">
          Nenhum dado de analytics disponível
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Filtro de período */}
      <Box display="flex" justifyContent="flex-end" mb={3}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Período</InputLabel>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            label="Período"
            sx={{
              borderRadius: 2,
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
            }}
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
          <Grow in={true} timeout={1000}>
            <Card sx={cardSx}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {analytics.summary.total_executions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Execuções Totais
                </Typography>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Grow in={true} timeout={1100}>
            <Card sx={cardSx}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {formatSuccessRate(analytics.summary.success_rate)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Taxa de Sucesso
                </Typography>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Grow in={true} timeout={1200}>
            <Card sx={cardSx}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {analytics.summary.unique_players}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Players Únicos
                </Typography>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Grow in={true} timeout={1300}>
            <Card sx={cardSx}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {formatDuration(analytics.summary.total_duration)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tempo Total
                </Typography>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Grow in={true} timeout={1400}>
            <Card sx={cardSx}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="secondary.main">
                  {analytics.summary.avg_content_duration}s
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Duração Média
                </Typography>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Performance por Conteúdo */}
        <Grid item xs={12} lg={8}>
          <Grow in={true} timeout={1500}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performance por Conteúdo
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.content_performance}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fill: chartColors.axis }} stroke={chartColors.grid} />
                    <YAxis tick={{ fill: chartColors.axis }} stroke={chartColors.grid} />
                    <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, color: chartColors.text }} labelStyle={{ color: chartColors.text }} itemStyle={{ color: chartColors.text }} />
                    <Bar dataKey="executions" fill={theme.palette.primary.main} name="Execuções" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        {/* Distribuição por Tipo */}
        <Grid item xs={12} lg={4}>
          <Grow in={true} timeout={1600}>
            <Card sx={cardSx}>
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
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, color: chartColors.text }} labelStyle={{ color: chartColors.text }} itemStyle={{ color: chartColors.text }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        {/* Timeline de Execuções */}
        <Grid item xs={12}>
          <Grow in={true} timeout={1700}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Timeline de Execuções
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.execution_timeline}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: chartColors.axis }} stroke={chartColors.grid} />
                    <YAxis tick={{ fill: chartColors.axis }} stroke={chartColors.grid} />
                    <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, color: chartColors.text }} labelStyle={{ color: chartColors.text }} itemStyle={{ color: chartColors.text }} />
                    <Area type="monotone" dataKey="executions" stackId="1" stroke={theme.palette.primary.main} fill={theme.palette.primary.main} fillOpacity={0.3} name="Total" />
                    <Area type="monotone" dataKey="success" stackId="2" stroke={theme.palette.success.main} fill={theme.palette.success.main} fillOpacity={0.3} name="Sucesso" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        {/* Performance por Player */}
        <Grid item xs={12} md={6}>
          <Grow in={true} timeout={1800}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                  <DevicesIcon />
                  Performance por Player
                </Typography>
                <List>
                  {analytics.player_performance.map((player, index) => (
                    <ListItem key={index}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
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
                              sx={{ mt: 1, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { backgroundColor: theme.palette.success.main } }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        {/* Horários de Pico */}
        <Grid item xs={12} md={6}>
          <Grow in={true} timeout={1900}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon />
                  Horários de Pico
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analytics.peak_hours}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tick={{ fill: chartColors.axis }} stroke={chartColors.grid} />
                    <YAxis tick={{ fill: chartColors.axis }} stroke={chartColors.grid} />
                    <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, color: chartColors.text }} labelStyle={{ color: chartColors.text }} itemStyle={{ color: chartColors.text }} />
                    <Line type="monotone" dataKey="executions" stroke={theme.palette.primary.main} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        {/* Top Conteúdos */}
        <Grid item xs={12}>
          <Grow in={true} timeout={2000}>
            <Card sx={cardSx}>
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
          </Grow>
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
