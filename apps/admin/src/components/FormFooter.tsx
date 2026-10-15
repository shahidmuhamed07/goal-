import { Trash2 } from 'lucide-react';

/** Delete on the left (only for saved items), Cancel and Save on the right. */
export function FormFooter({
  isNew,
  canSave,
  saving,
  onSave,
  onCancel,
  onDelete,
}: {
  isNew: boolean;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <>
      {!isNew && onDelete ? (
        <button className="btn quiet" onClick={onDelete}><Trash2 size={16} /> Delete</button>
      ) : (
        <span />
      )}
      <div className="row">
        <button className="btn quiet" onClick={onCancel}>Cancel</button>
        <button className="btn" onClick={onSave} disabled={!canSave || saving}>
          {saving ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
        </button>
      </div>
    </>
  );
}
