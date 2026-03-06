import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
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
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="live" element={<LiveMessages />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="documents" element={<Documents />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="system" element={<SystemHealth />} />
          <Route path="sms-configuration" element={<SMSConfiguration />} />
          <Route path="patient-management" element={<PatientManagement />} />
          <Route path="admin/hierarchy" element={<AdminDashboard />} />
          <Route path="admin/users" element={<UserManagement />} />
        </Route>
      </Routes>
    </Router>
  );
}
