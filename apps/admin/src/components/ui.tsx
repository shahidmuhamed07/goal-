import type { ReactNode } from 'react';
import { lifecycleOf, type Audience, type Option } from '@goalpath/shared';

/** The title row at the top of every screen. */
export function PageHeader({ title, lede, action }: { title: string; lede?: string; action?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {action}
    </header>
  );
}

const LIFECYCLE_LABEL = { draft: 'Draft', scheduled: 'Scheduled', live: 'Live', ended: 'Ended' } as const;

/** Draft, Scheduled, Live or Ended, worked out from status and dates. */
export function StatusPill({ item, now = new Date() }: { item: Parameters<typeof lifecycleOf>[0]; now?: Date }) {
  const state = lifecycleOf(item, now);
  return <span className={`pill ${state}`}>{LIFECYCLE_LABEL[state]}</span>;
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  everyone: 'Everyone',
  owners: 'People planning goals',
  professionals: 'Professionals',
};
export const audienceLabel = (a: Audience) => AUDIENCE_LABEL[a];

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

/** A label, the control, and an optional hint or error. Connects them for screen readers. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="error" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

/** A group of toggle chips where exactly one value is chosen. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="field" role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="chips">
        {options.map((o) => (
          <button key={o.value} type="button" className="chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {current && <span className="hint">{current.hint}</span>}
    </div>
  );
}

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
}

/** A plain table where a click on a row opens it. */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onOpen,
}: {
  rows: T[];
  columns: Column<T>[];
  onOpen: (row: T) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.header}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              data-click="true"
              tabIndex={0}
              onClick={() => onOpen(row)}
              onKeyDown={(e) => { if (e.key === 'Enter') onOpen(row); }}
            >
              {columns.map((c) => <td key={c.header}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
