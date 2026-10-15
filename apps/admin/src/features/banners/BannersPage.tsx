import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BANNER_PLACEMENTS, type Banner, type BannerPlacement } from '@goalpath/shared';
import { api } from '../../lib';
import { useCollection } from '../../lib/useCollection';
import { formatWindow } from '../../lib/dates';
import { useToast } from '../../components/Toasts';
import { DataTable, EmptyState, PageHeader, StatusPill, audienceLabel } from '../../components/ui';
import { BannerForm, blankBanner } from './BannerForm';

export function BannersPage() {
  const { items, loading, error, save, remove } = useCollection(api.banners);
  const [editing, setEditing] = useState<{ banner: Banner; isNew: boolean } | null>(null);
  const [filter, setFilter] = useState<BannerPlacement | 'all'>('all');
  const notify = useToast();

  const rows = items
    .filter((b) => filter === 'all' || b.placement === filter)
    .sort((a, b) => b.priority - a.priority);

  const onSave = async (banner: Banner) => {
    try {
      await save(banner);
      notify(editing?.isNew ? 'Banner created' : 'Banner saved');
      setEditing(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save. Please try again.', true);
    }
  };

  const onDelete = async (banner: Banner) => {
    if (!window.confirm(`Delete “${banner.name || banner.title}”? This cannot be undone.`)) return;
    try {
      await remove(banner.id);
      notify('Banner deleted');
      setEditing(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete. Please try again.', true);
    }
  };

  const placementLabel = (p: BannerPlacement) => BANNER_PLACEMENTS.find((x) => x.value === p)?.label ?? p;

  return (
    <>
      <PageHeader
        title="Banners"
        lede="Messages and offers that appear in set places in the app. Pick where, who sees it and for how long."
        action={<button className="btn" onClick={() => setEditing({ banner: blankBanner(), isNew: true })}><Plus size={18} /> New banner</button>}
      />

      <div className="chips" role="group" aria-label="Filter by place">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All ({items.length})</button>
        {BANNER_PLACEMENTS.map((p) => (
          <button key={p.value} className="chip" aria-pressed={filter === p.value} onClick={() => setFilter(p.value)}>
            {p.label} ({items.filter((b) => b.placement === p.value).length})
          </button>
        ))}
      </div>

      <div className="card flush">
        {error ? (
          <EmptyState title="Could not load banners" text={error} />
        ) : loading ? (
          <EmptyState title="Loading…" text="One moment." />
        ) : rows.length === 0 ? (
          <EmptyState
            title={filter === 'all' ? 'No banners yet' : 'Nothing here yet'}
            text="Create one to show a message or offer in the app."
            action={<button className="btn" onClick={() => setEditing({ banner: { ...blankBanner(), placement: filter === 'all' ? 'goals-banner' : filter }, isNew: true })}><Plus size={18} /> New banner</button>}
          />
        ) : (
          <DataTable
            rows={rows}
            onOpen={(banner) => setEditing({ banner, isNew: false })}
            columns={[
              { header: 'Banner', render: (b) => (<><div className="name">{b.name}</div><div className="sub">{b.title}</div></>) },
              { header: 'Where', render: (b) => <span className="tag">{placementLabel(b.placement)}</span> },
              { header: 'Who sees it', render: (b) => audienceLabel(b.audience) },
              { header: 'Dates', render: (b) => <span className="small muted">{formatWindow(b.startsAt, b.endsAt)}</span> },
              { header: 'State', render: (b) => <StatusPill item={b} /> },
            ]}
          />
        )}
      </div>

      {editing && (
        <BannerForm
          key={editing.banner.id}
          initial={editing.banner}
          isNew={editing.isNew}
          onSave={onSave}
          onDelete={onDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
