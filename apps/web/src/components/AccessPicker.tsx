import React from 'react';
import { Ban, Eye, Pencil } from 'lucide-react';
import type { GoalAccessLevel } from '../types';

interface AccessPickerProps {
  /** The access chosen now; undefined means no access. */
  value: GoalAccessLevel | undefined;
  /** `null` means no access. */
  onChange: (level: GoalAccessLevel | null) => void;
  /** Who it is for, read aloud by screen readers. */
  who: string;
}

/**
 * Choose what someone may do with a goal: no access, view, or edit.
 * One labelled row of three, so it reads the same wherever access is set.
 */
export const AccessPicker: React.FC<AccessPickerProps> = ({ value, onChange, who }) => (
  <div className="seg" role="group" aria-label={`Access for ${who}`}>
    <button type="button" className="seg-item" data-tone="none" aria-pressed={!value} onClick={() => onChange(null)} title="They cannot see this goal">
      <Ban className="w-3.5 h-3.5" />
      No access
    </button>
    <button type="button" className="seg-item" data-tone="view" aria-pressed={value === 'view'} onClick={() => onChange('view')} title="They can see it but not change it">
      <Eye className="w-3.5 h-3.5" />
      View
    </button>
    <button type="button" className="seg-item" data-tone="edit" aria-pressed={value === 'edit'} onClick={() => onChange('edit')} title="They can change routines and tasks">
      <Pencil className="w-3.5 h-3.5" />
      Edit
    </button>
  </div>
);
