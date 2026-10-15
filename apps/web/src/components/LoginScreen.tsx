import React, { useState } from 'react';
import { CmsBanners } from '../cms/CmsBanners';
import { useLiveBanners } from '../cms/useLiveBanners';
import { AlertTriangle, Check, Copy, Eye, EyeOff, Loader2, Mail, X } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoalPathMark } from './UIElements';

interface LoginScreenProps {
  onLogin: () => void;
  loading: boolean;
  error: string | null;
  /** A message that is not a failure, e.g. "taking you to Google's page instead". */
  info?: string | null;
}

type Mode = 'signin' | 'signup';

const friendlyAuthError = (code: string | undefined, message: string): string => {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/weak-password':
      return 'Use at least 6 characters for your password.';
    case 'auth/email-already-in-use':
      return 'That email already has an account. Try signing in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect. If you have not signed in with email before, choose "Create an account" first.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Email sign-in is not switched on in Firebase yet. Open Authentication → Sign-in method → Email/Password and enable it.';
    default:
      return message;
  }
};

/**
 * The first screen: a soft gradient, the mark, one line about what this is, and
 * two ways in. Google leads; email opens a sheet from the bottom so the
 * gradient stays on screen behind it.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, loading, error, info }) => {
  // A notice from the admin for people who are not signed in yet.
  const loginBanners = useLiveBanners();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const activeError = notice?.type === 'error' ? notice.text : error;
  const isUnauthorizedDomain = !!activeError && activeError.includes('unauthorized-domain');
  const projectId = firebaseConfig?.projectId || '';
  const working = busy || loading;

  const copyHostname = () => {
    if (navigator.clipboard && currentHostname) {
      navigator.clipboard.writeText(currentHostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setNotice({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      setNotice({ type: 'error', text: 'Use at least 6 characters for your password.' });
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
      // The auth listener in App takes over from here.
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      setNotice({
        type: 'error',
        text: friendlyAuthError(authErr.code, authErr.message || 'Could not sign you in.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setNotice(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setNotice({ type: 'error', text: 'Enter your email address first, then tap reset.' });
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setNotice({ type: 'ok', text: `Reset link sent to ${cleanEmail}.` });
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      setNotice({
        type: 'error',
        text: friendlyAuthError(authErr.code, authErr.message || 'Could not send the reset email.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
  };

  const canContinue = email.includes('@') && password.length >= 6 && !working;

  return (
    <div className="splash relative min-h-screen flex flex-col text-white overflow-hidden safe-top">
      {/* The mark and the promise */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-7 pt-10">
        <div className="glass w-28 h-28 rounded-[2.2rem] grid place-items-center">
          <GoalPathMark className="w-[58%] h-[58%] text-white" />
        </div>
        <h1 className="font-display text-[1.9rem] leading-[1.15] font-medium max-w-[16rem] drop-shadow-sm">
          Plan your goals, one week at a time
        </h1>
      </div>

      {/* Messages and the two ways in */}
      <div className="px-5 pb-8 space-y-3 safe-bottom">
        <CmsBanners banners={loginBanners} placement="login-notice" limit={1} />
        {isUnauthorizedDomain ? (
          <div className="bg-white text-slate-800 rounded-3xl p-4 text-left space-y-2.5 text-xs shadow-lg">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Domain authorization required</span>
            </div>
            <p className="leading-relaxed text-slate-600">
              Firebase blocked login because this domain is not yet in your Firebase authorized domains list.
            </p>
            <div className="neu-inset-sm p-2 flex items-center justify-between gap-2">
              <code className="font-mono text-[11px] text-slate-800 truncate select-all">{currentHostname}</code>
              <button
                type="button"
                onClick={copyHostname}
                className="chip text-[11px] px-2.5 py-1 shrink-0 flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Open{' '}
              <a
                href={`https://console.firebase.google.com/project/${projectId}/authentication/settings`}
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold text-slate-700"
              >
                Firebase Auth Settings
              </a>
              , go to <strong>Authorized domains</strong> and add this domain.
            </p>
          </div>
        ) : activeError && !showEmailForm ? (
          <div className="bg-white/95 text-rose-700 rounded-3xl px-4 py-3 text-xs font-medium text-left shadow-lg">
            {activeError}
          </div>
        ) : info ? (
          <div className="glass rounded-3xl px-4 py-3 text-xs font-medium text-white text-left">{info}</div>
        ) : null}

        <button
          type="button"
          onClick={onLogin}
          disabled={working}
          className="w-full h-14 rounded-full bg-white text-slate-900 font-semibold text-[1.0625rem] flex items-center justify-center gap-3 shadow-[0_14px_30px_-14px_rgba(40,30,120,0.5)] active:scale-[0.98] transition disabled:opacity-60 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>{loading ? 'Connecting to Google…' : 'Continue with Google'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowEmailForm(true)}
          disabled={working}
          className="glass w-full h-14 rounded-full text-white font-semibold text-[1.0625rem] flex items-center justify-center gap-2.5 active:scale-[0.98] transition disabled:opacity-60 cursor-pointer"
        >
          <Mail className="w-[1.15rem] h-[1.15rem]" />
          <span>Use email instead</span>
        </button>

        <p className="px-4 pt-1 text-center text-[11px] leading-relaxed text-white/70">
          By continuing you agree to Goal Path’s terms and acknowledge that your goals are stored securely in
          your account.
        </p>
      </div>

      {/* Email: a sheet over the gradient */}
      {showEmailForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end fade" role="dialog" aria-modal="true" aria-label="Sign in with email">
          <button
            type="button"
            aria-label="Close"
            data-plain
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] cursor-default"
            onClick={() => setShowEmailForm(false)}
          />
          <form onSubmit={handleEmailSubmit} className="sheet sheet-up relative px-6 pt-5 pb-8 text-slate-900 safe-bottom">
            <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              aria-label="Close"
              className="absolute right-5 top-5 w-8 h-8 grid place-items-center rounded-full bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-[1.6rem] leading-tight font-semibold pr-10">
              {mode === 'signup' ? 'Let’s get started with your email' : 'Welcome back'}
            </h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {mode === 'signup'
                ? 'Create an account to save your goals and plan across devices.'
                : 'Sign in to pick up where you left off.'}
            </p>

            {(notice?.type === 'ok' || (activeError && !isUnauthorizedDomain)) && (
              <p
                className={`mt-4 rounded-2xl px-4 py-3 text-xs font-medium ${
                  notice?.type === 'ok' ? 'bg-violet-50 text-violet-800' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {notice?.type === 'ok' ? notice.text : activeError}
              </p>
            )}

            <div className="mt-5 space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                aria-label="Email"
                className="w-full h-14 rounded-full px-6 text-base"
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Password (6+ characters)' : 'Password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  aria-label="Password"
                  className="w-full h-14 rounded-full pl-6 pr-14 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full text-slate-400 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canContinue}
              className="btn-tone mt-5 w-full h-14 text-[1.0625rem] flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {mode === 'signup'
                  ? busy
                    ? 'Creating account…'
                    : 'Create account'
                  : busy
                  ? 'Signing in…'
                  : 'Continue'}
              </span>
            </button>

            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                className="font-semibold text-[color:var(--tone-700)] cursor-pointer"
              >
                {mode === 'signin' ? 'New here? Create an account' : 'I already have an account'}
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={working}
                className="font-medium text-slate-500 cursor-pointer disabled:opacity-60"
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
