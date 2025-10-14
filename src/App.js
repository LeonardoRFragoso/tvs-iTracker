import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
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
            <ErrorBoundary>
              <Layout />
            </ErrorBoundary>
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          {/* Content routes - specific routes first */}
          <Route path="content" element={<ContentList />} />
          <Route path="content/new" element={<ErrorBoundary><ContentForm /></ErrorBoundary>} />
          <Route path="content/:id/edit" element={<ErrorBoundary><ContentForm /></ErrorBoundary>} />
          <Route path="content/:id" element={<ErrorBoundary><ContentDetail /></ErrorBoundary>} />
          
          {/* Campaign routes - specific routes first */}
          <Route path="campaigns" element={<ErrorBoundary><CampaignList /></ErrorBoundary>} />
          <Route path="campaigns/new" element={<ErrorBoundary><CampaignForm /></ErrorBoundary>} />
          <Route path="campaigns/:id/edit" element={<ErrorBoundary><CampaignForm /></ErrorBoundary>} />
          <Route path="campaigns/:id" element={<ErrorBoundary><CampaignDetail /></ErrorBoundary>} />
          
          <Route path="locations" element={<ErrorBoundary><LocationList /></ErrorBoundary>} />
          <Route path="locations/new" element={<ErrorBoundary><LocationForm /></ErrorBoundary>} />
          <Route path="locations/:id/edit" element={<ErrorBoundary><LocationForm /></ErrorBoundary>} />
          <Route path="locations/:id" element={<ErrorBoundary><LocationDetail /></ErrorBoundary>} />
          <Route path="players" element={<ErrorBoundary><PlayerList /></ErrorBoundary>} />
          <Route path="players/new" element={<ErrorBoundary><PlayerForm /></ErrorBoundary>} />
          <Route path="players/:id" element={<ErrorBoundary><PlayerDetail /></ErrorBoundary>} />
          <Route path="players/:id/edit" element={<ErrorBoundary><PlayerForm /></ErrorBoundary>} />
          <Route path="players/:id/settings" element={<ErrorBoundary><PlayerSettings /></ErrorBoundary>} />
          
          {/* Schedule routes - specific routes first */}
          <Route path="schedules" element={<ErrorBoundary><ScheduleList /></ErrorBoundary>} />
          <Route path="schedules/new" element={<ErrorBoundary><ScheduleForm /></ErrorBoundary>} />
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
