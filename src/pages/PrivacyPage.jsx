import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../analytics.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useConsent } from '../context/ConsentContext.jsx';

export default function PrivacyPage() {
  const { user } = useAuth();
  const {
    analyticsConsent,
    marketingConsent,
    termsAccepted,
    privacyAccepted,
    requestStatus,
    setConsent,
    submitPrivacyRequest,
  } = useConsent();
  const [notes, setNotes] = useState('');
  const [pageMessage, setPageMessage] = useState('');

  useEffect(() => {
    trackEvent('page_view', {
      page_name: 'privacy_center',
    });
  }, []);

  const handlePrivacyRequest = async (requestType) => {
    try {
      const statusMessage = await submitPrivacyRequest(requestType, notes);
      setPageMessage(statusMessage);
    } catch (error) {
      setPageMessage(error.message || 'Could not submit the privacy request.');
    }
  };

  return (
    <div className="app-shell app-workspace-shell">
      <main className="page">
        <header className="workspace-topbar card">
          <div>
            <span className="eyebrow">Account</span>
            <h1>Privacy Center</h1>
            <p>Manage consent preferences and submit GDPR-style privacy requests.</p>
          </div>
          <div className="workspace-actions">
            <Link className="secondary-button auth-link-button" to="/app">
              Back to workspace
            </Link>
          </div>
        </header>

        <section className="privacy-settings-grid">
          <article className="card privacy-settings-card">
            <h2>Consent preferences</h2>
            <div className="preference-list">
              <label className="preference-row">
                <div>
                  <strong>Analytics</strong>
                  <p>Enable optional product analytics after explicit consent.</p>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsConsent}
                  onChange={(event) => setConsent('analytics', event.target.checked, 'settings')}
                />
              </label>
              <label className="preference-row">
                <div>
                  <strong>Marketing emails</strong>
                  <p>Receive occasional product updates and release notes.</p>
                </div>
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(event) => setConsent('marketing_emails', event.target.checked, 'settings')}
                />
              </label>
            </div>
          </article>

          <article className="card privacy-settings-card">
            <h2>Account record</h2>
            <dl className="detail-grid">
              <div>
                <dt>Email</dt>
                <dd>{user?.email || 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Terms accepted</dt>
                <dd>{termsAccepted ? 'Yes' : 'Not recorded yet'}</dd>
              </div>
              <div>
                <dt>Privacy policy acknowledged</dt>
                <dd>{privacyAccepted ? 'Yes' : 'Not recorded yet'}</dd>
              </div>
            </dl>
            <p className="detail-note">
              Review the current <Link to="/legal/privacy">Privacy Policy</Link> and{' '}
              <Link to="/legal/terms">Terms of Service</Link>.
            </p>
          </article>
        </section>

        <section className="card privacy-request-card">
          <div className="section-header">
            <div>
              <h2>Privacy requests</h2>
              <p>Submit account export, deletion, rectification, or restriction requests.</p>
            </div>
          </div>

          <label className="inline-field">
            <span>Notes for the privacy team</span>
            <textarea
              className="privacy-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add context for the request if needed."
            />
          </label>

          <div className="privacy-request-actions">
            <button className="secondary-button" type="button" onClick={() => handlePrivacyRequest('export')}>
              Request export
            </button>
            <button className="secondary-button" type="button" onClick={() => handlePrivacyRequest('rectification')}>
              Request rectification
            </button>
            <button className="secondary-button" type="button" onClick={() => handlePrivacyRequest('restriction')}>
              Request restriction
            </button>
            <button className="primary-button" type="button" onClick={() => handlePrivacyRequest('delete')}>
              Request deletion
            </button>
          </div>

          {pageMessage || requestStatus ? (
            <div className="notice">{pageMessage || requestStatus}</div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
