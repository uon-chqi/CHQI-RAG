import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveMessages from './pages/LiveMessages';
import Conversations from './pages/Conversations';
import Documents from './pages/Documents';
import Analytics from './pages/Analytics';
import SystemHealth from './pages/SystemHealth';
import SMSConfiguration from './pages/SMSConfiguration';
import PatientManagement from './pages/PatientManagement';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import FacilityDetail from './pages/FacilityDetail';
import Chatbot from './pages/Chatbot';
import ClientChat from './pages/ClientChat';
import FlaggedPatients from './pages/FlaggedPatients';
import SmsTemplates from './pages/smsmodule/SmsTemplates';
import WorkflowsList from './pages/smsmodule/WorkflowsList';
import WorkflowBuilder from './pages/smsmodule/WorkflowBuilder';
import WorkflowSimulation from './pages/smsmodule/WorkflowSimulation';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors closeButton />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/client/chat" element={<ClientChat />} />
          <Route path="/client/chat/:clientid" element={<ClientChat />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="outbox" element={<Conversations />} />
            <Route path="inbox" element={<LiveMessages />} />
            <Route path="documents" element={<Documents />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="system" element={<SystemHealth />} />
            <Route path="sms-configuration" element={<SMSConfiguration />} />
            <Route path="patient-management" element={<PatientManagement />} />
            <Route path="organisations" element={<AdminDashboard />} />
            <Route path="organisations/:id" element={<FacilityDetail />} />
            <Route path="flagged-patients" element={<FlaggedPatients />} />
            <Route path="flagged-patients/:facilityId" element={<FlaggedPatients />} />
            <Route path="admin/hierarchy" element={<AdminDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/sms-templates" element={<ProtectedRoute requiredRole="super_admin"><SmsTemplates /></ProtectedRoute>} />
            <Route path="admin/workflows" element={<ProtectedRoute requiredRole="super_admin"><WorkflowsList /></ProtectedRoute>} />
            <Route path="admin/workflows/builder/:id?" element={<ProtectedRoute requiredRole="super_admin"><WorkflowBuilder /></ProtectedRoute>} />
            <Route path="admin/workflow-simulation" element={<ProtectedRoute requiredRole="super_admin"><WorkflowSimulation /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}