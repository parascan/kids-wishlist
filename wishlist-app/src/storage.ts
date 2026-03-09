import { AppSettings, KidId, WishItem } from './types';

const key = (kidId: string) => `wishlist_${kidId}`;
const SETTINGS_KEY = 'wishlist_settings';

export function loadItems(kidId: string): WishItem[] {
  const raw = localStorage.getItem(key(kidId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WishItem[];
  } catch {
    return [];
  }
}

export function saveItems(kidId: string, items: WishItem[]): void {
  localStorage.setItem(key(kidId), JSON.stringify(items));
}

const DEFAULT_SETTINGS: AppSettings = {
  birthdays: { mason: '', caden: '', felix: '' },
};

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as AppSettings };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function daysUntil(monthDay: string): number {
  const [month, day] = monthDay.split('-').map(Number);
  const now = new Date();
  // Normalize to midnight so the comparison is day-based, not ms-based
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYear = new Date(now.getFullYear(), month - 1, day);
  const nextYear = new Date(now.getFullYear() + 1, month - 1, day);
  const target = thisYear >= today ? thisYear : nextYear;
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export interface Reminder {
  label: string;
  daysUntil: number;
  kidId?: KidId;
}
