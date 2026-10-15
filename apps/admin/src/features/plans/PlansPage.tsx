import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PLAN_FOCUSES, type PlanTemplate } from '@goalpath/shared';
import { api } from '../../lib';
import { useCollection } from '../../lib/useCollection';
import { timeAgo } from '../../lib/dates';
import { useToast } from '../../components/Toasts';
import { DataTable, EmptyState, PageHeader, StatusPill } from '../../components/ui';
import { PlanForm, blankPlan } from './PlanForm';

export function PlansPage() {
  const { items, loading, error, save, remove } = useCollection(api.plans);
  const [editing, setEditing] = useState<{ plan: PlanTemplate; isNew: boolean } | null>(null);
  const notify = useToast();

  const onSave = async (plan: PlanTemplate) => {
    try {
      await save(plan);
      notify(editing?.isNew ? 'Plan created' : 'Plan saved');
      setEditing(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save. Please try again.', true);
    }
  };

  const onDelete = async (plan: PlanTemplate) => {
    if (!window.confirm(`Delete “${plan.name}”? New people will no longer be offered it.`)) return;
    try {
      await remove(plan.id);
      notify('Plan deleted');
      setEditing(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete. Please try again.', true);
    }
  };

  const focusLabel = (f: PlanTemplate['focus']) => PLAN_FOCUSES.find((x) => x.value === f)?.label ?? f;

  return (
    <>
      <PageHeader
        title="Starter plans"
        lede="The plans the first-run questions build for new people. Edit a diet or a training split here and the next person gets the new version."
        action={<button className="btn" onClick={() => setEditing({ plan: blankPlan(), isNew: true })}><Plus size={18} /> New plan</button>}
      />
      <div className="card flush">
        {error ? (
          <EmptyState title="Could not load plans" text={error} />
        ) : loading ? (
          <EmptyState title="Loading…" text="One moment." />
        ) : items.length === 0 ? (
          <EmptyState title="No starter plans yet" text="Without plans, new people start with an empty goal." action={<button className="btn" onClick={() => setEditing({ plan: blankPlan(), isNew: true })}><Plus size={18} /> New plan</button>} />
        ) : (
          <DataTable
            rows={items}
            onOpen={(plan) => setEditing({ plan, isNew: false })}
            columns={[
              { header: 'Plan', render: (p) => (<><div className="name">{p.name}</div><div className="sub">{p.title}</div></>) },
              { header: 'For', render: (p) => <span className="tag">{focusLabel(p.focus)}</span> },
              { header: 'Routines', render: (p) => p.routines.length },
              { header: 'Edited', render: (p) => <span className="small muted">{timeAgo(p.updatedAt)}</span> },
              { header: 'State', render: (p) => <StatusPill item={p} /> },
            ]}
          />
        )}
      </div>
      {editing && (
        <PlanForm key={editing.plan.id} initial={editing.plan} isNew={editing.isNew} onSave={onSave} onDelete={onDelete} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
