import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LiveMessages from './pages/LiveMessages';
import Conversations from './pages/Conversations';
import Documents from './pages/Documents';
import Analytics from './pages/Analytics';
import SystemHealth from './pages/SystemHealth';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="live" element={<LiveMessages />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="documents" element={<Documents />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="system" element={<SystemHealth />} />
        </Route>
      </Routes>
    </Router>
  );
}
