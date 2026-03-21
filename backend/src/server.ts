import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import db, { saveUnderdogLine, getUnderdogLines, deleteUnderdogLine } from './db.js';
import { fetchKalshi } from './fetchers/kalshi.js';
import { fetchPolymarket } from './fetchers/polymarket.js';
import { fetchEspnGames } from './fetchers/espn.js';
import { fetchTheOddsApi } from './fetchers/theoddsapi.js';
import { americanToImplied, removeVig, simpleConsensus, resolveTeam } from './math/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT ?? 3001;
const KALSHI_KEY = process.env.KALSHI_API_KEY ?? '';
const ODDS_API_KEY = process.env.THE_ODDS_API_KEY ?? '';

// ── In-memory reference odds cache (refreshed on demand) ──────────────────
interface RefOdds {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  bet_type: string;
  outcome: string;
  implied_prob: number;
  line_value?: number;
  source: string;
}

let referenceOdds: RefOdds[] = [];
let cachedGames: { game_id: string; home_team: string; away_team: string; game_time: string; status: string }[] = [];
let lastFetchedAt: string | null = null;
let fetchErrors: string[] = [];

async function refreshReferenceOdds() {
  const errors: string[] = [];
  const all: RefOdds[] = [];

  // ESPN — always try (free, no key)
  try {
    const { odds, games } = await fetchEspnGames();
    all.push(...odds);
    cachedGames = games;
    console.log(`[fetch] ESPN: ${odds.length} odds`);
  } catch (e: any) {
    errors.push(`ESPN: ${e.message}`);
  }

  // The Odds API — DraftKings, FanDuel, BetMGM, Caesars, etc.
  if (ODDS_API_KEY) {
    try {
      const oddsApiOdds = await fetchTheOddsApi(ODDS_API_KEY);
      all.push(...oddsApiOdds);
      const books = [...new Set(oddsApiOdds.map(o => o.source))];
      console.log(`[fetch] TheOddsAPI: ${oddsApiOdds.length} odds from ${books.join(', ')}`);
    } catch (e: any) {
      errors.push(`TheOddsAPI: ${e.message}`);
    }
  }

  // Kalshi — try if key provided
  if (KALSHI_KEY) {
    try {
      const kalshiOdds = await fetchKalshi(KALSHI_KEY);
      all.push(...kalshiOdds);
      console.log(`[fetch] Kalshi: ${kalshiOdds.length} odds`);
    } catch (e: any) {
      errors.push(`Kalshi: ${e.message}`);
    }
  } else {
    errors.push('Kalshi: no API key (set KALSHI_API_KEY in .env)');
  }

  // Polymarket — optional
  try {
    const polyOdds = await fetchPolymarket();
    all.push(...polyOdds);
    console.log(`[fetch] Polymarket: ${polyOdds.length} odds`);
  } catch (e: any) {
    errors.push(`Polymarket: ${e.message}`);
  }

  referenceOdds = all;
  lastFetchedAt = new Date().toISOString();
  fetchErrors = errors;
  console.log(`[fetch] Done. ${all.length} total reference odds. Errors: ${errors.length}`);
}

// ── Discrepancy computation ────────────────────────────────────────────────
interface DiscrepancyResult {
  id: number;
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  bet_type: string;
  outcome: string;
  underdog_american: number;
  underdog_prob: number;
  consensus_prob: number | null;
  consensus_sources: string[];
  delta: number | null;       // underdog_prob - consensus_prob (positive = Underdog is more favorable)
  ev: number | null;          // expected value per $1 bet
  severity: 'high' | 'medium' | 'low' | 'no-data';
  line_value: number | null;
  entered_at: string;
}

function computeDiscrepancies(threshold: number): DiscrepancyResult[] {
  const lines = getUnderdogLines();
  return lines.map(line => {
    const underdogProb = americanToImplied(line.american_odds);

    // Find matching reference odds by bet_type + outcome
    // Try to match by team name using resolveTeam for cross-source matching
    const matching = referenceOdds.filter(ref => {
      if (ref.bet_type !== line.bet_type) return false;
      if (ref.outcome !== line.outcome) return false;
      // Try to match team names
      const refTeam = line.outcome === 'home' ? ref.home_team : ref.away_team;
      const udTeam = line.outcome === 'home' ? line.home_team : line.away_team;
      const refResolved = resolveTeam(refTeam);
      const udResolved = resolveTeam(udTeam);
      if (refResolved && udResolved) return refResolved === udResolved;
      // Fallback: fuzzy string match
      return refTeam.toLowerCase().includes(udTeam.toLowerCase().split(' ')[0]) ||
             udTeam.toLowerCase().includes(refTeam.toLowerCase().split(' ')[0]);
    });

    const consensusProb = matching.length > 0
      ? simpleConsensus(matching.map(m => m.implied_prob))
      : null;

    const delta = consensusProb !== null ? underdogProb - consensusProb : null;

    // EV = p_fair * (decimal_odds - 1) - (1 - p_fair)
    // decimal_odds from american_odds
    const decimalOdds = line.american_odds > 0
      ? (line.american_odds / 100) + 1
      : (100 / Math.abs(line.american_odds)) + 1;
    const ev = consensusProb !== null
      ? consensusProb * (decimalOdds - 1) - (1 - consensusProb)
      : null;

    let severity: DiscrepancyResult['severity'] = 'no-data';
    if (delta !== null) {
      if (Math.abs(delta) >= threshold / 100) severity = 'high';
      else if (Math.abs(delta) >= (threshold / 100) / 2) severity = 'medium';
      else severity = 'low';
    }

    return {
      id: line.id,
      game_id: line.game_id,
      home_team: line.home_team,
      away_team: line.away_team,
      game_time: line.game_time,
      bet_type: line.bet_type,
      outcome: line.outcome,
      underdog_american: line.american_odds,
      underdog_prob: underdogProb,
      consensus_prob: consensusProb,
      consensus_sources: [...new Set(matching.map(m => m.source))],
      delta,
      ev,
      severity,
      line_value: line.line_value,
      entered_at: line.entered_at,
    };
  }).sort((a, b) => {
    // Sort by delta descending (biggest favorable discrepancy first)
    if (a.delta === null) return 1;
    if (b.delta === null) return -1;
    return b.delta - a.delta;
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────

app.get('/api/status', (_req, res) => {
  res.json({
    lastFetchedAt,
    referenceOddsCount: referenceOdds.length,
    errors: fetchErrors,
    kalshiKeySet: !!KALSHI_KEY,
  });
});

app.post('/api/refresh', async (_req, res) => {
  await refreshReferenceOdds();
  res.json({ ok: true, lastFetchedAt, count: referenceOdds.length, errors: fetchErrors });
});

app.get('/api/discrepancies', (req, res) => {
  const threshold = parseInt(req.query.threshold as string) || 5;
  res.json(computeDiscrepancies(threshold));
});

app.post('/api/underdog', (req, res) => {
  const { game_id, home_team, away_team, game_time, bet_type, outcome, american_odds, line_value } = req.body;
  if (!game_id || !bet_type || !outcome || !american_odds) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  saveUnderdogLine({ game_id, home_team, away_team, game_time, bet_type, outcome, american_odds: parseInt(american_odds), line_value });
  res.json({ ok: true });
});

app.delete('/api/underdog/:id', (req, res) => {
  deleteUnderdogLine(parseInt(req.params.id));
  res.json({ ok: true });
});

app.get('/api/games/espn', (_req, res) => {
  res.json(cachedGames);
});

app.get('/api/reference-odds', (_req, res) => {
  res.json(referenceOdds);
});

// Serve frontend
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🏀 March Madness Value Finder running at http://localhost:${PORT}\n`);
  console.log('Fetching initial reference odds...');
  refreshReferenceOdds().then(() => {
    console.log('Ready! Open http://localhost:' + PORT + ' in your browser.\n');
  });
});
