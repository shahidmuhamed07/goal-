import { useCallback, useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import type { TeamMember } from '@goalpath/shared';
import { api } from '../../lib';
import { timeAgo } from '../../lib/dates';
import { useSession } from '../../components/AuthGate';
import { useToast } from '../../components/Toasts';
import { EmptyState, Field, PageHeader } from '../../components/ui';

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Owners add and remove managers here. Managers never see this page. */
export function TeamPage() {
  const session = useSession();
  const notify = useToast();
  const team = api.team;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!team) return;
    try {
      setMembers(await team.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the team.');
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!team || session.role !== 'owner') {
    return <EmptyState title="Only owners can manage the team" text="Ask an owner if you need someone added or removed." />;
  }

  const add = async () => {
    setTouched(true);
    if (!looksLikeEmail(email)) return;
    setBusy(true);
    try {
      await team.add(email);
      notify(`${email.trim().toLowerCase()} can now use the admin`);
      setEmail('');
      setTouched(false);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not add them. Please try again.', true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: TeamMember) => {
    if (!window.confirm(`Remove ${m.email}? They lose access immediately.`)) return;
    try {
      await team.remove(m.email);
      notify(`${m.email} removed`);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not remove them. Please try again.', true);
    }
  };

  const emailError = touched && !looksLikeEmail(email) ? 'Enter a full email address, like name@gmail.com.' : '';

  return (
    <>
      <PageHeader
        title="Team"
        lede="Owners can do everything, including adding people. Managers can change banners, popups, pages and plans, but cannot add or remove anyone."
      />

      <section className="card stack">
        <h2 className="section-title">Add a manager</h2>
        <div className="row wrap" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 280px' }}>
            <Field label="Their Google email" htmlFor="team-email" error={emailError} hint="They must sign in with this exact Google account.">
              <input
                id="team-email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="name@gmail.com"
                value={email}
                aria-invalid={!!emailError}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
              />
            </Field>
          </div>
          <button className="btn" style={{ marginTop: 26 }} onClick={add} disabled={busy}><UserPlus size={18} /> {busy ? 'Adding…' : 'Add manager'}</button>
        </div>
      </section>

      <div className="card flush">
        {error ? (
          <EmptyState title="Could not load the team" text={error} />
        ) : loading ? (
          <EmptyState title="Loading…" text="One moment." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Person</th><th>Role</th><th>Added</th><th /></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.email}>
                    <td>
                      <div className="name" style={{ overflowWrap: 'anywhere' }}>{m.email}</div>
                      {m.email === session.email && <div className="sub">This is you</div>}
                    </td>
                    <td><span className="tag">{m.role === 'owner' ? 'Owner' : 'Manager'}</span></td>
                    <td className="small muted">
                      {m.role === 'owner' ? 'Set in the server settings' : m.addedAt ? `${timeAgo(m.addedAt)} by ${m.addedBy}` : ''}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {m.role === 'manager' && (
                        <button className="icon-btn danger" onClick={() => void remove(m)} aria-label={`Remove ${m.email}`}><Trash2 size={17} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
