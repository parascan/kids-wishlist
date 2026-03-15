import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Chore, Frequency } from './types';
import { FREQUENCY_DAYS } from './types';

const CHORES_COL = 'chores';

// ── Default chores (seeded on first load) ───────────────────────────────────

export function getDefaultChores(): Chore[] {
  const now = new Date().toISOString();
  const items: Array<{ name: string; frequency: Frequency }> = [
    { name: 'Dishes', frequency: 'daily' },
    { name: 'Sweep upstairs', frequency: 'daily' },
    { name: 'Put away toys', frequency: 'daily' },
    { name: 'Sweep stairs/entry', frequency: 'weekly' },
    { name: 'Vacuum all carpets', frequency: 'weekly' },
    { name: 'Water plants', frequency: 'weekly' },
    { name: 'Clean stools and area', frequency: 'weekly' },
    { name: 'Mop', frequency: 'biweekly' },
    { name: 'Go through fridge', frequency: 'biweekly' },
    { name: 'Clean bathrooms', frequency: 'biweekly' },
    { name: 'Clean bathtub', frequency: 'biweekly' },
    { name: 'Clean stove', frequency: 'biweekly' },
    { name: 'Swap towels', frequency: 'biweekly' },
    { name: 'Clean cars', frequency: 'biweekly' },
    { name: 'Wipe trim boards', frequency: 'monthly' },
    { name: 'Clean windows', frequency: 'monthly' },
    { name: 'Vacuum couches', frequency: 'monthly' },
    { name: 'Wash bed sheets', frequency: 'monthly' },
    { name: 'Organize pantry', frequency: 'monthly' },
  ];
  return items.map(c => ({ ...c, id: crypto.randomUUID(), addedAt: now }));
}

// ── Firestore CRUD ───────────────────────────────────────────────────────────

export function subscribeChores(
  onData: (chores: Chore[]) => void,
  onSeeded: (chores: Chore[]) => void,
): () => void {
  return onSnapshot(collection(db, CHORES_COL), snapshot => {
    if (snapshot.empty) {
      // First time — seed with defaults
      const defaults = getDefaultChores();
      seedChores(defaults).then(() => onSeeded(defaults));
    } else {
      const chores = snapshot.docs.map(d => d.data() as Chore);
      // Sort by addedAt ascending so order is stable
      chores.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
      onData(chores);
    }
  });
}

async function seedChores(chores: Chore[]): Promise<void> {
  const batch = writeBatch(db);
  chores.forEach(c => {
    batch.set(doc(db, CHORES_COL, c.id), c);
  });
  await batch.commit();
}

export async function saveChore(chore: Chore): Promise<void> {
  await setDoc(doc(db, CHORES_COL, chore.id), chore);
}

export async function removeChore(id: string): Promise<void> {
  await deleteDoc(doc(db, CHORES_COL, id));
}

// ── Due logic ────────────────────────────────────────────────────────────────

export function daysBetween(d1: Date, d2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((utc2 - utc1) / msPerDay);
}

export function isDue(chore: Chore): boolean {
  if (!chore.lastCompleted) return true;
  if (chore.frequency === 'once') return false;
  const days = daysBetween(new Date(chore.lastCompleted), new Date());
  return days >= FREQUENCY_DAYS[chore.frequency];
}

export function dueOffset(chore: Chore): number {
  if (!chore.lastCompleted) return 0;
  if (chore.frequency === 'once') return -999;
  const days = daysBetween(new Date(chore.lastCompleted), new Date());
  return days - FREQUENCY_DAYS[chore.frequency];
}
