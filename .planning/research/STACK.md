# Technology Stack

**Project:** March Madness Value Bet Finder
**Researched:** 2026-03-19
**Research mode:** Ecosystem — local web app, odds aggregation + comparison

---

## CRITICAL NOTE: External Verification Required

All external research tools (WebSearch, WebFetch, Bash) were unavailable during this session.
Every claim below is based on training knowledge with cutoff August 2025. Each section
includes explicit confidence levels and **VERIFY** flags for claims that must be confirmed
before writing code. Do not treat LOW confidence items as settled.

---

## API Availability Assessment

This is the most important section. The entire project depends on these being accessible.

### Kalshi

**What it is:** US-regulated prediction market (CFTC-licensed). Trades event contracts including
sports outcomes, tournament brackets, and game spreads.

**API availability:** YES, public REST API exists. **Confidence: HIGH** (well-documented as of
Aug 2025; official docs at trading-api.readme.io).

**Key details (as of Aug 2025):**
- Base URL: `https://trading-api.kalshi.com/trade-api/v2`
- Auth: API key + RSA private key (HMAC-SHA256 signature on each request) OR email+password
  session auth. Key-based is strongly preferred for scripted access.
- Rate limits: Not publicly documented in detail; observed ~10 req/sec without throttling.
  Hourly polling of ~60-70 active NCAA tournament markets should be well within limits.
- Sports markets: Kalshi actively lists NCAA basketball game-winner contracts and tournament
  bracket markets during March Madness. Endpoint: `GET /markets` with `event_ticker` filter
  or series lookup.
- Market tickers for NCAA games follow pattern like `NCAAB-TEAM1-TEAM2-DATE`.

**VERIFY before building:**
- [ ] Confirm March Madness 2026 markets are live at `GET /markets?series_ticker=NCAAB`
      or equivalent filter (tickers may change year to year)
- [ ] Confirm auth method — key-based vs session. Generate API key at kalshi.com/account/api
- [ ] Check if spread/O-U markets exist or only winner/moneyline (as of 2025, mostly winner)
- [ ] Confirm current base URL has not changed to v3

**What Kalshi gives you:** Implied probability % for winner markets. Requires conversion to
American odds for comparison with sportsbooks. Formula: prob → American odds is standard
(-EV math).

---

### Polymarket

**What it is:** Crypto-native prediction market (Polygon blockchain). Not CFTC regulated for
US sports betting. US access has been restricted/blocked as of late 2024.

**API availability:** YES, public API exists. **Confidence: MEDIUM.**

**Key details (as of Aug 2025):**
- Two APIs: CLOB API (`clob.polymarket.com`) for order book data; Gamma API
  (`gamma-api.polymarket.com`) for market metadata/search.
- Auth: No auth required for read-only market data. Wallet sig needed only for trading.
- Sports: Polymarket does list NCAA tournament markets (game winners, tournament champion,
  Final Four). Market IDs are UUIDs, not human-readable tickers.
- Endpoint for searching markets: `GET https://gamma-api.polymarket.com/markets?tag=ncaa`
  or similar. Returns `question`, `outcomePrices` (as probability strings).

**VERIFY before building:**
- [ ] US IP access: Polymarket has geo-blocked US users for trading; read-only API access
      from US IP may or may not work. **This is the biggest risk for Polymarket.**
      Test: `curl https://gamma-api.polymarket.com/markets?limit=1` from your machine.
- [ ] Confirm NCAA March Madness 2026 markets are being listed this year
- [ ] Confirm `outcomePrices` field still returns probability (0-1 float or percent string)
- [ ] Verify Gamma API base URL has not changed

**What Polymarket gives you:** Probability % for winner markets only (no spread/O-U). Lower
data quality for this use case than Kalshi. If geo-blocked, drop from stack.

---

### The Odds API (the-odds-api.com)

**What it is:** Third-party aggregator that proxies odds from 80+ sportsbooks via a clean REST API.
The standard solution for accessing DraftKings, FanDuel, and other major book lines without
scraping.

**API availability:** YES, public REST API. **Confidence: HIGH.**

**Key details (as of Aug 2025):**
- Base URL: `https://api.the-odds-api.com/v4`
- Auth: API key in query param (`?apiKey=YOUR_KEY`). Free tier: 500 requests/month.
  Paid tiers start ~$79/month for 50K requests; starter at ~$10/month for 3K requests.
- Sports key for NCAA basketball: `basketball_ncaab`
- Market types: `h2h` (moneyline), `spreads`, `totals` (O/U)
- Bookmakers supported (confirmed as of mid-2025): DraftKings (`draftkings`),
  FanDuel (`fanduel`), BetMGM, Caesars, many others.
- Endpoint: `GET /sports/basketball_ncaab/odds?regions=us&markets=h2h,spreads,totals&bookmakers=draftkings,fanduel`

**Underdog Fantasy on The Odds API:**
- **Confidence: LOW.** Underdog Fantasy is not a traditional sportsbook. It operates as a
  pick'em / fantasy sports platform, not a licensed sportsbook. As of Aug 2025, Underdog
  was NOT listed in The Odds API's supported bookmakers.
- **This is the critical gap in the stack.** See Underdog section below.

**VERIFY before building:**
- [ ] Sign up for free tier at the-odds-api.com; confirm `basketball_ncaab` is available
- [ ] Run: `GET /sports` to get full list of available sports and confirm NCAAB is active
      during March (may be seasonal)
- [ ] Confirm DraftKings and FanDuel are included in free tier or which tier includes them
- [ ] Check remaining request quota per month — hourly polling of 1 sport = ~720 req/month;
      free tier (500/month) may be insufficient; starter paid tier recommended

**Rate limit math:** Hourly polling, 1 sport, 3 market types = ~1 request/hour if batched
properly. 720 requests over the tournament. Free tier (500/month) may work if usage starts
mid-month; starter paid tier ($10/month, 3K requests) is safer.

---

### Underdog Fantasy

**What it is:** Pick'em and fantasy sports platform. Users pick over/under on player props and
game outcomes. NOT a traditional sportsbook — no spread betting in the traditional sense, but
does offer game O/U and winner picks.

**API availability:** NO public API. **Confidence: HIGH (that there is no public API).**

**What exists:**
- Underdog has an internal REST API that their mobile app consumes, discoverable via
  browser devtools / proxy (Charles, mitmproxy). This is an undocumented private API.
- The endpoints and auth tokens change without notice. Scraping/reverse-engineering violates
  Underdog's Terms of Service.
- No third-party aggregator (including The Odds API) supports Underdog as of Aug 2025.

**Options ranked:**

1. **Browser automation / scraping (HIGH RISK):** Use Puppeteer to load Underdog's web app,
   intercept XHR requests, parse the JSON responses. Works but fragile — Underdog may
   use bot detection, require login, or change their app structure. Terms of Service violation.

2. **Manual data entry (VIABLE for v1):** Given this is a 3-week tournament, a simple form
   to paste in Underdog's current lines for active games is pragmatic. User checks Underdog
   app, enters line. Removes the API dependency entirely for the most critical data source.

3. **Proxy/intercept approach (MEDIUM RISK):** User runs mitmproxy locally, opens Underdog
   app on phone routed through it, captures the JSON. One-time setup per session. More
   reliable than full automation but still ToS-gray-area.

**RECOMMENDATION:** Build Phase 1 with manual Underdog entry (simple form in the dashboard).
The value is in the consensus-building from reference APIs. Underdog data entry takes
30 seconds per game session. If the user wants to automate it later, Puppeteer is the path,
but scope it out of v1.

**VERIFY before building:**
- [ ] Check Underdog's current web app (app.underdogfantasy.com) for March Madness pick'em
      markets — confirm what bet types are available (game winner, O/U, spread)
- [ ] Confirm whether Underdog has added a public API since Aug 2025

---

### ESPN

**What it is:** Sports data and news. Relevant for game schedules, team info, and ESPN's own
published odds/lines (ESPN BET is their sportsbook).

**API availability:** UNOFFICIAL only. **Confidence: HIGH (that there is no official public API).**

**What exists:**
- `site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`
  — This is ESPN's internal API, publicly accessible without auth, used by their website.
  Not officially documented or supported.
- Returns game schedule, scores, team info.
- ESPN BET odds are available via the-odds-api.com (bookmaker key: `espnbet`) as of mid-2025.

**RECOMMENDATION:** Use ESPN's internal scoreboard API for game schedule/metadata only
(team names, game times, IDs). Use The Odds API for ESPN BET odds lines if desired.
Do not build a hard dependency on ESPN's undocumented API — it can change without notice,
but has been stable for years.

**VERIFY before building:**
- [ ] Hit `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`
      and confirm it returns current tournament games
- [ ] Confirm `espnbet` bookmaker is available in The Odds API if ESPN BET lines are desired

---

## Recommended Stack

### Backend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22.x LTS | Runtime | Already in project; no context switch; async-native for API polling |
| TypeScript | 5.x | Language | Type safety for odds data normalization; catches unit mismatches at compile time |
| Express | 4.x | HTTP server | Minimal, well-understood, no magic. Serves API routes to React frontend |
| node-cron | 3.x | Scheduled polling | Simple cron syntax for hourly jobs; no queue complexity needed at this scale |
| better-sqlite3 | 9.x | Local database | See Storage section |
| axios | 1.x | HTTP client | Clean promise API, interceptors for auth headers, better error handling than fetch |

**Why Node over Python/FastAPI:**
- Project is already Node/React/TypeScript. Shared type definitions between backend and
  frontend are a real productivity win for a time-boxed project.
- FastAPI would be a fine choice in isolation but introduces a second language context,
  separate process management, and no shared types. Not worth the overhead for a 3-week tool.
- The polling workload is I/O-bound (waiting on APIs), which Node handles well.

**Why Express over Fastify/Hono:**
- Express 4 is the known quantity. Fastify and Hono are both better in benchmarks but
  this app has ~5 routes and zero throughput requirements. Pick the one with the most
  Stack Overflow answers.

### Frontend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 18.x | UI framework | Already established in project; familiar |
| TypeScript | 5.x | Language | Shared types with backend (in a monorepo `types/` dir) |
| Vite | 5.x | Build tool | Already in project; fast HMR |
| vite-plugin-pwa | 0.20.x | PWA + service worker | Handles SW generation, manifest, VAPID setup |
| TanStack Query | 5.x | Data fetching + polling | Built-in refetch intervals, stale-while-revalidate, background updates |
| Recharts | 2.x | Charts (optional) | If odds history visualization is wanted; lightweight |

**Why TanStack Query over SWR or raw useEffect:**
- `refetchInterval` is first-class. For a dashboard that auto-refreshes every hour (or on
  demand), Query handles caching, background refetch, and stale data display cleanly.
- SWR is a viable alternative; Query has slightly better TypeScript support.

### Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| better-sqlite3 | 9.x | Hourly snapshots, current odds | Embedded, zero config, synchronous API fits Node perfectly |

**Why SQLite over alternatives:**

- **vs. JSON files:** JSON files are fine for single snapshots but become unwieldy for
  hourly snapshots over 3 weeks (500+ snapshot files). SQLite gives you querying, ordering,
  and efficient disk usage. Still zero-dependency in deployment terms.

- **vs. PostgreSQL/MySQL:** Total overkill. No multi-user access, no network access, no ops
  needed. Adding a Postgres server for a local 3-week tool is waste.

- **vs. in-memory:** Loses all history on restart. Hourly snapshots are valuable for
  trend analysis and debugging. Persist them.

**Schema sketch (not normative — for roadmap guidance):**

```sql
CREATE TABLE odds_snapshots (
  id INTEGER PRIMARY KEY,
  fetched_at TEXT NOT NULL,        -- ISO8601
  source TEXT NOT NULL,            -- 'kalshi' | 'polymarket' | 'the-odds-api' | 'manual'
  game_id TEXT NOT NULL,           -- normalized game identifier
  home_team TEXT,
  away_team TEXT,
  game_time TEXT,                  -- ISO8601
  market_type TEXT NOT NULL,       -- 'winner' | 'spread' | 'total'
  outcome TEXT,                    -- 'home' | 'away' | 'over' | 'under'
  value REAL NOT NULL,             -- probability (0-1) OR American odds integer
  value_type TEXT NOT NULL         -- 'probability' | 'american_odds'
);

CREATE TABLE underdog_lines (
  id INTEGER PRIMARY KEY,
  entered_at TEXT NOT NULL,
  game_id TEXT NOT NULL,
  market_type TEXT NOT NULL,
  outcome TEXT,
  american_odds INTEGER,
  spread REAL,
  total REAL
);
```

### PWA Push Notifications (Local)

**How it works locally:**

Push notifications require a push service. In production, browsers use FCM (Chrome) or
Mozilla's push service. Locally, you need to send VAPID-authenticated requests to the
browser's push subscription endpoint.

The browser already provides the push endpoint when the user subscribes — you POST a
VAPID-signed payload to that endpoint, and the browser delivers it even when the tab is closed.
This works locally because the push endpoint is a URL at Google/Mozilla's servers, not yours.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vite-plugin-pwa | 0.20.x | Service worker generation, manifest | Integrates with Vite; generates SW with Workbox |
| web-push | 3.x | VAPID key generation + push dispatch | Node library for sending push from backend |
| workbox | 7.x | SW caching strategies | Included via vite-plugin-pwa |

**Setup steps for local VAPID:**
1. Generate VAPID key pair once: `npx web-push generate-vapid-keys`
2. Store private key in backend `.env`; expose public key to frontend
3. Frontend: subscribe user via `PushManager.subscribe({ applicationServerKey: publicVapidKey })`
4. Frontend sends subscription object to backend (store in SQLite or in-memory)
5. Backend cron job: after computing discrepancies, if threshold exceeded, call
   `webpush.sendNotification(subscription, payload)` with VAPID credentials
6. Service worker handles `push` event and shows notification

**Localhost caveat:** Push notifications require HTTPS in most browsers, EXCEPT for
`localhost` — Chrome and Firefox explicitly exempt localhost from the HTTPS requirement for
service workers and push. This is the main reason local development works at all.

**Confidence: HIGH** — this localhost exemption is well-established behavior.

**VERIFY before building:**
- [ ] Confirm Chrome/Firefox versions in use still allow SW push on localhost (not https)
- [ ] Test with a minimal SW push example before integrating into full app

---

## Project Structure

```
march-madness-finder/
  backend/
    src/
      pollers/
        kalshi.ts         # Kalshi API client
        polymarket.ts     # Polymarket API client
        odds-api.ts       # The Odds API client (DK, FanDuel, ESPN BET)
        espn.ts           # ESPN scoreboard for game schedule
      normalizer.ts       # Convert probability % → American odds (and back)
      consensus.ts        # Weighted consensus computation
      db.ts               # SQLite setup, queries
      scheduler.ts        # node-cron hourly job
      routes/
        odds.ts           # GET /api/odds/current
        underdog.ts       # POST /api/underdog/entry
        discrepancies.ts  # GET /api/discrepancies
        push.ts           # POST /api/push/subscribe
      server.ts           # Express app
    .env                  # VAPID keys, API keys (not committed)
  frontend/
    src/
      components/
        GameCard.tsx
        DiscrepancyBadge.tsx
        UnderdogEntryForm.tsx
        ThresholdSlider.tsx
      hooks/
        useDiscrepancies.ts   # TanStack Query hook
      types.ts                # Shared with backend via symlink or copy
    vite.config.ts            # vite-plugin-pwa config
    public/
      sw.js (generated)
  shared/
    types.ts                  # Odds types, game types, shared interfaces
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend language | Node/TypeScript | Python/FastAPI | Two languages, no shared types, extra process management |
| Database | SQLite (better-sqlite3) | JSON files | Unwieldy at scale; no querying |
| Database | SQLite (better-sqlite3) | PostgreSQL | Ops overhead for a local 3-week tool |
| Database | SQLite (better-sqlite3) | In-memory | Loses history on restart |
| API framework | Express 4 | Fastify / Hono | Zero throughput needs; familiarity wins |
| Polling | node-cron | Bull/BullMQ | Queue infrastructure is over-engineering for hourly, single-job polling |
| Data fetching (FE) | TanStack Query | SWR | Better TypeScript; first-class refetch interval |
| Underdog data | Manual entry form | Puppeteer scraping | ToS violation; fragile; manual takes 30s |

---

## Installation

```bash
# Backend
cd backend
npm install express better-sqlite3 axios node-cron web-push
npm install -D typescript @types/express @types/better-sqlite3 @types/node @types/web-push ts-node nodemon

# Frontend
cd frontend
npm install react react-dom @tanstack/react-query vite vite-plugin-pwa
npm install -D typescript @vitejs/plugin-react
```

---

## Confidence Summary

| Area | Confidence | Basis | Key Risks |
|------|------------|-------|-----------|
| Kalshi API exists and works | HIGH | Well-documented as of Aug 2025 | Auth method, ticker format may have changed |
| Kalshi has March Madness markets | MEDIUM | Historical pattern; they listed them in 2024-2025 | Not guaranteed for 2026 until markets open |
| Polymarket API is accessible from US | LOW | Geo-blocking reported late 2024 | May be fully blocked; treat as optional |
| The Odds API covers DraftKings/FanDuel | HIGH | Confirmed in documentation as of mid-2025 | Free tier may be insufficient; paid tier needed |
| Underdog on The Odds API | HIGH (negative) | Not listed as of Aug 2025 | Manual entry is the fallback |
| ESPN internal API | MEDIUM | Undocumented but stable for years | No official support; can break without notice |
| Node/SQLite/Express stack | HIGH | Standard local tooling, no external dependencies | None significant |
| PWA push on localhost | HIGH | Browser spec; localhost HTTPS exemption is explicit | — |
| Odds normalization (prob → American) | HIGH | Standard math, no library needed | — |

---

## Pre-Build Verification Checklist

Before writing any code, run these manual checks (5-10 minutes total):

1. **Kalshi:** Log into kalshi.com → Settings → API → generate a key pair. Hit
   `GET https://trading-api.kalshi.com/trade-api/v2/markets?limit=5` with your key.
   Confirm it returns basketball markets.

2. **Polymarket:** From your machine, `curl https://gamma-api.polymarket.com/markets?limit=1`.
   If you get a 403 or empty response, drop Polymarket from the stack entirely.

3. **The Odds API:** Sign up for free tier at the-odds-api.com. Hit
   `GET /v4/sports/basketball_ncaab/odds?apiKey=YOUR_KEY&regions=us&markets=h2h&bookmakers=draftkings,fanduel`.
   Confirm DraftKings and FanDuel odds are returned.

4. **Underdog:** Visit app.underdogfantasy.com, open DevTools Network tab, navigate to
   March Madness pick'em. Observe the API calls. Determine if there's a stable endpoint
   worth reading (even if ToS prohibits it) or if manual entry is the pragmatic path.

5. **ESPN:** Hit
   `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`
   in your browser. Confirm it returns current tournament games.

6. **Push notifications:** Create a minimal test (`npx web-push generate-vapid-keys`, basic
   Express server, bare-bones SW) to confirm push works on your localhost setup before
   integrating.

---

## Sources

All findings based on training knowledge (cutoff August 2025). External verification tools
were unavailable during this research session. All claims marked LOW or MEDIUM confidence
**require independent verification** via the checklist above before implementation.

- Kalshi Trading API: trading-api.readme.io (known URL as of Aug 2025)
- Polymarket CLOB/Gamma APIs: polymarket.com/docs (known URL as of Aug 2025)
- The Odds API: the-odds-api.com/liveapi/guides/v4 (known URL as of Aug 2025)
- web-push npm package: npmjs.com/package/web-push
- vite-plugin-pwa: vite-pwa-org.netlify.app
- better-sqlite3: github.com/WiseLibs/better-sqlite3
