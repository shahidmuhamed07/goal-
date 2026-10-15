import { useState } from 'react';
import { BANNER_PLACEMENTS, type Banner } from '@goalpath/shared';
import { Drawer } from '../../components/Drawer';
import { FormFooter } from '../../components/FormFooter';
import { AudienceField, ScheduleFields, StatusField, ToneField, scheduleIsInvalid } from '../../components/PublishFields';
import { BannerPreview } from '../../components/Preview';
import { ChoiceChips, Field } from '../../components/ui';
import { newId } from '../../lib/ids';

export function blankBanner(): Banner {
  const now = new Date().toISOString();
  return {
    id: newId('ban'),
    name: '',
    placement: 'goals-banner',
    title: '',
    tone: 'brand',
    audience: 'everyone',
    priority: 10,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

interface Props {
  initial: Banner;
  isNew: boolean;
  onSave: (banner: Banner) => Promise<void>;
  onDelete: (banner: Banner) => void;
  onClose: () => void;
}

export function BannerForm({ initial, isNew, onSave, onDelete, onClose }: Props) {
  const [b, setB] = useState<Banner>(initial);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof Banner>(key: K, value: Banner[K]) => setB((prev) => ({ ...prev, [key]: value }));

  const errors = {
    name: !b.name.trim() ? 'Give it a name so you can find it later.' : '',
    title: !b.title.trim() ? 'The headline is what people read.' : '',
    ctaUrl: b.ctaLabel?.trim() && !b.ctaUrl?.trim() ? 'A button needs a link.' : '',
  };
  const valid = !errors.name && !errors.title && !errors.ctaUrl && !scheduleIsInvalid(b);

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({ ...b, name: b.name.trim(), title: b.title.trim(), updatedAt: new Date().toISOString() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={isNew ? 'New banner' : 'Edit banner'}
      onClose={onClose}
      footer={<FormFooter isNew={isNew} canSave={touched ? valid : true} saving={saving} onSave={save} onCancel={onClose} onDelete={() => onDelete(b)} />}
    >
      <div className="stack">
        <Field label="Name (only you see this)" htmlFor="name" error={touched ? errors.name : ''}>
          <input id="name" className="input" value={b.name} aria-invalid={touched && !!errors.name} onChange={(e) => set('name', e.target.value)} placeholder="Welcome offer" />
        </Field>

        <ChoiceChips label="Where it appears" options={BANNER_PLACEMENTS} value={b.placement} onChange={(v) => set('placement', v)} />

        <Field label="Headline" htmlFor="title" error={touched ? errors.title : ''}>
          <input id="title" className="input" value={b.title} aria-invalid={touched && !!errors.title} onChange={(e) => set('title', e.target.value)} placeholder="Plan your first month" />
        </Field>

        {b.placement !== 'announcement-bar' && (
          <>
            <Field label="Message" htmlFor="body" hint="One or two short sentences.">
              <textarea id="body" className="textarea" value={b.body ?? ''} onChange={(e) => set('body', e.target.value || undefined)} />
            </Field>
            <Field label="Image address" htmlFor="imageUrl" hint="A link to a picture on the web. Optional.">
              <input id="imageUrl" className="input" value={b.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value || undefined)} placeholder="https://…" />
            </Field>
          </>
        )}

        <div className="grid cols-2">
          <Field label="Button text" htmlFor="ctaLabel" hint="Optional.">
            <input id="ctaLabel" className="input" value={b.ctaLabel ?? ''} onChange={(e) => set('ctaLabel', e.target.value || undefined)} placeholder="See plans" />
          </Field>
          <Field label="Button link" htmlFor="ctaUrl" error={touched ? errors.ctaUrl : ''} hint="A page such as /pages/summer or a web address.">
            <input id="ctaUrl" className="input" value={b.ctaUrl ?? ''} onChange={(e) => set('ctaUrl', e.target.value || undefined)} placeholder="/pages/summer" />
          </Field>
        </div>

        <ToneField value={b.tone} onChange={(v) => set('tone', v)} />
        <AudienceField value={b.audience} onChange={(v) => set('audience', v)} />

        <Field label="Order" htmlFor="priority" hint="When several banners share a place, the highest number shows first.">
          <input id="priority" className="input" type="number" value={b.priority} onChange={(e) => set('priority', Number(e.target.value) || 0)} />
        </Field>

        <ScheduleFields value={b} onChange={(s) => setB((prev) => ({ ...prev, ...s }))} />
        <StatusField value={b.status} onChange={(v) => set('status', v)} />
      </div>
      <BannerPreview banner={b} />
    </Drawer>
  );
}
