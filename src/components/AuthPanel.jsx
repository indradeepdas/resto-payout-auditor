import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useConsent } from '../context/ConsentContext.jsx';

const defaultCheckboxState = {
  terms: false,
  privacy: false,
  marketing_emails: false,
};

export default function AuthPanel({ initialMode = 'signup', nextPath = '/app' }) {
  const {
    user,
    authError,
    emailSentTo,
    authAvailable,
    googleEnabled,
    appleEnabled,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    clearAuthError,
    authUnavailableMessage,
  } = useAuth();
  const { stageSignupConsents } = useConsent();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkboxes, setCheckboxes] = useState(defaultCheckboxState);
  const [formError, setFormError] = useState('');

  const helperCopy = useMemo(() => {
    if (mode === 'login') {
      return 'Log in with the method you already use for the product.';
    }

    return 'Create an account to unlock uploads, audits, recovery scoring, and claim-pack exports.';
  }, [mode]);

  const validateSignupRequirements = () => {
    if (mode === 'login') {
      return true;
    }

    if (!checkboxes.terms || !checkboxes.privacy) {
      setFormError('Accept the Terms and Privacy Policy before creating an account.');
      return false;
    }

    stageSignupConsents(checkboxes);
    return true;
  };

  const handleOauth = async (provider) => {
    if (!validateSignupRequirements()) {
      return;
    }

    setFormError('');
    clearAuthError();
    setIsSubmitting(true);

    const result = provider === 'google'
      ? await signInWithGoogle(nextPath)
      : await signInWithApple(nextPath);

    if (result.error) {
      setIsSubmitting(false);
      return;
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setFormError('Enter an email address to receive the magic link.');
      return;
    }

    if (!validateSignupRequirements()) {
      return;
    }

    setFormError('');
    clearAuthError();
    setIsSubmitting(true);
    const result = await signInWithEmail(email.trim(), nextPath);
    setIsSubmitting(false);

    if (result.error) {
      return;
    }
  };

  if (user) {
    return (
      <aside className="auth-panel card" id="auth-panel">
        <span className="eyebrow">Account</span>
        <h2>You are already signed in.</h2>
        <p>Your workspace is available immediately, including uploads, reconciliation, and claim-pack generation.</p>
        <Link className="primary-button auth-link-button" to="/app">
          Open recovery workspace
        </Link>
      </aside>
    );
  }

  return (
    <aside className="auth-panel card" id="auth-panel">
      <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
        <button
          className={mode === 'signup' ? 'auth-toggle-button active' : 'auth-toggle-button'}
          type="button"
          onClick={() => {
            clearAuthError();
            setFormError('');
            setMode('signup');
          }}
        >
          Sign up
        </button>
        <button
          className={mode === 'login' ? 'auth-toggle-button active' : 'auth-toggle-button'}
          type="button"
          onClick={() => {
            clearAuthError();
            setFormError('');
            setMode('login');
          }}
        >
          Log in
        </button>
      </div>

      <div className="auth-copy-block">
        <span className="eyebrow">Secure access</span>
        <h2>{mode === 'signup' ? 'Create your account' : 'Access your account'}</h2>
        <p>{helperCopy}</p>
      </div>

      {!authAvailable ? <div className="warning-panel">{authUnavailableMessage}</div> : null}
      {formError ? <div className="error-panel"><p>{formError}</p></div> : null}
      {authError ? <div className="error-panel"><p>{authError}</p></div> : null}
      {emailSentTo ? (
        <div className="notice">
          Magic link sent to <strong>{emailSentTo}</strong>. Open the email to finish sign-in.
        </div>
      ) : null}

      <div className="auth-provider-stack">
        {googleEnabled ? (
          <button
            className="secondary-button auth-provider-button"
            type="button"
            onClick={() => handleOauth('google')}
            disabled={!authAvailable || isSubmitting}
          >
            Continue with Google
          </button>
        ) : null}
        {appleEnabled ? (
          <button
            className="secondary-button auth-provider-button"
            type="button"
            onClick={() => handleOauth('apple')}
            disabled={!authAvailable || isSubmitting}
          >
            Continue with Apple
          </button>
        ) : null}
      </div>

      <div className="auth-divider">or use email</div>

      <form className="auth-email-form" onSubmit={handleEmailSubmit}>
        <label className="inline-field">
          <span>Email address</span>
          <input
            type="email"
            placeholder="finance@restaurant-group.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!authAvailable || isSubmitting}
          />
        </label>
        <button className="primary-button" type="submit" disabled={!authAvailable || isSubmitting}>
          {mode === 'signup' ? 'Send magic link' : 'Email me a sign-in link'}
        </button>
      </form>

      {mode === 'signup' ? (
        <div className="consent-checklist">
          <label className="consent-option">
            <input
              type="checkbox"
              checked={checkboxes.terms}
              onChange={(event) => setCheckboxes((current) => ({ ...current, terms: event.target.checked }))}
            />
            <span>
              I agree to the <Link to="/legal/terms">Terms of Service</Link>.
            </span>
          </label>
          <label className="consent-option">
            <input
              type="checkbox"
              checked={checkboxes.privacy}
              onChange={(event) =>
                setCheckboxes((current) => ({ ...current, privacy: event.target.checked }))
              }
            />
            <span>
              I acknowledge the <Link to="/legal/privacy">Privacy Policy</Link>.
            </span>
          </label>
          <label className="consent-option optional">
            <input
              type="checkbox"
              checked={checkboxes.marketing_emails}
              onChange={(event) =>
                setCheckboxes((current) => ({
                  ...current,
                  marketing_emails: event.target.checked,
                }))
              }
            />
            <span>Send me occasional product updates by email.</span>
          </label>
        </div>
      ) : null}
    </aside>
  );
}
