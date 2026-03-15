import { useState, useEffect, useRef } from 'react';
import type { Chore, Frequency } from '../types';
import { FREQUENCY_ORDER, FREQUENCY_LABELS } from '../types';

interface Props {
  initial: Chore | null;
  onSave: (chore: Chore) => void;
  onClose: () => void;
}

export default function AddChoreModal({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'weekly');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const chore: Chore = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      frequency,
      notes: notes.trim() || undefined,
      lastCompleted: initial?.lastCompleted,
      addedAt: initial?.addedAt ?? new Date().toISOString(),
    };
    onSave(chore);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="ch-overlay" onClick={handleOverlayClick}>
      <div className="ch-modal" role="dialog" aria-modal="true">
        <div className="ch-modal-handle" />
        <h2 className="ch-modal-title">{initial ? 'Edit Chore' : 'Add Chore'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="ch-form-group">
            <label className="ch-form-label" htmlFor="chore-name">Chore Name</label>
            <input
              id="chore-name"
              ref={nameRef}
              className="ch-form-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Vacuum carpets"
              required
            />
          </div>

          <div className="ch-form-group">
            <label className="ch-form-label" htmlFor="chore-freq">Frequency</label>
            <select
              id="chore-freq"
              className="ch-form-select"
              value={frequency}
              onChange={e => setFrequency(e.target.value as Frequency)}
            >
              {FREQUENCY_ORDER.map(f => (
                <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
              ))}
            </select>
          </div>

          <div className="ch-form-group">
            <label className="ch-form-label" htmlFor="chore-notes">Notes (optional)</label>
            <textarea
              id="chore-notes"
              className="ch-form-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any extra details..."
              rows={3}
            />
          </div>

          <div className="ch-modal-actions">
            <button type="button" className="ch-btn ch-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ch-btn ch-btn-primary" disabled={!name.trim()}>
              {initial ? 'Save Changes' : 'Add Chore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
