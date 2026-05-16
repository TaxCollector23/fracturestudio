import { createClient, type AuthSession, type AuthUser, type SupabaseClient } from '@supabase/supabase-js';

type EnvMap = Record<string, string | boolean | undefined>;

export type AuthReadinessStatus = 'ready' | 'unconfigured' | 'invalid-config' | 'offline';

export type AuthReadiness = {
  status: AuthReadinessStatus;
  configured: boolean;
  online: boolean;
  canUseRemoteAuth: boolean;
  message: string;
  supabaseUrl?: string;
};

export type AuthClientEvent =
  | 'INITIAL_SESSION'
  | 'PASSWORD_RECOVERY'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'MFA_CHALLENGE_VERIFIED'
  | 'AUTH_CLIENT_UNAVAILABLE'
  | 'AUTH_CLIENT_ERROR';

export type AuthActionResult<T = AuthSession | null> = {
  ok: boolean;
  data: T | null;
  session: AuthSession | null;
  readiness: AuthReadiness;
  message: string;
};

export type AuthStateSnapshot = {
  event: AuthClientEvent;
  session: AuthSession | null;
  readiness: AuthReadiness;
  message: string;
};

export type AuthRedirectOptions = {
  redirectTo?: string;
};

export type AuthSessionSummary = {
  email: string;
  userId: string;
  provider: string;
  createdAt: string;
  lastSignInAt: string;
  expiresAt: string;
};

const env = import.meta.env as EnvMap;
const supabaseUrl = readEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY');
const setupIssue = getSetupIssue();

let clientSetupFailed = false;

export const supabase: SupabaseClient | null = setupIssue
  ? null
  : createSupabaseClient(supabaseUrl, supabaseAnonKey);

export type { AuthSession, AuthUser };

export function getAuthReadiness(): AuthReadiness {
  const online = isOnline();

  if (setupIssue) {
    return {
      status: setupIssue.status,
      configured: false,
      online,
      canUseRemoteAuth: false,
      message: setupIssue.message,
    };
  }

  if (!supabase || clientSetupFailed) {
    return {
      status: 'invalid-config',
      configured: false,
      online,
      canUseRemoteAuth: false,
      message: 'Supabase auth is configured, but the client could not be started.',
    };
  }

  if (!online) {
    return {
      status: 'offline',
      configured: true,
      online: false,
      canUseRemoteAuth: false,
      message: 'You are offline. Saved session details can still load, but sign-in needs a connection.',
      supabaseUrl,
    };
  }

  return {
    status: 'ready',
    configured: true,
    online: true,
    canUseRemoteAuth: true,
    message: 'Supabase auth is ready.',
    supabaseUrl,
  };
}

export async function getCurrentSession(): Promise<AuthActionResult<AuthSession | null>> {
  const readiness = getAuthReadiness();

  if (!supabase) {
    return makeResult({
      ok: false,
      data: null,
      session: null,
      readiness,
      message: readiness.message,
    });
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return authFailure('We could not read the saved session right now.', error);
    }

    const session = data.session ?? null;

    return makeResult({
      ok: true,
      data: session,
      session,
      readiness,
      message: session ? 'Signed in.' : readiness.canUseRemoteAuth ? 'No active session.' : readiness.message,
    });
  } catch (error) {
    return authFailure('We could not read the saved session right now.', error);
  }
}

export async function signInWithPassword(emailInput: string, password: string): Promise<AuthActionResult<AuthSession | null>> {
  const email = normalizeEmail(emailInput);
  const validationMessage = validatePasswordCredentials(email, password, 'sign-in');

  if (validationMessage) {
    return validationFailure(validationMessage);
  }

  const remote = getRemoteAuthClient<AuthSession | null>();

  if ('result' in remote) {
    return remote.result;
  }

  try {
    const { data, error } = await remote.client.auth.signInWithPassword({ email, password });

    if (error) {
      return authFailure('We could not sign you in. Check the email and password and try again.', error);
    }

    return makeResult({
      ok: true,
      data: data.session ?? null,
      session: data.session ?? null,
      readiness: getAuthReadiness(),
      message: data.session ? 'Signed in.' : 'Check your email before signing in.',
    });
  } catch (error) {
    return authFailure('We could not sign you in. Check your connection and try again.', error);
  }
}

export async function signUpWithPassword(
  emailInput: string,
  password: string,
  options: AuthRedirectOptions = {},
): Promise<AuthActionResult<AuthSession | null>> {
  const email = normalizeEmail(emailInput);
  const validationMessage = validatePasswordCredentials(email, password, 'sign-up');

  if (validationMessage) {
    return validationFailure(validationMessage);
  }

  const remote = getRemoteAuthClient<AuthSession | null>();

  if ('result' in remote) {
    return remote.result;
  }

  try {
    const redirectTo = resolveRedirectTo(options.redirectTo);
    const credentials = redirectTo
      ? { email, password, options: { emailRedirectTo: redirectTo } }
      : { email, password };
    const { data, error } = await remote.client.auth.signUp(credentials);

    if (error) {
      return authFailure('We could not create the account. Try again in a moment.', error);
    }

    const session = data.session ?? null;

    return makeResult({
      ok: true,
      data: session,
      session,
      readiness: getAuthReadiness(),
      message: session ? 'Account created and signed in.' : 'Account created. Check your email to confirm it.',
    });
  } catch (error) {
    return authFailure('We could not create the account. Check your connection and try again.', error);
  }
}

export async function sendMagicLink(
  emailInput: string,
  options: AuthRedirectOptions = {},
): Promise<AuthActionResult<null>> {
  const email = normalizeEmail(emailInput);

  if (!isValidEmail(email)) {
    return validationFailure('Enter a valid email address.');
  }

  const remote = getRemoteAuthClient<null>();

  if ('result' in remote) {
    return remote.result;
  }

  try {
    const redirectTo = resolveRedirectTo(options.redirectTo);
    const credentials = redirectTo
      ? { email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } }
      : { email, options: { shouldCreateUser: true } };
    const { error } = await remote.client.auth.signInWithOtp(credentials);

    if (error) {
      return authFailure('We could not send the magic link. Try again in a moment.', error);
    }

    return makeResult({
      ok: true,
      data: null,
      session: null,
      readiness: getAuthReadiness(),
      message: 'Magic link sent. Check your email.',
    });
  } catch (error) {
    return authFailure('We could not send the magic link. Check your connection and try again.', error);
  }
}

export async function signInWithGoogle(options: AuthRedirectOptions = {}): Promise<AuthActionResult<unknown>> {
  const remote = getRemoteAuthClient<unknown>();

  if ('result' in remote) {
    return remote.result;
  }

  try {
    const redirectTo = resolveRedirectTo(options.redirectTo);
    const credentials = redirectTo
      ? { provider: 'google' as const, options: { redirectTo } }
      : { provider: 'google' as const };
    const { data, error } = await remote.client.auth.signInWithOAuth(credentials);

    if (error) {
      return authFailure('We could not start Google sign-in. Try again in a moment.', error);
    }

    return makeResult({
      ok: true,
      data,
      session: null,
      readiness: getAuthReadiness(),
      message: 'Redirecting to Google.',
    });
  } catch (error) {
    return authFailure('We could not start Google sign-in. Check your connection and try again.', error);
  }
}

export async function signOut(): Promise<AuthActionResult<null>> {
  const readiness = getAuthReadiness();

  if (!supabase) {
    return makeResult({
      ok: false,
      data: null,
      session: null,
      readiness,
      message: readiness.message,
    });
  }

  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      return authFailure('We could not sign you out in this tab. Refresh and try again.', error);
    }

    return makeResult({
      ok: true,
      data: null,
      session: null,
      readiness: getAuthReadiness(),
      message: 'Signed out.',
    });
  } catch (error) {
    return authFailure('We could not sign you out in this tab. Refresh and try again.', error);
  }
}

export function subscribeToAuthState(callback: (snapshot: AuthStateSnapshot) => void): () => void {
  const readiness = getAuthReadiness();

  if (!supabase) {
    callback({
      event: 'AUTH_CLIENT_UNAVAILABLE',
      session: null,
      readiness,
      message: readiness.message,
    });
    return () => undefined;
  }

  try {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const authEvent = event as AuthClientEvent;
      callback({
        event: authEvent,
        session,
        readiness: getAuthReadiness(),
        message: getEventMessage(authEvent, session),
      });
    });

    return () => data.subscription.unsubscribe();
  } catch (error) {
    callback({
      event: 'AUTH_CLIENT_ERROR',
      session: null,
      readiness: getAuthReadiness(),
      message: friendlyAuthMessage(error, 'Auth session updates are unavailable right now.'),
    });
    return () => undefined;
  }
}

export function getAuthSessionSummary(session: AuthSession | null): AuthSessionSummary | null {
  if (!session) {
    return null;
  }

  const user = session.user;
  const providerFromMetadata = stringValue(user.app_metadata?.provider);
  const providerFromIdentity = Array.isArray(user.identities)
    ? stringValue(user.identities.find((identity) => stringValue(identity.provider))?.provider)
    : '';

  return {
    email: user.email ?? 'Unknown email',
    userId: user.id,
    provider: providerFromMetadata || providerFromIdentity || 'email',
    createdAt: formatDate(user.created_at),
    lastSignInAt: formatDate(user.last_sign_in_at),
    expiresAt: formatDate(session.expires_at ? session.expires_at * 1000 : undefined),
  };
}

export function getSupabaseProjectHost(): string {
  if (!supabaseUrl) {
    return 'Not configured';
  }

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return 'Invalid project URL';
  }
}

export const authClient = {
  supabase,
  getAuthReadiness,
  getCurrentSession,
  signInWithPassword,
  signUpWithPassword,
  sendMagicLink,
  signInWithGoogle,
  signOut,
  subscribeToAuthState,
  getAuthSessionSummary,
  getSupabaseProjectHost,
};

function readEnv(name: string): string {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function createSupabaseClient(url: string, anonKey: string): SupabaseClient | null {
  try {
    return createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  } catch {
    clientSetupFailed = true;
    return null;
  }
}

function getSetupIssue(): Pick<AuthReadiness, 'status' | 'message'> | null {
  if (!supabaseUrl || !supabaseAnonKey || isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
    return {
      status: 'unconfigured',
      message: 'Supabase auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.',
    };
  }

  if (!isHttpUrl(supabaseUrl)) {
    return {
      status: 'invalid-config',
      message: 'Supabase auth needs a valid project URL.',
    };
  }

  return null;
}

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('your_') || normalized.includes('your-project');
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

function getRemoteAuthClient<T>(): { client: SupabaseClient } | { result: AuthActionResult<T> } {
  const readiness = getAuthReadiness();

  if (!supabase || !readiness.canUseRemoteAuth) {
    return {
      result: makeResult({
        ok: false,
        data: null,
        session: null,
        readiness,
        message: readiness.message,
      }),
    };
  }

  return { client: supabase };
}

function makeResult<T>(result: AuthActionResult<T>): AuthActionResult<T> {
  return result;
}

function validationFailure<T = never>(message: string): AuthActionResult<T> {
  return makeResult({
    ok: false,
    data: null,
    session: null,
    readiness: getAuthReadiness(),
    message,
  });
}

function authFailure<T = never>(fallbackMessage: string, error: unknown): AuthActionResult<T> {
  return makeResult({
    ok: false,
    data: null,
    session: null,
    readiness: getAuthReadiness(),
    message: friendlyAuthMessage(error, fallbackMessage),
  });
}

function friendlyAuthMessage(error: unknown, fallbackMessage: string): string {
  if (!isOnline()) {
    return 'You are offline. Reconnect and try again.';
  }

  const message = getErrorMessage(error).toLowerCase();

  if (!message) {
    return fallbackMessage;
  }

  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'The email or password did not match an account.';
  }

  if (message.includes('email not confirmed')) {
    return 'Confirm your email before signing in.';
  }

  if (message.includes('user already registered') || message.includes('already registered')) {
    return 'An account already exists for that email.';
  }

  if (message.includes('signup') && message.includes('disabled')) {
    return 'New account creation is disabled for this project.';
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Wait a moment before trying again.';
  }

  if (message.includes('fetch') || message.includes('network') || message.includes('cors') || message.includes('abort')) {
    return 'Auth service is unreachable right now. Try again when the connection is stable.';
  }

  if (message.includes('redirect')) {
    return 'The redirect URL is not allowed for this Supabase project.';
  }

  return fallbackMessage;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }

  return typeof error === 'string' ? error : '';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validatePasswordCredentials(email: string, password: string, mode: 'sign-in' | 'sign-up'): string | null {
  if (!isValidEmail(email)) {
    return 'Enter a valid email address.';
  }

  if (!password.trim()) {
    return 'Enter a password.';
  }

  if (mode === 'sign-up' && password.length < 6) {
    return 'Use at least 6 characters for the password.';
  }

  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveRedirectTo(redirectTo?: string): string | undefined {
  if (redirectTo) {
    return redirectTo;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.location.href.split('#')[0];
}

function getEventMessage(event: AuthClientEvent, session: AuthSession | null): string {
  switch (event) {
    case 'INITIAL_SESSION':
      return session ? 'Signed in.' : 'No active session.';
    case 'SIGNED_IN':
      return 'Signed in.';
    case 'SIGNED_OUT':
      return 'Signed out.';
    case 'TOKEN_REFRESHED':
      return 'Session refreshed.';
    case 'PASSWORD_RECOVERY':
      return 'Password recovery session ready.';
    case 'USER_UPDATED':
      return 'Account updated.';
    case 'MFA_CHALLENGE_VERIFIED':
      return 'Multi-factor challenge verified.';
    default:
      return getAuthReadiness().message;
  }
}

function formatDate(value?: string | number | null): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
