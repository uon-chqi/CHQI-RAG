import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import LiveMessages from './pages/LiveMessages';
import Conversations from './pages/Conversations';
import Documents from './pages/Documents';
import Analytics from './pages/Analytics';
import SystemHealth from './pages/SystemHealth';
import SMSConfiguration from './pages/SMSConfiguration';
import PatientManagement from './pages/PatientManagement';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="live" element={<LiveMessages />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="documents" element={<Documents />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="system" element={<SystemHealth />} />
            <Route path="sms-configuration" element={<SMSConfiguration />} />
            <Route path="patient-management" element={<PatientManagement />} />
            <Route path="organisations" element={<AdminDashboard />} />
            <Route path="admin/hierarchy" element={<AdminDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
