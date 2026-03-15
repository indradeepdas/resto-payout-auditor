import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  bootstrapAnalyticsConsent,
  hasAnalyticsConsent,
  setAnalyticsConsent,
  trackEvent,
} from '../analytics.js';
import { POLICY_VERSION, getSupabaseClient } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';

const ConsentContext = createContext(null);
const CONSENT_STORAGE_KEY = 'consent_preferences_v1';
const PENDING_SIGNUP_CONSENTS_KEY = 'pending_signup_consents_v1';

const defaultConsents = {
  analytics: false,
  marketing_emails: false,
  terms: false,
  privacy: false,
  hasAnalyticsChoice: false,
};

const readStoredConsents = () => {
  if (typeof window === 'undefined') {
    return defaultConsents;
  }

  try {
    const rawValue = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!rawValue) {
      return defaultConsents;
    }

    return {
      ...defaultConsents,
      ...JSON.parse(rawValue),
    };
  } catch {
    return defaultConsents;
  }
};

const persistConsents = (consents) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consents));
};

const readPendingSignupConsents = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(PENDING_SIGNUP_CONSENTS_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const clearPendingSignupConsents = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(PENDING_SIGNUP_CONSENTS_KEY);
};

const buildConsentPayload = (userId, consentType, granted, source) => ({
  user_id: userId,
  consent_type: consentType,
  granted: Boolean(granted),
  policy_version: POLICY_VERSION,
  granted_at: granted ? new Date().toISOString() : null,
  withdrawn_at: granted ? null : new Date().toISOString(),
  capture_source: source,
});

export function ConsentProvider({ children }) {
  const supabase = getSupabaseClient();
  const { user } = useAuth();
  const remoteLoadedForUser = useRef('');
  const [consents, setConsents] = useState(defaultConsents);
  const [isLoading, setIsLoading] = useState(true);
  const [requestStatus, setRequestStatus] = useState('');

  useEffect(() => {
    const analyticsState = bootstrapAnalyticsConsent();
    const storedConsents = readStoredConsents();

    setConsents({
      ...storedConsents,
      analytics: analyticsState.granted,
      hasAnalyticsChoice: analyticsState.decided || storedConsents.hasAnalyticsChoice,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    persistConsents(consents);
    setAnalyticsConsent(consents.analytics, { persist: false });
  }, [consents, isLoading]);

  const syncConsentRow = useCallback(
    async (consentType, granted, source = 'settings') => {
      if (!user || !supabase) {
        return;
      }

      const { error } = await supabase.from('user_consents').upsert(
        buildConsentPayload(user.id, consentType, granted, source),
        { onConflict: 'user_id,consent_type,policy_version' },
      );

      if (error) {
        console.warn(`Could not sync ${consentType} consent`, error);
      }
    },
    [supabase, user],
  );

  const updateMarketingProfile = useCallback(
    async (granted) => {
      if (!user || !supabase) {
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ marketing_opt_in: Boolean(granted), updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        console.warn('Could not sync marketing preference', error);
      }
    },
    [supabase, user],
  );

  useEffect(() => {
    if (!user || !supabase || isLoading || remoteLoadedForUser.current === user.id) {
      return;
    }

    remoteLoadedForUser.current = user.id;

    Promise.all([
      supabase
        .from('user_consents')
        .select('consent_type, granted, granted_at, withdrawn_at')
        .eq('user_id', user.id)
        .order('granted_at', { ascending: false, nullsFirst: false }),
      supabase.from('user_profiles').select('marketing_opt_in').eq('id', user.id).maybeSingle(),
    ])
      .then(([consentResult, profileResult]) => {
        const nextConsents = {};

        if (!consentResult.error && Array.isArray(consentResult.data)) {
          const latestByType = new Map();
          consentResult.data.forEach((row) => {
            if (!latestByType.has(row.consent_type)) {
              latestByType.set(row.consent_type, Boolean(row.granted));
            }
          });

          latestByType.forEach((granted, consentType) => {
            nextConsents[consentType] = granted;
          });
        }

        if (profileResult.data?.marketing_opt_in !== undefined) {
          nextConsents.marketing_emails = Boolean(profileResult.data.marketing_opt_in);
        }

        setConsents((current) => ({
          ...current,
          ...nextConsents,
          hasAnalyticsChoice:
            nextConsents.analytics !== undefined ? true : current.hasAnalyticsChoice,
        }));
      })
      .catch((error) => {
        console.warn('Could not load consent preferences', error);
      });
  }, [isLoading, supabase, user]);

  useEffect(() => {
    const pendingConsents = readPendingSignupConsents();

    if (!user || !pendingConsents) {
      return;
    }

    const nextConsents = {
      marketing_emails: Boolean(pendingConsents.marketing_emails),
      terms: Boolean(pendingConsents.terms),
      privacy: Boolean(pendingConsents.privacy),
    };

    setConsents((current) => ({
      ...current,
      ...nextConsents,
    }));

    Promise.all([
      syncConsentRow('terms', nextConsents.terms, 'signup_form'),
      syncConsentRow('privacy', nextConsents.privacy, 'signup_form'),
      syncConsentRow('marketing_emails', nextConsents.marketing_emails, 'signup_form'),
      updateMarketingProfile(nextConsents.marketing_emails),
    ]).finally(() => {
      clearPendingSignupConsents();
    });
  }, [syncConsentRow, updateMarketingProfile, user]);

  const setConsent = useCallback(
    async (consentType, granted, source = 'settings') => {
      setConsents((current) => ({
        ...current,
        [consentType]: Boolean(granted),
        hasAnalyticsChoice:
          consentType === 'analytics' ? true : current.hasAnalyticsChoice,
      }));

      if (consentType === 'analytics') {
        setAnalyticsConsent(granted);
      }

      await syncConsentRow(consentType, granted, source);

      if (consentType === 'marketing_emails') {
        await updateMarketingProfile(granted);
      }

      if (hasAnalyticsConsent()) {
        trackEvent('consent_updated', {
          consent_type: consentType,
          granted: Boolean(granted),
          source,
        });
      }
    },
    [syncConsentRow, updateMarketingProfile],
  );

  const stageSignupConsents = useCallback((values) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      PENDING_SIGNUP_CONSENTS_KEY,
      JSON.stringify({
        marketing_emails: Boolean(values.marketing_emails),
        terms: Boolean(values.terms),
        privacy: Boolean(values.privacy),
      }),
    );
  }, []);

  const submitPrivacyRequest = useCallback(
    async (requestType, notes = '') => {
      if (!user || !supabase) {
        throw new Error('You must be signed in to submit a privacy request.');
      }

      const { error } = await supabase.from('privacy_requests').insert({
        user_id: user.id,
        request_type: requestType,
        status: 'open',
        notes,
      });

      if (error) {
        throw error;
      }

      const nextStatus = `${requestType} request submitted`;
      setRequestStatus(nextStatus);

      if (hasAnalyticsConsent()) {
        trackEvent('privacy_request_created', {
          request_type: requestType,
        });
      }

      return nextStatus;
    },
    [supabase, user],
  );

  const value = useMemo(
    () => ({
      analyticsConsent: consents.analytics,
      marketingConsent: consents.marketing_emails,
      termsAccepted: consents.terms,
      privacyAccepted: consents.privacy,
      hasAnalyticsChoice: consents.hasAnalyticsChoice,
      isLoading,
      requestStatus,
      setConsent,
      stageSignupConsents,
      submitPrivacyRequest,
    }),
    [consents, isLoading, requestStatus, setConsent, stageSignupConsents, submitPrivacyRequest],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export const useConsent = () => {
  const context = useContext(ConsentContext);

  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }

  return context;
};
