import { useState } from 'react';
import { Kid, KidId, NewWishItem, Occasion, Priority, WishItem } from '../types';
import WishItemCard from './WishItemCard';
import AddItemModal from './AddItemModal';

type OccasionFilter = Occasion | 'all';
type PriorityFilter = Priority | 'all';

interface Props {
  kid: Kid;
  items: WishItem[];
  allKids: Kid[];
  onItemsChange: (items: WishItem[]) => void;
  onBack: () => void;
  onCopyItem: (toKidId: KidId, item: WishItem) => void;
}

export default function WishList({ kid, items, allKids, onItemsChange, onBack, onCopyItem }: Props) {
  const [filterOccasion, setFilterOccasion] = useState<OccasionFilter>('all');
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>('all');
  const [showBought, setShowBought] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<WishItem | null>(null);

  const otherKids = allKids.filter(k => k.id !== kid.id);

  const filtered = items.filter(item => {
    if (!showBought && item.bought) return false;
    if (filterOccasion !== 'all' && item.occasion !== filterOccasion) return false;
    if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
    return true;
  });

  function handleAdd(data: NewWishItem) {
    const newItem: WishItem = {
      ...data,
      id: crypto.randomUUID(),
      bought: false,
      addedAt: new Date().toISOString(),
    };
    onItemsChange([newItem, ...items]);
  }

  function handleSaveEdit(data: NewWishItem) {
    if (!editingItem) return;
    onItemsChange(items.map(i =>
      i.id === editingItem.id ? { ...i, ...data } : i
    ));
  }

  function handleToggleBought(id: string) {
    onItemsChange(items.map(i => i.id === id ? { ...i, bought: !i.bought } : i));
  }

  function handleDelete(id: string) {
    onItemsChange(items.filter(i => i.id !== id));
  }

  function handleClaim(id: string, claimedBy: string | undefined) {
    onItemsChange(items.map(i => i.id === id ? { ...i, claimedBy } : i));
  }

  // Single pass for all stats
  let boughtCount = 0;
  let totalBudget = 0;
  let boughtBudget = 0;
  let pricedCount = 0;
  for (const item of items) {
    if (item.bought) boughtCount++;
    if (item.price != null) {
      pricedCount++;
      totalBudget += item.price;
      if (item.bought) boughtBudget += item.price;
    }
  }
  const remainingBudget = totalBudget - boughtBudget;
  const showBudget = pricedCount > 0;

  return (
    <div
      className="wl-page"
      style={{ '--kid-color': kid.color } as React.CSSProperties}
    >
      <header className="wl-header">
        <button className="wl-header__back" onClick={onBack}>← Back</button>
        <span className="wl-header__title">{kid.emoji} {kid.name}'s List</span>
        <button className="wl-header__print" onClick={() => window.print()} title="Print list">
          🖨️
        </button>
        <button className="wl-header__add" onClick={() => setShowAdd(true)}>+ Add</button>
      </header>

      <div className="wl-filters">
        <div className="filter-group">
          {(['all', 'birthday', 'christmas'] as const).map(v => (
            <button
              key={v}
              className={`filter-btn${filterOccasion === v ? ' active' : ''}`}
              onClick={() => setFilterOccasion(v)}
            >
              {v === 'all' ? 'All' : v === 'birthday' ? '🎂 Birthday' : '🎄 Christmas'}
            </button>
          ))}
        </div>

        <div className="filter-divider" />

        <div className="filter-group">
          {(['all', 'high', 'medium', 'low'] as const).map(v => (
            <button
              key={v}
              className={`filter-btn${filterPriority === v ? ' active' : ''}`}
              onClick={() => setFilterPriority(v)}
            >
              {v === 'all' ? 'All' : v === 'high' ? '🔴' : v === 'medium' ? '🟡' : '🟢'}
            </button>
          ))}
        </div>

        {boughtCount > 0 && (
          <button
            className={`filter-toggle${showBought ? ' active' : ''}`}
            onClick={() => setShowBought(v => !v)}
          >
            {showBought ? 'Hide bought' : `Show bought (${boughtCount})`}
          </button>
        )}
      </div>

      {showBudget && (
        <div className="wl-budget">
          <span>~${remainingBudget.toFixed(0)} remaining</span>
          {boughtBudget > 0 && <span className="budget-bought">✓ ~${boughtBudget.toFixed(0)} bought</span>}
          <span className="budget-total">~${totalBudget.toFixed(0)} total</span>
        </div>
      )}

      <div className="wl-content">
        {filtered.length === 0 ? (
          <div className="wl-empty">
            <span className="empty-icon">{items.length === 0 ? '🎁' : '🔍'}</span>
            <p>{items.length === 0 ? `${kid.name}'s list is empty` : 'No items match these filters'}</p>
            {items.length === 0 && (
              <p className="empty-hint">Tap "+ Add" to start adding things they want</p>
            )}
          </div>
        ) : (
          <div className="wl-grid">
            {filtered.map(item => (
              <WishItemCard
                key={item.id}
                item={item}
                otherKids={otherKids}
                onEdit={() => setEditingItem(item)}
                onToggleBought={() => handleToggleBought(item.id)}
                onDelete={() => handleDelete(item.id)}
                onClaim={claimedBy => handleClaim(item.id, claimedBy)}
                onCopyTo={kidId => onCopyItem(kidId, item)}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddItemModal
          kidColor={kid.color}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editingItem && (
        <AddItemModal
          kidColor={kid.color}
          initialValues={editingItem}
          onSave={handleSaveEdit}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
