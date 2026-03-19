# March Madness Value Bet Finder

## What This Is

A local web app that pulls March Madness odds from multiple reference markets (Kalshi, Polymarket, DraftKings/FanDuel, ESPN) to build a consensus line, then compares that consensus against Underdog's current lines. Where Underdog differs meaningfully from the consensus, that's a potential value bet. The user bets exclusively on Underdog — all other platforms are reference-only.

## Core Value

Surface games where Underdog's lines (spread, over/under, winner) are off from the market consensus, so the user can place value bets on Underdog before the line corrects.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Pull odds from Underdog for all active March Madness 2026 games (spread, O/U, moneyline/winner)
- [ ] Pull reference odds from Kalshi, Polymarket, DraftKings/FanDuel, and ESPN
- [ ] Compute consensus line from reference platforms
- [ ] Compare Underdog line vs. consensus, compute discrepancy
- [ ] Dashboard shows all active games sorted by discrepancy size
- [ ] Highlight games where Underdog's line differs meaningfully from consensus
- [ ] User-configurable discrepancy threshold (what counts as "meaningful")
- [ ] Hourly auto-refresh of all data
- [ ] PWA push notifications when a new high-discrepancy game is detected
- [ ] Show discrepancy direction (which way Underdog is off — favorable or unfavorable)

### Out of Scope

- Betting on any platform other than Underdog — user can only place bets on Underdog
- True cross-platform arbitrage — not possible with single-platform access
- Historical bet tracking / P&L — v2 feature
- Live in-game odds — pre-game lines only for now

## Context

- March Madness 2026 is the target tournament
- User has an account on Underdog only; other platforms are data sources, not betting venues
- "Value bet" = Underdog's line is more favorable than what the consensus says is fair
- Platforms differ in how they express odds: prediction markets (Kalshi, Polymarket) use probability %; sportsbooks (DraftKings, FanDuel, Underdog) use American odds and spreads. Normalization is required.
- Runs locally — no deployment needed, accessed via browser on the same machine

## Constraints

- **Platform**: Local only — Node.js backend + React frontend, no cloud deployment
- **Betting**: Underdog is the only actionable platform; others are reference only
- **APIs**: Some platforms (DraftKings, FanDuel, Underdog) may not have public APIs — may need The Odds API aggregator or scraping
- **Tournament window**: March Madness runs ~3 weeks; this is a time-boxed tool

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Reference-only for non-Underdog platforms | User can't bet there, so no arb — pure value finding | — Pending |
| Local deployment | Simplest path, no infra needed | — Pending |
| Hourly refresh | Balance between freshness and API rate limits | — Pending |

---
*Last updated: 2026-03-19 after initialization*
