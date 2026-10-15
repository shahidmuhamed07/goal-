import { useState } from 'react';
import type { Page } from '@goalpath/shared';
import { Drawer } from '../../components/Drawer';
import { FormFooter } from '../../components/FormFooter';
import { AudienceField, StatusField } from '../../components/PublishFields';
import { PagePreview } from '../../components/Preview';
import { Field } from '../../components/ui';
import { newId, slugify } from '../../lib/ids';
import { BlockEditor } from './BlockEditor';

export function blankPage(): Page {
  const now = new Date().toISOString();
  return { id: newId('page'), slug: '', title: '', audience: 'everyone', status: 'draft', blocks: [], createdAt: now, updatedAt: now };
}

interface Props {
  initial: Page;
  isNew: boolean;
  /** Addresses already used by other pages. */
  takenSlugs: string[];
  onSave: (page: Page) => Promise<void>;
  onDelete: (page: Page) => void;
  onClose: () => void;
}

export function PageForm({ initial, isNew, takenSlugs, onSave, onDelete, onClose }: Props) {
  const [p, setP] = useState<Page>(initial);
  // Until someone edits the address by hand, it follows the title.
  const [slugEdited, setSlugEdited] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const slugError = !p.slug
    ? 'An address is needed, such as summer-challenge.'
    : takenSlugs.includes(p.slug)
    ? 'Another page already uses this address.'
    : '';
  const errors = { title: !p.title.trim() ? 'Give the page a title.' : '', slug: slugError };
  const valid = !errors.title && !errors.slug;

  const setTitle = (title: string) => setP((prev) => ({ ...prev, title, slug: slugEdited ? prev.slug : slugify(title) }));

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({ ...p, title: p.title.trim(), updatedAt: new Date().toISOString() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={isNew ? 'New page' : 'Edit page'}
      onClose={onClose}
      footer={<FormFooter isNew={isNew} canSave={touched ? valid : true} saving={saving} onSave={save} onCancel={onClose} onDelete={() => onDelete(p)} />}
    >
      <div className="stack">
        <Field label="Title" htmlFor="title" error={touched ? errors.title : ''}>
          <input id="title" className="input" value={p.title} aria-invalid={touched && !!errors.title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer challenge" />
        </Field>
        <Field label="Address" htmlFor="slug" error={touched ? errors.slug : ''} hint={`In the app: /pages/${p.slug || 'your-address'}`}>
          <input
            id="slug"
            className="input"
            value={p.slug}
            aria-invalid={touched && !!errors.slug}
            onChange={(e) => { setSlugEdited(true); setP((prev) => ({ ...prev, slug: slugify(e.target.value) })); }}
          />
        </Field>
        <BlockEditor blocks={p.blocks} onChange={(blocks) => setP((prev) => ({ ...prev, blocks }))} />
        <AudienceField value={p.audience} onChange={(audience) => setP((prev) => ({ ...prev, audience }))} />
        <StatusField value={p.status} onChange={(status) => setP((prev) => ({ ...prev, status }))} />
      </div>
      <PagePreview page={p} />
    </Drawer>
  );
}
