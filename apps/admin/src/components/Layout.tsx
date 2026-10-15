import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FileText, Gauge, LayoutTemplate, Megaphone, Menu, MessageSquareMore, RotateCcw, Route } from 'lucide-react';
import { api, apiLocation } from '../lib';
import { useSession } from './AuthGate';
import { useToast } from './Toasts';

const NAV = [
  { to: '/', label: 'Overview', icon: Gauge, end: true },
  { to: '/banners', label: 'Banners', icon: Megaphone },
  { to: '/popups', label: 'Popups', icon: MessageSquareMore },
  { to: '/pages', label: 'Pages', icon: FileText },
  { to: '/plans', label: 'Starter plans', icon: LayoutTemplate },
];

/** The frame around every screen: a sidebar on desktop, a slide-in menu on a phone. */
export function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const notify = useToast();
  const session = useSession();

  useEffect(() => setOpen(false), [location.pathname]);

  const resetSamples = async () => {
    if (!api.resetSamples) return;
    if (!window.confirm('Replace everything with the sample content? Your changes in this browser are lost.')) return;
    await api.resetSamples();
    notify('Sample content restored');
    window.location.reload();
  };

  return (
    <div className="shell">
      <div className="mobilebar">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
        <strong style={{ fontFamily: 'var(--display)' }}>Goal Path Admin</strong>
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className="sidebar" data-open={open}>
        <div className="brand">
          <span className="brand-mark"><Route size={18} /></span>
          <span>Goal Path<small>Admin</small></span>
        </div>
        <nav className="nav" aria-label="Sections">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          {!api.isMock && (
            <div className="well small">
              <b>Connected to the API</b>
              <p className="muted">{apiLocation}</p>
              {session.email ? (
                <>
                  <p className="muted" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>Signed in as {session.email}</p>
                  <button className="btn quiet small" style={{ marginTop: 8 }} onClick={session.signOut}>Sign out</button>
                </>
              ) : (
                <p className="muted" style={{ marginTop: 6 }}>No login on this server (local only).</p>
              )}
            </div>
          )}
          {api.isMock && (
            <div className="well small">
              <b>Practice mode</b>
              <p className="muted">Content is saved only in this browser until the backend is connected.</p>
              {api.resetSamples && (
                <button className="btn quiet small" style={{ marginTop: 8 }} onClick={resetSamples}>
                  <RotateCcw size={14} /> Restore samples
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
