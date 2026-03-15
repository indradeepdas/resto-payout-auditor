import { Link, Navigate, useParams } from 'react-router-dom';
import { trackEvent } from '../analytics.js';
import { legalDocuments } from '../content/legal.js';
import { useEffect } from 'react';

export default function LegalPage() {
  const { docType } = useParams();
  const document = legalDocuments[docType];

  useEffect(() => {
    if (document) {
      trackEvent('page_view', {
        page_name: `legal_${docType}`,
      });
    }
  }, [docType, document]);

  if (!document) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell landing-shell">
      <main className="legal-page page">
        <header className="landing-header legal-header">
          <Link className="brand-mark" to="/">
            Resto Payout Auditor
          </Link>
          <nav className="landing-nav">
            <Link to="/">Home</Link>
            <Link to="/app">App</Link>
          </nav>
        </header>

        <section className="card legal-card">
          <span className="eyebrow">Legal</span>
          <h1>{document.title}</h1>
          <p>{document.intro}</p>

          <div className="legal-sections">
            {document.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
