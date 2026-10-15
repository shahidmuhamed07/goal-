import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { LogIn, LogOut, Route } from 'lucide-react';
import type { AdminRole } from '@goalpath/shared';
import { apiLocation } from '../lib';
import { auth, getIdToken, signInWithGoogle, signOutAdmin } from '../lib/firebase';
import { checkAccess } from '../lib/httpApi';

interface Session {
  /** Who is signed in. Null when the API is open on this machine (no login configured). */
  email: string | null;
  /** What this person may do. On a developer's machine with no login set up, everyone is an owner. */
  role: AdminRole;
  signOut: () => void;
}
const SessionContext = createContext<Session>({ email: null, role: 'owner', signOut: () => {} });
export const useSession = () => useContext(SessionContext);

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out'; message?: string }
  | { kind: 'allowed'; email: string | null; role: AdminRole }
  | { kind: 'denied'; email: string }
  | { kind: 'error'; message: string };

/** Shown while we wait. After a few seconds it explains why, so a sleeping free server does not look broken. */
function WaitingMessage() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
      <p className="muted">Checking your sign-in…</p>
      {slow && <p className="muted small">The server is waking up. On the free plan this can take up to a minute the first time. Please wait.</p>}
    </>
  );
}

/** What to tell the person when Google's sign-in window fails. */
function explainSignInError(e: unknown): string {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'The sign-in window was closed before finishing.';
  if (code === 'auth/unauthorized-domain') return `This web address is not approved in Firebase yet. In the Firebase console, open Authentication, then Settings, then Authorized domains, and add ${window.location.hostname}.`;
  return 'Sign-in did not work. Please try again.';
}

/**
 * Keeps everyone out of the admin until the API confirms they may use it.
 * It asks the API, so the real decision is always made on the server.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const token = await getIdToken();
      const user = auth.currentUser;
      const result = await checkAccess(apiLocation, token);
      if (result.status === 'allowed') setState({ kind: 'allowed', email: result.email, role: result.role });
      else if (result.status === 'not-allowed') setState({ kind: 'denied', email: user?.email ?? 'this account' });
      else setState({ kind: 'signed-out', message: user ? 'Your sign-in has expired. Please sign in again.' : undefined });
    } catch (e) {
      const timedOut = e instanceof DOMException && e.name === 'TimeoutError';
      const offline = e instanceof TypeError;
      setState({
        kind: 'error',
        message: timedOut
          ? 'The server did not answer in time. It may still be waking up: wait a moment and try again.'
          : offline
          ? `Cannot reach the API at ${apiLocation}. Is it running?`
          : e instanceof Error
          ? e.message
          : 'Something went wrong.',
      });
    }
  }, []);

  // Firebase tells us once whether someone is already signed in, and again after every sign-in or sign-out.
  useEffect(() => onAuthStateChanged(auth, () => void refresh()), [refresh]);

  const signIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setState({ kind: 'signed-out', message: explainSignInError(e) });
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === 'allowed') {
    return <SessionContext.Provider value={{ email: state.email, role: state.role, signOut: () => void signOutAdmin() }}>{children}</SessionContext.Provider>;
  }

  return (
    <div className="gate">
      <div className="card gate-card">
        <span className="brand-mark"><Route size={20} /></span>
        <h1 className="page-title" style={{ fontSize: 26 }}>Goal Path Admin</h1>
        {state.kind === 'loading' && <WaitingMessage />}
        {state.kind === 'signed-out' && (
          <>
            <p className="muted">Sign in with the Google account that manages Goal Path.</p>
            {state.message && <p className="error-text" role="alert">{state.message}</p>}
            <button className="btn" onClick={signIn} disabled={busy}><LogIn size={18} /> {busy ? 'Opening Google…' : 'Continue with Google'}</button>
          </>
        )}
        {state.kind === 'denied' && (
          <>
            <p className="error-text" role="alert"><b>{state.email}</b> is not allowed to use the admin.</p>
            <p className="muted small">Ask the project owner to add this email, or sign in with a different account.</p>
            <button className="btn quiet" onClick={() => void signOutAdmin()}><LogOut size={18} /> Sign out</button>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <p className="error-text" role="alert">{state.message}</p>
            <button className="btn quiet" onClick={() => { setState({ kind: 'loading' }); void refresh(); }}>Try again</button>
          </>
        )}
      </div>
    </div>
  );
}
