import type { Audience, PublishStatus, Schedule, Tone } from '@goalpath/shared';
import { fromLocalInput, toLocalInput } from '../lib/dates';
import { ChoiceChips, Field } from './ui';

const STATUS = [
  { value: 'draft', label: 'Draft', hint: 'Only visible here. Nobody in the app sees it.' },
  { value: 'published', label: 'Published', hint: 'Shown in the app, inside the dates below.' },
] as const;

const AUDIENCES = [
  { value: 'everyone', label: 'Everyone', hint: 'All signed-in people.' },
  { value: 'owners', label: 'Planning goals', hint: 'People managing their own goals.' },
  { value: 'professionals', label: 'Professionals', hint: 'Trainers, dietitians and doctors.' },
] as const;

const TONES = [
  { value: 'brand', label: 'Periwinkle', hint: 'The main brand colour.' },
  { value: 'pink', label: 'Pink', hint: 'Warm, for offers and notices.' },
  { value: 'neutral', label: 'White', hint: 'Quiet, for tips.' },
] as const;

export function StatusField({ value, onChange }: { value: PublishStatus; onChange: (v: PublishStatus) => void }) {
  return <ChoiceChips label="Status" options={[...STATUS]} value={value} onChange={onChange} />;
}

export function AudienceField({ value, onChange }: { value: Audience; onChange: (v: Audience) => void }) {
  return <ChoiceChips label="Who sees it" options={[...AUDIENCES]} value={value} onChange={onChange} />;
}

export function ToneField({ value, onChange }: { value: Tone; onChange: (v: Tone) => void }) {
  return <ChoiceChips label="Colour" options={[...TONES]} value={value} onChange={onChange} />;
}

/** Start and end date-times. Empty means no limit on that side. */
export function ScheduleFields({ value, onChange }: { value: Schedule; onChange: (v: Schedule) => void }) {
  const endsBeforeStart =
    !!value.startsAt && !!value.endsAt && new Date(value.endsAt).getTime() < new Date(value.startsAt).getTime();
  return (
    <div className="grid cols-2">
      <Field label="Starts" htmlFor="startsAt" hint="Leave empty to start right away.">
        <input
          id="startsAt"
          className="input"
          type="datetime-local"
          value={toLocalInput(value.startsAt)}
          onChange={(e) => onChange({ ...value, startsAt: fromLocalInput(e.target.value) })}
        />
      </Field>
      <Field
        label="Ends"
        htmlFor="endsAt"
        hint="Leave empty to keep it up."
        error={endsBeforeStart ? 'The end must come after the start.' : undefined}
      >
        <input
          id="endsAt"
          className="input"
          type="datetime-local"
          value={toLocalInput(value.endsAt)}
          aria-invalid={endsBeforeStart}
          onChange={(e) => onChange({ ...value, endsAt: fromLocalInput(e.target.value) })}
        />
      </Field>
    </div>
  );
}

/** True when the end date is before the start date; forms use it to block saving. */
export function scheduleIsInvalid(s: Schedule): boolean {
  return !!s.startsAt && !!s.endsAt && new Date(s.endsAt).getTime() < new Date(s.startsAt).getTime();
}
