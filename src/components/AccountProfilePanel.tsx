import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Briefcase, Copy, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { formatJoinedDate } from '../utils';

interface AccountProfilePanelProps {
  user: User;
  profile: UserProfile | null;
  /** Switches the account to a professional and opens the professional profile. */
  onBecomeProfessional: () => void;
  saving?: boolean;
}

/**
 * The profile a client sees. Their account details plus their connection code,
 * and one clear path to becoming a professional — at which point the fuller
 * professional profile (credentials, showcase) takes over this same tab.
 */
export const AccountProfilePanel: React.FC<AccountProfilePanelProps> = ({
  user,
  profile,
  onBecomeProfessional,
  saving = false,
}) => {
  const [copied, setCopied] = useState(false);
  const name = profile?.displayName || user.displayName || 'Goal Path User';
  const email = profile?.email || user.email || '';
  const initial = (name || email || 'U').charAt(0).toUpperCase();
  const joined = formatJoinedDate(profile?.createdAt);

  const copyCode = async () => {
    if (!profile?.code) return;
    try {
      await navigator.clipboard.writeText(profile.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy code:', err);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your account details, and the code a trainer, dietitian or doctor uses to connect with you.
        </p>
      </div>

      {/* Identity card */}
      <div className="neu rounded-2xl p-5 sm:p-6 flex items-center gap-4">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="w-16 h-16 rounded-full object-cover shrink-0 border border-slate-200"
          />
        ) : (
          <span className="w-16 h-16 rounded-full grid place-items-center text-xl font-black text-white bg-gradient-to-br from-emerald-500 to-teal-700 shrink-0">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-lg font-bold text-slate-900 truncate">{name}</div>
          <div className="text-sm text-slate-500 truncate">{email}</div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-800 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">
              Client
            </span>
            {joined && (
              <span className="text-[11px] text-slate-400">Joined {joined}</span>
            )}
          </div>
        </div>
      </div>

      {/* Connection code */}
      <div className="neu rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Your connection code</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          Share this with a professional so they can request access to support your goals.
        </p>
        <div className="flex items-center gap-3">
          <div className="font-mono text-2xl tracking-[0.3em] font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
            {profile?.code || '••••••'}
          </div>
          <button
            type="button"
            onClick={copyCode}
            disabled={!profile?.code}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Become a professional */}
      <div className="neu rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl grid place-items-center bg-violet-50 border border-violet-200 text-violet-800 shrink-0">
            <Briefcase className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Work with clients as a professional</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Turn on a professional profile to connect with clients using their code, and support their
              goals as a trainer, dietitian or doctor. You keep your own goals exactly as they are.
            </p>
            <ul className="mt-3 space-y-1.5">
              {['Add your credentials and experience', 'Show a profile clients can verify', 'Get view or edit access to their goals'].map(
                (line) => (
                  <li key={line} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{line}</span>
                  </li>
                )
              )}
            </ul>
            <button
              type="button"
              onClick={onBecomeProfessional}
              disabled={saving}
              className="mt-4 inline-flex items-center gap-2 bg-violet-700 hover:bg-violet-800 active:scale-95 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-[0_8px_18px_-8px_rgb(91_33_182/0.9)] transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>{saving ? 'Setting up…' : 'Become a professional'}</span>
              {!saving && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
