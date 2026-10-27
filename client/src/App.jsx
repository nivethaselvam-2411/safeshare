import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Files from './pages/Files';
import FileDetail from './pages/FileDetail';
import Audit from './pages/Audit';
import Admin from './pages/Admin';
import PublicShare from './pages/PublicShare';

function Guard({ children, admin }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="splash"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth register />} />
      <Route path="/s/:token" element={<PublicShare />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="files" element={<Files scope="mine" />} />
        <Route path="shared" element={<Files scope="shared" />} />
        <Route path="trash" element={<Files scope="trash" />} />
        <Route path="files/:id" element={<FileDetail />} />
        <Route path="audit" element={<Audit />} />
        <Route path="admin" element={<Guard admin><Admin /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
