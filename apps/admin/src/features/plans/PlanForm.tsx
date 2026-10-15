import { useState } from 'react';
import { PLAN_FOCUSES, type PlanTemplate } from '@goalpath/shared';
import { Drawer } from '../../components/Drawer';
import { FormFooter } from '../../components/FormFooter';
import { StatusField } from '../../components/PublishFields';
import { ChoiceChips, Field } from '../../components/ui';
import { newId } from '../../lib/ids';
import { RoutineEditor } from './RoutineEditor';

const EATING = [
  { value: '', label: 'Any' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'protein', label: 'High-protein' },
  { value: 'lowcarb', label: 'Low-carb' },
];

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function blankPlan(): PlanTemplate {
  const now = new Date().toISOString();
  return { id: newId('plan'), name: '', focus: 'fitness', title: '', category: '', description: '', routines: [], status: 'draft', createdAt: now, updatedAt: now };
}

interface Props {
  initial: PlanTemplate;
  isNew: boolean;
  onSave: (plan: PlanTemplate) => Promise<void>;
  onDelete: (plan: PlanTemplate) => void;
  onClose: () => void;
}

export function PlanForm({ initial, isNew, onSave, onDelete, onClose }: Props) {
  const [p, setP] = useState<PlanTemplate>(initial);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof PlanTemplate>(key: K, value: PlanTemplate[K]) => setP((prev) => ({ ...prev, [key]: value }));

  const errors = {
    name: !p.name.trim() ? 'Give it a name so you can find it later.' : '',
    title: !p.title.trim() ? 'This is the goal title people end up with.' : '',
    category: !p.category.trim() ? 'A category such as Health or Fitness.' : '',
    routines:
      p.routines.length === 0
        ? 'Add at least one routine.'
        : p.routines.some((r) => !r.name.trim() || r.weekdays.length === 0 || r.tasks.every((t) => !t.trim()))
        ? 'Every routine needs a name, a weekday and a task.'
        : '',
  };
  const valid = !errors.name && !errors.title && !errors.category && !errors.routines;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const cleaned = p.routines.map((r) => ({ ...r, name: r.name.trim(), tasks: r.tasks.map((t) => t.trim()).filter(Boolean) }));
      await onSave({ ...p, name: p.name.trim(), title: p.title.trim(), category: p.category.trim(), routines: cleaned, updatedAt: new Date().toISOString() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={isNew ? 'New starter plan' : 'Edit starter plan'}
      onClose={onClose}
      footer={<FormFooter isNew={isNew} canSave={touched ? valid : true} saving={saving} onSave={save} onCancel={onClose} onDelete={() => onDelete(p)} />}
    >
      <div className="stack">
        <Field label="Name (only you see this)" htmlFor="name" error={touched ? errors.name : ''}>
          <input id="name" className="input" value={p.name} aria-invalid={touched && !!errors.name} onChange={(e) => set('name', e.target.value)} placeholder="Get fitter: push and pull" />
        </Field>
        <ChoiceChips label="Offered to people who want" options={PLAN_FOCUSES} value={p.focus} onChange={(v) => set('focus', v)} />
        {p.focus === 'diet' && (
          <Field label="Eating style" htmlFor="eating" hint="Offered only to people who chose this style. “Any” suits everyone.">
            <select id="eating" className="select" value={p.eating ?? ''} onChange={(e) => set('eating', e.target.value || undefined)}>
              {EATING.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}
        <div className="grid cols-2">
          <Field label="Goal title" htmlFor="title" error={touched ? errors.title : ''}>
            <input id="title" className="input" value={p.title} aria-invalid={touched && !!errors.title} onChange={(e) => set('title', e.target.value)} placeholder="Get stronger and fitter" />
          </Field>
          <Field label="Category" htmlFor="category" error={touched ? errors.category : ''}>
            <input id="category" className="input" value={p.category} aria-invalid={touched && !!errors.category} onChange={(e) => set('category', e.target.value)} placeholder="Fitness" />
          </Field>
        </div>
        <Field label="Description" htmlFor="description">
          <textarea id="description" className="textarea" value={p.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <RoutineEditor routines={p.routines} onChange={(r) => set('routines', r)} />
        {touched && errors.routines && <span className="error" role="alert" style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }}>{errors.routines}</span>}
        <StatusField value={p.status} onChange={(v) => set('status', v)} />
      </div>

      <div className="preview-col">
        <span className="label">What people get</span>
        <div className="card stack" style={{ gap: 10 }}>
          <div className="row between"><b style={{ fontFamily: 'var(--display)' }}>{p.title || 'Goal title'}</b><span className="tag">{p.category || 'Category'}</span></div>
          {p.description && <p className="muted small">{p.description}</p>}
          {p.routines.map((r) => (
            <div key={r.id} className="well">
              <div className="row between"><b className="small">{r.name || 'Routine'}</b><span className="small" style={{ color: 'var(--brand-deep)', fontWeight: 700 }}>{r.weekdays.map((d) => SHORT_DAYS[d]).join(' · ')}</span></div>
              <span className="small muted">{r.tasks.filter((t) => t.trim()).slice(0, 2).join(' · ')}</span>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}
