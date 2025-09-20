import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  Tabs,
  Tab,
  Chip,
  FormControlLabel,
  Switch,
  Select,
  InputLabel,
  FormControl,
  Avatar,
} from '@mui/material';
import { 
  AdminPanelSettings as AdminIcon 
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import axios from '../../config/axios';
import { useAuth } from '../../contexts/AuthContext';

const AdminUsers = () => {
  const {
    user,
    isAdmin,
    listPendingUsers,
    approveUser,
    rejectUser,
    listUsers,
    updateUser,
    adminSetPassword,
    registerUser,
    deleteUser,
  } = useAuth();

  const location = useLocation();

  // Tabs state: 'pending' | 'users'
  const initialTab = location.pathname.endsWith('/users') ? 'users' : 'pending';
  const [tab, setTab] = useState(initialTab);

  // Pending users state
  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // All users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Common UI state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [filterCompanyPending, setFilterCompanyPending] = useState('');
  const [filterCompanyUsers, setFilterCompanyUsers] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Companies list for selects
  const [companies, setCompanies] = useState([]);

  // Dialogs
  const [approveDialog, setApproveDialog] = useState({ open: false, userId: null, tempPass: '' });
  const [resetDialog, setResetDialog] = useState({ open: false, userId: null, newPass: '', mustChange: false });
  const [createDialog, setCreateDialog] = useState({ open: false, username: '', email: '', role: 'hr', company: 'iTracker', password: '' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, userId: null, name: '' });

  const loadCompanies = useCallback(async () => {
    try {
      const res = await axios.get('/auth/companies');
      const list = res?.data?.companies || [];
      setCompanies(list);
      if (!createDialog.company && list.length > 0) {
        setCreateDialog((d) => ({ ...d, company: list[0] }));
      }
    } catch (_) {
      // fallback já tratado no backend
    }
  }, [createDialog.company]);

  const fetchPending = useCallback(async () => {
    setLoadingPending(true);
    setError('');
    const res = await listPendingUsers();
    setLoadingPending(false);
    if (res.success) {
      setPending(res.users || []);
    } else {
      setError(res.error || 'Erro ao carregar solicitações');
    }
  }, [listPendingUsers]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError('');
    const res = await listUsers();
    setLoadingUsers(false);
    if (res.success) {
      setUsers(res.users || []);
    } else {
      setError(res.error || 'Erro ao carregar usuários');
    }
  }, [listUsers]);

  useEffect(() => {
    if (isAdmin) {
      fetchPending();
      fetchUsers();
      loadCompanies();
    }
  }, [isAdmin, fetchPending, fetchUsers, loadCompanies]);

  const pendingCompanies = useMemo(() => {
    const set = new Set(pending.map(u => u.company).filter(Boolean));
    return ['', ...Array.from(set)];
  }, [pending]);

  const usersCompanies = useMemo(() => {
    const set = new Set(users.map(u => u.company).filter(Boolean));
    return ['', ...Array.from(set)];
  }, [users]);

  const filteredPending = useMemo(() => {
    return pending.filter(u => (filterCompanyPending ? u.company === filterCompanyPending : true));
  }, [pending, filterCompanyPending]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => (filterCompanyUsers ? u.company === filterCompanyUsers : true) && (filterRole ? u.role === filterRole : true));
  }, [users, filterCompanyUsers, filterRole]);

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
      fetchPending();
      fetchUsers();
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
      fetchPending();
    } else {
      setError(res.error || 'Erro ao rejeitar usuário');
    }
  };

  const handleToggleActive = async (id, is_active) => {
    setError('');
    const res = await updateUser(id, { is_active });
    if (!res.success) setError(res.error);
    else setUsers((arr) => arr.map(u => (u.id === id ? { ...u, is_active } : u)));
  };

  const handleChangeRole = async (id, role) => {
    setError('');
    const res = await updateUser(id, { role });
    if (!res.success) setError(res.error);
    else setUsers((arr) => arr.map(u => (u.id === id ? { ...u, role } : u)));
  };

  const handleChangeCompany = async (id, company) => {
    setError('');
    const res = await updateUser(id, { company });
    if (!res.success) setError(res.error);
    else setUsers((arr) => arr.map(u => (u.id === id ? { ...u, company } : u)));
  };

  const openReset = (id) => setResetDialog({ open: true, userId: id, newPass: '', mustChange: true });
  const closeReset = () => setResetDialog({ open: false, userId: null, newPass: '', mustChange: false });
  const handleResetPassword = async () => {
    if (!resetDialog.userId || !resetDialog.newPass) return;
    setError('');
    setSuccess('');
    const res = await adminSetPassword(resetDialog.userId, { new_password: resetDialog.newPass, must_change_password: !!resetDialog.mustChange });
    if (res.success) {
      setSuccess('Senha redefinida com sucesso');
      closeReset();
    } else {
      setError(res.error || 'Erro ao redefinir senha');
    }
  };

  const openCreate = () => setCreateDialog({ open: true, username: '', email: '', role: 'hr', company: companies[0] || 'iTracker', password: '' });
  const closeCreate = () => setCreateDialog({ open: false, username: '', email: '', role: 'hr', company: companies[0] || 'iTracker', password: '' });
  const handleCreate = async () => {
    setError('');
    setSuccess('');
    const { username, email, role, company, password } = createDialog;
    if (!username || !email || !password) {
      setError('Preencha username, email e senha');
      return;
    }
    const res = await registerUser({ username, email, role, company, password });
    if (res.success) {
      setSuccess('Usuário criado com sucesso');
      closeCreate();
      fetchUsers();
    } else {
      setError(res.error || 'Erro ao criar usuário');
    }
  };

  const openDelete = (id, name) => setDeleteDialog({ open: true, userId: id, name: name || '' });
  const closeDelete = () => setDeleteDialog({ open: false, userId: null, name: '' });
  const handleDelete = async () => {
    if (!deleteDialog.userId) return;
    setError('');
    setSuccess('');
    const res = await deleteUser(deleteDialog.userId);
    if (res.success) {
      setUsers((arr) => arr.filter(u => u.id !== deleteDialog.userId));
      setSuccess('Usuário excluído com sucesso');
      closeDelete();
    } else {
      setError(res.error || 'Erro ao excluir usuário');
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
    <Container component="main" maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header com padrão visual */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
          <AdminIcon />
        </Avatar>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Administração de Usuários
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab value="pending" label={`Pendentes ${loadingPending ? '' : `(${filteredPending.length})`}`} />
        <Tab value="users" label="Usuários" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      {tab === 'pending' && (
        <>
          <Toolbar disableGutters sx={{ gap: 2, mb: 2 }}>
            <TextField
              select
              label="Empresa"
              size="small"
              value={filterCompanyPending}
              onChange={(e) => setFilterCompanyPending(e.target.value)}
              sx={{ width: 280 }}
            >
              {pendingCompanies.map(c => (
                <MenuItem key={c || 'all'} value={c}>{c || 'Todas as empresas'}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={fetchPending} disabled={loadingPending}>Atualizar</Button>
          </Toolbar>

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
                  {filteredPending.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.company}</TableCell>
                      <TableCell><Chip size="small" label={u.status} color={u.status === 'pending' ? 'warning' : 'default'} /></TableCell>
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
                  {filteredPending.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        {loadingPending ? 'Carregando...' : 'Nenhuma solicitação pendente'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {tab === 'users' && (
        <>
          <Toolbar disableGutters sx={{ gap: 2, mb: 2 }}>
            <TextField
              select
              label="Empresa"
              size="small"
              value={filterCompanyUsers}
              onChange={(e) => setFilterCompanyUsers(e.target.value)}
              sx={{ width: 220 }}
            >
              {usersCompanies.map(c => (
                <MenuItem key={c || 'all'} value={c}>{c || 'Todas as empresas'}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Papel"
              size="small"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              sx={{ width: 180 }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
              <MenuItem value="hr">RH</MenuItem>
              <MenuItem value="user">User</MenuItem>
            </TextField>
            <Button variant="outlined" onClick={fetchUsers} disabled={loadingUsers}>Atualizar</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={openCreate}>Novo Usuário</Button>
          </Toolbar>

          <Paper>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Papel</TableCell>
                    <TableCell>Ativo</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id} hover>
                        <TableCell>{u.username}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <Select
                              value={u.company || ''}
                              onChange={(e) => handleChangeCompany(u.id, e.target.value)}
                            >
                              {[...(companies.length ? companies : usersCompanies)].map((c) => (
                                <MenuItem key={c || 'unknown'} value={c}>{c || 'unknown'}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <Select
                              value={u.role || 'user'}
                              onChange={(e) => handleChangeRole(u.id, e.target.value)}
                            >
                              <MenuItem value="admin">Admin</MenuItem>
                              <MenuItem value="manager">Manager</MenuItem>
                              <MenuItem value="hr">RH</MenuItem>
                              <MenuItem value="user">User</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={!!u.is_active}
                                onChange={(e) => handleToggleActive(u.id, e.target.checked)}
                                color="primary"
                              />
                            }
                            label={u.is_active ? 'Ativo' : 'Inativo'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" variant="outlined" onClick={() => openReset(u.id)}>
                              Redefinir senha
                            </Button>
                            <Button size="small" color="error" variant="outlined" onClick={() => openDelete(u.id, u.username || u.email)} disabled={user?.id === u.id}>
                              Excluir
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          {loadingUsers ? 'Carregando...' : 'Nenhum usuário encontrado'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}

        {/* Approve dialog */}
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

        {/* Reset password dialog */}
        <Dialog open={resetDialog.open} onClose={closeReset} maxWidth="xs" fullWidth>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogContent>
            <TextField
              label="Nova senha"
              type="password"
              fullWidth
              sx={{ mt: 1 }}
              value={resetDialog.newPass}
              onChange={(e) => setResetDialog({ ...resetDialog, newPass: e.target.value })}
            />
            <FormControlLabel
              control={<Switch checked={resetDialog.mustChange} onChange={(e) => setResetDialog({ ...resetDialog, mustChange: e.target.checked })} />}
              label="Exigir troca no próximo login"
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeReset}>Cancelar</Button>
            <Button onClick={handleResetPassword} variant="contained" disabled={!resetDialog.newPass}>Salvar</Button>
          </DialogActions>
        </Dialog>

        {/* Delete user dialog */}
        <Dialog open={deleteDialog.open} onClose={closeDelete} maxWidth="xs" fullWidth>
          <DialogTitle>Excluir usuário</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Tem certeza que deseja excluir o usuário <strong>{deleteDialog.name || deleteDialog.userId}</strong>? Esta ação não pode ser desfeita.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDelete}>Cancelar</Button>
            <Button onClick={handleDelete} variant="contained" color="error">Excluir</Button>
          </DialogActions>
        </Dialog>

        {/* Create user dialog */}
        <Dialog open={createDialog.open} onClose={closeCreate} maxWidth="sm" fullWidth>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Username" value={createDialog.username} onChange={(e) => setCreateDialog({ ...createDialog, username: e.target.value })} fullWidth />
              <TextField label="Email" type="email" value={createDialog.email} onChange={(e) => setCreateDialog({ ...createDialog, email: e.target.value })} fullWidth />
              <TextField label="Senha" type="password" value={createDialog.password} onChange={(e) => setCreateDialog({ ...createDialog, password: e.target.value })} fullWidth />
              <FormControl fullWidth size="small">
                <InputLabel>Papel</InputLabel>
                <Select label="Papel" value={createDialog.role} onChange={(e) => setCreateDialog({ ...createDialog, role: e.target.value })}>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="hr">RH</MenuItem>
                  <MenuItem value="user">User</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Empresa</InputLabel>
                <Select label="Empresa" value={createDialog.company} onChange={(e) => setCreateDialog({ ...createDialog, company: e.target.value })}>
                  {[...(companies.length ? companies : usersCompanies.filter(Boolean))].map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCreate}>Cancelar</Button>
            <Button onClick={handleCreate} variant="contained">Criar</Button>
          </DialogActions>
        </Dialog>
      </Container>
    );
  };

  export default AdminUsers;
