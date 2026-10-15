import { useState } from 'react';
import { Plus } from 'lucide-react';
import { POPUP_FREQUENCIES, type Popup } from '@goalpath/shared';
import { api } from '../../lib';
import { useCollection } from '../../lib/useCollection';
import { formatWindow } from '../../lib/dates';
import { useToast } from '../../components/Toasts';
import { DataTable, EmptyState, PageHeader, StatusPill, audienceLabel } from '../../components/ui';
import { PopupForm, blankPopup } from './PopupForm';

export function PopupsPage() {
  const { items, loading, error, save, remove } = useCollection(api.popups);
  const [editing, setEditing] = useState<{ popup: Popup; isNew: boolean } | null>(null);
  const notify = useToast();

  const onSave = async (popup: Popup) => {
    try {
      await save(popup);
      notify(editing?.isNew ? 'Popup created' : 'Popup saved');
      setEditing(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save. Please try again.', true);
    }
  };

  const onDelete = async (popup: Popup) => {
    if (!window.confirm(`Delete “${popup.name || popup.title}”? This cannot be undone.`)) return;
    try {
      await remove(popup.id);
      notify('Popup deleted');
      setEditing(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete. Please try again.', true);
    }
  };

  const freq = (f: Popup['frequency']) => POPUP_FREQUENCIES.find((x) => x.value === f)?.label ?? f;

  return (
    <>
      <PageHeader
        title="Popups"
        lede="A window that opens over the app when someone starts it, such as “What’s new” or a time-limited offer."
        action={<button className="btn" onClick={() => setEditing({ popup: blankPopup(), isNew: true })}><Plus size={18} /> New popup</button>}
      />
      <div className="card flush">
        {error ? (
          <EmptyState title="Could not load popups" text={error} />
        ) : loading ? (
          <EmptyState title="Loading…" text="One moment." />
        ) : items.length === 0 ? (
          <EmptyState
            title="No popups yet"
            text="Create one to announce something new."
            action={<button className="btn" onClick={() => setEditing({ popup: blankPopup(), isNew: true })}><Plus size={18} /> New popup</button>}
          />
        ) : (
          <DataTable
            rows={items}
            onOpen={(popup) => setEditing({ popup, isNew: false })}
            columns={[
              { header: 'Popup', render: (p) => (<><div className="name">{p.name}</div><div className="sub">{p.title}</div></>) },
              { header: 'Who sees it', render: (p) => audienceLabel(p.audience) },
              { header: 'How often', render: (p) => freq(p.frequency) },
              { header: 'Dates', render: (p) => <span className="small muted">{formatWindow(p.startsAt, p.endsAt)}</span> },
              { header: 'State', render: (p) => <StatusPill item={p} /> },
            ]}
          />
        )}
      </div>
      {editing && (
        <PopupForm key={editing.popup.id} initial={editing.popup} isNew={editing.isNew} onSave={onSave} onDelete={onDelete} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
