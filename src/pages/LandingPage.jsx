import { Fragment, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { trackEvent } from '../analytics.js';
import AuthPanel from '../components/AuthPanel.jsx';
import ConsentBanner from '../components/ConsentBanner.jsx';
import { landingPageSections } from '../content/landingPage.js';
import { useAuth } from '../context/AuthContext.jsx';

const scrollToId = (id) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function LandingPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next') || '/app';
  const authMode = searchParams.get('auth') === 'login' ? 'login' : 'signup';

  useEffect(() => {
    trackEvent('page_view', {
      page_name: 'landing_page',
    });
  }, []);

  return (
    <div className="app-shell landing-shell">
      <main className="landing-page">
        <header className="landing-header">
          <Link className="brand-mark" to="/">
            Resto Payout Auditor
          </Link>
          <nav className="landing-nav">
            <button type="button" onClick={() => scrollToId('how-it-works')}>
              Product
            </button>
            <button type="button" onClick={() => scrollToId('security-privacy')}>
              Privacy
            </button>
            <Link to="/legal/privacy">Privacy policy</Link>
            {user ? (
              <Link className="secondary-link" to="/app">
                Open app
              </Link>
            ) : (
              <Fragment>
                <Link className="secondary-link" to={`/?auth=login&next=${encodeURIComponent(nextPath)}`}>
                  Log in
                </Link>
                <button className="primary-button header-cta" type="button" onClick={() => scrollToId('auth-panel')}>
                  Sign up
                </button>
              </Fragment>
            )}
          </nav>
        </header>

        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="eyebrow">Payout recovery for restaurant operators</span>
            <h1>Find payout leakage. Estimate what is recoverable. Generate the claim pack.</h1>
            <p>
              Audit Uber Eats payouts against your POS export, score recoverable discrepancies,
              and move straight into dispute preparation from a browser-based workflow.
            </p>

            <div className="hero-actions">
              {user ? (
                <Link className="primary-button auth-link-button" to="/app">
                  Open recovery workspace
                </Link>
              ) : (
                <button className="primary-button" type="button" onClick={() => scrollToId('auth-panel')}>
                  Start free
                </button>
              )}
              <button className="secondary-button" type="button" onClick={() => scrollToId('how-it-works')}>
                See product
              </button>
            </div>

            <div className="trust-strip">
              <span>No installation. Browser-based.</span>
              <span>EU-oriented privacy controls.</span>
              <span>Uploads stay client-side in v1.</span>
            </div>
          </div>

          <AuthPanel key={authMode} initialMode={authMode} nextPath={nextPath} />
        </section>

        {landingPageSections.map((section) => (
          <section className="landing-section" id={section.id} key={section.id}>
            {section.type === 'social_proof' ? (
              <div className="proof-strip card">
                <span className="eyebrow">{section.eyebrow}</span>
                <div className="proof-items">
                  {section.items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {section.type === 'problem_solution' ? (
              <div className="editorial-block">
                <div className="section-copy">
                  <h2>{section.headline}</h2>
                  <p>{section.body}</p>
                </div>
                <div className="feature-card-grid">
                  {section.items.map((item) => (
                    <article className="card editorial-card" key={item.title}>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {section.type === 'how_it_works' ? (
              <div className="editorial-block">
                <div className="section-copy">
                  <span className="eyebrow">{section.eyebrow}</span>
                  <h2>{section.headline}</h2>
                </div>
                <div className="steps-grid">
                  {section.items.map((item, index) => (
                    <article className="card step-card" key={item}>
                      <span className="step-index">0{index + 1}</span>
                      <h3>{item}</h3>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {section.type === 'value_metrics' ? (
              <div className="metric-grid">
                {section.items.map((item) => (
                  <article className="card metric-card" key={item.value}>
                    <strong>{item.value}</strong>
                    <p>{item.label}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {section.type === 'feature_grid' ? (
              <div className="editorial-block">
                <div className="section-copy narrow-copy">
                  <h2>{section.headline}</h2>
                </div>
                <div className="feature-card-grid feature-card-grid-wide">
                  {section.items.map((item) => (
                    <article className="card editorial-card feature-card" key={item.title}>
                      <span className="feature-icon">{item.icon_key.slice(0, 1).toUpperCase()}</span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {section.type === 'security_privacy' ? (
              <div className="privacy-grid">
                <div className="section-copy">
                  <span className="eyebrow">{section.eyebrow}</span>
                  <h2>{section.headline}</h2>
                </div>
                <div className="privacy-list card">
                  {section.items.map((item) => (
                    <div className="privacy-list-item" key={item}>
                      <span className="privacy-list-bullet" />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section.type === 'faq' ? (
              <div className="editorial-block">
                <div className="section-copy">
                  <h2>{section.headline}</h2>
                </div>
                <div className="faq-list">
                  {section.items.map((item) => (
                    <article className="card faq-card" key={item.question}>
                      <h3>{item.question}</h3>
                      <p>{item.answer}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {section.type === 'final_cta' ? (
              <div className="card final-cta-card">
                <div>
                  <h2>{section.headline}</h2>
                  <p>{section.body}</p>
                </div>
                <div className="hero-actions">
                  <button className="primary-button" type="button" onClick={() => scrollToId('auth-panel')}>
                    {section.primary_cta.label}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => scrollToId('how-it-works')}>
                    {section.secondary_cta.label}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </main>

      <ConsentBanner />
    </div>
  );
}
