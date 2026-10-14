import { Plus, Trash2 } from 'lucide-react';
import type { RoutineTemplate } from '@goalpath/shared';
import { newId } from '../../lib/ids';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Routines of a starter plan: a name, the weekdays it repeats on, and its tasks (one per line). */
export function RoutineEditor({ routines, onChange }: { routines: RoutineTemplate[]; onChange: (r: RoutineTemplate[]) => void }) {
  const update = (id: string, patch: Partial<RoutineTemplate>) =>
    onChange(routines.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toggleDay = (r: RoutineTemplate, day: number) =>
    update(r.id, { weekdays: r.weekdays.includes(day) ? r.weekdays.filter((d) => d !== day) : [...r.weekdays, day].sort() });

  return (
    <div className="stack">
      <span className="label">Routines</span>
      {routines.length === 0 && <p className="muted small">A plan needs at least one routine.</p>}
      {routines.map((r) => (
        <div key={r.id} className="block">
          <div className="block-head">
            <input className="input" aria-label="Routine name" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} placeholder="Push day" />
            <button className="icon-btn danger" onClick={() => onChange(routines.filter((x) => x.id !== r.id))} aria-label="Remove routine"><Trash2 size={16} /></button>
          </div>
          <div className="weekdays" role="group" aria-label="Repeats on">
            {LETTERS.map((letter, day) => (
              <button key={day} type="button" className="chip" aria-pressed={r.weekdays.includes(day)} aria-label={NAMES[day]} title={NAMES[day]} onClick={() => toggleDay(r, day)}>
                {letter}
              </button>
            ))}
          </div>
          <textarea
            className="textarea"
            aria-label="Tasks, one per line"
            value={r.tasks.join('\n')}
            onChange={(e) => update(r.id, { tasks: e.target.value.split('\n') })}
            placeholder={'Warm up for 5 minutes\nBench press: 4 sets'}
          />
        </div>
      ))}
      <button className="btn quiet small" style={{ justifySelf: 'start' }} onClick={() => onChange([...routines, { id: newId('rtn'), name: '', weekdays: [1], tasks: [] }])}>
        <Plus size={14} /> Add routine
      </button>
    </div>
  );
}
