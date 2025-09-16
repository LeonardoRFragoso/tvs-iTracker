import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  VideoLibrary as ContentIcon,
  Campaign as CampaignIcon,
  Tv as PlayerIcon,
  Schedule as ScheduleIcon,
  RssFeed as EditorialIcon,
  People as UsersIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const drawerWidth = 240;

const Sidebar = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, isManager } = useAuth();

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      roles: ['admin', 'manager', 'user'],
    },
    {
      text: 'Conteúdo',
      icon: <ContentIcon />,
      path: '/content',
      roles: ['admin', 'manager', 'user'],
    },
    {
      text: 'Campanhas',
      icon: <CampaignIcon />,
      path: '/campaigns',
      roles: ['admin', 'manager', 'user'],
    },
    {
      text: 'Players',
      icon: <PlayerIcon />,
      path: '/players',
      roles: ['admin', 'manager'],
    },
    {
      text: 'Agendamentos',
      icon: <ScheduleIcon />,
      path: '/schedules',
      roles: ['admin', 'manager'],
    },
    {
      text: 'Editorias',
      icon: <EditorialIcon />,
      path: '/editorials',
      roles: ['admin', 'manager'],
    },
    {
      text: 'Usuários',
      icon: <UsersIcon />,
      path: '/users',
      roles: ['admin'],
    },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < 600) {
      onClose();
    }
  };

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role)
  );

  const drawer = (
    <Box>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          minHeight: 64,
        }}
      >
        <Typography variant="h6" noWrap component="div">
          Menu
        </Typography>
      </Box>
      <Divider />
      
      <List>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? 'inherit' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mt: 2 }} />
      
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Logado como: {user?.username}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {user?.role === 'admin' ? 'Administrador' : 
           user?.role === 'manager' ? 'Gerente' : 'Usuário'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
    >
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="persistent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
        open={open}
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export default Sidebar;
