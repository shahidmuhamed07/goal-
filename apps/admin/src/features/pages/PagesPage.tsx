import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Page } from '@goalpath/shared';
import { api } from '../../lib';
import { useCollection } from '../../lib/useCollection';
import { timeAgo } from '../../lib/dates';
import { useToast } from '../../components/Toasts';
import { DataTable, EmptyState, PageHeader, StatusPill, audienceLabel } from '../../components/ui';
import { PageForm, blankPage } from './PageForm';

export function PagesPage() {
  const { items, loading, error, save, remove } = useCollection(api.pages);
  const [editing, setEditing] = useState<{ page: Page; isNew: boolean } | null>(null);
  const notify = useToast();

  const onSave = async (page: Page) => {
    try {
      await save(page);
      notify(editing?.isNew ? 'Page created' : 'Page saved');
      setEditing(null);
    } catch {
      notify('Could not save. Please try again.', true);
    }
  };

  const onDelete = async (page: Page) => {
    if (!window.confirm(`Delete “${page.title}”? Banners linking to it will lead nowhere.`)) return;
    try {
      await remove(page.id);
      notify('Page deleted');
      setEditing(null);
    } catch {
      notify('Could not delete. Please try again.', true);
    }
  };

  return (
    <>
      <PageHeader
        title="Pages"
        lede="New windows for the app, built from simple blocks. Link to them from a banner or popup."
        action={<button className="btn" onClick={() => setEditing({ page: blankPage(), isNew: true })}><Plus size={18} /> New page</button>}
      />
      <div className="card flush">
        {error ? (
          <EmptyState title="Could not load pages" text={error} />
        ) : loading ? (
          <EmptyState title="Loading…" text="One moment." />
        ) : items.length === 0 ? (
          <EmptyState title="No pages yet" text="Create a page for an offer, a guide or a challenge." action={<button className="btn" onClick={() => setEditing({ page: blankPage(), isNew: true })}><Plus size={18} /> New page</button>} />
        ) : (
          <DataTable
            rows={items}
            onOpen={(page) => setEditing({ page, isNew: false })}
            columns={[
              { header: 'Page', render: (p) => (<><div className="name">{p.title}</div><div className="sub">/pages/{p.slug}</div></>) },
              { header: 'Blocks', render: (p) => p.blocks.length },
              { header: 'Who sees it', render: (p) => audienceLabel(p.audience) },
              { header: 'Edited', render: (p) => <span className="small muted">{timeAgo(p.updatedAt)}</span> },
              { header: 'State', render: (p) => <StatusPill item={p} /> },
            ]}
          />
        )}
      </div>
      {editing && (
        <PageForm
          key={editing.page.id}
          initial={editing.page}
          isNew={editing.isNew}
          takenSlugs={items.filter((p) => p.id !== editing.page.id).map((p) => p.slug)}
          onSave={onSave}
          onDelete={onDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
