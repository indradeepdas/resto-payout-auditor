import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { identifyUser, resetAnalytics } from '../analytics.js';
import {
  APPLE_AUTH_ENABLED,
  GOOGLE_AUTH_ENABLED,
  SUPABASE_ENABLED,
  buildCallbackUrl,
  clearAuthReturnPath,
  getSupabaseClient,
  setAuthReturnPath,
} from '../lib/supabase.js';

const AuthContext = createContext(null);

const authUnavailableMessage =
  'Authentication is not configured. Add the Supabase environment variables to enable signup and login.';

const getDisplayName = (user) =>
  user?.user_metadata?.full_name ||
  user?.user_metadata?.name ||
  user?.email?.split('@')[0] ||
  'Account owner';

const mapProviderToSignupMethod = (provider) => {
  if (provider === 'google') {
    return 'google';
  }

  if (provider === 'apple') {
    return 'apple';
  }

  return 'email_magic_link';
};

const normalizeAuthError = (error) => {
  const fallbackMessage = 'We could not complete authentication. Please try again.';
  const message = error?.message || fallbackMessage;
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('expired') || lowerMessage.includes('otp_expired')) {
    return 'This sign-in link has expired. Request a new magic link and try again.';
  }

  if (lowerMessage.includes('cancelled') || lowerMessage.includes('canceled')) {
    return 'The sign-in flow was canceled before completion.';
  }

  if (lowerMessage.includes('provider') && lowerMessage.includes('disabled')) {
    return 'This login provider is not enabled yet for the current environment.';
  }

  if (lowerMessage.includes('already') && lowerMessage.includes('exists')) {
    return 'This account is already linked to another sign-in method. Try logging in with the original method.';
  }

  return message;
};

const syncUserProfile = async (supabase, user) => {
  if (!supabase || !user) {
    return;
  }

  const provider = user.app_metadata?.provider || user.app_metadata?.providers?.[0] || 'email';
  const signupMethod = mapProviderToSignupMethod(provider);
  const profilePayload = {
    id: user.id,
    email: user.email || '',
    display_name: getDisplayName(user),
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
    signup_method: signupMethod,
    preferred_locale:
      typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-GB',
    updated_at: new Date().toISOString(),
  };

  const providerRows = (user.app_metadata?.providers?.length
    ? user.app_metadata.providers
    : [provider]
  ).map((providerName) => ({
    user_id: user.id,
    provider: providerName === 'email' ? 'email' : providerName,
    provider_subject:
      user.user_metadata?.sub || user.identities?.find((identity) => identity.provider === providerName)?.id || user.id,
    linked_at: new Date().toISOString(),
  }));

  const profileResult = await supabase
    .from('user_profiles')
    .upsert(profilePayload, { onConflict: 'id' });

  if (profileResult.error) {
    console.warn('Could not sync user profile', profileResult.error);
  }

  if (providerRows.length) {
    const providerResult = await supabase
      .from('user_provider_accounts')
      .upsert(providerRows, { onConflict: 'provider,provider_subject' });

    if (providerResult.error) {
      console.warn('Could not sync provider accounts', providerResult.error);
    }
  }
};

export function AuthProvider({ children }) {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [emailSentTo, setEmailSentTo] = useState('');
  const syncRef = useRef('');

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setIsLoading(false);
      return undefined;
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setAuthError(normalizeAuthError(error));
        }

        setSession(data.session || null);
        setUser(data.session?.user || null);
        setIsLoading(false);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setAuthError(normalizeAuthError(error));
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        clearAuthReturnPath();
        setEmailSentTo('');
        setAuthError('');
        syncRef.current = '';
        resetAnalytics();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user || syncRef.current === user.id) {
      return;
    }

    syncRef.current = user.id;
    syncUserProfile(supabase, user).catch((error) => {
      console.warn('Could not finish user setup', error);
    });
  }, [supabase, user]);

  useEffect(() => {
    if (user) {
      identifyUser(user.id, {
        email: user.email,
        signup_method: mapProviderToSignupMethod(
          user.app_metadata?.provider || user.app_metadata?.providers?.[0] || 'email',
        ),
      });
      return;
    }

    resetAnalytics();
  }, [user]);

  const signInWithOAuth = useCallback(
    async (provider, nextPath = '/app') => {
      if (!supabase) {
        setAuthError(authUnavailableMessage);
        return { error: new Error(authUnavailableMessage) };
      }

      setAuthError('');
      setAuthReturnPath(nextPath);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: buildCallbackUrl(nextPath),
        },
      });

      if (error) {
        const message = normalizeAuthError(error);
        setAuthError(message);
        return { error: new Error(message) };
      }

      return { error: null };
    },
    [supabase],
  );

  const signInWithGoogle = useCallback(
    (nextPath = '/app') => signInWithOAuth('google', nextPath),
    [signInWithOAuth],
  );

  const signInWithApple = useCallback(
    (nextPath = '/app') => signInWithOAuth('apple', nextPath),
    [signInWithOAuth],
  );

  const signInWithEmail = useCallback(
    async (email, nextPath = '/app') => {
      if (!supabase) {
        setAuthError(authUnavailableMessage);
        return { error: new Error(authUnavailableMessage) };
      }

      setAuthError('');
      setAuthReturnPath(nextPath);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: buildCallbackUrl(nextPath),
          shouldCreateUser: true,
        },
      });

      if (error) {
        const message = normalizeAuthError(error);
        setAuthError(message);
        return { error: new Error(message) };
      }

      setEmailSentTo(email);
      return { error: null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  }, [supabase]);

  const clearAuthError = useCallback(() => setAuthError(''), []);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      authError,
      emailSentTo,
      authAvailable: SUPABASE_ENABLED,
      googleEnabled: SUPABASE_ENABLED && GOOGLE_AUTH_ENABLED,
      appleEnabled: SUPABASE_ENABLED && APPLE_AUTH_ENABLED,
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      signOut,
      clearAuthError,
      authUnavailableMessage,
    }),
    [
      authError,
      clearAuthError,
      emailSentTo,
      isLoading,
      session,
      signInWithApple,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
