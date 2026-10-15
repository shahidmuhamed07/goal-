import { useState } from 'react';
import { POPUP_FREQUENCIES, type Popup } from '@goalpath/shared';
import { Drawer } from '../../components/Drawer';
import { FormFooter } from '../../components/FormFooter';
import { AudienceField, ScheduleFields, StatusField, ToneField, scheduleIsInvalid } from '../../components/PublishFields';
import { PopupPreview } from '../../components/Preview';
import { ChoiceChips, Field } from '../../components/ui';
import { newId } from '../../lib/ids';

export function blankPopup(): Popup {
  const now = new Date().toISOString();
  return {
    id: newId('pop'),
    name: '',
    title: '',
    body: '',
    tone: 'brand',
    audience: 'everyone',
    frequency: 'once',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

interface Props {
  initial: Popup;
  isNew: boolean;
  onSave: (popup: Popup) => Promise<void>;
  onDelete: (popup: Popup) => void;
  onClose: () => void;
}

export function PopupForm({ initial, isNew, onSave, onDelete, onClose }: Props) {
  const [p, setP] = useState<Popup>(initial);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof Popup>(key: K, value: Popup[K]) => setP((prev) => ({ ...prev, [key]: value }));

  const errors = {
    name: !p.name.trim() ? 'Give it a name so you can find it later.' : '',
    title: !p.title.trim() ? 'The headline is what people read.' : '',
    body: !p.body.trim() ? 'Say a little more than the headline.' : '',
    ctaUrl: p.ctaLabel?.trim() && !p.ctaUrl?.trim() ? 'A button needs a link.' : '',
  };
  const valid = !errors.name && !errors.title && !errors.body && !errors.ctaUrl && !scheduleIsInvalid(p);

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({ ...p, name: p.name.trim(), title: p.title.trim(), body: p.body.trim(), updatedAt: new Date().toISOString() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={isNew ? 'New popup' : 'Edit popup'}
      onClose={onClose}
      footer={<FormFooter isNew={isNew} canSave={touched ? valid : true} saving={saving} onSave={save} onCancel={onClose} onDelete={() => onDelete(p)} />}
    >
      <div className="stack">
        <Field label="Name (only you see this)" htmlFor="name" error={touched ? errors.name : ''}>
          <input id="name" className="input" value={p.name} aria-invalid={touched && !!errors.name} onChange={(e) => set('name', e.target.value)} placeholder="What’s new: routines" />
        </Field>
        <Field label="Headline" htmlFor="title" error={touched ? errors.title : ''}>
          <input id="title" className="input" value={p.title} aria-invalid={touched && !!errors.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Message" htmlFor="body" error={touched ? errors.body : ''}>
          <textarea id="body" className="textarea" value={p.body} aria-invalid={touched && !!errors.body} onChange={(e) => set('body', e.target.value)} />
        </Field>
        <Field label="Image address" htmlFor="imageUrl" hint="A link to a picture on the web. Optional.">
          <input id="imageUrl" className="input" value={p.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value || undefined)} placeholder="https://…" />
        </Field>
        <div className="grid cols-2">
          <Field label="Button text" htmlFor="ctaLabel" hint="Optional.">
            <input id="ctaLabel" className="input" value={p.ctaLabel ?? ''} onChange={(e) => set('ctaLabel', e.target.value || undefined)} />
          </Field>
          <Field label="Button link" htmlFor="ctaUrl" error={touched ? errors.ctaUrl : ''}>
            <input id="ctaUrl" className="input" value={p.ctaUrl ?? ''} onChange={(e) => set('ctaUrl', e.target.value || undefined)} />
          </Field>
        </div>
        <ToneField value={p.tone} onChange={(v) => set('tone', v)} />
        <ChoiceChips label="How often" options={POPUP_FREQUENCIES} value={p.frequency} onChange={(v) => set('frequency', v)} />
        <AudienceField value={p.audience} onChange={(v) => set('audience', v)} />
        <ScheduleFields value={p} onChange={(s) => setP((prev) => ({ ...prev, ...s }))} />
        <StatusField value={p.status} onChange={(v) => set('status', v)} />
      </div>
      <PopupPreview popup={p} />
    </Drawer>
  );
}
