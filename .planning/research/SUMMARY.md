# Research Summary: March Madness Value Bet Finder

**Project:** March Madness Value Bet Finder
**Domain:** Sports odds aggregation + value betting dashboard (local tool)
**Researched:** 2026-03-19
**Confidence:** MEDIUM overall (math is HIGH; API availability requires live verification)

---

## Executive Summary

This is a local, single-user dashboard that aggregates odds from regulated sportsbooks (DraftKings, FanDuel via The Odds API) and prediction markets (Kalshi, and optionally Polymarket) to establish a consensus probability, then compares that consensus against Underdog Fantasy's lines to surface value betting opportunities. The core intellectual challenge is correct odds normalization — all sources must have vig stripped and be converted to implied probability before any comparison is valid. Without this, every alert is noise.

The recommended approach is a Node.js/Express backend with SQLite persistence, a React/Vite frontend with TanStack Query for polling, and in-tab browser Notification API for alerts (not full PWA push, which adds cloud relay complexity for no practical gain in a local tool). The entire stack stays within the existing project's TypeScript/Vite ecosystem. The biggest structural decision is Underdog data acquisition: Underdog has no public API, and the recommended v1 approach is a manual entry form in the dashboard, which takes 30 seconds per session and eliminates all ToS risk.

The three highest risks are: (1) The Odds API quota exhaustion if not budgeted correctly before the tournament opens — the free tier will not survive even one round weekend; (2) Kalshi's read-only endpoints still require API key authentication, which catches developers off-guard; and (3) Polymarket's US IP geo-block may prevent data access entirely from a US machine. All three must be verified with live API calls before writing integration code.

---

## Recommended Stack

The project is best served by staying entirely within the existing Node.js/TypeScript/React/Vite ecosystem. No context switch to Python, no external services beyond the APIs themselves.

**Core technologies:**

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend runtime | Node.js 22 LTS + TypeScript 5 | Existing project context; shared types with frontend; async I/O suits API polling |
| HTTP framework | Express 4 | ~5 routes, zero throughput pressure — pick the one with the most Stack Overflow coverage |
| Scheduler | node-cron 3 | Wall-clock-aligned hourly runs; `setInterval` drifts and doesn't respect hour boundaries |
| HTTP client | axios 1 | Interceptors for auth headers; cleaner error handling than raw fetch for multi-source polling |
| Database | better-sqlite3 9 | Synchronous API, fastest Node SQLite binding, WAL mode, zero config — right-sized for 64 games over 3 weeks |
| Frontend framework | React 18 + Vite 5 | Existing project stack |
| Data fetching | TanStack Query 5 | First-class `refetchInterval`; built-in stale-while-revalidate for background polling |
| Notifications | Browser Notification API | Works on localhost without HTTPS; no cloud relay; tab must be open, which matches the actual use case |

**What was ruled out:** Python/FastAPI (second language, no shared types), PostgreSQL (ops overhead for a local 3-week tool), Bull/BullMQ queues (overkill for a single hourly job), full PWA/VAPID push (routes through Google's servers — adds cloud dependency to a self-contained tool), Puppeteer scraping for Underdog (ToS violation risk on the live betting account).

**Verify before coding:** Sign up for The Odds API paid starter tier (~$10/month, 3K requests) — the free 500/month tier will exhaust in the first tournament day. Generate Kalshi API keys before any integration work. Test Polymarket from your IP before treating it as a required source.

---

## Table Stakes Features

These are the features the tool is useless without. Every one is a dependency for the core alert pipeline.

| Feature | Notes |
|---------|-------|
| American odds → implied probability conversion | Positive: `100/(odds+100)`; Negative: `|odds|/(|odds|+100)` |
| Vig removal before consensus | Divide each raw prob by the two-sided total so sides sum to exactly 1.0 |
| Consensus construction from reference sources | Simple average of no-vig probs from DraftKings, FanDuel, Kalshi (Polymarket optional) |
| Per-game discrepancy score vs. Underdog | Delta = `underdog_implied_prob - consensus_prob`; positive = favorable |
| EV calculation | `EV = fair_p * (odds/100) - (1-fair_p)` for positive lines; same for negative |
| Sort by discrepancy descending | Biggest value opportunities at top |
| Discrepancy threshold filter | Hide games below user's minimum edge %; explicitly called out in PROJECT.md |
| All three market types: spread, O/U, moneyline | Each type has separate normalization logic; spread/O-U compare in points, not probability |
| Manual Underdog entry form | Required because Underdog has no public API; 30 seconds per session in v1 |
| Manual refresh button | Force a poll without waiting for the hourly cron |
| Game list with team names and tip-off time | Context for every row — no raw IDs shown to user |
| "Last updated" timestamp per source | Freshness signal critical when data may be stale |

**Feature dependency chain:**
```
Vig removal → Consensus construction → Discrepancy score → EV calculation
                                                          → Color coding (by EV magnitude)
                                                          → Sort order
                                                          → Threshold filter
```

**Defer to v1.1:** Weighted source configuration (build simple average first), line movement indicator (opening vs. closing discrepancy — requires storing previous snapshot), Kelly Criterion stake sizing, game status filter (in-progress suppression).

**Explicit anti-features:** No user auth, no bet placement, no ML win models (trust market consensus instead), no responsive mobile layout (desktop only), no configurable refresh interval (hourly is correct; sub-minute would breach rate limits).

---

## Architecture Overview

**Component map and build order:**

```
BACKEND
  [node-cron Scheduler] ──triggers──▶ [Poller orchestrator]
                                              │
                                    ┌─────────┴──────────┐
                                    │ Fetchers (parallel) │
                                    │  theOddsApi.ts      │
                                    │  kalshi.ts          │
                                    │  polymarket.ts      │
                                    └─────────┬──────────┘
                                              │
                                    [Normalizer]
                                    (→ OddsSnapshot, vig removed)
                                              │
                                    [Comparator]
                                    (consensus + discrepancy delta)
                                              │
                                    [SQLite via better-sqlite3]
                                              │
                                    [Express API Server]
                                    GET /api/games
                                    GET /api/games/:id
                                    GET /api/status
                                    POST /api/underdog/entry

FRONTEND
  [TanStack Query usePolling hook] ──60s refetch──▶ /api/games
  [GameList] ──sorted by discrepancy──▶ [GameCard] (odds table + discrepancy badge)
  [UnderdogEntryForm] ──POST──▶ /api/underdog/entry
  [SettingsPanel] ──threshold config──▶ local state
  [Browser Notification API] ──fires when delta crosses threshold──▶ user
```

**Build order (each step tests the one before):**
1. Types and DB schema — `OddsSnapshot`, `GameWithDiscrepancy`, SQLite tables
2. SQLite store — write/read helpers, WAL mode, testable with mock data
3. Normalizer — pure functions for `americanToImplied`, `removeVig`, `consensus`; unit-test with fixtures
4. One fetcher end-to-end — start with The Odds API (most reliable); smoke-test full pipeline to DB
5. Remaining fetchers — Kalshi, Polymarket (if accessible), Underdog manual entry
6. Comparator — reads all sources per game, writes discrepancies table
7. Scheduler + poller — wire cron + startup poll so DB is populated before server ready
8. Express API server — three routes; backend is fully functional here
9. React frontend data layer — `usePolling` hook, verify data arrives correctly
10. React frontend UI — `GameList`, `GameCard`, `UnderdogEntryForm`, `SettingsPanel`; build with mock data first
11. Notifications — Notification API permission, delta-crossing detection in `usePolling`

**Key architectural decisions:**
- Underdog is excluded from consensus calculation — it is the comparison target, never a reference source
- Each fetcher catches its own errors and returns null; a broken Kalshi API does not stop DraftKings data from updating
- No WebSockets needed — frontend polls `/api/games` every 60 seconds; latency of up to 60s is imperceptible when underlying data only changes hourly
- Spread/O-U discrepancies are reported in points (not probability) — no spurious probability conversion
- Team matching uses canonical team IDs, not timestamps or raw names (platform naming variants differ significantly)

---

## Critical Decisions Required

These must be resolved before writing any code, or the wrong assumption will cascade through the entire build.

**1. The Odds API tier selection**
The free 500-request/month tier will exhaust in the opening tournament weekend (64 requests per poll × ~10 polls on a first-round day = 640 units/day). Buy the starter paid tier (~$10/month, 3K requests) before starting. Calculate: `(bookmaker count) × (active games) × (polls/day) × (tournament days)`.

**2. Underdog: manual entry vs. automation**
Manual entry is the recommended v1 path. Automated scraping violates Underdog's ToS and risks the live betting account used to actually place bets. Decide before writing a single line of Underdog integration code. If manual, the UI needs an `UnderdogEntryForm` component and a `POST /api/underdog/entry` route. This decision shapes the entire data model.

**3. Polymarket: in or out**
Test from your IP: `curl https://gamma-api.polymarket.com/markets?limit=1`. If geo-blocked (403 or empty), drop Polymarket entirely. If accessible, verify that per-game markets exist for early-round NCAA games (many first-round matchups may have no Polymarket market). Build the consensus algorithm to handle a missing Polymarket input gracefully regardless of this decision.

**4. Notification strategy: in-tab vs. full PWA push**
Research consensus is clear: use the browser `Notification` API (in-tab) for MVP. Full VAPID/service worker push routes through Google's servers and requires HTTPS infrastructure for no meaningful gain when the user has the tab open while betting. Commit to in-tab notifications before building the notification layer.

**5. Kalshi API version and auth method**
Kalshi requires API key authentication even for read-only market endpoints. Generate a key pair at kalshi.com/account/api before writing any integration code. Verify the base URL is still `https://trading-api.kalshi.com/trade-api/v2` (not v3) and that March Madness markets are live under a filterable ticker.

---

## Watch Out For

**1. Vig not removed before consensus (kill-the-tool bug)**
If you compare raw American odds or raw sportsbook implied probabilities without stripping the vig, every discrepancy alert is false. A DraftKings -110/-110 market implies 52.4% per side — 4.8% vig baked in. The fix: normalize each side by the two-sided total before any consensus math. Unit-test this before touching real APIs. Detection: if consensus probabilities for both sides of any game sum to more than 1.02, vig removal is not working.

**2. The Odds API quota exhaustion mid-tournament**
First-round weekends have up to 16 simultaneous games. At 4 bookmakers per poll, that is 64 usage units per hourly poll — over 1,500 units for a single first-round weekend. The free tier (500/month) dies after 7 polls. Monitor `x-requests-remaining` in every response header. Implement a circuit breaker that extends the polling interval automatically when quota drops below 200.

**3. Kalshi auth surprises (silent 401 or empty 200)**
Kalshi's API returns 200 with an empty body (not a 429) when rate-limited, and a clean 401 when auth is missing. Both look like "no data" to naive code. Implement auth headers from day one, log every HTTP status code on fetch, and add explicit per-request delays (~300ms between sequential Kalshi calls).

**4. Team name normalization failures (silent data loss)**
"UConn Huskies" (ESPN), "Connecticut" (Kalshi), "UCONN" (DraftKings), and "UConn" (Underdog) are the same team. Name mismatches cause silent data loss — the game appears in the dashboard with consensus from only one platform, showing a false discrepancy. Build a canonical 68-team name dictionary before any cross-platform matching logic. Log every unmatched name as a warning; never silently drop it.

**5. Stale data producing false alerts**
Sequential API fetches over 3-5 minutes mean a line that moved between Platform A's fetch and Platform B's fetch shows a discrepancy that does not exist at any real point in time. Fix: use `Promise.all` to fetch all platforms in parallel, stamp every data point with its fetch timestamp, and reject comparisons where the age gap between any two sources exceeds 5 minutes.

---

## Open Questions

These are unresolved at research time and require live verification before implementation.

| Question | How to Resolve | Impact if Wrong |
|----------|---------------|-----------------|
| Are Kalshi March Madness 2026 per-game markets live? | Hit `GET /markets?series_ticker=NCAAB` with a valid API key | If no markets, lose the sharpest prediction-market signal in consensus |
| Is Polymarket accessible from a US IP for read-only data? | `curl https://gamma-api.polymarket.com/markets?limit=1` | If blocked, drop Polymarket entirely — already optional |
| Does Polymarket have per-game (not just tournament futures) markets for early-round NCAA games? | Browse gamma-api manually for game-level markets | If not, Polymarket is useless for the per-game consensus even if accessible |
| Which Kalshi auth method is current — HMAC-SHA256 or RSA? | Read current Kalshi API docs | Wrong auth scheme means zero Kalshi data |
| What bet types does Underdog actually offer for NCAA March Madness 2026? | Open app.underdogfantasy.com, check available pick'em markets | Determines which of spread/moneyline/O-U are in scope for comparison |
| Does The Odds API include Underdog Fantasy as a bookmaker? | Hit `/v4/sports/basketball_ncaab/odds` and check bookmaker list | If yes, eliminates the manual entry requirement entirely |
| Is ESPN BET available as a bookmaker on The Odds API free/starter tier? | Check `espnbet` in bookmakers list | Low impact — redundant with DraftKings/FanDuel |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Node/Express/SQLite/React/Vite are settled choices; no exotic dependencies |
| Odds math (vig removal, EV, consensus) | HIGH | Textbook formulas; verified against industry-standard implementations |
| Features / product requirements | HIGH | Clear scope from PROJECT.md; table stakes are unambiguous |
| Architecture patterns | HIGH | Standard Node.js data pipeline; well-established patterns |
| Kalshi API availability | MEDIUM | Existed and was well-documented as of Aug 2025; verify auth method and market tickers |
| The Odds API coverage | MEDIUM | DraftKings/FanDuel confirmed as of mid-2025; quota model must be verified |
| Polymarket accessibility | LOW | US geo-block makes this a verify-first, use-if-works source |
| Underdog API | HIGH (negative) | Confirmed no public API; manual entry is the correct v1 decision |
| Push notifications | HIGH | In-tab Notification API is the right choice; full PWA push is explicitly deferred |

**Overall confidence: MEDIUM** — The architecture and math are solid. The uncertainty is entirely in live API verification, which takes 20 minutes of manual testing before writing code.

### Gaps to Address Before Building

- Run the 5-step pre-build verification checklist from STACK.md (Kalshi auth, Polymarket geo-access, The Odds API key + NCAAB availability, Underdog market audit, ESPN scoreboard check) before committing to any fetcher implementations
- Calculate The Odds API quota for the full tournament before subscribing to a tier
- Confirm Underdog bet types for NCAA 2026 to finalize which market types are in scope

---

## Sources

### High Confidence (training knowledge, stable domain)
- American odds / implied probability / vig removal math — textbook formulas, same as Pinnacle's official documentation and Action Network's published methodology
- EV formula — standard Kelly/Thorp betting literature
- Node.js / Express / SQLite / React architecture patterns — well-established, training knowledge
- Browser Notification API — MDN standard; localhost exemption for service workers is explicit browser spec behavior
- Web Push VAPID architecture — well-documented browser specification

### Medium Confidence (training knowledge, verify against live state)
- Kalshi Trading API: `https://trading-api.kalshi.com/trade-api/v2` — accurate as of Aug 2025; auth method and market structure should be re-verified
- The Odds API: `https://api.the-odds-api.com/v4` — confirmed DraftKings/FanDuel coverage as of mid-2025; pricing tiers change
- Polymarket Gamma API: `https://gamma-api.polymarket.com/markets` — accessible without auth as of Aug 2025; US access status uncertain
- ESPN internal API: `site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard` — undocumented, has been stable for years but can change

### Low Confidence (requires live verification)
- Kalshi rate limits (~10-30 req/min) — changes with API versions; verify in current docs
- Polymarket per-game NCAA market availability — manually audit at time of build
- The Odds API quota math under current pricing — verify before subscribing

---

*Research completed: 2026-03-19*
*Ready for roadmap: yes — pending live API verification (estimated 20 minutes)*
