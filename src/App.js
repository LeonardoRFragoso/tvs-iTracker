import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import PrivateRoute from './components/Common/PrivateRoute';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ContentList from './pages/Content/ContentList';
import ContentDetail from './pages/Content/ContentDetail';
import ContentForm from './pages/Content/ContentForm';
import CampaignList from './pages/Campaigns/CampaignList';
import CampaignDetail from './pages/Campaigns/CampaignDetail';
import CampaignForm from './pages/Campaigns/CampaignForm';
import PlayerList from './pages/Players/PlayerList';
import PlayerDetail from './pages/Players/PlayerDetail';
import PlayerForm from './pages/Players/PlayerForm';
import PlayerSettings from './pages/Players/PlayerSettings';
import PlayerView from './pages/Player/PlayerView';
import LocationList from './pages/Locations/LocationList';
import LocationForm from './pages/Locations/LocationForm';
import LocationDetail from './pages/Locations/LocationDetail';
import ScheduleList from './pages/Schedules/ScheduleList';
import ScheduleForm from './pages/Schedules/ScheduleForm';
import Settings from './pages/Settings/Settings';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import PendingUsers from './pages/Admin/PendingUsers';
import TrafficMonitor from './pages/Admin/TrafficMonitor';
import UsersSummary from './pages/Admin/UsersSummary';
import ScheduleCalendar from './pages/Schedules/ScheduleCalendar';
import SchedulesCalendar from './pages/Schedules/SchedulesCalendar';
import Calendar from './pages/Calendar';

function App() {
  return (
    <SocketProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
        {/* Short friendly code route -> will resolve and redirect to /kiosk/player/:id */}
        <Route path="/k/:code" element={<PlayerView />} />
        {/* Public kiosk route for Smart TVs / Android / Windows */}
        <Route path="/kiosk/player/:id" element={<PlayerView />} />
        <Route path="/player/:id" element={<PrivateRoute><PlayerView /></PrivateRoute>} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          {/* Content routes - specific routes first */}
          <Route path="content" element={<ContentList />} />
          <Route path="content/new" element={<ContentForm />} />
          <Route path="content/:id/edit" element={<ContentForm />} />
          <Route path="content/:id" element={<ContentDetail />} />
          
          {/* Campaign routes - specific routes first */}
          <Route path="campaigns" element={<CampaignList />} />
          <Route path="campaigns/new" element={<CampaignForm />} />
          <Route path="campaigns/:id/edit" element={<CampaignForm />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          
          <Route path="locations" element={<LocationList />} />
          <Route path="locations/new" element={<LocationForm />} />
          <Route path="locations/:id/edit" element={<LocationForm />} />
          <Route path="locations/:id" element={<LocationDetail />} />
          <Route path="players" element={<PlayerList />} />
          <Route path="players/new" element={<PlayerForm />} />
          <Route path="players/:id" element={<PlayerDetail />} />
          <Route path="players/:id/edit" element={<PlayerForm />} />
          <Route path="players/:id/settings" element={<PlayerSettings />} />
          
          {/* Schedule routes - specific routes first */}
          <Route path="schedules" element={<ScheduleList />} />
          <Route path="schedules/new" element={<ScheduleForm />} />
          <Route path="schedules/:id/edit" element={<ScheduleForm />} />
          <Route path="schedules/calendar" element={<SchedulesCalendar />} />
          <Route path="players/:id/calendar" element={<ScheduleCalendar />} />
          
          {/* Unified Calendar route */}
          <Route path="calendar" element={<Calendar />} />
          
          <Route path="settings" element={<Settings />} />
          
          {/* Admin routes */}
          <Route path="admin/pending-users" element={<PendingUsers />} />
          <Route path="admin/traffic-monitor" element={<TrafficMonitor />} />
          <Route path="admin/users-summary" element={<UsersSummary />} />
          {/* Admin: Users CRUD (same component, Users tab default) */}
          <Route path="users" element={<PendingUsers />} />
        </Route>
      </Routes>
    </SocketProvider>
  );
}

export default App;
