import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  BadgeCheck,
  Briefcase,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { db } from '../firebase';
import { Credential, ProfessionalProfile, ProfessionalRole, ShowcaseItem, UserProfile } from '../types';
import { PROFESSIONAL_ROLES } from '../utils';

interface ProfessionalProfilePanelProps {
  user: User;
  profile: UserProfile | null;
  onError: (message: string) => void;
}

const emptyProfile = (uid: string): ProfessionalProfile => ({
  uid,
  displayName: '',
  headline: '',
  roles: [],
  yearsExperience: '',
  languages: '',
  bio: '',
  contactEmail: '',
  referenceUrl: '',
  credentials: [],
  showcase: [],
  acceptingClients: true,
});

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/**
 * Read-only presentation of a professional profile. Used by the owner to
 * preview their own profile and by clients viewing someone they work with.
 */
export const ProfessionalProfileCard: React.FC<{ value: ProfessionalProfile; compact?: boolean }> = ({
  value,
  compact = false,
}) => {
  const credentials = value.credentials || [];
  const showcase = value.showcase || [];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center text-sm font-bold shrink-0">
          {(value.displayName || 'P').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="text-base font-bold text-slate-900 truncate">
            {value.displayName || 'Professional'}
          </div>
          {value.headline && (
            <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{value.headline}</div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {(value.roles || []).map((role) => (
              <span
                key={role}
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
              >
                {role}
              </span>
            ))}
            {value.acceptingClients ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                Accepting clients
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                Not taking new clients
              </span>
            )}
          </div>
        </div>
      </div>

      {(value.yearsExperience || value.languages) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {value.yearsExperience && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Experience
              </div>
              <div className="text-xs font-semibold text-slate-800 mt-0.5">
                {value.yearsExperience}
              </div>
            </div>
          )}
          {value.languages && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Languages
              </div>
              <div className="text-xs font-semibold text-slate-800 mt-0.5">{value.languages}</div>
            </div>
          )}
        </div>
      )}

      {value.bio && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            About
          </div>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{value.bio}</p>
        </div>
      )}

      {credentials.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Qualifications
          </div>
          <ul className="space-y-2">
            {credentials.map((c) => (
              <li
                key={c.id}
                className="border border-slate-200 rounded-xl p-3 bg-white flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{c.title || 'Qualification'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {[c.issuer, c.year].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {c.referenceUrl && (
                  <a
                    href={c.referenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showcase.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Work &amp; results
          </div>
          <ul className="space-y-2">
            {showcase.map((s) => (
              <li key={s.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                <div className="text-xs font-bold text-slate-900">{s.title || 'Showcase'}</div>
                {s.description && (
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{s.description}</p>
                )}
                {s.link && (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 mt-1 inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (value.contactEmail || value.referenceUrl) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Reach out
          </div>
          {value.contactEmail && (
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{value.contactEmail}</span>
            </div>
          )}
          {value.referenceUrl && (
            <a
              href={value.referenceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Professional profile &amp; references</span>
            </a>
          )}
        </div>
      )}

      {credentials.length === 0 && showcase.length === 0 && !value.bio && (
        <p className="text-xs text-slate-400 italic">Nothing added yet.</p>
      )}
    </div>
  );
};

export const ProfessionalProfilePanel: React.FC<ProfessionalProfilePanelProps> = ({
  user,
  profile,
  onError,
}) => {
  const [value, setValue] = useState<ProfessionalProfile>(() =>
    emptyProfile(user.uid)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'publicProfiles', user.uid));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as Partial<ProfessionalProfile>;
          setValue({
            ...emptyProfile(user.uid),
            ...data,
            roles: data.roles || [],
            credentials: data.credentials || [],
            showcase: data.showcase || [],
          });
        } else {
          setValue((prev) => ({
            ...prev,
            displayName: profile?.displayName || user.displayName || '',
            contactEmail: profile?.email || user.email || '',
          }));
        }
      } catch (err) {
        console.error('Load professional profile:', err);
        onError('Could not load your professional profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.uid, user.displayName, user.email, profile?.displayName, profile?.email, onError]);

  const patch = (updates: Partial<ProfessionalProfile>) =>
    setValue((prev) => ({ ...prev, ...updates }));

  const toggleRole = (role: ProfessionalRole) =>
    setValue((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));

  // Only one entry is open at a time: the Add control comes back once the row
  // currently open has a title, so blank rows never stack up.
  const blankCredential = value.credentials.some((c) => !c.title.trim());
  const blankShowcase = value.showcase.some((s) => !s.title.trim());

  const addCredential = () => {
    if (blankCredential) return;
    patch({ credentials: [...value.credentials, { id: newId('cred'), title: '', issuer: '' }] });
  };

  const updateCredential = (id: string, updates: Partial<Credential>) =>
    patch({
      credentials: value.credentials.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });

  const removeCredential = (id: string) =>
    patch({ credentials: value.credentials.filter((c) => c.id !== id) });

  const addShowcase = () => {
    if (blankShowcase) return;
    patch({ showcase: [...value.showcase, { id: newId('show'), title: '' }] });
  };

  const updateShowcase = (id: string, updates: Partial<ShowcaseItem>) =>
    patch({ showcase: value.showcase.map((s) => (s.id === id ? { ...s, ...updates } : s)) });

  const removeShowcase = (id: string) =>
    patch({ showcase: value.showcase.filter((s) => s.id !== id) });

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const cleaned: ProfessionalProfile = {
        ...value,
        uid: user.uid,
        credentials: value.credentials.filter((c) => c.title.trim() !== ''),
        showcase: value.showcase.filter((s) => s.title.trim() !== ''),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'publicProfiles', user.uid), cleaned, { merge: true });
      setValue(cleaned);
      setIsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save professional profile:', err);
      onError('Could not save your professional profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyEmail = async () => {
    if (value.contactEmail) {
      await navigator.clipboard.writeText(value.contactEmail).catch(() => {});
    }
  };

  const inputClass =
    'w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600';
  const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1';

  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <span className="text-xs font-semibold text-slate-500">Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Professional Profile</h1>
          <p className="text-sm text-slate-500 mt-1">
            What your connected clients see. Only people whose requests you approved can read this.
          </p>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-2 shrink-0">
            {saved && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit profile</span>
            </button>
          </div>
        )}
      </div>

      {!isEditing ? (
        <div className="glass rounded-2xl p-5 sm:p-6">
          <ProfessionalProfileCard value={value} />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Who you are */}
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Who you are</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>Name shown to clients</span>
                <input
                  className={inputClass}
                  value={value.displayName || ''}
                  onChange={(e) => patch({ displayName: e.target.value })}
                  placeholder="e.g. Coach Aisha"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Headline</span>
                <input
                  className={inputClass}
                  value={value.headline || ''}
                  onChange={(e) => patch({ headline: e.target.value })}
                  placeholder="e.g. Strength coach for busy beginners"
                />
              </label>
            </div>

            <div>
              <span className={labelClass}>Roles you offer</span>
              <div className="flex flex-wrap gap-2">
                {PROFESSIONAL_ROLES.map((role) => {
                  const active = value.roles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>Experience</span>
                <input
                  className={inputClass}
                  value={value.yearsExperience || ''}
                  onChange={(e) => patch({ yearsExperience: e.target.value })}
                  placeholder="e.g. 6 years"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Languages</span>
                <input
                  className={inputClass}
                  value={value.languages || ''}
                  onChange={(e) => patch({ languages: e.target.value })}
                  placeholder="e.g. English, Arabic"
                />
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>About</span>
              <textarea
                rows={4}
                className={`${inputClass} resize-none`}
                value={value.bio || ''}
                onChange={(e) => patch({ bio: e.target.value })}
                placeholder="How you work, who you help, what a client can expect."
              />
            </label>

            <label className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700">Currently accepting new clients</span>
              <input
                type="checkbox"
                checked={!!value.acceptingClients}
                onChange={(e) => patch({ acceptingClients: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
            </label>
          </div>

          {/* Qualifications */}
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Qualifications
                </h2>
              </div>
              {blankCredential ? (
                <span className="text-[11px] font-semibold text-slate-400 text-right">
                  Finish this one to add another
                </span>
              ) : (
                <button
                  type="button"
                  onClick={addCredential}
                  className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  {value.credentials.length === 0 ? 'Add a qualification' : 'Add another'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Name the certificate and link to somewhere a client can check it, such as your LinkedIn
              profile or the issuer&apos;s verification page.
            </p>

            {value.credentials.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nothing added yet.</p>
            ) : (
              <div className="space-y-2.5">
                {value.credentials.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        className={inputClass}
                        value={c.title}
                        onChange={(e) => updateCredential(c.id, { title: e.target.value })}
                        placeholder="Certificate title"
                      />
                      <input
                        className={inputClass}
                        value={c.issuer}
                        onChange={(e) => updateCredential(c.id, { issuer: e.target.value })}
                        placeholder="Issued by"
                      />
                      <input
                        className={inputClass}
                        value={c.year || ''}
                        onChange={(e) => updateCredential(c.id, { year: e.target.value })}
                        placeholder="Year"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className={inputClass}
                        value={c.referenceUrl || ''}
                        onChange={(e) => updateCredential(c.id, { referenceUrl: e.target.value })}
                        placeholder="Reference link (LinkedIn, issuer page)"
                      />
                      <button
                        type="button"
                        onClick={() => removeCredential(c.id)}
                        title="Remove"
                        className="p-2 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Showcase */}
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Work &amp; results
                </h2>
              </div>
              {blankShowcase ? (
                <span className="text-[11px] font-semibold text-slate-400 text-right">
                  Finish this one to add another
                </span>
              ) : (
                <button
                  type="button"
                  onClick={addShowcase}
                  className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  {value.showcase.length === 0 ? 'Add a result' : 'Add another'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Client outcomes, programmes you built, publications. Keep it to results you can stand behind.
            </p>

            {value.showcase.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nothing added yet.</p>
            ) : (
              <div className="space-y-2.5">
                {value.showcase.map((s) => (
                  <div key={s.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        className={inputClass}
                        value={s.title}
                        onChange={(e) => updateShowcase(s.id, { title: e.target.value })}
                        placeholder="Title"
                      />
                      <button
                        type="button"
                        onClick={() => removeShowcase(s.id)}
                        title="Remove"
                        className="p-2 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className={`${inputClass} resize-none`}
                      value={s.description || ''}
                      onChange={(e) => updateShowcase(s.id, { description: e.target.value })}
                      placeholder="What you did and what changed"
                    />
                    <input
                      className={inputClass}
                      value={s.link || ''}
                      onChange={(e) => updateShowcase(s.id, { link: e.target.value })}
                      placeholder="Link (optional)"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Contact</h2>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Email only. Plans, check-ins and questions stay inside Goal Path so your client&apos;s
                progress lives in one place.
              </span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>Contact email</span>
                <input
                  type="email"
                  className={inputClass}
                  value={value.contactEmail || ''}
                  onChange={(e) => patch({ contactEmail: e.target.value })}
                  placeholder="you@gmail.com"
                />
              </label>
              <label className="block">
                <span className={labelClass}>LinkedIn or references</span>
                <input
                  className={inputClass}
                  value={value.referenceUrl || ''}
                  onChange={(e) => patch({ referenceUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-semibold px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save profile'}</span>
            </button>
          </div>
        </div>
      )}

      {!isEditing && value.contactEmail && (
        <button
          type="button"
          onClick={copyEmail}
          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer flex items-center gap-1.5"
        >
          <Copy className="w-3 h-3" />
          <span>Copy my contact email</span>
        </button>
      )}
    </div>
  );
};
