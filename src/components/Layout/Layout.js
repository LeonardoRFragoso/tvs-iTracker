import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  CalendarToday,
  Password,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import axios from '../../config/axios';

const drawerWidth = 220;

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [badges, setBadges] = useState({
    content: 0,
    locations: 0,
    players: 0
  });
  const { user, logout } = useAuth();
  const { start: startOnboarding } = useOnboarding();
  const { isDarkMode, toggleTheme, animationsEnabled, transitionDuration } = useTheme();
  const { getSetting, companyDisplayName } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const didFetchBadgesRef = useRef(false);
  const brandBase = 'ICTSI TVs';
  const effectiveCompanyName = (companyDisplayName || (getSetting && getSetting('general.company_name', '')) || '').trim();
  const appTitle = effectiveCompanyName ? `${brandBase} - ${effectiveCompanyName}` : brandBase;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = appTitle;
    }
  }, [appTitle]);

  // Buscar dados para badges
  useEffect(() => {
    if (didFetchBadgesRef.current) return;
    const fetchBadgeData = async () => {
      try {
        // Buscar endpoints de forma resiliente para não falhar tudo se um deles der erro
        const [contentRes, locationsRes, playersStatsRes] = await Promise.allSettled([
          axios.get('/content?per_page=1'),
          axios.get('/locations?per_page=1'),
          axios.get('/players/stats') // players online
        ]);

        const contentTotal = (contentRes.status === 'fulfilled')
          ? (contentRes.value?.data?.total || contentRes.value?.data?.contents?.length || 0)
          : 0;

        const locationsTotal = (locationsRes.status === 'fulfilled')
          ? (locationsRes.value?.data?.total || locationsRes.value?.data?.locations?.length || 0)
          : 0;

        const playersOnline = (playersStatsRes.status === 'fulfilled')
          ? (playersStatsRes.value?.data?.online_players || 0)
          : 0;

        setBadges({
          content: contentTotal,
          locations: locationsTotal,
          players: playersOnline
        });
      } catch (error) {
        console.error('Erro ao buscar dados dos badges:', error);
        // Em caso de erro inesperado do bloco acima, manter estado atual (sem hardcode)
      }
    };

    fetchBadgeData();
    didFetchBadgesRef.current = true;
  }, []);

  // Atalhos globais de teclado
  useEffect(() => {
    const handleKeyPress = (event) => {
      const activeElement = document.activeElement;
      const isInputActive = !!(
        activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.isContentEditable ||
          (typeof activeElement.closest === 'function' && (
            activeElement.closest('input, textarea, select, [contenteditable="true"], .MuiInputBase-root, [role="textbox"]')
          ))
        )
      );

      if (isInputActive) return;

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'h':
            event.preventDefault();
            console.log('[Atalho] Ctrl+H - Navegando para dashboard');
            // Navegar para dashboard e mostrar atalhos
            navigate('/dashboard');
            // Pequeno delay para garantir que a página carregou
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('showKeyboardShortcuts'));
            }, 100);
            break;
          case '1':
            event.preventDefault();
            console.log('[Atalho] Ctrl+1 - Navegando para /content/new');
            navigate('/content/new');
            break;
          case '2':
            event.preventDefault();
            console.log('[Atalho] Ctrl+2 - Navegando para /campaigns/new');
            navigate('/campaigns/new');
            break;
          case '3':
            event.preventDefault();
            console.log('[Atalho] Ctrl+3 - Navegando para /players/new');
            navigate('/players/new');
            break;
          case '4':
            event.preventDefault();
            console.log('[Atalho] Ctrl+4 - Navegando para /schedules/new');
            navigate('/schedules/new');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

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
        text: 'Empresas', 
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
      text: 'Calendário', 
      icon: <CalendarToday />, 
      path: '/calendar',
      badge: null,
      description: 'Visualização unificada de agendamentos'
    },
  ];

  const computedMenuItems = useMemo(() => {
    let items = [...menuItems];
    // Separar itens que devem ir para a seção Administração
    const locationItem = items.find(i => i.path === '/locations');
    const playersItem = items.find(i => i.path === '/players');
    // Remover temporariamente para reordenar depois
    items = items.filter(i => i.path !== '/locations' && i.path !== '/players');
    const isAdmin = user?.role === 'admin';

    // Remover Monitor de Tráfego e Configurações temporariamente
    items = items.filter(i => i.path !== '/admin/traffic-monitor' && i.path !== '/settings');

    // Adicionar item de aprovações para admin
    if (isAdmin) {
      const adminItem = {
        text: 'Solicitações de Acesso',
        icon: <PeopleIcon />,
        path: '/admin/pending-users',
        badge: null,
        description: 'Aprovar/Rejeitar novos usuários',
      };
      items.push(adminItem);

      // Adicionar Monitor de Tráfego para admin
      const monitorItem = {
        text: 'Monitor de Tráfego',
        icon: <TrendingUp />,
        path: '/admin/traffic-monitor',
        badge: null,
        description: 'Estatísticas de rede por player'
      };
      items.push(monitorItem);
    }

    // Adicionar Empresas e Players na área de Administração (após itens admin e antes de Configurações)
    if (locationItem) items.push(locationItem);
    if (playersItem) items.push(playersItem);

    // Sempre adicionar Configurações como último item
    const configItem = {
      text: 'Configurações',
      icon: <Settings />,
      path: '/settings',
      badge: null,
      description: 'Configurações do sistema'
    };
    items.push(configItem);

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
        background: isDarkMode ? '#151515' : '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        '&::before': {
          content: '""',
          background: 'transparent',
          pointerEvents: 'none',
        },
      }}
    >
      <Toolbar
        sx={{
          background: isDarkMode ? '#121212' : '#1976d2',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          '&::after': {
            content: '""',
            display: 'none',
          },
        }}
      >
        <Box display="flex" alignItems="center" gap={2} sx={{ position: 'relative', zIndex: 1 }}>
          <Avatar
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              width: 28,
              height: 28,
              border: '2px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <Tv />
          </Avatar>
          <Box>
            <Typography variant="h6" noWrap component="div" fontWeight="bold" sx={{ color: isDarkMode ? 'white' : 'inherit' }}>
              {brandBase}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {effectiveCompanyName || ''}
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Box sx={{ p: 1.5, position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <Chip
          label={`Bem-vindo, ${user?.username || 'Usuário'}`}
          avatar={<Avatar sx={{ bgcolor: 'primary.main' }}><AccountCircle /></Avatar>}
          variant="outlined"
          sx={{
            width: '100%',
            justifyContent: 'flex-start',
            mb: 1.5,
            bgcolor: isDarkMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(25, 118, 210, 0.1)',
            borderColor: isDarkMode ? 'rgba(255, 152, 0, 0.3)' : 'rgba(25, 118, 210, 0.3)',
            '&:hover': {
              bgcolor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : 'rgba(25, 118, 210, 0.2)',
            },
          }}
        />
      </Box>

      <Divider sx={{ mx: 2, opacity: 0.3, flexShrink: 0 }} />

      <Box 
        sx={{ 
          flex: 1, 
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: isDarkMode ? 'rgba(255, 152, 0, 0.3)' : 'rgba(25, 118, 210, 0.3)',
            borderRadius: '3px',
            '&:hover': {
              background: isDarkMode ? 'rgba(255, 152, 0, 0.5)' : 'rgba(25, 118, 210, 0.5)',
            },
          },
        }}
      >
        <List sx={{ px: 1, pt: 1.5, pb: 3 }}>
          {computedMenuItems.map((item, index) => {
            const isActive = location.pathname === item.path || 
                            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            const dataTour = item.path === '/content' ? 'menu-content'
              : item.path === '/campaigns' ? 'menu-campaigns'
              : item.path === '/schedules' ? 'menu-schedules'
              : item.path === '/players' ? 'menu-players'
              : item.path === '/calendar' ? 'menu-calendar'
              : item.path === '/dashboard' ? 'menu-dashboard'
              : undefined;
            
            // Adicionar separador antes dos itens administrativos
            const isAdminItem = item.path.startsWith('/admin') 
                               || item.path === '/settings'
                               || item.path === '/locations'
                               || item.path === '/players';
            const prevItem = computedMenuItems[index - 1];
            const prevIsAdmin = prevItem && (prevItem.path.startsWith('/admin') 
                               || prevItem.path === '/settings'
                               || prevItem.path === '/locations'
                               || prevItem.path === '/players');
            const showDivider = isAdminItem && prevItem && !prevIsAdmin;
            
            return (
              <React.Fragment key={item.text}>
                {showDivider && (
                  <Divider 
                    sx={{ 
                      mx: 2, 
                      my: 2, 
                      opacity: 0.3,
                      '&::before, &::after': {
                        borderColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : 'rgba(25, 118, 210, 0.2)',
                      }
                    }} 
                  >
                    <Chip 
                      label="Administração" 
                      size="small" 
                      sx={{ 
                        fontSize: '0.7rem',
                        height: 20,
                        bgcolor: isDarkMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(25, 118, 210, 0.1)',
                        color: isDarkMode ? '#ff9800' : '#1976d2',
                        border: `1px solid ${isDarkMode ? 'rgba(255, 152, 0, 0.3)' : 'rgba(25, 118, 210, 0.3)'}`,
                      }} 
                    />
                  </Divider>
                )}
                
                <Fade in={true} timeout={animationsEnabled ? Math.max(0, Math.min(transitionDuration + index * 100, 1500)) : 0}>
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      data-tour={dataTour}
                      selected={isActive}
                      onClick={() => navigate(item.path)}
                      sx={{
                        borderRadius: 2,
                        mx: 1,
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        minHeight: 42,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: isActive
                            ? (isDarkMode ? 'rgba(255, 152, 0, 0.12)' : 'rgba(25, 118, 210, 0.12)')
                            : 'transparent',
                          transition: 'all 0.3s ease',
                        },
                        '&:hover': {
                          transform: 'translateX(4px)',
                          bgcolor: isDarkMode ? '#1e1e1e' : 'rgba(0,0,0,0.03)',
                          '&::before': {
                            background: isDarkMode ? 'rgba(255, 152, 0, 0.08)' : 'rgba(25,118,210,0.08)',
                          },
                        },
                        '&.Mui-selected': {
                          bgcolor: isDarkMode ? '#232323' : 'rgba(0,0,0,0.04)',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 4,
                            height: '60%',
                            background: isDarkMode ? '#ff9800' : '#1976d2',
                            borderRadius: '0 2px 2px 0',
                          },
                          '&:hover': {
                            bgcolor: isDarkMode ? '#262626' : 'rgba(0,0,0,0.06)',
                          },
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          position: 'relative',
                          zIndex: 1,
                          color: isActive ? (isDarkMode ? '#ff9800' : '#1976d2') : 'inherit',
                          transition: 'all 0.3s ease',
                          transform: isActive ? 'scale(1.1)' : 'scale(1)',
                          minWidth: 36,
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
                                    minWidth: 16,
                                    height: 16,
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
                              fontSize: '0.7rem',
                            }}
                          >
                            {item.description}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                </Fade>
              </React.Fragment>
            );
          })}
        </List>
      </Box>
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
          background: isDarkMode ? '#121212' : '#1976d2',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${isDarkMode ? '#2a2a2a' : 'rgba(255,255,255,0.3)'}`,
          boxShadow: 'none',
          '&::before': {
            display: 'none',
          },
          '&::after': {
            display: 'none',
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
            {appTitle}
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
                  background: isDarkMode ? '#1a1a1a' : '#ffffff',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                },
              }}
            >
              <MenuItem onClick={handleClose}>
                <AccountCircle sx={{ mr: 1 }} />
                {user?.username || 'Usuário'}
              </MenuItem>
              {user?.role === 'admin' && (
                <MenuItem onClick={() => { navigate('/users'); handleClose(); }}>
                  <Password sx={{ mr: 1 }} />
                  Trocar senha de usuários
                </MenuItem>
              )}
              <MenuItem onClick={() => { startOnboarding(); handleClose(); }}>
                <Password sx={{ mr: 1 }} />
                Iniciar Tour
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
        sx={{ flexGrow: 1, p: 1.5, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;
