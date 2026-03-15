export const legalDocuments = {
  privacy: {
    title: 'Privacy Policy',
    intro:
      'This product stores only the account and consent data needed to operate a signup-gated payout recovery service. Audit file contents stay in the browser in v1.',
    sections: [
      {
        heading: 'What we collect',
        body: 'We collect account identifiers, sign-in method, consent records, and privacy request records. We do not persist uploaded payout or POS files in the current release.',
      },
      {
        heading: 'Why we process it',
        body: 'Account data is processed to provide the service, secure access, manage consent, and handle privacy requests. Optional analytics is processed only after explicit consent.',
      },
      {
        heading: 'Retention',
        body: 'Profiles remain active while the account is active. Deleted accounts are soft-deleted first, then hard-deleted on a scheduled retention workflow. Consent records may be retained longer where needed as proof of consent history.',
      },
      {
        heading: 'Your rights',
        body: 'Users can request access, deletion, rectification, or restriction. A privacy request area is available inside the signed-in account experience.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro:
      'These terms govern access to the payout recovery product, including the audit engine, recovery scoring, and claim-pack generation features.',
    sections: [
      {
        heading: 'Service scope',
        body: 'The product helps users analyze payout files, estimate recoverable discrepancies, and generate structured recovery outputs. It does not guarantee platform reimbursement.',
      },
      {
        heading: 'Account responsibilities',
        body: 'Users are responsible for the accuracy of uploaded files, maintaining access to their sign-in method, and verifying the claim pack before submission to a platform.',
      },
      {
        heading: 'Acceptable use',
        body: 'You must not upload data unlawfully, misuse third-party credentials, or use the service to submit false or misleading claims.',
      },
      {
        heading: 'Future updates',
        body: 'Provider integrations, storage policies, and workflows may evolve. Material policy changes should trigger a new policy version and consent capture where required.',
      },
    ],
  },
};
