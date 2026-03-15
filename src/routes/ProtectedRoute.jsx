import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="page page-centered">
        <section className="card status-card">
          <span className="eyebrow">Session</span>
          <h1>Restoring your session</h1>
          <p>We are checking your sign-in state before loading the recovery workspace.</p>
        </section>
      </main>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}
