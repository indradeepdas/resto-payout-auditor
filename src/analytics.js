import posthog from 'posthog-js';

/*
Analytics schema
- page_view
- demo_data_used
- payout_file_uploaded
- orders_file_uploaded
- auto_detect_clicked
- audit_started
- audit_succeeded
- audit_failed
- csv_downloaded
- excel_downloaded
- payout_discrepancy_detected
- recovery_summary_generated
- claim_pack_generated
- claim_pack_json_downloaded
- claim_pack_csv_downloaded
- consent_updated
- privacy_request_created
*/

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
const ANALYTICS_ENABLED = Boolean(POSTHOG_KEY && POSTHOG_HOST);
const NORMALIZED_POSTHOG_HOST = POSTHOG_HOST ? POSTHOG_HOST.replace(/\/+$/, '') : '';
const DISTINCT_ID_STORAGE_KEY = 'posthog_distinct_id';
const ANALYTICS_CONSENT_STORAGE_KEY = 'analytics_consent_v1';
const POSTHOG_CONFIG = {
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  disable_surveys: true,
  disable_session_recording: true,
  advanced_disable_flags: true,
  person_profiles: 'identified_only',
  api_transport: 'fetch',
  request_batching: false,
};

let initialized = false;
let analyticsConsentGranted = false;

const sanitizeProperties = (properties = {}) =>
  Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );

const isLocalDevHost = () =>
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const resolveCaptureHost = () => {
  if (!NORMALIZED_POSTHOG_HOST) {
    return '';
  }

  if (NORMALIZED_POSTHOG_HOST.startsWith('/')) {
    return NORMALIZED_POSTHOG_HOST;
  }

  if (isLocalDevHost()) {
    return '/ingest';
  }

  return NORMALIZED_POSTHOG_HOST;
};

const resolveSdkHost = () => {
  const captureHost = resolveCaptureHost();

  if (!captureHost) {
    return '';
  }

  if (captureHost.startsWith('http')) {
    return captureHost;
  }

  if (typeof window === 'undefined') {
    return captureHost;
  }

  return `${window.location.origin}${captureHost}`;
};

const getStoredDistinctId = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(DISTINCT_ID_STORAGE_KEY) || '';
};

const persistDistinctId = (distinctId) => {
  if (typeof window === 'undefined' || !distinctId) {
    return distinctId;
  }

  window.localStorage.setItem(DISTINCT_ID_STORAGE_KEY, distinctId);
  return distinctId;
};

const generateDistinctId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `web-${crypto.randomUUID()}`;
  }

  return `web-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

const getDistinctId = () => {
  const storedDistinctId = getStoredDistinctId();
  if (storedDistinctId) {
    return storedDistinctId;
  }

  if (initialized) {
    try {
      const sdkDistinctId = posthog.get_distinct_id();
      if (sdkDistinctId) {
        return persistDistinctId(sdkDistinctId);
      }
    } catch (error) {
      console.warn('PostHog distinct id lookup failed', error);
    }
  }

  return persistDistinctId(generateDistinctId());
};

const persistConsentState = (granted, decided = true) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    ANALYTICS_CONSENT_STORAGE_KEY,
    JSON.stringify({ granted: Boolean(granted), decided: Boolean(decided) }),
  );
};

const readConsentState = () => {
  if (typeof window === 'undefined') {
    return { granted: false, decided: false };
  }

  try {
    const rawValue = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (!rawValue) {
      return { granted: false, decided: false };
    }

    const parsedValue = JSON.parse(rawValue);
    return {
      granted: Boolean(parsedValue?.granted),
      decided: Boolean(parsedValue?.decided),
    };
  } catch {
    return { granted: false, decided: false };
  }
};

export const initAnalytics = () => {
  if (initialized) {
    return posthog;
  }

  if (typeof window === 'undefined' || !ANALYTICS_ENABLED || !analyticsConsentGranted) {
    return null;
  }

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: resolveSdkHost(),
      ...POSTHOG_CONFIG,
      loaded: () => persistDistinctId(posthog.get_distinct_id()),
      on_request_error: (error) => {
        console.error('PostHog request error', {
          statusCode: error.statusCode,
          text: error.text,
          stage: error.stage ?? error.error?.stage,
        });
      },
    });

    initialized = true;
    return posthog;
  } catch (error) {
    console.error('PostHog init failed', error);
    return null;
  }
};

export const bootstrapAnalyticsConsent = () => {
  const storedConsent = readConsentState();
  analyticsConsentGranted = storedConsent.granted && storedConsent.decided;

  if (analyticsConsentGranted) {
    initAnalytics();
  }

  return storedConsent;
};

export const setAnalyticsConsent = (granted, options = {}) => {
  const shouldPersist = options.persist !== false;

  analyticsConsentGranted = Boolean(granted);

  if (shouldPersist) {
    persistConsentState(granted, true);
  }

  if (!analyticsConsentGranted) {
    if (initialized) {
      try {
        posthog.opt_out_capturing();
        posthog.reset();
      } catch (error) {
        console.warn('PostHog opt-out failed', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DISTINCT_ID_STORAGE_KEY);
    }

    return false;
  }

  const client = initAnalytics();
  if (client) {
    try {
      client.opt_in_capturing();
    } catch {
      return true;
    }
  }

  return true;
};

export const hasAnalyticsConsent = () => analyticsConsentGranted;

export const trackEvent = (eventName, properties = {}) => {
  if (!ANALYTICS_ENABLED || !analyticsConsentGranted) {
    return;
  }

  const client = initAnalytics();
  if (!client) {
    return;
  }

  client.capture(
    eventName,
    sanitizeProperties({
      ...properties,
      distinct_id: getDistinctId(),
    }),
  );
};

export const identifyUser = (userId, properties = {}) => {
  if (!ANALYTICS_ENABLED || !analyticsConsentGranted || !userId) {
    return;
  }

  persistDistinctId(userId);
  const client = initAnalytics();
  if (!client) {
    return;
  }

  client.identify(userId, sanitizeProperties(properties));
};

export const resetAnalytics = () => {
  if (!ANALYTICS_ENABLED || !initialized) {
    return;
  }

  try {
    posthog.reset();
  } catch (error) {
    console.warn('PostHog reset failed', error);
  }
};

export const analyticsConfig = POSTHOG_CONFIG;
