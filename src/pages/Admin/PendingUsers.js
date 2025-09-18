import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Toolbar,
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const PendingUsers = () => {
  const { user, isAdmin, listPendingUsers, approveUser, rejectUser } = useAuth();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [approveDialog, setApproveDialog] = useState({ open: false, userId: null, tempPass: '' });

  const companies = useMemo(() => {
    const set = new Set(pending.map(u => u.company).filter(Boolean));
    return ['', ...Array.from(set)];
  }, [pending]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const res = await listPendingUsers();
    setLoading(false);
    if (res.success) {
      setPending(res.users || []);
    } else {
      setError(res.error || 'Erro ao carregar solicitações');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return pending.filter(u => (filterCompany ? u.company === filterCompany : true));
  }, [pending, filterCompany]);

  const openApprove = (id) => setApproveDialog({ open: true, userId: id, tempPass: '' });
  const closeApprove = () => setApproveDialog({ open: false, userId: null, tempPass: '' });

  const handleApprove = async () => {
    if (!approveDialog.userId) return;
    setError('');
    setSuccess('');
    const res = await approveUser(approveDialog.userId, approveDialog.tempPass || undefined);
    if (res.success) {
      setSuccess(`Usuário aprovado. Senha temporária: ${res.temp_password || approveDialog.tempPass || '(gerada automaticamente)'}`);
      closeApprove();
      fetchData();
    } else {
      setError(res.error || 'Erro ao aprovar usuário');
    }
  };

  const handleReject = async (id) => {
    setError('');
    setSuccess('');
    const res = await rejectUser(id);
    if (res.success) {
      setSuccess('Usuário rejeitado com sucesso');
      fetchData();
    } else {
      setError(res.error || 'Erro ao rejeitar usuário');
    }
  };

  if (!isAdmin) {
    return (
      <Container component="main" maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="warning">Acesso restrito aos administradores.</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Solicitações de acesso pendentes
        </Typography>

        <Toolbar disableGutters sx={{ gap: 2, mb: 2 }}>
          <TextField
            select
            label="Empresa"
            size="small"
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            sx={{ width: 280 }}
          >
            {companies.map(c => (
              <MenuItem key={c || 'all'} value={c}>{c || 'Todas as empresas'}</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={fetchData} disabled={loading}>Atualizar</Button>
        </Toolbar>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Empresa</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Criado em</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.company}</TableCell>
                    <TableCell>{u.status}</TableCell>
                    <TableCell>{u.created_at}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="contained" onClick={() => openApprove(u.id)}>
                          Aprovar
                        </Button>
                        <Button size="small" color="error" variant="outlined" onClick={() => handleReject(u.id)}>
                          Rejeitar
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      {loading ? 'Carregando...' : 'Nenhuma solicitação pendente'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={approveDialog.open} onClose={closeApprove} maxWidth="xs" fullWidth>
          <DialogTitle>Aprovar usuário</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Opcional: defina uma senha temporária ou deixe em branco para gerar automaticamente.
            </Typography>
            <TextField
              label="Senha temporária (opcional)"
              type="text"
              fullWidth
              value={approveDialog.tempPass}
              onChange={(e) => setApproveDialog({ ...approveDialog, tempPass: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeApprove}>Cancelar</Button>
            <Button onClick={handleApprove} variant="contained">Aprovar</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default PendingUsers;
