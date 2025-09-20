import React, { useState, useEffect } from 'react';
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
  Chip,
} from '@mui/material';
import {
  PersonAddAlt as PersonAddIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from '../config/axios';
import { Link as RouterLink } from 'react-router-dom';

const DEFAULT_COMPANIES = ['iTracker', 'Rio Brasil Terminal - RBT', 'CLIA'];

const Register = () => {
  const { publicRegister } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [companiesOptions, setCompaniesOptions] = useState(DEFAULT_COMPANIES);
  const [company, setCompany] = useState(DEFAULT_COMPANIES[0]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Tenta buscar lista dinâmica de empresas (JWT pode não existir; fazer fallback silencioso)
    const fetchCompanies = async () => {
      try {
        // 1) endpoint público
        let res = await axios.get('/public/companies');
        let list = res.data?.companies;
        // 2) fallback para endpoint autenticado (caso público não exista)
        if (!Array.isArray(list) || !list.length) {
          res = await axios.get('/auth/companies');
          list = res.data?.companies;
        }
        if (Array.isArray(list) && list.length) {
          setCompaniesOptions(list);
          if (!list.includes(company)) {
            setCompany(list[0]);
          }
        }
      } catch (e) {
        // Ignora erro (ex.: sem token) e mantém DEFAULT_COMPANIES
      }
    };
    fetchCompanies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !email || !company) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    const res = await publicRegister({ username, email, company });
    setLoading(false);

    if (res.success) {
      setSuccess(res.message || 'Cadastro enviado com sucesso. Aguarde aprovação do administrador.');
      // Resetar formulário
      setUsername('');
      setEmail('');
      setCompany((companiesOptions && companiesOptions[0]) || DEFAULT_COMPANIES[0]);
    } else {
      setError(res.error || 'Erro ao enviar cadastro');
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <PersonAddIcon />
            </Avatar>
            <Typography component="h1" variant="h5">
              Cadastro de novo usuário
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Preencha os dados abaixo. Sua solicitação será enviada para aprovação do administrador.
            Caso seja aprovada, uma senha temporária será definida e você deverá alterá-la no primeiro acesso.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Nome de usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              type="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">Perfil:</Typography>
              <Chip label="RH" color="default" size="small" />
              <Typography variant="caption" color="text.secondary">(definido automaticamente)</Typography>
            </Stack>

            <TextField
              select
              fullWidth
              margin="normal"
              label="Empresa"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              SelectProps={{ native: true }}
            >
              {companiesOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </TextField>

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar cadastro'}
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

export default Register;
