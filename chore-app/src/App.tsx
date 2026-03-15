import { useState, useEffect } from 'react';
import type { Chore } from './types';
import { FREQUENCY_ORDER, FREQUENCY_LABELS, FREQUENCY_COLORS } from './types';
import { subscribeChores, saveChore, removeChore, isDue } from './storage';
import ChoreCard from './components/ChoreCard';
import AddChoreModal from './components/AddChoreModal';
import './App.css';

type Filter = 'due' | 'all' | 'done';

export default function App() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('due');
  const [showAdd, setShowAdd] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);

  useEffect(() => {
    const unsub = subscribeChores(
      data => { setChores(data); setLoading(false); },
      seeded => { setChores(seeded); setLoading(false); },
    );
    return unsub;
  }, []);

  async function handleComplete(id: string, done: boolean) {
    const chore = chores.find(c => c.id === id);
    if (!chore) return;
    await saveChore({
      ...chore,
      lastCompleted: done ? new Date().toISOString() : undefined,
    });
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this chore?')) return;
    await removeChore(id);
  }

  async function handleSave(chore: Chore) {
    await saveChore(chore);
    setShowAdd(false);
    setEditingChore(null);
  }

  function handleEdit(chore: Chore) {
    setEditingChore(chore);
    setShowAdd(true);
  }

  function handleCloseModal() {
    setShowAdd(false);
    setEditingChore(null);
  }

  const filtered = chores.filter(c => {
    if (filter === 'due') return isDue(c);
    if (filter === 'done') return !isDue(c);
    return true;
  });

  const dueCount = chores.filter(isDue).length;

  const grouped = FREQUENCY_ORDER.map(freq => {
    const group = filtered.filter(c => c.frequency === freq);
    const totalInFreq = chores.filter(c => c.frequency === freq);
    const doneInFreq = totalInFreq.filter(c => !isDue(c)).length;
    return { freq, chores: group, total: totalInFreq.length, done: doneInFreq };
  }).filter(g => g.chores.length > 0);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  if (loading) {
    return (
      <div className="ch-app">
        <div className="ch-loading">
          <div className="ch-spinner" />
          <p>Loading chores…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ch-app">
      <header className="ch-header">
        <div className="ch-header-content">
          <div>
            <h1 className="ch-title">Chore Tracker</h1>
            <p className="ch-subtitle">{today}</p>
          </div>
          {dueCount > 0 && (
            <div className="ch-due-badge">{dueCount} due</div>
          )}
          {dueCount === 0 && chores.length > 0 && (
            <div className="ch-done-badge">All done!</div>
          )}
        </div>
        <div className="ch-filters">
          <button
            className={`ch-filter-btn${filter === 'due' ? ' active' : ''}`}
            onClick={() => setFilter('due')}
          >
            Due{dueCount > 0 ? ` (${dueCount})` : ''}
          </button>
          <button
            className={`ch-filter-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`ch-filter-btn${filter === 'done' ? ' active' : ''}`}
            onClick={() => setFilter('done')}
          >
            Done
          </button>
        </div>
      </header>

      <main className="ch-main">
        {grouped.length === 0 ? (
          <div className="ch-empty">
            {filter === 'due' && <span className="ch-empty-icon">🎉</span>}
            {filter === 'done' && <span className="ch-empty-icon">📋</span>}
            {filter === 'all' && <span className="ch-empty-icon">✨</span>}
            <p>
              {filter === 'due'
                ? 'All chores are done!'
                : filter === 'done'
                ? 'No completed chores yet'
                : 'No chores yet. Tap + to add one.'}
            </p>
          </div>
        ) : (
          grouped.map(({ freq, chores: groupChores, total, done }) => (
            <section key={freq} className="ch-group">
              <div
                className="ch-group-header"
                style={{ '--freq-color': FREQUENCY_COLORS[freq] } as React.CSSProperties}
              >
                <span className="ch-group-label">{FREQUENCY_LABELS[freq]}</span>
                <div className="ch-group-line" />
                {filter === 'all' && total > 0 && (
                  <span className="ch-group-progress">{done}/{total}</span>
                )}
                {filter !== 'all' && (
                  <span className="ch-group-count">{groupChores.length}</span>
                )}
              </div>
              <div className="ch-group-list">
                {groupChores.map(chore => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    onComplete={handleComplete}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          ))
        )}
        <div className="ch-bottom-spacer" />
      </main>

      <button
        className="ch-fab"
        onClick={() => { setEditingChore(null); setShowAdd(true); }}
        aria-label="Add chore"
      >
        +
      </button>

      {showAdd && (
        <AddChoreModal
          initial={editingChore}
          onSave={handleSave}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
