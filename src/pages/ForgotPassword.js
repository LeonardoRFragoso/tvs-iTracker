import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Avatar,
  InputAdornment,
  Stack,
} from '@mui/material';
import { Email as EmailIcon, LockReset as LockResetIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { Link as RouterLink } from 'react-router-dom';

const ForgotPassword = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Informe seu email');
      return;
    }

    setLoading(true);
    const res = await forgotPassword(email);
    setLoading(false);

    if (res.success) {
      setSuccess(res.message || 'Se existir uma conta com este email, enviaremos instruções para redefinir sua senha.');
    } else {
      setError(res.error || 'Não foi possível processar sua solicitação');
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <LockResetIcon />
            </Avatar>
            <Typography component="h1" variant="h5">
              Recuperar senha
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Informe o email cadastrado. Se houver uma conta, enviaremos instruções para redefinição de senha.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar instruções'}
              </Button>
              <Button component={RouterLink} to="/login" variant="text">
                Voltar para login
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ForgotPassword;
