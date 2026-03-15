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
*/

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
const ANALYTICS_ENABLED = Boolean(POSTHOG_KEY && POSTHOG_HOST);
const NORMALIZED_POSTHOG_HOST = POSTHOG_HOST ? POSTHOG_HOST.replace(/\/+$/, '') : '';
const DISTINCT_ID_STORAGE_KEY = 'posthog_distinct_id';
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
let initAttempted = false;

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

export const initAnalytics = () => {
  if (initialized) {
    return posthog;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  initAttempted = true;

  if (!ANALYTICS_ENABLED) {
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

export const trackEvent = (eventName, properties = {}) => {
  if (!ANALYTICS_ENABLED) {
    return;
  }

  const client = initAnalytics();
  if (!client) {
    console.warn('PostHog track skipped: analytics is unavailable');
    return;
  }

  const distinctId = getDistinctId();
  const eventProperties = sanitizeProperties({
    ...properties,
    distinct_id: distinctId,
  });

  client.capture(eventName, eventProperties);
};

export const identifyUser = (userId, properties = {}) => {
  if (!ANALYTICS_ENABLED || !userId) {
    return;
  }

  persistDistinctId(userId);
  const client = initAnalytics();
  if (!client) {
    console.warn('PostHog identify skipped: analytics is unavailable');
    return;
  }

  client.identify(userId, sanitizeProperties(properties));
};

export const resetAnalytics = () => {
  if (!ANALYTICS_ENABLED) {
    return;
  }

  const client = initAnalytics();
  if (!client) {
    console.warn('PostHog reset skipped: analytics is unavailable');
    return;
  }

  client.reset();
};

export const analyticsConfig = POSTHOG_CONFIG;
