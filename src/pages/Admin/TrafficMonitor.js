import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { formatBRDateTime } from '../../utils/dateFormatter';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  IconButton,
  Tooltip,
  LinearProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import TrafficIcon from '@mui/icons-material/Traffic';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import SpeedIcon from '@mui/icons-material/Speed';
import axios from '../../config/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import PageTitle from '../../components/Common/PageTitle';

const formatBytes = (bytes = 0) => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const formatRate = (bytesPerSec = 0) => {
  if (bytesPerSec == null) return '--';
  // Show as MB/s with two decimals
  const mbps = bytesPerSec / (1024 * 1024);
  return `${mbps.toFixed(2)} MB/s`;
};

const formatPerMin = (bytesPerMin = 0) => {
  if (bytesPerMin == null) return '--';
  return `${formatBytes(bytesPerMin)}/min`;
};

const formatRpm = (rpm = 0) => {
  if (rpm == null) return '--';
  return Number(rpm).toFixed(1);
};

const TrafficMonitor = () => {
  const { user, isAdmin } = useAuth();
  const { adminTraffic, connected, systemStats } = useSocket();
  const [snapshot, setSnapshot] = useState(null);
  const [playersInfo, setPlayersInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filter, setFilter] = useState('');
  const [sysSnapshot, setSysSnapshot] = useState(null);

  // Timeseries/Top N state
  const [period, setPeriod] = useState('24h'); // 1h | 24h | 7d
  const [playerId, setPlayerId] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [locationId, setLocationId] = useState('');
  const [timeseries, setTimeseries] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [accItems, setAccItems] = useState([]);

  // Options data for dropdowns
  const [companies, setCompanies] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [allLocations, setAllLocations] = useState([]);

  const canView = isAdmin;

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await axios.get('/monitor/traffic');
      setSnapshot(res.data);
      setLastUpdated(new Date());
    } catch (e) {
      setError('Erro ao carregar estatísticas de tráfego');
    }
  }, []);

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await axios.get('/monitor/players');
      setPlayersInfo(res.data.players || []);
    } catch (e) {
      setError('Erro ao carregar status dos players');
    }
  }, []);

  // Load dictionaries for dropdowns
  const loadCompanies = useCallback(async () => {
    try {
      const res = await axios.get('/auth/companies');
      setCompanies(res?.data?.companies || []);
    } catch (_) {
      // fallback será derivar das listas de players abaixo
    }
  }, []);

  const loadAllPlayers = useCallback(async () => {
    try {
      const res = await axios.get('/players', { params: { per_page: 1000 } });
      setAllPlayers(res?.data?.players || []);
    } catch (_) { /* no-op */ }
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      const res = await axios.get('/players/locations');
      setAllLocations(res?.data?.locations || []);
    } catch (_) { /* no-op */ }
  }, []);

  const fetchSystem = useCallback(async () => {
    const tryGet = async (url) => {
      try {
        const res = await axios.get(url);
        return res.data;
      } catch (err) {
        throw err;
      }
    };

    try {
      // 1) Same-origin baseURL (/api) -> /monitor/system
      const data = await tryGet('/monitor/system');
      setSysSnapshot(data);
      return;
    } catch (_) {
      // continue
    }

    try {
      // 2) Same-origin baseURL (/api) -> /system (alias)
      const data2 = await tryGet('/system');
      setSysSnapshot(data2);
      return;
    } catch (_) {
      // continue
    }

    try {
      // 3) Fallback direto para :5000 (bypassa reverse proxy desatualizado)
      const proto = typeof window !== 'undefined' ? window.location.protocol : 'http:';
      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const base5000 = `${proto}//${host}:5000/api`;
      const data3 = await tryGet(`${base5000}/monitor/system`);
      setSysSnapshot(data3);
      return;
    } catch (_) {
      // continue
    }

    try {
      // 4) Último fallback: :5000 alias
      const proto = typeof window !== 'undefined' ? window.location.protocol : 'http:';
      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const base5000 = `${proto}//${host}:5000/api`;
      const data4 = await tryGet(`${base5000}/system`);
      setSysSnapshot(data4);
      return;
    } catch (_) {
      // silencioso: socket/polling devem preencher quando disponíveis
    }
  }, []);

  const resetCounters = useCallback(async () => {
    try {
      await axios.get('/monitor/traffic?reset=true');
      await fetchSnapshot();
    } catch (e) {
      setError('Erro ao resetar contadores');
    }
  }, [fetchSnapshot]);

  // Timeseries
  const computeRange = useCallback(() => {
    const now = new Date();
    let from = new Date(now);
    if (period === '1h') from.setHours(now.getHours() - 1);
    else if (period === '24h') from.setDate(now.getDate() - 1);
    else if (period === '7d') from.setDate(now.getDate() - 7);
    const toISO = formatBRDateTime(now);
    const fromISO = formatBRDateTime(from);
    const group_by = period === '7d' ? 'hour' : 'minute';
    return { fromISO, toISO, group_by };
  }, [period]);

  const fetchTimeseries = useCallback(async () => {
    try {
      const { fromISO, toISO, group_by } = computeRange();
      const params = { group_by, from: fromISO, to: toISO };
      if (playerId) params.player_id = playerId;
      if (companyFilter) params.company = companyFilter;
      if (locationId) params.location_id = locationId;
      const res = await axios.get('/monitor/traffic/timeseries', { params });
      const series = Array.isArray(res.data?.series) ? res.data.series : [];
      setTimeseries(series);
    } catch (e) {
      // silencioso
    }
  }, [computeRange, playerId, companyFilter, locationId]);

  const fetchTop = useCallback(async () => {
    try {
      const params = { period };
      if (playerId) params.player_id = playerId;
      if (companyFilter) params.company = companyFilter;
      if (locationId) params.location_id = locationId;
      const res = await axios.get('/monitor/traffic/top', { params });
      const items = Array.isArray(res.data?.top) ? res.data.top : [];
      setTopItems(items);
    } catch (e) {
      // silencioso
    }
  }, [period, playerId, companyFilter, locationId]);

  // flushNow será definido após fetchTimeseries/fetchTop para evitar TDZ
  const fetchAccumulated = useCallback(async () => {
    try {
      const params = { period };
      if (playerId) params.player_id = playerId;
      if (companyFilter) params.company = companyFilter;
      if (locationId) params.location_id = locationId;
      const res = await axios.get('/monitor/traffic/accumulated', { params });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setAccItems(items);
    } catch (e) {
      // silencioso
    }
  }, [period, playerId, companyFilter, locationId]);

  // Agora que fetchTimeseries/fetchTop/fetchAccumulated já existem, é seguro depender deles
  const flushNow = useCallback(async () => {
    try {
      await axios.post('/monitor/traffic/flush-now');
      await Promise.all([
        fetchTimeseries(),
        fetchTop(),
        fetchSnapshot(),
        fetchAccumulated?.()
      ]);
    } catch (e) {
      // silencioso
    }
  }, [fetchTimeseries, fetchTop, fetchSnapshot, fetchAccumulated]);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        await Promise.all([
          fetchSnapshot(),
          fetchPlayers(),
          fetchSystem(),
          fetchTimeseries(),
          fetchTop(),
          fetchAccumulated(),
          loadCompanies(),
          loadAllPlayers(),
          loadLocations(),
        ]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [canView, fetchSnapshot, fetchPlayers, fetchSystem, fetchTimeseries, fetchTop, fetchAccumulated, loadCompanies, loadAllPlayers, loadLocations]);

  // Real-time updates from Socket (admin room)
  useEffect(() => {
    if (adminTraffic) {
      setSnapshot(adminTraffic);
      setLastUpdated(new Date());
    }
  }, [adminTraffic]);

  useEffect(() => {
    if (systemStats) setSysSnapshot(systemStats);
  }, [systemStats]);

  // Refetch when filters change
  useEffect(() => {
    if (!canView) return;
    fetchTimeseries();
    fetchTop();
    fetchAccumulated();
  }, [canView, period, playerId, companyFilter, locationId, fetchTimeseries, fetchTop, fetchAccumulated]);

  // Polling de fallback para métricas do servidor (caso socket não esteja emitindo)
  useEffect(() => {
    if (!canView) return;
    const id = setInterval(() => {
      fetchSystem();
    }, 15000);
    return () => clearInterval(id);
  }, [canView, fetchSystem]);

  // Resetar player/location ao trocar empresa
  useEffect(() => {
    setPlayerId('');
    setLocationId('');
  }, [companyFilter]);

  // Options derivadas por empresa
  const companyOptions = useMemo(() => {
    if (Array.isArray(companies) && companies.length > 0) return companies;
    const set = new Set((allPlayers || []).map(p => p.company).filter(Boolean));
    return Array.from(set);
  }, [companies, allPlayers]);

  const playerOptions = useMemo(() => {
    const list = Array.isArray(allPlayers) ? allPlayers : [];
    return list
      .filter(p => (companyFilter ? p.company === companyFilter : true))
      .map(p => ({ id: String(p.id), name: p.name || String(p.id), company: p.company || '' }));
  }, [allPlayers, companyFilter]);

  const locationOptions = useMemo(() => {
    const list = Array.isArray(allLocations) ? allLocations : [];
    return list.filter(l => (companyFilter ? l.company === companyFilter : true));
  }, [allLocations, companyFilter]);

  const formatNumber = (n) => {
    if (!n && n !== 0) return '0';
    return n.toLocaleString('pt-BR');
  };

  const kpis = useMemo(() => {
    if (!timeseries || timeseries.length === 0) return { lastBytes: 0, lastReq: 0, totalBytes: 0, totalReq: 0 };
    const last = timeseries[timeseries.length - 1];
    const lastBytes = last?.bytes || 0;
    const lastReq = last?.requests || 0;
    const totals = timeseries.reduce((acc, p) => {
      acc.totalBytes += p.bytes || 0;
      acc.totalReq += p.requests || 0;
      return acc;
    }, { totalBytes: 0, totalReq: 0 });
    return { lastBytes, lastReq, totalBytes: totals.totalBytes, totalReq: totals.totalReq };
  }, [timeseries]);

  const rows = useMemo(() => {
    let arr = [];
    const recentMap = snapshot?.recent?.players || {};
    if (accItems && accItems.length > 0) {
      arr = accItems.map((it) => {
        const info = playersInfo.find(p => String(p.id) === String(it.player_id));
        const recent = recentMap[String(it.player_id)] || null;
        return {
          id: String(it.player_id),
          name: info?.name || '(Sem nome)'.concat(' '),
          status: info?.status || 'unknown',
          socket_connected: !!info?.socket_connected,
          last_ping: info?.last_ping || null,
          last_seen: it.last_seen || null,
          bytes: it.bytes || 0,
          requests: it.requests || 0,
          video: it.video || 0,
          image: it.image || 0,
          audio: it.audio || 0,
          other: it.other || 0,
          bytes_per_min: recent?.bytes_per_min || 0,
          rpm: recent?.rpm || 0,
          status_counts: snapshot?.players?.[String(it.player_id)]?.status_counts || null,
        };
      });
    } else if (snapshot && snapshot.players) {
      arr = Object.entries(snapshot.players).map(([pid, pstats]) => {
        const info = playersInfo.find(p => String(p.id) === String(pid));
        const recent = recentMap[String(pid)] || null;
        return {
          id: pid,
          name: info?.name || '(Sem nome)'.concat(' '),
          status: info?.status || 'unknown',
          socket_connected: !!info?.socket_connected,
          last_ping: info?.last_ping || null,
          last_seen: pstats.last_seen || null,
          bytes: pstats.bytes || 0,
          requests: pstats.requests || 0,
          video: (pstats.by_type?.video) || 0,
          image: (pstats.by_type?.image) || 0,
          audio: (pstats.by_type?.audio) || 0,
          other: (pstats.by_type?.other) || 0,
          bytes_per_min: recent?.bytes_per_min || 0,
          rpm: recent?.rpm || 0,
          status_counts: pstats?.status_counts || null,
        };
      });
    }

    const f = (filter || '').toLowerCase();
    return arr
      .filter(r => !f || r.name.toLowerCase().includes(f) || String(r.id).includes(f))
      .sort((a, b) => b.bytes - a.bytes);
  }, [accItems, snapshot, playersInfo, filter]);

  if (!canView) {
    return (
      <Box p={3}>
        <Typography variant="h6">Acesso restrito</Typography>
        <Typography variant="body2" color="text.secondary">
          Você não tem permissão para acessar esta página.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header com PageTitle */}
      <PageTitle 
        title="Monitoramento de Tráfego e Players"
        subtitle="Acompanhe o uso de rede e status dos dispositivos em tempo real"
        actions={
          <>
            {/* Filtros principais */}
            <FormControl size="small" sx={{ mr: 1, minWidth: 100 }}>
              <InputLabel>Período</InputLabel>
              <Select label="Período" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <MenuItem value="1h">1h</MenuItem>
                <MenuItem value="24h">24h</MenuItem>
                <MenuItem value="7d">7d</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ mr: 1, minWidth: 160 }}>
              <InputLabel>Empresa</InputLabel>
              <Select label="Empresa" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {companyOptions.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ mr: 1, minWidth: 180 }}>
              <InputLabel>Player</InputLabel>
              <Select label="Player" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {playerOptions.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ mr: 1, minWidth: 180 }}>
              <InputLabel>Localização</InputLabel>
              <Select label="Localização" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {locationOptions.map((l) => (
                  <MenuItem key={l.id} value={l.id}>{l.name || l.id}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Filtrar por nome ou ID"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ mr: 1 }}
            />
            <Tooltip title="Atualizar agora">
              <span>
                <IconButton 
                  color="primary" 
                  onClick={() => { fetchSnapshot(); fetchSystem(); fetchTimeseries(); fetchTop(); fetchAccumulated(); }} 
                  disabled={loading}
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
              </span>
            </Tooltip>
            <Tooltip title="Resetar contadores (desde)">
              <span>
                <IconButton 
                  color="secondary" 
                  onClick={resetCounters} 
                  disabled={loading}
                  sx={{
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'secondary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'secondary.dark',
                    },
                  }}
                >
                  <RestartAltIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Persistir amostras agora (flush)">
              <span>
                <IconButton
                  color="warning"
                  onClick={flushNow}
                  disabled={loading}
                  sx={{
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'warning.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'warning.dark',
                    },
                  }}
                >
                  <StorageIcon />
                </IconButton>
              </span>
            </Tooltip>
            {connected ? (
              <Chip size="small" color="success" icon={<WifiIcon />} label="Socket conectado" />
            ) : (
              <Chip size="small" color="default" icon={<WifiOffIcon />} label="Socket desconectado" />
            )}
          </>
        }
      />

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Box mb={2}><Typography color="error">{error}</Typography></Box>
      )}

      <Grid container spacing={3}>
        {/* Widget do Servidor */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Servidor (tempo real)</Typography>
                <Typography variant="caption" color="text.secondary">
                  {sysSnapshot?.ts ? new Date(sysSnapshot.ts).toLocaleTimeString('pt-BR') : '—'}
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <MemoryIcon color="primary" />
                    <Box>
                      <Typography variant="overline" color="text.secondary">CPU</Typography>
                      <Typography variant="subtitle1">{sysSnapshot?.cpu_percent?.toFixed ? sysSnapshot.cpu_percent.toFixed(1) : sysSnapshot?.cpu_percent || 0}%</Typography>
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SdStorageIcon color="primary" />
                    <Box>
                      <Typography variant="overline" color="text.secondary">Memória</Typography>
                      <Typography variant="subtitle1">
                        {sysSnapshot?.memory ? `${formatBytes(sysSnapshot.memory.used)} / ${formatBytes(sysSnapshot.memory.total)} (${sysSnapshot.memory.percent}%)` : '—'}
                      </Typography>
                    </Box>
                </Stack>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StorageIcon color="primary" />
                    <Box>
                      <Typography variant="overline" color="text.secondary">Disco</Typography>
                      <Typography variant="subtitle1">
                        {sysSnapshot?.disk ? `${formatBytes(sysSnapshot.disk.used)} / ${formatBytes(sysSnapshot.disk.total)} (${sysSnapshot.disk.percent}%)` : '—'}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <NetworkCheckIcon color="primary" />
                    <Box>
                      <Typography variant="overline" color="text.secondary">Rede</Typography>
                      <Typography variant="subtitle1">
                        ↑ {formatRate(sysSnapshot?.net?.send_rate_bps)} • ↓ {formatRate(sysSnapshot?.net?.recv_rate_bps)}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={3} mt={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <SpeedIcon fontSize="small" />
                      <Typography variant="body2">Latência média: {sysSnapshot?.uploads ? `${sysSnapshot.uploads.latency_avg_ms.toFixed(1)} ms` : '—'}</Typography>
                    </Stack>
                    <Typography variant="body2">p95: {sysSnapshot?.uploads ? `${sysSnapshot.uploads.latency_p95_ms.toFixed(1)} ms` : '—'}</Typography>
                    <Typography variant="body2">206: {sysSnapshot?.uploads?.status_counts?.['206'] ?? 0}</Typography>
                    <Typography variant="body2">304: {sysSnapshot?.uploads?.status_counts?.['304'] ?? 0}</Typography>
                    <Typography variant="body2">5xx: {sysSnapshot?.uploads?.status_counts?.['5xx'] ?? 0}</Typography>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <StorageIcon color="primary" />
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Tráfego no período
                  </Typography>
                  <Typography variant="h6">
                    {period}
                  </Typography>
                </Box>
              </Stack>
              <Box mt={1}>
                <Typography variant="h4" fontWeight="bold">
                  {formatBytes(kpis.totalBytes)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Última leitura {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('pt-BR') : '--'} • Req: {formatNumber(kpis.totalReq)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Consumo por Player (acumulado persistido)</Typography>
                <Typography variant="caption" color="text.secondary">
                  {rows.length} players
                </Typography>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Player</TableCell>
                      <TableCell>ID</TableCell>
                      <TableCell align="right">Bytes</TableCell>
                      <TableCell align="right">Req</TableCell>
                      <TableCell align="right">B/min</TableCell>
                      <TableCell align="right">Req/min</TableCell>
                      <TableCell align="right">Vídeo</TableCell>
                      <TableCell align="right">Imagem</TableCell>
                      <TableCell align="right">Áudio</TableCell>
                      <TableCell align="right">Outros</TableCell>
                      <TableCell>HTTP</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Ping</TableCell>
                      <TableCell>Last Seen (trafego)</TableCell>
                      <TableCell>Socket</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.id}</TableCell>
                        <TableCell align="right">{formatBytes(r.bytes)}</TableCell>
                        <TableCell align="right">{r.requests}</TableCell>
                        <TableCell align="right">{formatPerMin(r.bytes_per_min)}</TableCell>
                        <TableCell align="right">{formatRpm(r.rpm)}</TableCell>
                        <TableCell align="right">{formatBytes(r.video)}</TableCell>
                        <TableCell align="right">{formatBytes(r.image)}</TableCell>
                        <TableCell align="right">{formatBytes(r.audio)}</TableCell>
                        <TableCell align="right">{formatBytes(r.other)}</TableCell>
                        <TableCell>
                          {r.status_counts ? (
                            <Tooltip title="200 / 206 / 304">
                              <span>{(r.status_counts?.['200'] || 0)} / {(r.status_counts?.['206'] || 0)} / {(r.status_counts?.['304'] || 0)}</span>
                            </Tooltip>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={r.status} color={r.status === 'online' ? 'success' : 'default'} />
                        </TableCell>
                        <TableCell>{r.last_ping ? new Date(r.last_ping).toLocaleString('pt-BR') : '-'}</TableCell>
                        <TableCell>{r.last_seen ? new Date(r.last_seen).toLocaleString('pt-BR') : '-'}</TableCell>
                        <TableCell>
                          {r.socket_connected ? (
                            <Chip size="small" color="success" label="ON" />
                          ) : (
                            <Chip size="small" label="OFF" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={15}>
                          <Typography variant="body2" color="text.secondary">
                            Nenhum dado disponível ainda.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top N por bytes no período */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h6">Top por bytes ({period})</Typography>
                <Typography variant="caption" color="text.secondary">{topItems.length} itens</Typography>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Player ID</TableCell>
                      <TableCell align="right">Bytes</TableCell>
                      <TableCell align="right">Req</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topItems.map((it) => (
                      <TableRow key={String(it.player_id)} hover>
                        <TableCell>{String(it.player_id)}</TableCell>
                        <TableCell align="right">{formatBytes(it.bytes || 0)}</TableCell>
                        <TableCell align="right">{formatNumber(it.requests || 0)}</TableCell>
                      </TableRow>
                    ))}
                    {topItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography variant="body2" color="text.secondary">Sem dados no período</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TrafficMonitor;
