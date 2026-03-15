import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import LegalPage from './pages/LegalPage.jsx';
import AuthCallbackPage from './pages/AuthCallbackPage.jsx';
import ProductWorkspace from './pages/ProductWorkspace.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/legal/:docType" element={<LegalPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <ProductWorkspace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/privacy"
        element={
          <ProtectedRoute>
            <PrivacyPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
