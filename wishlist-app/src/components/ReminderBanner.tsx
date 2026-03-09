import { Reminder } from '../storage';

interface Props {
  reminders: Reminder[];
  onDismiss: () => void;
}

export default function ReminderBanner({ reminders, onDismiss }: Props) {
  if (reminders.length === 0) return null;

  const top = reminders[0];
  const daysText =
    top.daysUntil === 0
      ? 'TODAY!'
      : top.daysUntil === 1
      ? 'tomorrow'
      : `in ${top.daysUntil} days`;

  return (
    <div className="reminder-banner">
      <span className="reminder-banner__icon">⏰</span>
      <span className="reminder-banner__text">
        <strong>{top.label}</strong> is {daysText}
        {reminders.length > 1 && (
          <span className="reminder-banner__more"> +{reminders.length - 1} more</span>
        )}
      </span>
      <button className="reminder-banner__dismiss" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
