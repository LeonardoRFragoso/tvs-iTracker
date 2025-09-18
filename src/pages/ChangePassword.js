import React, { useState } from 'react';
import { Container, Box, Paper, Typography, TextField, Button, Alert, Stack } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ChangePassword = () => {
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Nova senha e confirmação não conferem');
      return;
    }

    setLoading(true);
    const res = await changePassword({ old_password: oldPassword, new_password: newPassword });
    setLoading(false);

    if (res.success) {
      setSuccess('Senha alterada com sucesso! Redirecionando...');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
    } else {
      setError(res.error || 'Erro ao alterar senha');
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h5" gutterBottom>
            Alterar senha
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {user?.must_change_password ? 'Defina uma nova senha para continuar usando o sistema.' : 'Altere sua senha.'}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Senha atual"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Confirmar nova senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              margin="normal"
              required
            />

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </Button>
              <Button onClick={() => navigate('/dashboard')} disabled={loading}>
                Cancelar
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ChangePassword;
