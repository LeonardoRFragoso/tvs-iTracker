import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  IconButton,
  Stack,
  Divider,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import GroupsIcon from '@mui/icons-material/Groups';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import axios from '../../config/axios';
import { useAuth } from '../../contexts/AuthContext';

const UsersSummary = () => {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get('/auth/users/summary');
      setData(res.data || {});
    } catch (e) {
      setError(e?.response?.data?.error || 'Erro ao carregar resumo de usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchSummary();
  }, [isAdmin, fetchSummary]);

  const pendingTotal = useMemo(() => {
    if (!data?.pending_by_company) return 0;
    return Object.values(data.pending_by_company).reduce((acc, v) => acc + (parseInt(v, 10) || 0), 0);
  }, [data]);

  if (!isAdmin) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="warning">Acesso restrito aos administradores.</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <VerifiedUserIcon color="primary" />
            <Typography variant="h5" fontWeight="bold">
              Resumo de Usuários por Empresa
            </Typography>
            {loading ? (
              <Chip size="small" label="Carregando..." />
            ) : (
              <Chip size="small" color="info" label={`Empresas: ${data?.companies?.length || 0}`} />
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Atualizar">
              <span>
                <IconButton onClick={fetchSummary} disabled={loading} color="primary">
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* KPIs */}
        <Grid container spacing={3} sx={{ mb: 1 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <PeopleIcon color="primary" />
                  <Box>
                    <Typography variant="overline" color="text.secondary">Usuários totais</Typography>
                    <Typography variant="h5" fontWeight="bold">{data?.total_users ?? '--'}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <GroupsIcon color="warning" />
                  <Box>
                    <Typography variant="overline" color="text.secondary">Empresas</Typography>
                    <Typography variant="h5" fontWeight="bold">{data?.companies?.length ?? 0}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <VerifiedUserIcon color="error" />
                  <Box>
                    <Typography variant="overline" color="text.secondary">Pendentes de aprovação</Typography>
                    <Typography variant="h5" fontWeight="bold">{pendingTotal}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* Tabela por empresa */}
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Distribuição por Empresa e Papel</Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Empresa</TableCell>
                        <TableCell align="right">Admin</TableCell>
                        <TableCell align="right">Manager</TableCell>
                        <TableCell align="right">RH</TableCell>
                        <TableCell align="right">User</TableCell>
                        <TableCell align="right">Pendentes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data?.companies || []).map((company) => {
                        const row = data?.by_company?.[company] || {};
                        const pend = data?.pending_by_company?.[company] || 0;
                        return (
                          <TableRow key={company} hover>
                            <TableCell>{company}</TableCell>
                            <TableCell align="right">{row.admin || 0}</TableCell>
                            <TableCell align="right">{row.manager || 0}</TableCell>
                            <TableCell align="right">{row.hr || 0}</TableCell>
                            <TableCell align="right">{row.user || 0}</TableCell>
                            <TableCell align="right">{pend}</TableCell>
                          </TableRow>
                        );
                      })}
                      {(data?.companies?.length || 0) === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">Sem dados</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* RH por empresa */}
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Usuários de RH por Empresa</Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Empresa</TableCell>
                        <TableCell>Usuário (email)</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(data?.hr_by_company || {}).map(([company, users]) => (
                        (users || []).map((u) => (
                          <TableRow key={`${company}-${u.id}`} hover>
                            <TableCell>{company}</TableCell>
                            <TableCell>{u.username} ({u.email})</TableCell>
                            <TableCell>
                              <Chip size="small" label={u.status} color={u.status === 'active' ? 'success' : (u.status === 'pending' ? 'warning' : 'default')} />
                            </TableCell>
                          </TableRow>
                        ))
                      ))}
                      {Object.keys(data?.hr_by_company || {}).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} align="center">Sem usuários RH</TableCell>
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
    </Container>
  );
};

export default UsersSummary;
