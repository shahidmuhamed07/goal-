import { Link } from 'react-router-dom';
import { BANNER_PLACEMENTS, isLive, lifecycleOf } from '@goalpath/shared';
import { api } from '../../lib';
import { useCollection } from '../../lib/useCollection';
import { formatWhen } from '../../lib/dates';
import { PageHeader, StatusPill } from '../../components/ui';

/** A glance at what is live in the app now, what is coming, and what is only a draft. */
export function OverviewPage() {
  const banners = useCollection(api.banners);
  const popups = useCollection(api.popups);
  const pages = useCollection(api.pages);
  const plans = useCollection(api.plans);
  const now = new Date();

  const stat = (items: { status: 'draft' | 'published'; startsAt?: string; endsAt?: string }[]) => ({
    live: items.filter((i) => lifecycleOf(i, now) === 'live').length,
    scheduled: items.filter((i) => lifecycleOf(i, now) === 'scheduled').length,
    draft: items.filter((i) => lifecycleOf(i, now) === 'draft').length,
  });

  const cards = [
    { label: 'Banners', to: '/banners', ...stat(banners.items) },
    { label: 'Popups', to: '/popups', ...stat(popups.items) },
    { label: 'Pages', to: '/pages', ...stat(pages.items) },
    { label: 'Starter plans', to: '/plans', ...stat(plans.items) },
  ];

  const liveNow = [
    ...banners.items.filter((b) => isLive(b, now)).map((b) => ({ id: b.id, kind: 'Banner', name: b.name, item: b, where: BANNER_PLACEMENTS.find((p) => p.value === b.placement)?.label ?? '' })),
    ...popups.items.filter((p) => isLive(p, now)).map((p) => ({ id: p.id, kind: 'Popup', name: p.name, item: p, where: 'On app start' })),
  ];

  const upcoming = [...banners.items.map((b) => ({ id: b.id, kind: 'Banner', name: b.name, item: b })), ...popups.items.map((p) => ({ id: p.id, kind: 'Popup', name: p.name, item: p }))]
    .filter((x) => lifecycleOf(x.item, now) === 'scheduled')
    .sort((a, b) => new Date(a.item.startsAt!).getTime() - new Date(b.item.startsAt!).getTime());

  return (
    <>
      <PageHeader title="Overview" lede="What people see in the app right now, and what is on its way." />

      <div className="grid cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card stat">
            <b>{c.live}</b>
            <span>{c.label} live</span>
            <span className="small faint">{c.scheduled} scheduled · {c.draft} draft</span>
            <Link to={c.to}>Manage →</Link>
          </div>
        ))}
      </div>

      <div className="grid cols-2">
        <section className="card stack">
          <h2 className="section-title">Live in the app now</h2>
          {liveNow.length === 0 ? (
            <p className="muted">Nothing is live. People see the app as it is.</p>
          ) : (
            liveNow.map((x) => (
              <div key={x.id} className="row between">
                <div>
                  <div style={{ fontWeight: 700 }}>{x.name}</div>
                  <div className="small muted">{x.kind} · {x.where}</div>
                </div>
                <StatusPill item={x.item} />
              </div>
            ))
          )}
        </section>

        <section className="card stack">
          <h2 className="section-title">Coming up</h2>
          {upcoming.length === 0 ? (
            <p className="muted">Nothing is scheduled. Set a start date on a published item to plan ahead.</p>
          ) : (
            upcoming.map((x) => (
              <div key={x.id} className="row between">
                <div>
                  <div style={{ fontWeight: 700 }}>{x.name}</div>
                  <div className="small muted">{x.kind} · starts {formatWhen(x.item.startsAt)}</div>
                </div>
                <StatusPill item={x.item} />
              </div>
            ))
          )}
        </section>
      </div>

      <section className="card stack">
        <h2 className="section-title">Where banners can appear</h2>
        <div className="grid cols-2">
          {BANNER_PLACEMENTS.map((p) => {
            const live = banners.items.filter((b) => b.placement === p.value && isLive(b, now)).length;
            return (
              <div key={p.value} className="well row between">
                <div>
                  <div style={{ fontWeight: 700 }}>{p.label}</div>
                  <div className="small muted">{p.hint}</div>
                </div>
                <span className="tag">{live} live</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
