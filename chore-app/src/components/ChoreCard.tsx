import type { Chore } from '../types';
import { FREQUENCY_DAYS } from '../types';
import { daysBetween, dueOffset } from '../storage';

interface Props {
  chore: Chore;
  onComplete: (id: string, done: boolean) => void;
  onEdit: (chore: Chore) => void;
  onDelete: (id: string) => void;
}

type StatusType = 'overdue' | 'due' | 'upcoming' | 'done-status' | 'never';

function getStatus(chore: Chore): { text: string; type: StatusType } {
  if (!chore.lastCompleted) return { text: 'Never done', type: 'never' };
  if (chore.frequency === 'once') return { text: 'Done', type: 'done-status' };

  const offset = dueOffset(chore);

  if (offset > 1) return { text: `${offset}d overdue`, type: 'overdue' };
  if (offset === 1) return { text: '1d overdue', type: 'overdue' };
  if (offset === 0) return { text: 'Due today', type: 'due' };

  const daysLeft = Math.abs(offset);
  if (daysLeft === 1) return { text: 'Due tomorrow', type: 'upcoming' };
  return { text: `Due in ${daysLeft}d`, type: 'upcoming' };
}

function getLastDoneText(chore: Chore): string | null {
  if (!chore.lastCompleted) return null;
  if (chore.frequency === 'once') return null;

  const days = daysBetween(new Date(chore.lastCompleted), new Date());
  if (days === 0) return 'Done today';
  if (days === 1) return 'Done yesterday';
  return `Done ${days}d ago`;
}

function isDoneToday(chore: Chore): boolean {
  if (!chore.lastCompleted) return false;
  const days = daysBetween(new Date(chore.lastCompleted), new Date());
  return days === 0;
}

function isCompleted(chore: Chore): boolean {
  if (!chore.lastCompleted) return false;
  if (chore.frequency === 'once') return true;
  const days = daysBetween(new Date(chore.lastCompleted), new Date());
  return days < FREQUENCY_DAYS[chore.frequency];
}

export default function ChoreCard({ chore, onComplete, onEdit, onDelete }: Props) {
  const done = isCompleted(chore);
  const doneToday = isDoneToday(chore);
  const status = getStatus(chore);
  const lastDoneText = getLastDoneText(chore);

  return (
    <div className={`ch-card${done ? ' is-done' : ''}`}>
      <button
        className="ch-check"
        onClick={() => onComplete(chore.id, !doneToday)}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        title={done ? 'Mark not done' : 'Mark done'}
      >
        {done && '✓'}
      </button>

      <div className="ch-card-body">
        <p className="ch-card-name">{chore.name}</p>
        <div className="ch-card-meta">
          <span className={`ch-status ${status.type}`}>{status.text}</span>
          {lastDoneText && lastDoneText !== status.text && (
            <span className="ch-last-done">{lastDoneText}</span>
          )}
        </div>
        {chore.notes && <p className="ch-card-notes">{chore.notes}</p>}
      </div>

      <div className="ch-card-actions">
        <button
          className="ch-icon-btn"
          onClick={() => onEdit(chore)}
          aria-label="Edit chore"
          title="Edit"
        >
          ✏️
        </button>
        <button
          className="ch-icon-btn delete"
          onClick={() => onDelete(chore.id)}
          aria-label="Delete chore"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
