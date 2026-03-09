import { useEffect, useState } from 'react';
import { AppSettings, Kid, KidId } from '../types';

interface Props {
  kids: Kid[];
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export default function SettingsModal({ kids, settings, onSave, onClose }: Props) {
  const [birthdays, setBirthdays] = useState<Record<KidId, string>>({ ...settings.birthdays });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function handleSave() {
    onSave({ ...settings, birthdays });
    onClose();
  }

  // Use year 2000 as a neutral anchor; we only store MM-DD
  function toDateInputValue(monthDay: string) {
    return monthDay ? `2000-${monthDay}` : '';
  }

  function fromDateInputValue(value: string) {
    return value ? value.slice(5) : ''; // extract MM-DD
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>⚙️ Settings</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal__body">
          <p className="settings-hint">
            Set birthdays to get a reminder 30 days before. The year doesn't matter.
          </p>

          {kids.map(kid => (
            <div key={kid.id} className="form-field">
              <label>{kid.emoji} {kid.name}'s Birthday</label>
              <div className="birthday-row">
                <input
                  type="date"
                  value={toDateInputValue(birthdays[kid.id])}
                  onChange={e => setBirthdays(prev => ({
                    ...prev,
                    [kid.id]: fromDateInputValue(e.target.value),
                  }))}
                />
                {birthdays[kid.id] && (
                  <button
                    type="button"
                    className="btn-clear"
                    onClick={() => setBirthdays(prev => ({ ...prev, [kid.id]: '' }))}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="modal__footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
