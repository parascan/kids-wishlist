import { useEffect, useRef, useState } from 'react';
import { NewWishItem, Occasion, Priority, WishItem } from '../types';
import { compressImage } from '../imageUtils';

interface Props {
  kidColor: string;
  initialValues?: WishItem; // if provided → edit mode
  onSave: (item: NewWishItem) => void;
  onClose: () => void;
}

export default function AddItemModal({ kidColor, initialValues, onSave, onClose }: Props) {
  const isEditing = !!initialValues;

  const [name, setName] = useState(initialValues?.name ?? '');
  const [photo, setPhoto] = useState<string | undefined>(initialValues?.photo);
  const [link, setLink] = useState(initialValues?.link ?? '');
  const [price, setPrice] = useState(initialValues?.price != null ? String(initialValues.price) : '');
  const [priority, setPriority] = useState<Priority>(initialValues?.priority ?? 'medium');
  const [occasion, setOccasion] = useState<Occasion>(initialValues?.occasion ?? 'any');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [compressing, setCompressing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      setPhoto(await compressImage(file));
    } catch {
      alert('Could not load that image. Please try another.');
    } finally {
      setCompressing(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const parsedPrice = parseFloat(price);
    onSave({
      name: name.trim(),
      photo,
      link: link.trim() || undefined,
      price: isNaN(parsedPrice) || price.trim() === '' ? undefined : parsedPrice,
      priority,
      occasion,
      notes: notes.trim(),
      claimedBy: initialValues?.claimedBy,
    });
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ '--kid-color': kidColor } as React.CSSProperties}
    >
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{isEditing ? 'Edit Item' : 'Add Wish List Item'}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form id="add-item-form" className="modal__body" onSubmit={handleSubmit}>
          {/* Photo upload */}
          <div className="photo-upload">
            {photo ? (
              <>
                <img className="photo-upload__preview" src={photo} alt="Preview" />
                <button
                  type="button"
                  className="photo-upload__remove"
                  onClick={e => { e.stopPropagation(); setPhoto(undefined); }}
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </>
            ) : (
              <div className="photo-upload__hint">
                <span className="upload-icon">{compressing ? '⏳' : '📷'}</span>
                <span>{compressing ? 'Processing…' : 'Tap to add a photo'}</span>
                <small>Photo of the toy, screenshot, catalog page, etc.</small>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              disabled={compressing}
            />
          </div>

          {/* Name */}
          <div className="form-field">
            <label htmlFor="item-name">Item name *</label>
            <input
              id="item-name"
              ref={nameRef}
              type="text"
              placeholder="e.g. LEGO Technic Bulldozer"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {/* Price + Link row */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="item-price">Est. price ($)</label>
              <input
                id="item-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 49.99"
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
            </div>
            <div className="form-field form-field--grow">
              <label htmlFor="item-link">Product link</label>
              <input
                id="item-link"
                type="url"
                placeholder="https://amazon.com/..."
                value={link}
                onChange={e => setLink(e.target.value)}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="form-field">
            <label>Priority</label>
            <div className="radio-group">
              {([
                { value: 'high',   label: '🔴 Must have',   color: '#dc2626' },
                { value: 'medium', label: '🟡 Would love',   color: '#d97706' },
                { value: 'low',    label: '🟢 Nice to have', color: '#16a34a' },
              ] as const).map(opt => (
                <label key={opt.value} className="radio-option">
                  <input
                    type="radio"
                    name="priority"
                    value={opt.value}
                    checked={priority === opt.value}
                    onChange={() => setPriority(opt.value)}
                  />
                  <span
                    className="radio-label"
                    style={{ '--selected-color': opt.color } as React.CSSProperties}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Occasion */}
          <div className="form-field">
            <label>Occasion</label>
            <div className="radio-group">
              {([
                { value: 'birthday',  label: '🎂 Birthday',  color: '#9333ea' },
                { value: 'christmas', label: '🎄 Christmas', color: '#e11d48' },
                { value: 'any',       label: '🎁 Any',       color: '#6366F1' },
              ] as const).map(opt => (
                <label key={opt.value} className="radio-option">
                  <input
                    type="radio"
                    name="occasion"
                    value={opt.value}
                    checked={occasion === opt.value}
                    onChange={() => setOccasion(opt.value)}
                  />
                  <span
                    className="radio-label"
                    style={{ '--selected-color': opt.color } as React.CSSProperties}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="form-field">
            <label htmlFor="item-notes">Notes</label>
            <textarea
              id="item-notes"
              placeholder="e.g. Saw this at Target, the blue one, size medium"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </form>

        <div className="modal__footer">
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form="add-item-form"
            className="btn-save"
            disabled={!name.trim() || compressing}
          >
            {isEditing ? 'Save Changes' : 'Save to List'}
          </button>
        </div>
      </div>
    </div>
  );
}
