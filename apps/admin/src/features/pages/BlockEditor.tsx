import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { PAGE_BLOCK_TYPES, type PageBlock, type PageBlockType } from '@goalpath/shared';
import { newId } from '../../lib/ids';

function blankBlock(type: PageBlockType): PageBlock {
  const id = newId('blk');
  switch (type) {
    case 'heading': return { id, type, text: '' };
    case 'text': return { id, type, text: '' };
    case 'image': return { id, type, url: '', alt: '' };
    case 'button': return { id, type, label: '', url: '' };
    case 'divider': return { id, type };
  }
}

/** Builds a page from blocks: add, edit, reorder, remove. */
export function BlockEditor({ blocks, onChange }: { blocks: PageBlock[]; onChange: (b: PageBlock[]) => void }) {
  const update = (id: string, patch: Partial<PageBlock>) =>
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as PageBlock) : b)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...blocks];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));
  const label = (t: PageBlockType) => PAGE_BLOCK_TYPES.find((x) => x.value === t)?.label ?? t;

  return (
    <div className="stack">
      <span className="label">Content blocks</span>
      {blocks.length === 0 && <p className="muted small">No blocks yet. Add one below.</p>}
      {blocks.map((b, i) => (
        <div key={b.id} className="block">
          <div className="block-head">
            <span className="tag">{label(b.type)}</span>
            <div className="row" style={{ gap: 2 }}>
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={16} /></button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="Move down"><ArrowDown size={16} /></button>
              <button className="icon-btn danger" onClick={() => remove(b.id)} aria-label="Remove block"><Trash2 size={16} /></button>
            </div>
          </div>
          {b.type === 'heading' && (
            <input className="input" aria-label="Heading text" value={b.text} onChange={(e) => update(b.id, { text: e.target.value })} placeholder="Heading" />
          )}
          {b.type === 'text' && (
            <textarea className="textarea" aria-label="Paragraph text" value={b.text} onChange={(e) => update(b.id, { text: e.target.value })} placeholder="Write a paragraph" />
          )}
          {b.type === 'image' && (
            <>
              <input className="input" aria-label="Image address" value={b.url} onChange={(e) => update(b.id, { url: e.target.value })} placeholder="Image address, https://…" />
              <input className="input" aria-label="Image description" value={b.alt} onChange={(e) => update(b.id, { alt: e.target.value })} placeholder="Describe the picture (for screen readers)" />
            </>
          )}
          {b.type === 'button' && (
            <div className="grid cols-2">
              <input className="input" aria-label="Button text" value={b.label} onChange={(e) => update(b.id, { label: e.target.value })} placeholder="Button text" />
              <input className="input" aria-label="Button link" value={b.url} onChange={(e) => update(b.id, { url: e.target.value })} placeholder="Link" />
            </div>
          )}
          {b.type === 'divider' && <span className="small muted">A thin line between sections.</span>}
        </div>
      ))}
      <div className="chips" role="group" aria-label="Add a block">
        {PAGE_BLOCK_TYPES.map((t) => (
          <button key={t.value} className="chip" onClick={() => onChange([...blocks, blankBlock(t.value)])} title={t.hint}>
            <Plus size={12} style={{ verticalAlign: '-1px' }} /> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
