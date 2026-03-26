import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Local: backend/data/  Railway: /app/data/
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../data/march-madness.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS robinhood_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    game_time TEXT,
    sport TEXT NOT NULL DEFAULT 'NCAAB',
    bet_type TEXT NOT NULL,
    outcome TEXT NOT NULL,
    american_odds INTEGER,
    line_value REAL,
    entered_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reference_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    game_id TEXT NOT NULL,
    bet_type TEXT NOT NULL,
    outcome TEXT NOT NULL,
    implied_prob REAL NOT NULL,
    raw_data TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS placed_bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    game_time TEXT,
    sport TEXT NOT NULL,
    outcome TEXT NOT NULL,
    book TEXT NOT NULL DEFAULT 'Robinhood',
    american_odds INTEGER NOT NULL,
    stake REAL NOT NULL,
    result TEXT,
    payout REAL,
    placed_at TEXT NOT NULL DEFAULT (datetime('now')),
    settled_at TEXT
  );
`);

export default db;

// ── Robinhood lines ─────────────────────────────────────────────────────────

export function saveRobinhoodLine(data: {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
  bet_type: string;
  outcome: string;
  american_odds: number;
  line_value?: number;
}) {
  db.prepare(`
    DELETE FROM robinhood_lines WHERE game_id = ? AND bet_type = ? AND outcome = ?
  `).run(data.game_id, data.bet_type, data.outcome);

  db.prepare(`
    INSERT INTO robinhood_lines (game_id, home_team, away_team, game_time, sport, bet_type, outcome, american_odds, line_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.game_id, data.home_team, data.away_team, data.game_time, data.sport,
         data.bet_type, data.outcome, data.american_odds, data.line_value ?? null);
}

export function getRobinhoodLines() {
  return db.prepare(`SELECT * FROM robinhood_lines ORDER BY entered_at DESC`).all() as RobinhoodLine[];
}

export function deleteRobinhoodLine(id: number) {
  db.prepare(`DELETE FROM robinhood_lines WHERE id = ?`).run(id);
}

export interface RobinhoodLine {
  id: number;
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
  bet_type: string;
  outcome: string;
  american_odds: number;
  line_value: number | null;
  entered_at: string;
}

// ── Placed bets ─────────────────────────────────────────────────────────────

export function saveBet(data: {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
  outcome: string;
  book: string;
  american_odds: number;
  stake: number;
}) {
  const res = db.prepare(`
    INSERT INTO placed_bets (game_id, home_team, away_team, game_time, sport, outcome, book, american_odds, stake)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.game_id, data.home_team, data.away_team, data.game_time,
         data.sport, data.outcome, data.book, data.american_odds, data.stake);
  return db.prepare(`SELECT * FROM placed_bets WHERE id = ?`).get(res.lastInsertRowid) as PlacedBet;
}

export function getBets() {
  return db.prepare(`SELECT * FROM placed_bets ORDER BY placed_at DESC`).all() as PlacedBet[];
}

export function settleBet(id: number, result: 'win' | 'loss' | 'push') {
  const bet = db.prepare(`SELECT * FROM placed_bets WHERE id = ?`).get(id) as PlacedBet | undefined;
  if (!bet) return null;
  let payout = 0;
  if (result === 'win') {
    const dec = bet.american_odds > 0
      ? bet.american_odds / 100 + 1
      : 100 / Math.abs(bet.american_odds) + 1;
    payout = bet.stake * dec;
  } else if (result === 'push') {
    payout = bet.stake;
  }
  db.prepare(`
    UPDATE placed_bets SET result = ?, payout = ?, settled_at = datetime('now') WHERE id = ?
  `).run(result, payout, id);
  return db.prepare(`SELECT * FROM placed_bets WHERE id = ?`).get(id) as PlacedBet;
}

export function deleteBet(id: number) {
  db.prepare(`DELETE FROM placed_bets WHERE id = ?`).run(id);
}

export function getBetsSummary() {
  const bets = getBets();
  const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
  const settled = bets.filter(b => b.result != null);
  const wins = settled.filter(b => b.result === 'win').length;
  const losses = settled.filter(b => b.result === 'loss').length;
  const pushes = settled.filter(b => b.result === 'push').length;
  const totalPayout = settled.reduce((s, b) => s + (b.payout ?? 0), 0);
  const totalStakedSettled = settled.reduce((s, b) => s + b.stake, 0);
  const netPnl = totalPayout - totalStakedSettled;
  const roi = totalStakedSettled > 0 ? (netPnl / totalStakedSettled) * 100 : 0;
  return { totalStaked, netPnl, roi, wins, losses, pushes, pending: bets.length - settled.length };
}

export interface PlacedBet {
  id: number;
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
  outcome: string;
  book: string;
  american_odds: number;
  stake: number;
  result: 'win' | 'loss' | 'push' | null;
  payout: number | null;
  placed_at: string;
  settled_at: string | null;
}
