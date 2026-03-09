import { useState } from 'react';
import { Kid, KidId, WishItem } from '../types';

const PRIORITY_LABELS = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
const OCCASION_LABELS = { birthday: '🎂 Birthday', christmas: '🎄 Christmas', any: '' };
const CLAIM_PRESETS = ['Dad', 'Mom', 'Grandma', 'Grandpa'];

interface Props {
  item: WishItem;
  otherKids: Kid[];
  onEdit: () => void;
  onToggleBought: () => void;
  onDelete: () => void;
  onClaim: (claimedBy: string | undefined) => void;
  onCopyTo: (kidId: KidId) => void;
}

export default function WishItemCard({
  item, otherKids, onEdit, onToggleBought, onDelete, onClaim, onCopyTo,
}: Props) {
  const [showClaimUI, setShowClaimUI] = useState(false);
  const [claimText, setClaimText] = useState('');
  const [showCopyUI, setShowCopyUI] = useState(false);

  const addedDate = new Date(item.addedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  function handleAmazonSearch() {
    window.open(
      `https://www.amazon.com/s?k=${encodeURIComponent(item.name)}`,
      '_blank', 'noopener,noreferrer',
    );
  }

  function handleDelete() {
    if (window.confirm(`Remove "${item.name}" from the list?`)) onDelete();
  }

  function handleClaimPreset(name: string) {
    onClaim(name);
    setShowClaimUI(false);
    setClaimText('');
  }

  function handleClaimSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (claimText.trim()) onClaim(claimText.trim());
    setShowClaimUI(false);
    setClaimText('');
  }

  return (
    <div className={`wi-card${item.bought ? ' bought' : ''}`}>
      {item.photo ? (
        <img className="wi-photo" src={item.photo} alt={item.name} />
      ) : (
        <div className="wi-photo-placeholder">🎁</div>
      )}

      <div className="wi-body">
        <div className="wi-badges">
          <span className={`badge badge--${item.priority}`}>
            {PRIORITY_LABELS[item.priority]}
          </span>
          {item.occasion !== 'any' && (
            <span className={`badge badge--${item.occasion}`}>
              {OCCASION_LABELS[item.occasion]}
            </span>
          )}
        </div>

        <div className="wi-name">{item.name}</div>

        {item.notes && <div className="wi-notes">{item.notes}</div>}

        {/* Price + link row */}
        {(item.price != null || item.link) && (
          <div className="wi-meta">
            {item.price != null && (
              <span className="wi-price">~${item.price.toFixed(0)}</span>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="wi-link"
                onClick={e => e.stopPropagation()}
              >
                🔗 View product
              </a>
            )}
          </div>
        )}

        {/* Claimed-by section */}
        {item.claimedBy ? (
          <div className="wi-claimed">
            <span>🙋 {item.claimedBy}</span>
            <button
              className="wi-unclaim"
              onClick={() => onClaim(undefined)}
              title="Remove claim"
            >
              ✕
            </button>
          </div>
        ) : showClaimUI ? (
          <div className="wi-claim-ui">
            <div className="wi-claim-presets">
              {CLAIM_PRESETS.map(p => (
                <button key={p} className="wi-claim-preset" onClick={() => handleClaimPreset(p)}>
                  {p}
                </button>
              ))}
            </div>
            <form className="wi-claim-form" onSubmit={handleClaimSubmit}>
              <input
                type="text"
                placeholder="Or type a name…"
                value={claimText}
                onChange={e => setClaimText(e.target.value)}
                autoFocus
              />
              <button type="submit">✓</button>
              <button type="button" onClick={() => { setShowClaimUI(false); setClaimText(''); }}>✕</button>
            </form>
          </div>
        ) : (
          <button className="wi-claim-btn" onClick={() => setShowClaimUI(true)}>
            + Claim it
          </button>
        )}

        {/* Copy to another list */}
        {otherKids.length > 0 && (
          showCopyUI ? (
            <div className="wi-copy-ui">
              <span>Copy to:</span>
              {otherKids.map(k => (
                <button
                  key={k.id}
                  className="wi-copy-kid"
                  onClick={() => { onCopyTo(k.id); setShowCopyUI(false); }}
                >
                  {k.emoji} {k.name}
                </button>
              ))}
              <button className="wi-copy-cancel" onClick={() => setShowCopyUI(false)}>Cancel</button>
            </div>
          ) : (
            <button className="wi-copy-btn" onClick={() => setShowCopyUI(true)}>
              📋 Copy to another list
            </button>
          )
        )}

        <div className="wi-date">Added {addedDate}</div>
      </div>

      <div className="wi-actions">
        <button className="wi-action wi-action--amazon" onClick={handleAmazonSearch}>
          🛒 Amazon
        </button>
        <button className="wi-action wi-action--edit" onClick={onEdit}>
          ✏️ Edit
        </button>
        <button
          className={`wi-action wi-action--bought${item.bought ? ' is-bought' : ''}`}
          onClick={onToggleBought}
        >
          {item.bought ? '✓ Bought' : '○ Buy'}
        </button>
        <button className="wi-action wi-action--delete" onClick={handleDelete}>
          🗑
        </button>
      </div>
    </div>
  );
}
