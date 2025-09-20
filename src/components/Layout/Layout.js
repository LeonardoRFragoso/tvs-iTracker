import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Fade,
  Badge,
  Chip,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  VideoLibrary,
  Campaign,
  Tv,
  Schedule,
  Settings,
  AccountCircle,
  Logout,
  LocationOn,
  Brightness4,
  Brightness7,
  TrendingUp,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import axios from '../../config/axios';

const drawerWidth = 240;

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [badges, setBadges] = useState({
    content: 0,
    locations: 0,
    players: 0
  });
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Buscar dados para badges
  useEffect(() => {
    const fetchBadgeData = async () => {
      try {
        const [contentRes, locationsRes, dashboardRes] = await Promise.all([
          axios.get('/content?per_page=1000'), // Buscar todos os conteúdos
          axios.get('/locations'),
          axios.get('/dashboard/stats') // Buscar stats do dashboard para players online
        ]);

        setBadges({
          content: contentRes.data.total || contentRes.data.contents?.length || 0,
          locations: locationsRes.data.total || locationsRes.data.locations?.length || 0,
          players: dashboardRes.data.overview?.online_players || 0 // Usar players online em vez do total
        });
      } catch (error) {
        console.error('Erro ao buscar dados dos badges:', error);
        // Manter valores padrão em caso de erro
        setBadges({
          content: 4,
          locations: 3,
          players: 0 // Padrão 0 para players online
        });
      }
    };

    fetchBadgeData();
  }, []);

  const menuItems = [
    { 
      text: 'Dashboard', 
      icon: <Dashboard />, 
      path: '/dashboard',
      badge: null,
      description: 'Visão geral do sistema'
    },
    { 
      text: 'Conteúdo', 
      icon: <VideoLibrary />, 
      path: '/content',
      badge: badges.content > 0 ? badges.content.toString() : null,
      description: 'Gerenciar mídias'
    },
    { 
      text: 'Sedes', 
      icon: <LocationOn />, 
      path: '/locations',
      badge: badges.locations > 0 ? badges.locations.toString() : null,
      description: 'Localizações ativas'
    },
    { 
      text: 'Campanhas', 
      icon: <Campaign />, 
      path: '/campaigns',
      badge: null,
      description: 'Campanhas publicitárias'
    },
    { 
      text: 'Players', 
      icon: <Tv />, 
      path: '/players',
      badge: badges.players > 0 ? badges.players.toString() : null,
      description: 'Players online'
    },
    { 
      text: 'Agendamentos', 
      icon: <Schedule />, 
      path: '/schedules',
      badge: null,
      description: 'Programação de conteúdo'
    },
    { 
      text: 'Configurações', 
      icon: <Settings />, 
      path: '/settings',
      badge: null,
      description: 'Configurações do sistema'
    },
    { 
      text: 'Monitor de Tráfego', 
      icon: <TrendingUp />, 
      path: '/admin/traffic-monitor',
      badge: null,
      description: 'Estatísticas de rede por player'
    },
  ];

  const computedMenuItems = useMemo(() => {
    let items = [...menuItems];
    const isAdmin = user?.role === 'admin';

    // Ocultar Monitor de Tráfego para não-admin
    if (!isAdmin) {
      items = items.filter(i => i.path !== '/admin/traffic-monitor');
    }

    // Inserir item de aprovações para admin, preferencialmente antes do Monitor de Tráfego
    if (isAdmin) {
      const adminItem = {
        text: 'Solicitações de Acesso',
        icon: <PeopleIcon />,
        path: '/admin/pending-users',
        badge: null,
        description: 'Aprovar/Rejeitar novos usuários',
      };
      const monitorIdx = items.findIndex(i => i.path === '/admin/traffic-monitor');
      const insertIdx = monitorIdx >= 0 ? monitorIdx : items.length;
      items.splice(insertIdx, 0, adminItem);
    }

    return items;
  }, [menuItems, user]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  const drawer = (
    <Box
      sx={{
        height: '100%',
        background: isDarkMode 
          ? 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDarkMode 
            ? 'radial-gradient(circle at top left, rgba(255, 152, 0, 0.1) 0%, transparent 50%)'
            : 'radial-gradient(circle at top left, rgba(25, 118, 210, 0.05) 0%, transparent 50%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Toolbar
        sx={{
          background: isDarkMode 
            ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
            : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: -50,
            right: -50,
            width: 100,
            height: 100,
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            animation: 'pulse 4s ease-in-out infinite',
          },
          '@keyframes pulse': {
            '0%, 100%': {
              transform: 'scale(1)',
              opacity: 0.7,
            },
            '50%': {
              transform: 'scale(1.2)',
              opacity: 0.3,
            },
          },
        }}
      >
        <Box display="flex" alignItems="center" gap={2} sx={{ position: 'relative', zIndex: 1 }}>
          <Avatar
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              width: 40,
              height: 40,
              border: '2px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <Tv />
          </Avatar>
          <Box>
            <Typography variant="h6" noWrap component="div" fontWeight="bold" sx={{ color: isDarkMode ? 'white' : 'inherit' }}>
              TVS iTracker
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Digital Signage
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Box sx={{ p: 2, position: 'relative', zIndex: 1 }}>
        <Chip
          label={`Bem-vindo, ${user?.username || 'Usuário'}`}
          avatar={<Avatar sx={{ bgcolor: 'primary.main' }}><AccountCircle /></Avatar>}
          variant="outlined"
          sx={{
            width: '100%',
            justifyContent: 'flex-start',
            mb: 2,
            bgcolor: isDarkMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(25, 118, 210, 0.1)',
            borderColor: isDarkMode ? 'rgba(255, 152, 0, 0.3)' : 'rgba(25, 118, 210, 0.3)',
            '&:hover': {
              bgcolor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : 'rgba(25, 118, 210, 0.2)',
            },
          }}
        />
      </Box>

      <Divider sx={{ mx: 2, opacity: 0.3 }} />

      <List sx={{ px: 1, pt: 2, pb: 8 }}>
        {computedMenuItems.map((item, index) => {
          const isActive = location.pathname === item.path || 
                          (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          
          return (
            <Fade in={true} timeout={300 + index * 100} key={item.text}>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={isActive}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2,
                    mx: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    minHeight: 48,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: isActive 
                        ? (isDarkMode 
                          ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.2) 0%, rgba(245, 124, 0, 0.1) 100%)'
                          : 'linear-gradient(135deg, rgba(25, 118, 210, 0.15) 0%, rgba(21, 101, 192, 0.1) 100%)')
                        : 'transparent',
                      transition: 'all 0.3s ease',
                    },
                    '&:hover': {
                      transform: 'translateX(4px)',
                      bgcolor: 'transparent',
                      '&::before': {
                        background: isDarkMode 
                          ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.15) 0%, rgba(245, 124, 0, 0.05) 100%)'
                          : 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(21, 101, 192, 0.05) 100%)',
                      },
                    },
                    '&.Mui-selected': {
                      bgcolor: 'transparent',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 4,
                        height: '60%',
                        background: isDarkMode 
                          ? 'linear-gradient(180deg, #ff9800 0%, #f57c00 100%)'
                          : 'linear-gradient(180deg, #1976d2 0%, #1565c0 100%)',
                        borderRadius: '0 2px 2px 0',
                      },
                      '&:hover': {
                        bgcolor: 'transparent',
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      color: isActive 
                        ? (isDarkMode ? '#ff9800' : '#1976d2')
                        : 'inherit',
                      transition: 'all 0.3s ease',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                      minWidth: 40,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    sx={{ position: 'relative', zIndex: 1 }}
                    primary={
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography
                          variant="body2"
                          fontWeight={isActive ? 'bold' : 'medium'}
                          sx={{
                            color: isActive 
                              ? (isDarkMode ? '#ff9800' : '#1976d2')
                              : 'inherit',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {item.text}
                        </Typography>
                        {item.badge && (
                          <Badge
                            badgeContent={item.badge}
                            color="primary"
                            sx={{
                              '& .MuiBadge-badge': {
                                fontSize: '0.7rem',
                                minWidth: 18,
                                height: 18,
                                bgcolor: isDarkMode ? '#ff9800' : '#1976d2',
                              },
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          opacity: isActive ? 1 : 0.7,
                          transition: 'opacity 0.3s ease',
                          fontSize: '0.75rem',
                        }}
                      >
                        {item.description}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            </Fade>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: isDarkMode 
            ? 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(26, 26, 26, 0.95) 70%, rgba(255, 119, 48, 0.15) 100%)'
            : 'linear-gradient(135deg, rgba(25, 118, 210, 0.95) 0%, rgba(21, 101, 192, 0.95) 70%, rgba(255, 152, 0, 0.15) 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 119, 48, 0.3)' : 'rgba(255, 255, 255, 0.3)'}`,
          boxShadow: isDarkMode 
            ? '0 4px 20px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(255, 119, 48, 0.2)' 
            : '0 4px 20px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(255, 152, 0, 0.2)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: isDarkMode
              ? 'radial-gradient(ellipse at 30% 0%, rgba(255, 119, 48, 0.08) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at 30% 0%, rgba(255, 152, 0, 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: -1,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: isDarkMode
              ? 'linear-gradient(90deg, transparent 0%, rgba(255, 119, 48, 0.5) 50%, transparent 100%)'
              : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%)',
            zIndex: 1,
          }
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Controle de Televisões iTracker
          </Typography>
          <div>
            <IconButton
              color="inherit"
              onClick={toggleTheme}
              title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
              sx={{ 
                mr: 1,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              {isDarkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
              sx={{
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                <AccountCircle />
              </Avatar>
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              sx={{
                '& .MuiPaper-root': {
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                },
              }}
            >
              <MenuItem onClick={handleClose}>
                <AccountCircle sx={{ mr: 1 }} />
                {user?.username || 'Usuário'}
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <Logout sx={{ mr: 1 }} />
                Sair
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              border: 'none',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              border: 'none',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;
