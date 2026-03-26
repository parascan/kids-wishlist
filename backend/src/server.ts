import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import db, {
  saveRobinhoodLine, getRobinhoodLines, deleteRobinhoodLine,
  saveBet, getBets, settleBet, deleteBet, getBetsSummary,
} from './db.js';
import { fetchEspnGames } from './fetchers/espn.js';
import { fetchTheOddsApi } from './fetchers/theoddsapi.js';
import { americanToImplied, removeVig, simpleConsensus, resolveTeam } from './math/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT ?? 3001;
const ODDS_API_KEY = process.env.THE_ODDS_API_KEY ?? '';

// ── In-memory reference odds cache ────────────────────────────────────────
interface RefOdds {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
  bet_type: string;
  outcome: string;
  implied_prob: number;
  line_value?: number;
  source: string;
}

let referenceOdds: RefOdds[] = [];
let cachedGames: { game_id: string; home_team: string; away_team: string; game_time: string; status: string; sport: string }[] = [];
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
    console.log(`[fetch] ESPN: ${odds.length} odds across ${games.length} games`);
  } catch (e: any) {
    errors.push(`ESPN: ${e.message}`);
  }

  // The Odds API — DraftKings, FanDuel, BetMGM, Caesars, etc.
  if (ODDS_API_KEY) {
    try {
      const oddsApiOdds = await fetchTheOddsApi(ODDS_API_KEY);
      all.push(...oddsApiOdds);
      const sports = [...new Set(oddsApiOdds.map(o => o.sport))];
      console.log(`[fetch] TheOddsAPI: ${oddsApiOdds.length} odds across ${sports.join(', ')}`);
    } catch (e: any) {
      errors.push(`TheOddsAPI: ${e.message}`);
    }
  } else {
    errors.push('TheOddsAPI: no key (set THE_ODDS_API_KEY in .env)');
  }

  referenceOdds = all;
  lastFetchedAt = new Date().toISOString();
  fetchErrors = errors;
  console.log(`[fetch] Done. ${all.length} total reference odds. Errors: ${errors.length}`);
}

// ── Value bet auto-detection ───────────────────────────────────────────────
interface ValueBet {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
  bet_type: string;
  outcome: string;
  best_book: string;
  best_american: number;
  consensus_american: number;
  edge: number;   // probability edge (positive = book is more generous than consensus)
  ev: number;     // expected value per $1 bet using best book odds
}

function toAmerican(p: number): number {
  if (p >= 0.5) return Math.round(-p / (1 - p) * 100);
  return Math.round((1 - p) / p * 100);
}

function computeValueBets(threshold = 0.015): ValueBet[] {
  // Group reference odds by game + bet_type + outcome
  const groups = new Map<string, RefOdds[]>();
  for (const o of referenceOdds) {
    const k = `${o.game_id}||${o.bet_type}||${o.outcome}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(o);
  }

  const results: ValueBet[] = [];
  for (const odds of groups.values()) {
    if (odds.length < 2) continue;
    const probs = odds.map(o => o.implied_prob);
    const consensusProb = probs.reduce((a, b) => a + b, 0) / probs.length;
    // Best for bettor = book with LOWEST implied prob = most generous odds
    const best = odds.reduce((a, b) => a.implied_prob < b.implied_prob ? a : b);
    const edge = consensusProb - best.implied_prob;
    if (edge < threshold) continue;

    const bestAmerican = toAmerican(best.implied_prob);
    const decOdds = bestAmerican > 0 ? bestAmerican / 100 + 1 : 100 / Math.abs(bestAmerican) + 1;
    const ev = consensusProb * (decOdds - 1) - (1 - consensusProb);

    results.push({
      game_id: best.game_id,
      home_team: best.home_team,
      away_team: best.away_team,
      game_time: best.game_time,
      sport: best.sport,
      bet_type: best.bet_type,
      outcome: best.outcome,
      best_book: best.source,
      best_american: bestAmerican,
      consensus_american: toAmerican(consensusProb),
      edge,
      ev,
    });
  }

  return results.sort((a, b) => b.ev - a.ev);
}

// ── Robinhood discrepancy computation ─────────────────────────────────────
interface DiscrepancyResult {
  id: number;
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
  bet_type: string;
  outcome: string;
  robinhood_american: number;
  robinhood_prob: number;
  consensus_prob: number | null;
  consensus_sources: string[];
  delta: number | null;
  ev: number | null;
  severity: 'high' | 'medium' | 'low' | 'no-data';
  line_value: number | null;
  entered_at: string;
}

function computeDiscrepancies(): DiscrepancyResult[] {
  const lines = getRobinhoodLines();
  return lines.map(line => {
    const rhProb = americanToImplied(line.american_odds);

    const matching = referenceOdds.filter(ref => {
      if (ref.bet_type !== line.bet_type) return false;
      if (ref.outcome !== line.outcome) return false;
      const refTeam = line.outcome === 'home' ? ref.home_team : ref.away_team;
      const rhTeam  = line.outcome === 'home' ? line.home_team : line.away_team;
      const refResolved = resolveTeam(refTeam);
      const rhResolved  = resolveTeam(rhTeam);
      if (refResolved && rhResolved) return refResolved === rhResolved;
      return refTeam.toLowerCase().includes(rhTeam.toLowerCase().split(' ')[0]) ||
             rhTeam.toLowerCase().includes(refTeam.toLowerCase().split(' ')[0]);
    });

    const consensusProb = matching.length > 0
      ? simpleConsensus(matching.map(m => m.implied_prob))
      : null;

    const delta = consensusProb !== null ? rhProb - consensusProb : null;

    const decimalOdds = line.american_odds > 0
      ? (line.american_odds / 100) + 1
      : (100 / Math.abs(line.american_odds)) + 1;
    const ev = consensusProb !== null
      ? consensusProb * (decimalOdds - 1) - (1 - consensusProb)
      : null;

    let severity: DiscrepancyResult['severity'] = 'no-data';
    if (delta !== null) {
      if (delta >= 0.02) severity = 'high';
      else if (delta >= 0.01) severity = 'medium';
      else severity = 'low';
    }

    return {
      id: line.id, game_id: line.game_id, home_team: line.home_team,
      away_team: line.away_team, game_time: line.game_time, sport: line.sport,
      bet_type: line.bet_type, outcome: line.outcome,
      robinhood_american: line.american_odds, robinhood_prob: rhProb,
      consensus_prob: consensusProb, consensus_sources: [...new Set(matching.map(m => m.source))],
      delta, ev, severity, line_value: line.line_value, entered_at: line.entered_at,
    };
  }).sort((a, b) => {
    if (a.delta === null) return 1;
    if (b.delta === null) return -1;
    return b.delta - a.delta;
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────

app.get('/api/status', (_req, res) => {
  res.json({ lastFetchedAt, referenceOddsCount: referenceOdds.length, errors: fetchErrors });
});

app.post('/api/refresh', async (_req, res) => {
  await refreshReferenceOdds();
  res.json({ ok: true, lastFetchedAt, count: referenceOdds.length, errors: fetchErrors });
});

app.get('/api/discrepancies', (_req, res) => {
  res.json(computeDiscrepancies());
});

app.get('/api/value-bets', (_req, res) => {
  const threshold = parseFloat(_req.query.threshold as string) || 0.015;
  res.json(computeValueBets(threshold));
});

// Robinhood lines
app.post('/api/robinhood', (req, res) => {
  const { game_id, home_team, away_team, game_time, sport, bet_type, outcome, american_odds, line_value } = req.body;
  if (!game_id || !bet_type || !outcome || !american_odds) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  saveRobinhoodLine({ game_id, home_team, away_team, game_time, sport: sport ?? 'NCAAB', bet_type, outcome, american_odds: parseInt(american_odds), line_value });
  res.json({ ok: true });
});

app.delete('/api/robinhood/:id', (req, res) => {
  deleteRobinhoodLine(parseInt(req.params.id));
  res.json({ ok: true });
});

// Placed bets
app.get('/api/bets', (_req, res) => {
  res.json(getBets());
});

app.get('/api/bets/summary', (_req, res) => {
  res.json(getBetsSummary());
});

app.post('/api/bets', (req, res) => {
  const { game_id, home_team, away_team, game_time, sport, outcome, book, american_odds, stake } = req.body;
  if (!game_id || !outcome || !american_odds || !stake) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const bet = saveBet({
    game_id, home_team: home_team ?? '', away_team: away_team ?? '',
    game_time: game_time ?? '', sport: sport ?? '',
    outcome, book: book ?? 'Robinhood',
    american_odds: parseInt(american_odds), stake: parseFloat(stake),
  });
  res.json(bet);
});

app.patch('/api/bets/:id/settle', (req, res) => {
  const { result } = req.body;
  if (!['win', 'loss', 'push'].includes(result)) {
    return res.status(400).json({ error: 'result must be win, loss, or push' });
  }
  const bet = settleBet(parseInt(req.params.id), result);
  if (!bet) return res.status(404).json({ error: 'bet not found' });
  res.json(bet);
});

app.delete('/api/bets/:id', (req, res) => {
  deleteBet(parseInt(req.params.id));
  res.json({ ok: true });
});

// Games and reference data
app.get('/api/games', (_req, res) => {
  res.json(cachedGames);
});

app.get('/api/reference-odds', (_req, res) => {
  res.json(referenceOdds);
});

app.get('/api/robinhood-lines', (_req, res) => {
  res.json(getRobinhoodLines());
});

// Serve frontend
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n📊 Sports Odds Finder running at http://localhost:${PORT}\n`);
  console.log('Fetching initial reference odds...');
  refreshReferenceOdds().then(() => {
    console.log('Ready! Open http://localhost:' + PORT + ' in your browser.\n');
  });
});
