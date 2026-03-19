# Roadmap: March Madness Value Bet Finder

## Overview

Three phases that build the tool from the inside out: first the odds math engine (pure functions, no APIs), then the data pipeline that feeds it (fetchers, normalizer, discrepancy computation, SQLite + Express), then the dashboard UI that surfaces value bets to the user (React frontend with manual Underdog entry, sorting, color coding, and threshold controls). Each phase is independently testable. The math works before any real API is called. The pipeline works before the UI exists. The UI displays real discrepancies on day one.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Odds Math Engine** - Pure normalization functions: American odds to implied probability, vig removal, consensus computation, team name dictionary (completed 2026-03-19)
- [ ] **Phase 2: Data Pipeline** - Backend fetchers (Kalshi, Polymarket, ESPN), SQLite persistence, discrepancy and EV computation, Express API server
- [ ] **Phase 3: Dashboard** - React frontend with Underdog manual entry, game list sorted by discrepancy, color coding, filters, refresh, threshold settings, stale-data flagging

## Phase Details

### Phase 1: Odds Math Engine
**Goal**: The odds normalization math is correct, tested, and ready to consume real API data
**Depends on**: Nothing (first phase)
**Requirements**: NORM-01, NORM-02, NORM-03, NORM-04
**Success Criteria** (what must be TRUE):
  1. Given American odds (+150, -110), the app converts them to correct implied probability using standard formulas
  2. Given a two-sided sportsbook market, vig is stripped so both sides sum to exactly 1.0 before consensus math
  3. Given implied probabilities from multiple reference sources, the app returns their simple average as the consensus
  4. Given any team name variant from Kalshi, Polymarket, or ESPN, the app resolves it to the same canonical team ID
**Plans:** 2/2 plans complete
Plans:
- [ ] 01-01-PLAN.md — Scaffold backend project, write failing tests for all 4 NORM requirements, seed team-map.json
- [ ] 01-02-PLAN.md — Implement odds, vig, consensus, and teams modules to make all tests pass

### Phase 2: Data Pipeline
**Goal**: The backend fetches live reference odds, normalizes them, computes discrepancies, stores results in SQLite, and serves them via Express API
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-05, DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):
  1. Starting the backend triggers an immediate poll of all reference sources (Kalshi, Polymarket if accessible, ESPN) and populates the database with normalized odds
  2. Each data record is timestamped, and any record older than 2 hours is marked stale in the API response
  3. GET /api/games returns all active March Madness games with their consensus line and discrepancy delta computed from reference sources
  4. For any game with Underdog data, the API response includes EV and discrepancy classified as low/medium/high
  5. A broken fetcher (e.g. Polymarket geo-blocked) does not prevent other sources from updating — each fetcher fails independently
**Plans**: TBD

### Phase 3: Dashboard
**Goal**: The user can open the dashboard, enter Underdog's lines, and immediately see which games represent value bets sorted by discrepancy size
**Depends on**: Phase 2
**Requirements**: DATA-04, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):
  1. User can type Underdog's spread, O/U, and moneyline for any game into a form and save it — the game card immediately updates with discrepancy and EV
  2. All active March Madness games appear sorted by discrepancy size (largest gap first) by default
  3. Each game card shows teams, game time, bet type, Underdog line, consensus line, discrepancy delta, and EV
  4. Games are color-coded green (high value), yellow (moderate), or gray (no gap) based on discrepancy severity
  5. User can filter by bet type (spread / over-under / winner), click manual refresh to re-poll sources, and adjust the discrepancy threshold that defines "significant" — threshold persists across browser sessions
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Odds Math Engine | 2/2 | Complete   | 2026-03-19 |
| 2. Data Pipeline | 0/TBD | Not started | - |
| 3. Dashboard | 0/TBD | Not started | - |
