import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Fade,
  Grow,
  Skeleton,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  Wifi as WifiIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';
import axios from '../../config/axios';

const StatCard = ({ icon, label, value, color = 'primary', delay = 0 }) => (
  <Grid item xs={12} sm={6} md={3}>
    <Grow in={true} timeout={1000 + delay * 200}>
      <Card sx={{ borderRadius: 3, color: 'white', background: (theme) => theme.palette[color].main }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h4" fontWeight="bold">{value}</Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>{label}</Typography>
            </Box>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.25)', width: 56, height: 56 }}>
              {icon}
            </Avatar>
          </Box>
        </CardContent>
      </Card>
    </Grow>
  </Grid>
);

const LocationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const [location, setLocation] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [locRes, statsRes] = await Promise.all([
        axios.get(`/locations/${id}`),
        axios.get(`/locations/${id}/stats`),
      ]);
      setLocation(locRes.data.location);
      setStats(statsRes.data);
    } catch (e) {
      // Leave basic error handling to UI fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [id]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  const formatPeak = (start, end) => {
    if (!start || !end) return 'Não definido';
    return `${start} - ${end}`;
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="text" width={320} height={48} />
        <Skeleton variant="rectangular" width="100%" height={300} sx={{ mt: 2, borderRadius: 3 }} />
      </Box>
    );
  }

  if (!location) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Sede não encontrada</Typography>
      </Box>
    );
  }

  const onlinePct = stats?.player_stats?.online_percentage || 0;
  const totalPlayers = stats?.player_stats?.total_players || 0;
  const onlinePlayers = stats?.player_stats?.online_players || 0;
  const usedGb = stats?.storage_stats?.used_storage_gb || 0;
  const totalGb = stats?.storage_stats?.total_storage_gb || 0;
  const storagePct = stats?.storage_stats?.usage_percentage || 0;

  return (
    <Fade in={true} timeout={800}>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => navigate('/locations')} sx={{ bgcolor: 'primary.main', color: 'white' }}>
              <BackIcon />
            </IconButton>
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
              <LocationIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight="bold">{location.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {location.city}, {location.state} • {location.address || 'Endereço não informado'}
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Atualizar">
            <span>
              <IconButton onClick={onRefresh} disabled={refreshing} sx={{ bgcolor: 'info.main', color: 'white' }}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Summary cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <StatCard icon={<BusinessIcon />} label="Empresa" value={location.company || '—'} color="primary" />
          <StatCard icon={<ComputerIcon />} label="Players" value={`${onlinePlayers}/${totalPlayers}`} color="success" delay={1} />
          <StatCard icon={<WifiIcon />} label="Online" value={`${onlinePct.toFixed(0)}%`} color="info" delay={2} />
          <StatCard icon={<StorageIcon />} label="Armazenamento" value={`${usedGb.toFixed(1)}/${totalGb.toFixed(1)} GB`} color="warning" delay={3} />
        </Grid>

        {/* Details panel */}
        <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle2" color="text.secondary">Empresa:</Typography>
                <Chip label={location.company || '—'} size="small" />
              </Box>
              <Box mt={1} display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle2" color="text.secondary">Timezone:</Typography>
                <Typography variant="body2">{location.timezone}</Typography>
              </Box>
              <Box mt={1} display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle2" color="text.secondary">Horário de Pico:</Typography>
                <Typography variant="body2">{formatPeak(location.peak_hours_start, location.peak_hours_end)}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle2" color="text.secondary">Status:</Typography>
                <Chip label={location.is_active ? 'Ativa' : 'Inativa'} color={location.is_active ? 'success' : 'error'} size="small" />
              </Box>
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">Uso de Armazenamento</Typography>
                <LinearProgress variant="determinate" value={storagePct} sx={{ height: 6, borderRadius: 2 }} />
                <Typography variant="caption" color="text.secondary">{storagePct.toFixed(0)}%</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Players quick table placeholder: could be extended later */}
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
              <ComputerIcon fontSize="small" />
            </Avatar>
            <Typography variant="h6" fontWeight="bold">Resumo de Players</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Total: {totalPlayers} • Online: {onlinePlayers} ({onlinePct.toFixed(0)}%)
          </Typography>
        </Paper>
      </Box>
    </Fade>
  );
};

export default LocationDetail;
