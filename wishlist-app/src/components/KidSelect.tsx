import { Kid, KidId, WishItem } from '../types';

interface Props {
  kids: Kid[];
  itemsByKid: Record<KidId, WishItem[]>;
  onSelect: (id: KidId) => void;
  onOpenSettings: () => void;
}

export default function KidSelect({ kids, itemsByKid, onSelect, onOpenSettings }: Props) {
  return (
    <div className="ks-page">
      <header className="ks-header">
        <span className="ks-icon">🎁</span>
        <h1>Wish Lists</h1>
        <p>Tap a name to see their list</p>
      </header>

      <div className="ks-cards">
        {kids.map(kid => {
          const items = itemsByKid[kid.id];
          const total = items.length;
          const highPriority = items.filter(i => i.priority === 'high' && !i.bought).length;
          const bought = items.filter(i => i.bought).length;
          const withPrice = items.filter(i => i.price != null);
          const budget = withPrice.reduce((s, i) => s + (i.price ?? 0), 0);
          const remaining = withPrice.filter(i => !i.bought).reduce((s, i) => s + (i.price ?? 0), 0);

          return (
            <button
              key={kid.id}
              className="kid-card"
              style={{ '--kid-color': kid.color } as React.CSSProperties}
              onClick={() => onSelect(kid.id)}
            >
              <div className="kid-card__emoji">{kid.emoji}</div>
              <div className="kid-card__body">
                <div className="kid-card__name">{kid.name}</div>
                <div className="kid-card__stats">
                  <span className="stat">{total} {total === 1 ? 'item' : 'items'}</span>
                  {highPriority > 0 && (
                    <span className="stat stat--high">🔴 {highPriority} must-have</span>
                  )}
                  {bought > 0 && (
                    <span className="stat stat--bought">✓ {bought} bought</span>
                  )}
                  {budget > 0 && (
                    <span className="stat stat--budget">~${remaining.toFixed(0)} left</span>
                  )}
                </div>
              </div>
              <div className="kid-card__arrow">→</div>
            </button>
          );
        })}
      </div>

      <button className="ks-settings-btn" onClick={onOpenSettings} aria-label="Settings">
        ⚙️ Settings
      </button>
    </div>
  );
}
