import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Chrome, KeyRound, Lock, LogOut, Mail, ShieldCheck } from 'lucide-react';
import {
  getAuthReadiness,
  getAuthSessionSummary,
  getCurrentSession,
  sendMagicLink,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeToAuthState,
  type AuthReadiness,
  type AuthSession,
} from '../lib/authClient';

type PasswordMode = 'sign-in' | 'sign-up';
type LoadingAction = 'password' | 'magic-link' | 'google' | 'sign-out' | null;
type NoticeTone = 'success' | 'warning' | 'info';
type Notice = { tone: NoticeTone; message: string };

export function AuthPage() {
  const [readiness, setReadiness] = useState<AuthReadiness>(() => getAuthReadiness());
  const [session, setSession] = useState<AuthSession | null>(null);
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [notice, setNotice] = useState<Notice | null>(() => {
    const initial = getAuthReadiness();
    return initial.canUseRemoteAuth ? null : { tone: 'warning', message: initial.message };
  });

  useEffect(() => {
    let active = true;

    getCurrentSession().then((result) => {
      if (!active) {
        return;
      }

      setSession(result.session);
      setReadiness(result.readiness);

      if (result.session || !result.readiness.canUseRemoteAuth) {
        setNotice({ tone: result.ok ? 'info' : 'warning', message: result.message });
      }
    });

    const unsubscribe = subscribeToAuthState((snapshot) => {
      if (!active) {
        return;
      }

      setSession(snapshot.session);
      setReadiness(snapshot.readiness);

      if (snapshot.event !== 'INITIAL_SESSION') {
        setNotice({
          tone: snapshot.event === 'SIGNED_IN' || snapshot.event === 'TOKEN_REFRESHED' ? 'success' : 'info',
          message: snapshot.message,
        });
      }
    });

    const refreshReadiness = () => {
      const next = getAuthReadiness();
      setReadiness(next);
      if (!next.canUseRemoteAuth) {
        setNotice({ tone: 'warning', message: next.message });
      }
    };

    window.addEventListener('online', refreshReadiness);
    window.addEventListener('offline', refreshReadiness);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('online', refreshReadiness);
      window.removeEventListener('offline', refreshReadiness);
    };
  }, []);

  const sessionSummary = useMemo(() => getAuthSessionSummary(session), [session]);
  const remoteDisabled = !readiness.canUseRemoteAuth || loading !== null;
  const passwordDisabled = remoteDisabled || !email.trim() || !password.trim();
  const emailDisabled = remoteDisabled || !email.trim();
  const passwordAction = passwordMode === 'sign-in' ? 'Sign in' : 'Create account';

  async function handlePasswordAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading('password');
    const result =
      passwordMode === 'sign-in'
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password);

    setLoading(null);
    setReadiness(result.readiness);
    if (result.ok) {
      setSession(result.session);
    }
    setNotice({ tone: result.ok ? 'success' : 'warning', message: result.message });
  }

  async function handleMagicLink() {
    setLoading('magic-link');
    const result = await sendMagicLink(email);
    setLoading(null);
    setReadiness(result.readiness);
    setNotice({ tone: result.ok ? 'success' : 'warning', message: result.message });
  }

  async function handleGoogleSignIn() {
    setLoading('google');
    const result = await signInWithGoogle();
    setLoading(null);
    setReadiness(result.readiness);
    setNotice({ tone: result.ok ? 'success' : 'warning', message: result.message });
  }

  async function handleSignOut() {
    setLoading('sign-out');
    const result = await signOut();
    setLoading(null);
    setReadiness(result.readiness);
    if (result.ok) {
      setSession(null);
    }
    setNotice({ tone: result.ok ? 'success' : 'warning', message: result.message });
  }

  return (
    <div className="min-h-screen bg-[#09090b] px-6 py-10 text-zinc-50 sm:px-12">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <section className="border-b border-zinc-900 pb-8 lg:border-b-0 lg:pb-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-zinc-100 text-zinc-950">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="mt-7 text-xs uppercase tracking-[0.45em] text-zinc-500">Studio Auth</p>
          <h1 className="mt-3 font-serif text-5xl italic leading-none sm:text-6xl">Enter the workspace.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
            Auth runs through Supabase when configured, and falls back to a calm local state when it is not.
          </p>

          <div className="mt-8 grid gap-3 text-sm text-zinc-300">
            <StatusStrip readiness={readiness} />
            {notice && <NoticePanel notice={notice} />}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500"
              to="/studio/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="border border-zinc-800 px-5 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
              to="/"
            >
              Home
            </Link>
          </div>
        </section>

        <section className="border border-zinc-800 bg-[#0c0c0e] p-5 sm:p-6">
          {sessionSummary ? (
            <div>
              <div className="flex flex-col gap-5 border-b border-zinc-900 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current Session</p>
                  <h2 className="mt-3 font-serif text-3xl italic text-zinc-100">{sessionSummary.email}</h2>
                </div>
                <button
                  className="inline-flex items-center justify-center gap-2 border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading === 'sign-out'}
                  onClick={handleSignOut}
                  type="button"
                >
                  <LogOut className="h-4 w-4" />
                  {loading === 'sign-out' ? 'Signing out...' : 'Sign out'}
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <SessionFact label="Provider" value={sessionSummary.provider} />
                <SessionFact label="Expires" value={sessionSummary.expiresAt} />
                <SessionFact label="Last sign-in" value={sessionSummary.lastSignInAt} />
                <SessionFact label="User ID" value={sessionSummary.userId} />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-4 border-b border-zinc-900 pb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Sign In</p>
                  <h2 className="mt-3 font-serif text-3xl italic text-zinc-100">Choose a path.</h2>
                </div>
                <Lock className="h-5 w-5 text-zinc-400" />
              </div>

              <div className="mt-6 grid grid-cols-2 border border-zinc-800 p-1 text-sm">
                <button
                  aria-pressed={passwordMode === 'sign-in'}
                  className={`px-3 py-2 font-medium transition-colors ${
                    passwordMode === 'sign-in' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                  onClick={() => setPasswordMode('sign-in')}
                  type="button"
                >
                  Sign in
                </button>
                <button
                  aria-pressed={passwordMode === 'sign-up'}
                  className={`px-3 py-2 font-medium transition-colors ${
                    passwordMode === 'sign-up' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                  onClick={() => setPasswordMode('sign-up')}
                  type="button"
                >
                  Create
                </button>
              </div>

              <form className="mt-6 space-y-5" onSubmit={handlePasswordAuth}>
                <label className="block text-sm font-medium text-zinc-200" htmlFor="auth-email">
                  Email
                  <span className="mt-2 flex items-center gap-3 border border-zinc-800 bg-zinc-950/60 px-3 py-3">
                    <Mail className="h-4 w-4 text-zinc-500" />
                    <input
                      autoComplete="email"
                      className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                      disabled={loading !== null}
                      id="auth-email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      value={email}
                    />
                  </span>
                </label>

                <label className="block text-sm font-medium text-zinc-200" htmlFor="auth-password">
                  Password
                  <span className="mt-2 flex items-center gap-3 border border-zinc-800 bg-zinc-950/60 px-3 py-3">
                    <KeyRound className="h-4 w-4 text-zinc-500" />
                    <input
                      autoComplete={passwordMode === 'sign-in' ? 'current-password' : 'new-password'}
                      className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                      disabled={loading !== null}
                      id="auth-password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={passwordMode === 'sign-in' ? 'Password' : 'At least 6 characters'}
                      type="password"
                      value={password}
                    />
                  </span>
                </label>

                <button
                  className="w-full bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={passwordDisabled}
                  type="submit"
                >
                  {loading === 'password' ? `${passwordAction}...` : passwordAction}
                </button>
              </form>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  className="inline-flex items-center justify-center gap-2 border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={emailDisabled}
                  onClick={handleMagicLink}
                  type="button"
                >
                  <Mail className="h-4 w-4" />
                  {loading === 'magic-link' ? 'Sending...' : 'Magic link'}
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={remoteDisabled}
                  onClick={handleGoogleSignIn}
                  type="button"
                >
                  <Chrome className="h-4 w-4" />
                  {loading === 'google' ? 'Opening...' : 'Google'}
                </button>
              </div>
            </div>
          )}
        </section>
      </motion.div>
    </div>
  );
}

function StatusStrip({ readiness }: { readiness: AuthReadiness }) {
  const ready = readiness.status === 'ready';
  const Icon = ready ? CheckCircle2 : AlertTriangle;

  return (
    <div className="flex items-start gap-3 border border-zinc-800 bg-[#0c0c0e] p-4">
      <Icon className={`mt-0.5 h-4 w-4 ${ready ? 'text-emerald-300' : 'text-amber-300'}`} />
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Connection</p>
        <p className="mt-2 leading-6 text-zinc-300">{readiness.message}</p>
      </div>
    </div>
  );
}

function NoticePanel({ notice }: { notice: Notice }) {
  const Icon = notice.tone === 'success' ? CheckCircle2 : AlertTriangle;
  const color = notice.tone === 'success' ? 'text-emerald-300' : notice.tone === 'warning' ? 'text-amber-300' : 'text-zinc-300';

  return (
    <div className="flex items-start gap-3 border border-zinc-800 bg-zinc-950/60 p-4">
      <Icon className={`mt-0.5 h-4 w-4 ${color}`} />
      <p className="leading-6 text-zinc-300">{notice.message}</p>
    </div>
  );
}

function SessionFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-zinc-900 bg-zinc-950/60 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-zinc-200">{value}</p>
    </div>
  );
}
