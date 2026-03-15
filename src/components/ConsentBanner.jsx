import { Link } from 'react-router-dom';
import { useConsent } from '../context/ConsentContext.jsx';

export default function ConsentBanner() {
  const { hasAnalyticsChoice, setConsent, isLoading } = useConsent();

  if (isLoading || hasAnalyticsChoice) {
    return null;
  }

  return (
    <div className="consent-banner card" role="dialog" aria-live="polite">
      <div>
        <strong>Privacy choices</strong>
        <p>
          We keep optional analytics off until you decide. Essential authentication and security
          processing still applies. Read the <Link to="/legal/privacy">Privacy Policy</Link>.
        </p>
      </div>
      <div className="consent-banner-actions">
        <button className="secondary-button" type="button" onClick={() => setConsent('analytics', false, 'cookie_banner')}>
          Reject analytics
        </button>
        <button className="primary-button" type="button" onClick={() => setConsent('analytics', true, 'cookie_banner')}>
          Accept analytics
        </button>
      </div>
    </div>
  );
}
