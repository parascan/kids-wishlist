import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/march-madness.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS underdog_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    game_time TEXT,
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
`);

export default db;

export function saveUnderdogLine(data: {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  bet_type: string;
  outcome: string;
  american_odds: number;
  line_value?: number;
}) {
  // Delete existing entry for same game+bet_type+outcome
  db.prepare(`
    DELETE FROM underdog_lines WHERE game_id = ? AND bet_type = ? AND outcome = ?
  `).run(data.game_id, data.bet_type, data.outcome);

  db.prepare(`
    INSERT INTO underdog_lines (game_id, home_team, away_team, game_time, bet_type, outcome, american_odds, line_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.game_id, data.home_team, data.away_team, data.game_time,
         data.bet_type, data.outcome, data.american_odds, data.line_value ?? null);
}

export function getUnderdogLines() {
  return db.prepare(`
    SELECT * FROM underdog_lines ORDER BY entered_at DESC
  `).all() as UnderdogLine[];
}

export function deleteUnderdogLine(id: number) {
  db.prepare(`DELETE FROM underdog_lines WHERE id = ?`).run(id);
}

export interface UnderdogLine {
  id: number;
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  bet_type: string;
  outcome: string;
  american_odds: number;
  line_value: number | null;
  entered_at: string;
}
