import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
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
      return 'Email or password is incorrect. If you have not signed in with email before, use "New here? Create an account" first.';
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

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, loading, error }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // The email fields stay hidden until the visitor actually asks for them.
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full neu rounded-3xl p-8 text-center pop">
        {/* Brand mark: the same logo shown in the app header */}
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-sm overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center">
          <GoalPathMark className="w-[62%] h-[62%]" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Welcome to Goal Path</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6 leading-relaxed">
          Break multi-month goals down into sequential monthly horizons and daily momentum.
        </p>

        {isUnauthorizedDomain ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-3.5 rounded-2xl mb-6 text-left space-y-2.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>Domain authorization required</span>
            </div>
            <p className="leading-relaxed text-amber-800">
              Firebase blocked login because this domain is not yet in your Firebase authorized domains list.
            </p>
            <div className="bg-white/80 border border-amber-300/80 rounded-xl p-2 flex items-center justify-between gap-2">
              <code className="font-mono text-[11px] text-slate-800 truncate select-all">{currentHostname}</code>
              <button
                type="button"
                onClick={copyHostname}
                className="text-[11px] font-semibold bg-amber-200/70 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg transition cursor-pointer flex-shrink-0 flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-amber-800" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[11px] text-amber-800 space-y-1">
              <p><strong>To allow sign-in:</strong></p>
              <ol className="list-decimal list-inside space-y-0.5 pl-1">
                <li>
                  Open{' '}
                  <a
                    href={`https://console.firebase.google.com/project/${projectId}/authentication/settings`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-semibold hover:text-amber-950"
                  >
                    Firebase Auth Settings
                  </a>
                </li>
                <li>Go to the <strong>Authorized domains</strong> tab</li>
                <li>Add this domain</li>
              </ol>
            </div>
          </div>
        ) : notice?.type === 'ok' ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl mb-6 text-left">
            {notice.text}
          </div>
        ) : activeError ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl mb-6 text-left">
            {activeError}
          </div>
        ) : null}

        {/* Google leads: it is the primary route, with email as the alternative */}
        <button
          type="button"
          onClick={onLogin}
          disabled={working}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-[15px] border border-slate-300 rounded-2xl px-5 py-4 shadow-sm hover:border-slate-400 hover:shadow transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        {showEmailForm && (
          <div className="flex items-center gap-3 my-6">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">or use email</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        )}

        {/* Email + password, revealed only after choosing email */}
        {showEmailForm ? (
        <form onSubmit={handleEmailSubmit} className="text-left space-y-2.5">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="mt-1 w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Password</span>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-11 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={working}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-2xl px-5 py-3 shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {mode === 'signup'
                ? (busy ? 'Creating account...' : 'Create account')
                : (busy ? 'Signing in...' : 'Sign in')}
            </span>
          </button>
        </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            disabled={working}
            className="w-full mt-3 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-300 rounded-2xl px-5 py-3.5 shadow-xs hover:border-slate-400 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4 text-slate-500" />
            <span>Use email instead</span>
          </button>
        )}

        {showEmailForm && (
        <div className="flex items-center justify-between mt-3 text-xs">
          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
          >
            {mode === 'signin' ? 'New here? Create an account' : 'I already have an account'}
          </button>
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={working}
            className="text-slate-500 hover:text-slate-700 cursor-pointer disabled:opacity-60"
          >
            Forgot password?
          </button>
        </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-4 text-xs text-slate-400">
          <span>Cloud Sync</span>
          <span>•</span>
          <span>Firestore Secured</span>
          <span>•</span>
          <span>Cross-Device</span>
        </div>
      </div>
    </div>
  );
};
