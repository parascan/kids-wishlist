# Architecture Patterns

**Domain:** Local odds aggregation + value betting dashboard
**Project:** March Madness Value Bet Finder
**Researched:** 2026-03-19
**Confidence:** HIGH for structural patterns (well-established Node.js/React patterns); MEDIUM for PWA local push (nuanced browser constraints)

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js)                   │
│                                                           │
│  ┌──────────┐    ┌────────────┐    ┌──────────────────┐  │
│  │ Scheduler │───▶│  Fetchers  │───▶│   Normalizer     │  │
│  │(node-cron)│    │(per-source)│    │(→ implied prob)  │  │
│  └──────────┘    └────────────┘    └────────┬─────────┘  │
│                                             │             │
│                                    ┌────────▼─────────┐  │
│                                    │    Comparator    │  │
│                                    │(consensus + diff)│  │
│                                    └────────┬─────────┘  │
│                                             │             │
│                                    ┌────────▼─────────┐  │
│                                    │  SQLite Store    │  │
│                                    │ (better-sqlite3) │  │
│                                    └────────┬─────────┘  │
│                                             │             │
│  ┌──────────────────────────────────────────▼──────────┐ │
│  │              Express API Server                      │ │
│  │  GET /api/games   GET /api/games/:id   GET /health   │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                    HTTP (localhost:3001)
                              │
┌─────────────────────────────▼───────────────────────────┐
│                    FRONTEND (React + Vite)               │
│                                                           │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ GameList     │  │ GameCard    │  │ SettingsPanel  │  │
│  │(sorted by    │  │(odds table, │  │(threshold,     │  │
│  │ discrepancy) │  │ discrepancy │  │ notifications) │  │
│  └──────────────┘  │ badge)      │  └────────────────┘  │
│                    └─────────────┘                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              usePolling hook (60s refetch)           │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Service Worker (PWA notifications)      │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Inputs | Outputs | Communicates With |
|-----------|---------------|--------|---------|-------------------|
| **Scheduler** | Triggers hourly poll cycle | Wall clock | Tick event | Fetchers |
| **Fetchers** (one per source) | Calls external API, returns raw response | API credentials | Raw JSON/HTML per source | Normalizer |
| **Normalizer** | Converts all formats → canonical `OddsSnapshot` | Raw per-source data | `NormalizedGame[]` | Comparator |
| **Comparator** | Computes consensus line + Underdog discrepancy | `NormalizedGame[]` | `GameWithDiscrepancy[]` | SQLite Store |
| **SQLite Store** | Persists latest snapshot + history | `GameWithDiscrepancy[]` | Query results | API Server, Comparator |
| **API Server** | Exposes data to frontend over HTTP | HTTP requests | JSON responses | SQLite Store, Frontend |
| **Frontend** | Renders dashboard, manages UI state | HTTP/JSON from API | UI | API Server, Service Worker |
| **Service Worker** | Receives push events, shows notifications | Push messages | Browser notifications | Frontend |

---

## Data Flow

```
External APIs
    │
    ▼
[Fetcher: The Odds API]  ──┐
[Fetcher: Kalshi]          ├──▶ [Normalizer] ──▶ [Comparator] ──▶ [SQLite]
[Fetcher: Polymarket]      │         │                │
[Fetcher: Underdog*]   ───┘         │                │
                                     │                │
                     converts all → OddsSnapshot      │
                     (American → implied prob)         │
                                                       │
                                              writes GameWithDiscrepancy
                                                       │
                                                       ▼
                                              [Express API Server]
                                                       │
                                              GET /api/games
                                                       │
                                                       ▼
                                              [React usePolling hook]
                                              (polls every 60s)
                                                       │
                                                       ▼
                                              [GameList → GameCard]
                                              (sorted by discrepancy)
                                                       │
                                              (if new high-value game)
                                                       │
                                                       ▼
                                              [Service Worker Push]
```

*Underdog: likely requires The Odds API or scraping — see PITFALLS.md

---

## Polling: Use `node-cron` (not `setInterval`)

**Recommendation:** `node-cron` with a `0 * * * *` schedule.

**Why not `setInterval`:**
- Does not respect wall-clock hours — drifts if process was paused or started mid-hour
- No scheduling semantics (no "run at :00 of every hour")
- Silent failures: if a poll takes > interval, intervals stack

**Why not `node-schedule`:**
- Slightly heavier API for this use case; `node-cron` is simpler and sufficient
- Both are fine; `node-cron` has less surface area

**Why `node-cron`:**
- `0 * * * *` = run at the top of every hour, exactly
- Process restart is safe — next :00 boundary triggers fresh run
- Built-in error isolation per job (one failed poll doesn't kill the scheduler)
- Lightweight; maintained (HIGH confidence)

```typescript
// scheduler.ts
import cron from 'node-cron';
import { runPollCycle } from './poller';

cron.schedule('0 * * * *', async () => {
  console.log('[scheduler] Starting poll cycle', new Date().toISOString());
  try {
    await runPollCycle();
  } catch (err) {
    console.error('[scheduler] Poll cycle failed:', err);
  }
});
```

Also trigger one immediate poll on server startup so the dashboard isn't empty on first load.

---

## Storage: SQLite via `better-sqlite3`

**Recommendation:** SQLite with `better-sqlite3`.

**Why not in-memory (plain JS objects):**
- Lost on process restart — dashboard goes blank if you restart the backend
- No query capability for history or filtering
- Concurrency between poll and read is unsafe without locking

**Why not a file of JSON:**
- Atomic writes require careful temp-file-swap logic
- No indexed queries; filtering discrepancy threshold requires full parse

**Why not PostgreSQL/MySQL:**
- Overkill for a local single-user tool with 64 games max (March Madness bracket)
- Adds a running service dependency

**Why `better-sqlite3` specifically:**
- Synchronous API — no async/await needed for reads, which simplifies Express handlers
- Fastest SQLite binding for Node.js (HIGH confidence: well-established benchmark winner)
- WAL mode enables concurrent reads while writing

**Schema:**

```sql
-- games: one row per game, overwritten each poll
CREATE TABLE games (
  game_id       TEXT PRIMARY KEY,
  home_team     TEXT NOT NULL,
  away_team     TEXT NOT NULL,
  tip_time      INTEGER NOT NULL,  -- Unix timestamp
  updated_at    INTEGER NOT NULL
);

-- odds: one row per (game, source, bet_type), overwritten each poll
CREATE TABLE odds (
  game_id       TEXT NOT NULL,
  source        TEXT NOT NULL,   -- 'draftkings','fanduel','kalshi','polymarket','underdog'
  bet_type      TEXT NOT NULL,   -- 'spread','totals','moneyline'
  line          REAL,            -- spread value or total
  american_odds INTEGER,         -- e.g. -110, +150
  implied_prob  REAL,            -- 0.0–1.0, vig-removed
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (game_id, source, bet_type)
);

-- discrepancies: computed by Comparator, one row per (game, bet_type)
CREATE TABLE discrepancies (
  game_id         TEXT NOT NULL,
  bet_type        TEXT NOT NULL,
  consensus_prob  REAL,
  underdog_prob   REAL,
  delta           REAL,          -- underdog_prob - consensus_prob (positive = favorable)
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (game_id, bet_type)
);
```

---

## Normalization Layer

This is the most domain-specific component. All sources must be reduced to `implied_prob` (0.0–1.0, vig-removed) before consensus can be computed.

### Source format map

| Source | Format | Notes |
|--------|--------|-------|
| DraftKings / FanDuel | American odds + spread | Via The Odds API |
| Underdog | American odds + spread | Via The Odds API or scraping |
| Kalshi | Probability % (0–100) | Direct from Kalshi API |
| Polymarket | Probability % (0–100) | Direct from Polymarket API |

### American odds → implied probability

```typescript
function americanToImplied(american: number): number {
  if (american > 0) {
    return 100 / (american + 100);
  } else {
    return Math.abs(american) / (Math.abs(american) + 100);
  }
}
```

### Vig removal (two-sided markets)

Raw implied probabilities from sportsbooks sum to > 1.0 due to the vig (house edge). Remove it before consensus calculation:

```typescript
function removeVig(impliedA: number, impliedB: number): [number, number] {
  const total = impliedA + impliedB;
  return [impliedA / total, impliedB / total];
}
```

Kalshi and Polymarket are prediction markets — their probabilities may already be close to true (no vig to remove), but apply same normalization for consistency.

### Consensus calculation

Use simple average across reference sources (DraftKings, FanDuel, Kalshi, Polymarket). Exclude Underdog from consensus — Underdog is the comparison target, not a reference.

```typescript
function consensus(probs: number[]): number {
  return probs.reduce((a, b) => a + b, 0) / probs.length;
}
```

Weighted average (weighting sharper books more heavily) is a v2 enhancement.

### Canonical `OddsSnapshot` type

```typescript
interface OddsSnapshot {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  tipTime: Date;
  source: 'draftkings' | 'fanduel' | 'kalshi' | 'polymarket' | 'underdog';
  betType: 'spread' | 'totals' | 'moneyline';
  line?: number;         // spread or total value
  americanOdds?: number; // for sportsbook sources
  impliedProb: number;   // normalized, vig-removed
}
```

---

## API Structure (Backend → Frontend)

Use Express. Keep it minimal — three endpoints are sufficient.

### `GET /api/games`

Returns all active games sorted by max discrepancy across bet types.

```typescript
// Response shape
interface GameSummary {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  tipTime: string;        // ISO 8601
  updatedAt: string;
  discrepancies: {
    betType: 'spread' | 'totals' | 'moneyline';
    consensusProb: number;
    underdogProb: number;
    delta: number;        // positive = Underdog is favorable
  }[];
  maxDelta: number;       // pre-computed for sort
}
```

### `GET /api/games/:gameId`

Full detail for one game including per-source odds breakdown.

### `GET /api/status`

Last poll time, next poll time, per-source success/failure. Used by the frontend header.

```typescript
interface PollStatus {
  lastPollAt: string;
  nextPollAt: string;
  sources: {
    name: string;
    status: 'ok' | 'error' | 'pending';
    lastError?: string;
  }[];
}
```

### No WebSockets needed

The frontend polls `GET /api/games` every 60 seconds via a `usePolling` hook. This is simpler than WebSocket/SSE and perfectly adequate for hourly data — the extra latency (up to 60s between backend write and frontend render) is imperceptible when the underlying data only changes hourly.

---

## PWA Push Notifications (Local)

**Context:** "Local" push notifications have a specific constraint — standard Web Push requires an external push service (FCM, VAPID endpoint). For a purely local app, the right approach is **in-page notifications, not service worker push**.

### Why standard Web Push won't work cleanly locally

Web Push requires:
1. A VAPID key pair (easy to generate)
2. A push subscription with an endpoint URL (this URL points to FCM or another cloud relay)
3. The browser contacts the cloud relay to deliver the push

This means even for a "local" notification, the push message routes through Google's servers. This works but adds cloud dependency to what should be self-contained.

### Recommended: In-page Notification API + optional SW fallback

**Approach A (simplest — use for MVP):** Use the browser `Notification` API directly from the React app.

```typescript
// notifications.ts
async function requestPermission(): Promise<boolean> {
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function notifyNewValueBet(game: GameSummary) {
  if (Notification.permission !== 'granted') return;
  new Notification('Value bet detected', {
    body: `${game.awayTeam} @ ${game.homeTeam}: +${(game.maxDelta * 100).toFixed(1)}% edge`,
    icon: '/icon-192.png',
    tag: game.gameId,  // deduplicates repeat notifications
  });
}
```

The `usePolling` hook compares newly fetched games against the previous snapshot. When a game crosses the threshold for the first time, fire the notification.

**Approach B (with service worker — only needed if tab is closed):** Register a service worker. When the poll detects a new value bet, `postMessage` to the SW, which calls `self.registration.showNotification()`. The SW must be active, which requires the page to have been opened at least once. This still doesn't work if the browser is fully closed.

**Recommendation:** Use Approach A for MVP. It satisfies the stated requirement (push notification when new high-discrepancy game detected) without cloud relay complexity. The user will have the tab open when placing bets — notifications while tab is open is the real use case.

VAPID + full Web Push is a v2 enhancement if background delivery is needed.

---

## Fetcher Architecture

One fetcher module per source. Each exports a single async function returning raw normalized data.

```
src/
  fetchers/
    theOddsApi.ts     — DraftKings, FanDuel, ESPN (and possibly Underdog)
    kalshi.ts         — Kalshi prediction market API
    polymarket.ts     — Polymarket API
    underdog.ts       — Underdog (scraping or Odds API if available)
  normalizer.ts       — per-source conversion to OddsSnapshot[]
  comparator.ts       — consensus + discrepancy computation
  store.ts            — SQLite read/write
  scheduler.ts        — node-cron wiring
  poller.ts           — orchestrates fetch → normalize → compare → store
  server.ts           — Express app + API routes
```

Isolating fetchers means a broken Kalshi API doesn't prevent DraftKings data from updating. Each fetcher should catch its own errors, log, and return `null` — the poll cycle continues with whatever sources succeeded.

---

## Suggested Build Order

Build in this order — each layer depends on the one below it.

```
1. Data types + schema
   └─ Define OddsSnapshot, GameWithDiscrepancy, DB schema
   └─ No external deps; everything else imports from here

2. SQLite store (store.ts)
   └─ Create/migrate tables, write + read helpers
   └─ Testable in isolation with mock data

3. Normalizer (normalizer.ts)
   └─ americanToImplied, removeVig, consensus math
   └─ Pure functions — unit test with fixture data before touching real APIs

4. One fetcher + end-to-end smoke test
   └─ Start with The Odds API (most reliable, covers DraftKings/FanDuel)
   └─ Fetch → normalize → store → verify DB row exists
   └─ Validates API key, response shape, normalization path

5. Remaining fetchers
   └─ Kalshi, Polymarket, Underdog (or confirm via The Odds API)
   └─ Each can be added independently without breaking prior work

6. Comparator (comparator.ts)
   └─ Reads all sources from DB for a game, computes consensus + delta
   └─ Writes discrepancies table

7. Scheduler + poller (scheduler.ts + poller.ts)
   └─ Wire cron → fetch all → normalize → compare → store
   └─ Add startup poll so DB is populated before server starts

8. Express API server (server.ts)
   └─ GET /api/games, /api/games/:id, /api/status
   └─ Backend is now fully functional

9. React frontend — data layer
   └─ usePolling hook, API client (axios or fetch)
   └─ Verify data arrives correctly before building UI

10. React frontend — UI components
    └─ GameList, GameCard, SettingsPanel (threshold config)
    └─ Build with mock data first, swap for real API last

11. Notifications
    └─ Browser Notification API permission request
    └─ Delta-crossing detection in usePolling
    └─ Wire to GameList render cycle
```

**Rationale for this order:**
- Types first eliminates "what shape is this?" questions across all other layers
- SQLite + normalizer before fetchers means API integration can be verified E2E immediately
- One fetcher first validates the full pipeline before adding complexity
- Frontend last means the backend contract is stable before building against it
- Notifications last because they depend on working polling + threshold logic

---

## Scalability Considerations

This is a local, time-boxed tool (3 weeks). Scalability is not a concern. The constraints that matter:

| Concern | At tournament scale | Approach |
|---------|---------------------|----------|
| Game count | Max ~64 games, ~20 active at once | In-memory query results are fine |
| Poll frequency | Hourly | Single cron job, sequential fetches |
| API rate limits | The Odds API: 500 requests/month free tier | One call per sport per hour; budget carefully |
| Kalshi / Polymarket rate limits | Unknown | Add per-request delay; cache aggressively |
| DB size | Tiny (< 1MB for entire tournament) | No cleanup needed |

---

## Sources

- `node-cron` package: well-established pattern for Node.js cron scheduling (HIGH confidence — in use since 2013, stable API)
- `better-sqlite3` vs `node-sqlite3`: synchronous API design is intentional and well-documented in package README (HIGH confidence)
- American odds to implied probability formula: standard industry formula (HIGH confidence)
- Vig removal (multiplicative normalization): standard methodology in sports analytics literature (HIGH confidence)
- Web Push / VAPID local constraints: documented browser behavior, cloud relay requirement is inherent to Web Push spec (HIGH confidence)
- Browser `Notification` API: MDN standard, works without service worker when tab is in foreground (HIGH confidence)
- MEDIUM confidence: Underdog availability via The Odds API — needs verification during Phase 1 (their coverage list changes)
- MEDIUM confidence: Kalshi and Polymarket response shapes — API docs exist but field names should be verified during implementation
