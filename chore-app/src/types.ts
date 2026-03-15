export type Frequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'biyearly'
  | 'yearly'
  | 'once';

export const FREQUENCY_ORDER: Frequency[] = [
  'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'biyearly', 'yearly', 'once',
];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  biyearly: 'Twice a Year',
  yearly: 'Yearly',
  once: 'One Time',
};

export const FREQUENCY_DAYS: Record<Frequency, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
  biyearly: 182,
  yearly: 365,
  once: Infinity,
};

export const FREQUENCY_COLORS: Record<Frequency, string> = {
  daily: '#2563eb',
  weekly: '#7c3aed',
  biweekly: '#0891b2',
  monthly: '#059669',
  quarterly: '#d97706',
  biyearly: '#db2777',
  yearly: '#dc2626',
  once: '#6b7280',
};

export interface Chore {
  id: string;
  name: string;
  frequency: Frequency;
  lastCompleted?: string; // ISO date string
  notes?: string;
  addedAt: string;
}
