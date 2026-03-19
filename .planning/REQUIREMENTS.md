# Requirements: March Madness Value Bet Finder

**Defined:** 2026-03-19
**Core Value:** Surface games where Underdog's lines differ from the market consensus so the user can place value bets on Underdog before the line corrects.

## v1 Requirements

### Data Sources

- [ ] **DATA-01**: App fetches Kalshi API for active March Madness game-winner markets (moneyline/winner)
- [ ] **DATA-02**: App fetches Polymarket API for active March Madness game-winner markets (moneyline/winner); gracefully skips if geo-blocked
- [ ] **DATA-03**: App scrapes ESPN odds page for March Madness spread and over/under lines
- [ ] **DATA-04**: User can manually enter Underdog's current lines (spread, O/U, moneyline) for any game via a form in the dashboard
- [ ] **DATA-05**: Each data fetch is timestamped; stale data (>2 hours old) is flagged visually

### Normalization

- [x] **NORM-01**: App converts all American odds to implied probability using standard formula
- [x] **NORM-02**: App removes vig from sportsbook-style implied probabilities before computing consensus (Kalshi/Polymarket prices used directly — already vig-free)
- [x] **NORM-03**: App computes consensus implied probability as simple average of available reference sources per market
- [x] **NORM-04**: App maintains a team name dictionary to match the same team across Kalshi, Polymarket, and ESPN naming conventions

### Discrepancy & EV

- [ ] **DISC-01**: For each game with Underdog data entered, app computes discrepancy between Underdog's line and the reference consensus (in points for spread/O-U; in probability % for winner)
- [ ] **DISC-02**: App computes Expected Value (EV) per bet: `EV = p_fair × (decimal_odds - 1) - (1 - p_fair)` where p_fair is the no-vig consensus probability
- [ ] **DISC-03**: App classifies discrepancy severity: low (< configurable threshold), medium, high

### Dashboard

- [ ] **DASH-01**: Dashboard shows all active March Madness games with their Underdog lines and reference consensus
- [ ] **DASH-02**: Games are sorted by discrepancy size by default (largest gap first)
- [ ] **DASH-03**: Each game card shows: teams, game time, bet type, Underdog line, consensus line, discrepancy delta, EV
- [ ] **DASH-04**: Color coding applied by severity — green (high value), yellow (moderate), gray (no significant gap)
- [ ] **DASH-05**: User can filter games by bet type (spread / over-under / winner)
- [ ] **DASH-06**: Manual refresh button triggers re-fetch of all reference sources
- [ ] **DASH-07**: User can configure the discrepancy threshold that determines "significant" (stored in localStorage)

## v2 Requirements

### Automation

- **AUTO-01**: Scheduled hourly background polling with push/browser notifications on new discrepancies
- **AUTO-02**: Underdog odds fetched automatically if they ever expose an API or unofficial endpoint

### History & Tracking

- **HIST-01**: Bet tracking — user marks which opportunities they acted on
- **HIST-02**: Line movement history — show how Underdog's line has moved vs. consensus over time
- **HIST-03**: P&L tracking — record outcomes and calculate ROI

### Sources

- **SRC-01**: The Odds API integration (DraftKings + FanDuel) for paid sportsbook consensus
- **SRC-02**: Additional sportsbooks via The Odds API (BetMGM, Caesars) for broader consensus

## Out of Scope

| Feature | Reason |
|---------|--------|
| Betting on Kalshi, Polymarket, or any other platform | User can only bet on Underdog |
| Cross-platform arbitrage | Single-platform betting makes arb impossible |
| Mobile deployment / cloud hosting | Local-only tool |
| ML-based prediction models | Out of scope — this is an odds comparison tool, not a prediction engine |
| Underdog API scraping/automation | Risks account suspension; manual entry is safer for a live betting account |
| In-game / live odds | Pre-game lines only for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NORM-01 | Phase 1 | Complete |
| NORM-02 | Phase 1 | Complete |
| NORM-03 | Phase 1 | Complete |
| NORM-04 | Phase 1 | Complete |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| DISC-01 | Phase 2 | Pending |
| DISC-02 | Phase 2 | Pending |
| DISC-03 | Phase 2 | Pending |
| DATA-04 | Phase 3 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| DASH-05 | Phase 3 | Pending |
| DASH-06 | Phase 3 | Pending |
| DASH-07 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
