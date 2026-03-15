import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { trackEvent } from '../analytics.js';
import { useAuth } from '../context/AuthContext.jsx';
import { clearAuthReturnPath, getAuthReturnPath } from '../lib/supabase.js';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading, authError } = useAuth();

  const callbackError = useMemo(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return (
      searchParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error_description') ||
      hashParams.get('error') ||
      authError
    );
  }, [authError, searchParams]);

  useEffect(() => {
    trackEvent('page_view', {
      page_name: 'auth_callback',
    });
  }, []);

  useEffect(() => {
    if (isLoading || !user) {
      return;
    }

    const nextPath = searchParams.get('next') || getAuthReturnPath() || '/app';
    clearAuthReturnPath();
    navigate(nextPath, { replace: true });
  }, [isLoading, navigate, searchParams, user]);

  return (
    <main className="page page-centered">
      <section className="card status-card">
        <span className="eyebrow">Authentication</span>
        <h1>{callbackError ? 'We could not complete sign-in' : 'Completing sign-in'}</h1>
        <p>
          {callbackError
            ? callbackError
            : 'Please wait while we finish your login and restore your session.'}
        </p>
        {callbackError ? (
          <Link className="secondary-button auth-link-button" to="/?auth=login&next=/app">
            Return to login
          </Link>
        ) : null}
      </section>
    </main>
  );
}
