import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED !== 'false';
export const APPLE_AUTH_ENABLED = import.meta.env.VITE_APPLE_OAUTH_ENABLED !== 'false';
export const POLICY_VERSION = '2026-03-15';

const AUTH_RETURN_TO_STORAGE_KEY = 'auth_return_to';
let supabaseClient;

export const getSupabaseClient = () => {
  if (!SUPABASE_ENABLED) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }

  return supabaseClient;
};

export const getAuthCallbackUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return `${window.location.origin}/auth/callback`;
};

export const setAuthReturnPath = (path = '/app') => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, path);
};

export const getAuthReturnPath = () => {
  if (typeof window === 'undefined') {
    return '/app';
  }

  return window.localStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY) || '/app';
};

export const clearAuthReturnPath = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
};

export const buildCallbackUrl = (nextPath = '/app') => {
  const callbackUrl = getAuthCallbackUrl();

  if (!callbackUrl) {
    return '';
  }

  const url = new URL(callbackUrl);
  url.searchParams.set('next', nextPath);
  return url.toString();
};
