# Feature Landscape: March Madness Value Bet Finder

**Domain:** Sports odds comparison / value betting dashboard
**Researched:** 2026-03-19
**Note on sources:** WebSearch and Bash tools were unavailable in this session. All findings are drawn from
training knowledge of the sports betting domain (implied probability math, EV formulas, odds comparison
tooling patterns). The mathematics here is textbook and HIGH confidence. Product/UX patterns are MEDIUM
confidence based on known tools (OddsShark, ActionNetwork, BetMGM, Sharp Sports). Flag anything that
needs live-source verification.

---

## Table Stakes

Features the tool is useless without. If any of these are missing, the user can't do their job.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Odds normalization to implied probability | All comparisons require a common unit; American odds and % are not directly comparable | Low | Well-defined math — see Odds Math section |
| Vig removal before consensus | Raw implied probs from a sportsbook sum to >100% (the vig). Must strip vig before treating as fair probability | Low-Med | Multiplicative normalization is standard; see math section |
| Per-game discrepancy score | The core output — "Underdog is X points/% off consensus on this game" | Low | Simple delta after normalization |
| Sort by discrepancy descending | User needs to see biggest value opportunities first | Low | Default sort order |
| Bet direction label | Is Underdog's line favorable (you gain edge) or unfavorable (avoid)? | Low | +/- sign plus a "FAVOR/AVOID" label |
| Three market types displayed | Spread, Over/Under, Moneyline — all three are in scope per PROJECT.md | Med | Each type needs its own normalization logic |
| Game list with team names + tip-off time | Context for every row — no raw IDs | Low | |
| Manual refresh button | User should be able to force a data pull on demand, not just wait for hourly cron | Low | |
| Discrepancy threshold filter | User-configurable cutoff: "only show me games where the gap is ≥ X%" | Low | PROJECT.md explicitly calls this out |

---

## Odds Math Reference

This section documents the math so implementation is unambiguous.

### 1. American Odds → Implied Probability

```
Positive moneyline (underdog):  p = 100 / (odds + 100)
Negative moneyline (favorite):  p = |odds| / (|odds| + 100)

Examples:
  +150  →  100 / 250  = 0.400  (40%)
  -200  →  200 / 300  = 0.667  (66.7%)
```

**Confidence: HIGH** — This is textbook, not platform-specific.

### 2. Vig Removal (Sharp/No-Vig Fair Odds)

A sportsbook's two-sided market has implied probabilities that sum to >100% — the excess is the vig (juice).
To get the fair (no-vig) probability, normalize by the total:

```
raw_p_side_A = implied_prob(odds_A)
raw_p_side_B = implied_prob(odds_B)
total         = raw_p_side_A + raw_p_side_B   // e.g. 1.045 for a 4.5% vig book

fair_p_A = raw_p_side_A / total
fair_p_B = raw_p_side_B / total
// fair_p_A + fair_p_B == 1.000 exactly
```

**Why this matters:** DraftKings and FanDuel carry ~4–6% vig. If you don't remove it before consensus-
averaging, you'll systematically understate the probability of both sides and the consensus will be biased.

**Confidence: HIGH** — Industry standard; used by every sharp tool (Pinnacle converter, Action Network).

### 3. Prediction Market Implied Probability

Kalshi and Polymarket already trade as probability percentages (e.g., "Team A wins at 62 cents = 62%").
These are already vig-adjusted (the market's bid-ask spread is the "juice," but midpoint is fair).

```
fair_p = market_price_cents / 100
```

Use the last-trade price or mid of bid/ask. No vig removal needed beyond taking the midpoint.

**Confidence: MEDIUM** — Polymarket/Kalshi mid-market prices are generally considered sharp, but liquidity
varies on smaller matchups. Flag: verify that March Madness first-round games have sufficient liquidity on
both platforms.

### 4. Spread → Win Probability Conversion

Spread is not a probability — it's a points handicap. There is no universal conversion without team-specific
data (pace, efficiency). For a consensus-vs-Underdog comparison on spread, compare the spread number directly
in points rather than converting to probability.

```
discrepancy_spread = underdog_spread - consensus_spread_average
```

Example: if consensus says -3.5 and Underdog says -2, Underdog is giving 1.5 fewer points on the favorite —
that's a favorable line for betting the underdog (+2 vs. the consensus +3.5).

**Confidence: HIGH** — Spread deltas are more interpretable than spurious probability conversions.

### 5. Over/Under → Consensus

Same as spread: compare totals in points, not probability.

```
discrepancy_total = underdog_total - consensus_total_average
```

A positive delta means Underdog's total is higher than consensus (favors UNDER bettors).
A negative delta means Underdog's total is lower (favors OVER bettors).

**Confidence: HIGH**

### 6. Consensus Construction — Weighted Average

Simple average is reasonable for a first version. Weighted average is better if source quality is known.

**Simple (MVP):**
```
consensus_fair_p = mean(fair_p_source1, fair_p_source2, ..., fair_p_sourceN)
```

**Weighted (sharper):**
Assign weights reflecting market sharpness. A reasonable prior:
```
Pinnacle-equivalent (DraftKings sharp market):  weight 2
Kalshi/Polymarket (prediction market):          weight 2
ESPN (aggregated public lines):                 weight 1
FanDuel:                                        weight 1
```

Rationale: DraftKings and prediction markets are known to be sharper (more efficient). ESPN lines often lag
and reflect public money. But weight assignments are subjective — document them and make them configurable.

**Confidence: MEDIUM** — Weight values are a judgment call. The structure (weighted avg of no-vig probs)
is standard; the specific weights need validation against real March Madness line movement data.

### 7. Expected Value (EV)

EV quantifies how much you expect to win per unit bet, given your edge over the book.

```
// For a bet at American odds with your estimated fair probability p_fair:

If odds are positive (+X):
  EV = p_fair * (odds / 100) - (1 - p_fair) * 1

If odds are negative (-X):
  EV = p_fair * (100 / |odds|) - (1 - p_fair) * 1

// Convention: EV is per $1 wagered. EV > 0 means positive expected value.
```

Example: Underdog offers +130 on Team A. Consensus says Team A wins with 50% fair probability.
```
EV = 0.50 * (130/100) - 0.50 * 1
   = 0.65 - 0.50
   = +0.15   (15 cents per dollar bet = +15% EV)
```

**Confidence: HIGH** — Standard formula used across all professional betting literature.

### 8. Discrepancy Display

For moneyline/winner bets, show both:
- **Probability delta:** `consensus_fair_p - underdog_implied_p` (positive = Underdog is paying more than fair)
- **EV:** From formula above

For spread/total bets, show:
- **Points delta:** `underdog_line - consensus_line`
- **Direction label:** FAVOR (Underdog gives you better number) or AVOID

---

## Differentiators

Nice-to-have features that improve the experience but aren't blockers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Color-coded discrepancy intensity | Green gradient for favorable gaps, red for unfavorable — instant visual triage | Low | CSS hue rotation by EV magnitude |
| Per-source breakdown panel | Expandable row: show what each source says individually, not just the consensus | Low | Helps user sanity-check weird consensus values |
| Configurable source weights | Let user adjust how much each reference platform contributes to consensus | Med | Build the weighted avg system, expose sliders/inputs |
| Line movement indicator | Arrow showing which direction Underdog's line has moved since last refresh | Med | Requires storing previous snapshot in memory |
| "Last updated" timestamp per game | Freshness signal — some games update faster than others | Low | Store fetch timestamp with each record |
| Bet type filter (spread / O/U / ML) | Quickly focus on only the market type you care about for a given session | Low | Checkbox filter, not a hard tab |
| Game status indicator | "Tip-off in 2h", "In progress" (suppress), "Final" (archive) | Med | Requires game schedule data, not just odds |
| Minimum liquidity filter (prediction markets) | Hide lines where Kalshi/Polymarket volume is too thin to be meaningful | Med | Requires volume data from those APIs |
| Kelly Criterion stake size | Given EV and bankroll, suggest optimal bet size | Low | Formula: f = (bp - q) / b where b=decimal odds-1, p=fair_p, q=1-p |

---

## Anti-Features

Things to deliberately NOT build for a solo local tool. Each would add complexity without proportional
benefit for a single user during a 3-week tournament.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User accounts / authentication | No multi-user need; it's local-only | Hardcode single user context; no login |
| Bet placement / Underdog API integration | Out of scope per PROJECT.md; Underdog may not have a public betting API anyway | User clicks through to Underdog manually |
| Historical odds database / line history charts | Interesting but non-actionable for in-the-moment value betting | Store only current snapshot + previous snapshot for line movement arrow |
| Arbitrage calculator | Arb requires placing bets on multiple platforms; user only bets Underdog | Focus purely on value vs. consensus, not cross-platform arb |
| ML/model-based win predictions | Adds huge complexity and doesn't leverage the actual signal (market consensus); would introduce model error | Trust markets; consensus IS the prediction |
| Email/SMS notifications | PWA push is sufficient; SMTP adds infra complexity | PWA push notifications per PROJECT.md |
| Database persistence (Postgres, etc.) | Overkill for one user, 3-week lifespan | In-memory Node.js store with JSON file backup for current + previous snapshot |
| Responsive mobile layout | This is a desktop-only local tool; user is making deliberate bets at a computer | Optimize for desktop viewport, don't waste time on mobile breakpoints |
| User-facing documentation / help system | Solo user built the tool; they know how it works | README is sufficient |
| Configurable refresh interval | Hourly is the right default; sub-minute would hit rate limits; config adds UI noise | Hard-code 60 min with a manual override button |

---

## Feature Dependencies

```
Odds normalization (vig removal)
  └── Consensus construction (weighted avg of fair probs)
        └── Discrepancy score (consensus vs. Underdog)
              └── EV calculation (discrepancy × odds payout)
                    └── Color coding (EV magnitude → hue)
                    └── Sort by discrepancy
                    └── Threshold filter

Game schedule / tip-off time
  └── Game status indicator (in-progress suppression)
  └── "Tip-off in Xh" display

Previous snapshot storage
  └── Line movement indicator
```

---

## MVP Recommendation

Prioritize in this order:

1. Odds normalization + vig removal — foundational; nothing else works without it
2. Consensus construction (simple average first, weighted in v1.1) — the core algorithm
3. Discrepancy score + direction label — the core output
4. EV display — converts discrepancy into a decision-ready number
5. Sort by discrepancy descending + threshold filter — usability, prevents noise
6. Color coding (green/red by EV) — instant visual triage, low effort
7. Manual refresh button — operational necessity
8. Per-source breakdown (expandable row) — trust-building, low complexity

Defer to v1.1:
- Weighted source configuration (build simple avg first; validate weights are worth the complexity)
- Line movement indicator (requires snapshot storage, adds state management)
- Game status filtering (requires schedule data beyond odds feed)
- Kelly Criterion display (useful but not core decision-making)

---

## Sources

- Odds-to-probability math: textbook formula, same as Pinnacle's official "Understanding Odds" documentation
  and Action Network's published methodology. **Confidence: HIGH**
- Vig removal method: multiplicative normalization is industry standard across sharp tooling (Pinnacle converter,
  Closing Line Value literature). **Confidence: HIGH**
- EV formula: standard in Kelly/Thorp betting literature; same formula used by Bet Labs, Pikkit, Unabated.
  **Confidence: HIGH**
- Consensus weighting rationale: judgment call based on market efficiency literature (prediction markets vs.
  public sportsbooks). Specific weights are **LOW confidence** — treat as starting hypothesis, validate with
  real data.
- UX patterns (color coding, sort order, per-source breakdown): based on known tools including OddsShark,
  ActionNetwork, and Sharp Sports dashboards. **MEDIUM confidence** — could not verify live during this session.
