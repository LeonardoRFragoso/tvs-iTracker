import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import TrafficIcon from '@mui/icons-material/Traffic';
import StorageIcon from '@mui/icons-material/Storage';
import axios from '../../config/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const formatBytes = (bytes = 0) => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const TrafficMonitor = () => {
  const { user, isAdmin, isManager } = useAuth();
  const { adminTraffic, connected } = useSocket();
  const [snapshot, setSnapshot] = useState(null);
  const [playersInfo, setPlayersInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filter, setFilter] = useState('');

  const canView = isAdmin || isManager;

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

  const resetCounters = useCallback(async () => {
    try {
      await axios.get('/monitor/traffic?reset=true');
      await fetchSnapshot();
    } catch (e) {
      setError('Erro ao resetar contadores');
    }
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        await Promise.all([fetchSnapshot(), fetchPlayers()]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [canView, fetchSnapshot, fetchPlayers]);

  // Real-time updates from Socket (admin room)
  useEffect(() => {
    if (adminTraffic) {
      setSnapshot(adminTraffic);
      setLastUpdated(new Date());
    }
  }, [adminTraffic]);

  const rows = useMemo(() => {
    if (!snapshot || !snapshot.players) return [];
    const arr = Object.entries(snapshot.players).map(([pid, pstats]) => {
      const info = playersInfo.find(p => String(p.id) === String(pid));
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
      };
    });

    // Filter
    const f = (filter || '').toLowerCase();
    return arr
      .filter(r => !f || r.name.toLowerCase().includes(f) || String(r.id).includes(f))
      .sort((a, b) => b.bytes - a.bytes);
  }, [snapshot, playersInfo, filter]);

  if (!canView) {
    return (
      <Box p={3}>
        <Typography variant="h6">Acesso restrito</Typography>
        <Typography variant="body2" color="text.secondary">
          Esta página é exclusiva para administradores e gerentes.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <TrafficIcon color="warning" />
          <Typography variant="h5" fontWeight="bold">
            Monitoramento de Tráfego e Players
          </Typography>
          {connected ? (
            <Chip size="small" color="success" icon={<WifiIcon />} label="Socket conectado" />
          ) : (
            <Chip size="small" color="default" icon={<WifiOffIcon />} label="Socket desconectado" />
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Filtrar por nome ou ID"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Tooltip title="Atualizar agora">
            <span>
              <IconButton color="primary" onClick={fetchSnapshot} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Resetar contadores (desde)">
            <span>
              <IconButton color="warning" onClick={resetCounters} disabled={loading}>
                <RestartAltIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {loading && (
        <Box mb={2}><LinearProgress /></Box>
      )}
      {error && (
        <Box mb={2}><Typography color="error">{error}</Typography></Box>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <StorageIcon color="primary" />
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Tráfego total desde
                  </Typography>
                  <Typography variant="h6">
                    {snapshot?.since ? new Date(snapshot.since).toLocaleString('pt-BR') : '--'}
                  </Typography>
                </Box>
              </Stack>
              <Box mt={1}>
                <Typography variant="h4" fontWeight="bold">
                  {formatBytes(snapshot?.total_bytes || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Atualizado {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('pt-BR') : '--'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Consumo por Player</Typography>
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
                      <TableCell align="right">Vídeo</TableCell>
                      <TableCell align="right">Imagem</TableCell>
                      <TableCell align="right">Áudio</TableCell>
                      <TableCell align="right">Outros</TableCell>
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
                        <TableCell align="right">{formatBytes(r.video)}</TableCell>
                        <TableCell align="right">{formatBytes(r.image)}</TableCell>
                        <TableCell align="right">{formatBytes(r.audio)}</TableCell>
                        <TableCell align="right">{formatBytes(r.other)}</TableCell>
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
                        <TableCell colSpan={12}>
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
      </Grid>
    </Box>
  );
};

export default TrafficMonitor;
