export const landingPageSections = [
  {
    id: 'social-proof',
    type: 'social_proof',
    eyebrow: 'Used by operators who care about margin leakage',
    items: ['Restaurants', 'Finance teams', 'Multi-site operators', 'Revenue assurance'],
  },
  {
    id: 'problem-solution',
    type: 'problem_solution',
    headline: 'Stop finding payout issues too late to recover them.',
    body: 'The product moves from payout diagnosis into claim-ready recovery work, without forcing your team into spreadsheets and manual evidence packs.',
    items: [
      {
        title: 'Missed payouts',
        description: 'Spot orders that exist in the POS but never settle into the platform payout export.',
      },
      {
        title: 'Overcharged commissions',
        description: 'Compare actual fees to expected contract logic and isolate commission leakage quickly.',
      },
      {
        title: 'Manual dispute prep',
        description: 'Turn anomalies into structured claim lines with suggested reasons and next actions.',
      },
    ],
  },
  {
    id: 'how-it-works',
    type: 'how_it_works',
    eyebrow: 'How it works',
    headline: 'Four steps from raw files to a dispute-ready claim pack.',
    items: [
      'Upload files',
      'Detect discrepancies',
      'Estimate recoverable revenue',
      'Generate claim pack',
    ],
  },
  {
    id: 'value-metrics',
    type: 'value_metrics',
    headline: 'What the workflow is designed to improve.',
    items: [
      { value: 'Recoverable revenue', label: 'Quantify likely claim value before you spend ops time.' },
      { value: 'Audit time saved', label: 'Replace manual cross-checks with deterministic reconciliation.' },
      { value: 'Claim-ready lines', label: 'Prioritize the highest-confidence payout disputes first.' },
    ],
  },
  {
    id: 'feature-grid',
    type: 'feature_grid',
    headline: 'Built for finance-grade payout recovery, not generic reporting.',
    items: [
      {
        icon_key: 'audit',
        title: 'Audit engine',
        description: 'Automatic column mapping, file parsing, discrepancy detection, and reconciliation exports.',
      },
      {
        icon_key: 'recovery',
        title: 'Recovery scoring',
        description: 'Deterministic recoverability scoring for missing payouts, net mismatches, and fee disputes.',
      },
      {
        icon_key: 'claims',
        title: 'Claim pack generation',
        description: 'Structured JSON and CSV claim packs designed for dispute submission and finance handoff.',
      },
      {
        icon_key: 'export',
        title: 'Evidence packaging',
        description: 'Keep the raw reconciliation output and the commercial recovery narrative together.',
      },
      {
        icon_key: 'privacy',
        title: 'Privacy-safe processing',
        description: 'Uploads stay client-side in v1, with account data minimized to identity and consent records.',
      },
    ],
  },
  {
    id: 'security-privacy',
    type: 'security_privacy',
    eyebrow: 'Security and privacy',
    headline: 'Designed for EU-first privacy expectations from the start.',
    items: [
      'Account data is stored separately from payout file contents.',
      'Analytics stays off until the user explicitly opts in.',
      'Consent history, export requests, and deletion requests are persisted for compliance workflows.',
      'The product is designed for EU-hosted Supabase deployment with row-level security.',
    ],
  },
  {
    id: 'faq',
    type: 'faq',
    headline: 'Questions teams ask before they trust a payout workflow.',
    items: [
      {
        question: 'Which file types are supported?',
        answer: 'CSV and XLSX are supported for both the platform payout file and the POS order export.',
      },
      {
        question: 'How is recoverable revenue estimated?',
        answer: 'The current release uses deterministic rules based on issue type, commission variance, net variance, and expected payout logic.',
      },
      {
        question: 'Where is data processed?',
        answer: 'The audit and recovery calculations run in the browser. Account, consent, and privacy request data lives in Supabase.',
      },
      {
        question: 'Are uploaded files stored?',
        answer: 'Not in v1. Uploaded payout and POS files remain client-side unless a future server-side storage feature is added intentionally.',
      },
    ],
  },
  {
    id: 'final-cta',
    type: 'final_cta',
    headline: 'Create an account before you start auditing payouts.',
    body: 'Sign up once, then keep every audit, consent choice, and privacy request tied to a real user identity.',
    primary_cta: {
      label: 'Create account',
      href: '#auth-panel',
      variant: 'primary',
      event_name: 'landing_signup_clicked',
    },
    secondary_cta: {
      label: 'View sample report',
      href: '#how-it-works',
      variant: 'secondary',
      event_name: 'landing_sample_clicked',
    },
  },
];
