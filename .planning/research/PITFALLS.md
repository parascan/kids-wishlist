# Domain Pitfalls: Odds Aggregation + Value Betting Dashboard

**Domain:** Sports odds aggregation, prediction market normalization, value bet detection
**Researched:** 2026-03-19
**Confidence note:** WebSearch and WebFetch were unavailable during this research session. All findings are drawn from training data (cutoff August 2025). API-specific details (rate limits, endpoint paths) should be verified against current official documentation before implementation. Core mathematics and structural differences between market types are stable and HIGH confidence.

---

## Critical Pitfalls

These mistakes cause incorrect value signals, wasted development time, or broken data pipelines.

---

### Pitfall 1: Not Removing Vig Before Comparing Lines

**What goes wrong:** You compare Underdog's raw American odds directly to another sportsbook's raw American odds, or to a prediction market percentage, without first removing the house edge (vig/overround). Every sportsbook embeds a margin into their lines. A -110/-110 two-way market implies ~52.4% for each side — summing to 104.8%, not 100%. If you skip vig removal, you're comparing apples to oranges: Underdog's 4.8% margin is baked into their numbers, DraftKings' margin is baked into theirs, and Kalshi's spread is different again. The "discrepancy" you detect is largely just different vig levels, not genuine mispricing.

**Why it happens:** Developers new to sports betting treat odds as direct probability statements. They are not — they are probability plus margin.

**Consequences:** Nearly every alert is a false positive. The dashboard becomes noise. You lose trust in the tool before it can find real value.

**Prevention:**
- Always convert American odds to implied probability first: positive odds `+X` → `100 / (X + 100)`; negative odds `-X` → `X / (X + 100)`.
- Then apply vig removal (also called "no-vig" or "fair odds" conversion) before computing consensus. The standard method for a two-outcome market is the Shin method or simple additive normalization: divide each side's raw probability by the total overround, so the two sides sum to exactly 1.0.
- Example: -110/-110 → raw probs 0.5238 + 0.5238 = 1.0476 overround → no-vig probs 0.5238/1.0476 = 0.500 each.
- For three-outcome markets (e.g., spread with a push), normalize all three outcomes.

**Detection:** If your consensus line shows a favorite at >55% implied probability and an underdog at >45% on every game, your vig removal is working. If sides routinely sum to >105% in your consensus, you haven't removed vig.

**Phase:** Address in Phase 1 (data normalization layer). Every downstream calculation depends on correct vig removal.

---

### Pitfall 2: Treating Prediction Market Prices as Fair-Odds Probabilities

**What goes wrong:** Kalshi and Polymarket express prices as cents on the dollar (0–100 or 0.00–1.00). A contract at 62 cents means 62% implied probability — but only if you ignore the bid/ask spread and the platform's own margin. Prediction markets are two-sided order books; the "price" you see is the last traded price or mid-market, which may be stale or wide. Taking the last price as a clean probability and then comparing it directly to a sportsbook's vig-adjusted line produces misleading discrepancies.

**Why it happens:** Prediction market prices look like probabilities, so developers assume they are ready-to-use fair probabilities. They are not — they have their own spread and liquidity characteristics.

**Consequences:** Games with thin Kalshi/Polymarket liquidity generate spurious alerts because the market price drifted away from consensus without being updated.

**Prevention:**
- Use mid-market (average of best bid and best ask) rather than last traded price whenever the API provides order book data.
- Apply a liquidity filter: if the total open interest or volume on a prediction market contract is below a threshold (e.g., <$5,000 notional), down-weight that platform's contribution to consensus or exclude it entirely.
- Treat prediction market prices as directional signals, not precise probabilities. They are useful for detecting gross mispricing but not precise enough for tight thresholds.
- Weight consensus contributions by platform reliability: DraftKings/FanDuel have deeper liquidity and tighter lines for NCAA games than Kalshi/Polymarket.

**Detection:** If games have Kalshi prices that diverge from sportsbook consensus by >10 percentage points with no news reason, check the open interest. Thin markets drift.

**Phase:** Address in Phase 1 (data ingestion) and Phase 2 (consensus algorithm). The weighting/filtering logic belongs in Phase 2.

---

### Pitfall 3: Different Market Definitions for the Same Game

**What goes wrong:** "Duke -5.5" on DraftKings and "Duke -5.5" on Underdog sound like the same market, but the spread may be set at different times, against different openers, and the bet type may have subtle definitional differences (does the spread include overtime? Is the over/under on regulation only?). More critically, a Kalshi contract might be "Duke wins by 6 or more" (binary, discrete) while DraftKings has a continuous spread. These are structurally different instruments expressing a similar opinion, but they cannot be directly compared without explicit normalization.

**Why it happens:** Market names look similar. Developers assume same name = same thing.

**Consequences:** False discrepancy alerts on markets that are legitimately different products, not mispriced versions of the same product.

**Prevention:**
- For each platform, document the exact market definition during Phase 1: Does the spread include OT? What happens on a push? Is the O/U for full game or regulation?
- For prediction markets, identify whether a contract is binary (win/lose), spread-equivalent (wins by N+), or something else before including it in consensus.
- When in doubt, exclude a platform's data from consensus for a specific market type rather than force-fitting incompatible definitions.
- Keep a market-type registry: `{ platform, game_id, market_type, definition_notes }`.

**Detection:** If a specific market type (e.g., over/under) consistently shows large discrepancies for a single platform but not others, that platform likely uses a different definition.

**Phase:** Address in Phase 1 (data modeling). Define market types explicitly in the data schema before writing any comparison logic.

---

### Pitfall 4: Stale Data Triggering False Alerts

**What goes wrong:** You fetch data from Platform A at :00 and Platform B at :03. A line moves between those two fetches. Your comparison shows a discrepancy that doesn't actually exist at any single point in time — it's an artifact of the fetch offset. With hourly polling, a 3-minute offset between fetches can easily produce 1–2 point false discrepancies on a moving line.

**Why it happens:** Fetching multiple APIs sequentially rather than near-simultaneously, or caching data with different TTLs per platform.

**Consequences:** User chases a discrepancy that corrected itself before they can even check Underdog's app.

**Prevention:**
- Fetch all platforms in parallel (Promise.all in Node.js) to minimize the window between fetches.
- Stamp every data point with its fetch timestamp. Reject comparisons where the age gap between any two platforms' data exceeds a threshold (e.g., 5 minutes).
- Display the "as of" timestamp per platform on the dashboard. The user can see if one platform's data is older.
- For Underdog specifically (the actionable platform), prioritize its freshness. It's acceptable if ESPN is 10 minutes stale; it's not acceptable if Underdog is 10 minutes stale.

**Detection:** If the same game repeatedly shows a discrepancy that disappears on the next refresh, stale data is the likely cause.

**Phase:** Address in Phase 2 (polling and data freshness). Parallel fetching in Phase 1 setup.

---

### Pitfall 5: Ignoring Line Movement Direction in Alerts

**What goes wrong:** A line that was Duke -5 an hour ago and is now Duke -7 has "moved" 2 points. If Underdog is still at -5, that looks like a discrepancy. But this discrepancy is closing — the market is moving away from Underdog's line, meaning either: (a) sharp money just moved DraftKings, and Underdog will update shortly, or (b) Underdog is legitimately behind. Treating all discrepancies identically ignores whether the gap is opening (growing opportunity) or closing (fading opportunity).

**Why it happens:** Value bet detection is often built as a static snapshot comparison without a time dimension.

**Consequences:** User gets alerted on opportunities that are about to close, or misses opportunities that are opening.

**Prevention:**
- Store the previous poll's data alongside the current poll's data.
- On each refresh, compute delta: did the discrepancy grow or shrink since last check?
- Surface "opening" discrepancies (delta growing) more prominently than "closing" ones.
- A growing discrepancy means Underdog is increasingly favorable relative to consensus — stronger value signal.

**Detection:** If users are clicking alerts only to find Underdog has already updated their line, you need line movement tracking.

**Phase:** Address in Phase 3 (value signal enhancement). Basic detection works without this; movement tracking is an improvement layer.

---

### Pitfall 6: Kalshi API Authentication and Rate Limit Surprises

**What goes wrong:** Kalshi's trading API requires authentication even for read-only market data. The standard flow uses API key + secret to generate a signed request header (RSA or HMAC depending on API version). Developers who assume "read-only = no auth needed" (as with some public APIs) will hit 401 errors on all endpoints. Rate limits on the free/basic tier are meaningful — typically in the range of 10–30 requests/minute — and hitting them silently fails rather than returning an error the first time (the response comes back empty or stale from their CDN).

**Why it happens:** Auth requirement is not obvious from the market browsing UI. Rate limit behavior (silent empty response vs. 429) catches developers off guard.

**Consequences:** Kalshi data appears missing or empty. Debugging time lost chasing a data problem that's actually an auth or rate limit problem.

**Prevention (MEDIUM confidence — verify against current Kalshi docs):**
- Create a Kalshi account and generate API credentials before writing any integration code.
- Implement auth headers from day one, even for read-only polling.
- Add explicit rate limiting in your Node.js polling layer (e.g., p-limit or a simple token bucket). Do not rely on the API to throttle you gracefully.
- Log HTTP status codes on every fetch. If you see 200 with an empty body, check rate limits before assuming "no markets available."

**Detection:** Empty Kalshi data with 200 status codes during development. 401 on first request.

**Phase:** Address in Phase 1 (API integration). Auth setup must precede any data work.

---

### Pitfall 7: Polymarket Geographic and Regulatory Restrictions

**What goes wrong:** Polymarket blocks US IP addresses for trading. Their data API (CLOB API / Gamma API) is publicly accessible without auth for read-only market data — but the endpoints, rate limits, and available market data have changed multiple times. More critically, Polymarket markets for NCAA games may not exist, may use different team names, or may be structured as tournament-level markets ("Duke wins the tournament") rather than game-level markets ("Duke beats Kansas"). Trying to extract per-game probabilities from tournament futures is a different problem than reading per-game spreads.

**Why it happens:** Developers assume prediction markets mirror the game-by-game structure of sportsbooks. They don't — they often express longer-horizon or different-granularity questions.

**Consequences:** Polymarket is a poor direct substitute for per-game sportsbook lines. Trying to force-fit it produces misleading consensus inputs.

**Prevention (MEDIUM confidence — verify current Polymarket market availability):**
- Before relying on Polymarket as a consensus input, manually check whether per-game markets exist for early-round March Madness games (many first-round games will not have markets).
- Treat Polymarket as an optional/supplementary signal, not a required consensus component.
- Build the consensus algorithm to handle missing platform data gracefully: if Polymarket has no market for a given game, compute consensus from the available platforms only.
- The Gamma markets API (api.gamma.io) is more reliable for read-only market browsing than the CLOB trading API.

**Detection:** If Polymarket market count for March Madness games is <10% of total games, it's not reliable as a consensus component.

**Phase:** Address in Phase 1 (data source scoping). Resolve before committing to Polymarket as a required data source.

---

### Pitfall 8: The Odds API Quota Exhaustion During Tournament

**What goes wrong:** The Odds API charges per request by "usage" units (each bookmaker's odds for one game = 1 usage unit). With 4 bookmakers across 16 first-round games, a single fetch costs ~64 usage units. At hourly polling for a 4-day first-round weekend, that's ~6,000 units per weekend — plus the second weekend (Elite Eight/Final Four) runs in parallel. Free-tier plans (typically 500 units/month) will exhaust in the first day. Paid plans have limits too. Running out mid-tournament means losing all sportsbook reference data at the worst time.

**Why it happens:** Developers test with a small number of games and don't project tournament-scale usage.

**Consequences:** Data goes dark mid-tournament. No sportsbook reference data means no consensus, no alerts.

**Prevention (MEDIUM confidence — verify current The Odds API pricing):**
- Calculate your expected usage before subscribing: (bookmakers) x (active games) x (polls/day) x (days in round).
- Buy enough quota upfront. March Madness has 67 games across 3 weeks; plan for the opening weekend being highest volume (up to 16 simultaneous games).
- Cache aggressively server-side: if two browser tabs or two users hit the backend, serve from cache rather than re-fetching the API.
- Use the API's "snapshots" endpoint if available (fetches all sports/books at once with lower effective cost per sport).
- Implement a circuit breaker: if remaining quota drops below a threshold, switch to a longer polling interval automatically.

**Detection:** Monitor the `x-requests-remaining` response header on every call. Log it. Alert yourself (console or email) when it drops below 200.

**Phase:** Address in Phase 1 (API setup) and Phase 2 (polling infrastructure). Quota math should happen before writing integration code.

---

### Pitfall 9: Underdog Does Not Have a Public API

**What goes wrong:** Underdog Fantasy's odds (for their Pick'em / higher-lower / spread products) are not available through any official public API. The only options are: (a) their internal app API endpoints, discovered by proxying their mobile app traffic, or (b) manual data entry. Scraping their internal API violates their Terms of Service and risks account suspension — the account that the user intends to bet with. This is the highest-risk data integration in the entire project.

**Why it happens:** Developers assume "if I can see it in the app, I can fetch it programmatically." True technically, risky legally and practically.

**Consequences:** Underdog data acquisition is the hardest, most fragile part of the integration. It may require daily or per-session manual updates rather than automated polling.

**Prevention:**
- Before writing any Underdog integration, review Underdog's Terms of Service for scraping/automation prohibitions.
- Treat Underdog data acquisition as a potential manual step rather than assuming automation is feasible.
- Design the data model so Underdog odds can be entered manually (a simple form in the UI) and still flow through the full comparison pipeline.
- If automated fetching is attempted, use a separate non-betting account for development/testing, not the live betting account.
- Do not run automated requests from the same IP/session as a logged-in betting session.

**Detection:** If you are making requests to underdogfantasy.com endpoints with your real session cookie, you have already introduced risk. Stop and reassess.

**Phase:** Address in Phase 0 (pre-coding) — this is a go/no-go decision for automation. Phase 1 must include the manual fallback path regardless of what else is decided.

---

## Moderate Pitfalls

---

### Pitfall 10: Overround Asymmetry Between Market Types

**What goes wrong:** Sportsbooks have different vig levels for different bet types. Moneylines on heavy favorites carry much higher vig than spreads. A -300/+250 moneyline has ~6% overround; a -110/-110 spread has ~5%; a -130/-110 spread has ~3% on one side and ~7% on the other. If you apply uniform vig removal (e.g., always divide by 1.05) regardless of market type, your no-vig probabilities will be wrong for moneylines on lopsided games.

**Prevention:** Compute overround per-market from the actual odds, not from a fixed assumption. For each two-outcome market: overround = raw_prob_A + raw_prob_B. Divide each by the overround.

**Phase:** Phase 1 (math utilities). Unit-test the conversion functions before using them.

---

### Pitfall 11: Team Name Normalization Failures

**What goes wrong:** "UConn Huskies" on ESPN, "Connecticut" on Kalshi, "UCONN" on DraftKings, and "UConn" on Underdog are the same team. Your cross-platform matching logic fails silently when names don't match exactly — you get zero consensus data for that game rather than an error.

**Prevention:**
- Build a canonical team name dictionary for all 68 NCAA tournament teams before fetching any data. Map every known variant to a canonical ID.
- Log every unmatched team name as a warning — never silently drop an unmatched market.
- Test matching logic against actual API responses from each platform before building comparison logic.

**Phase:** Phase 1 (data modeling). Create the normalization dictionary before any cross-platform logic.

---

### Pitfall 12: Push Notifications Don't Work in Local Development

**What goes wrong:** The Web Push API requires HTTPS for `serviceWorker.register()` and `PushManager.subscribe()`. On `localhost`, most browsers grant an exception and allow HTTP. However: (1) the VAPID key setup requires a working push service that can reach your local server, which means the push notification will never actually be delivered to a remote subscriber, and (2) if the frontend is served from `http://localhost:3000` but the service worker is registered on a different port, scope mismatches cause silent failures.

**Prevention:**
- For local development, use a simpler notification strategy: the Web Notifications API (not push, just in-tab notifications via `new Notification(...)` after the user grants permission). This does not require HTTPS, does not require a service worker for basic use, and works fine for a single-machine local tool.
- Full PWA push (background, even when app is closed) requires a running push server, VAPID keys, and a service worker — overkill for a local tool you use while sitting at your computer.
- Reserve full push implementation for if/when the app becomes remotely accessible.

**Detection:** `PushManager.subscribe()` throws `NotSupportedError` or `InvalidStateError` on HTTP in stricter browsers.

**Phase:** Address in Phase 3 (notifications). Use in-tab Notification API for MVP; document full push as a deferred enhancement.

---

### Pitfall 13: Consensus Algorithm Doesn't Handle Missing Platform Data

**What goes wrong:** You write the consensus computation assuming all four platforms always have data for every game. In reality: Kalshi may have no market for 60-seed vs. 7-seed first-round games; Polymarket may have no per-game markets at all; ESPN's API may return games without odds during the pre-tournament period. If any missing value causes the consensus calculation to return NaN or throw, the entire dashboard breaks.

**Prevention:**
- Implement consensus as a weighted average that skips platforms with missing data. Never divide by zero — track "platforms contributing" per game.
- If only one platform has data for a game, show the game with a low-confidence flag rather than hiding it or throwing.
- Define minimum quorum: e.g., "require at least 2 platforms to compute consensus; show 'insufficient data' otherwise."

**Phase:** Phase 2 (consensus algorithm). This is a correctness requirement, not an enhancement.

---

### Pitfall 14: Confusing Spread, Moneyline, and Totals as Interchangeable Value Signals

**What goes wrong:** A discrepancy in Underdog's spread does not imply a discrepancy in their moneyline or totals. These are separate markets with separate pricing. Detecting a large spread discrepancy and surfacing the game prominently is correct — but implying the user should bet the moneyline based on a spread discrepancy is a logical error.

**Prevention:**
- Track discrepancies per market type, not per game. A game can have value on the spread and be fairly priced on the total.
- Dashboard should show market-level discrepancies, not game-level aggregates that smear across bet types.
- Underdog's product offerings differ from traditional sportsbooks — confirm which bet types (higher/lower, spread, moneyline) they offer for NCAA games, and only compare the types that are actionable.

**Phase:** Phase 1 (data modeling) — enforce market-type separation in schema.

---

## Minor Pitfalls

---

### Pitfall 15: Time Zone Handling for Game Times

**What goes wrong:** March Madness games span multiple time zones (East/Midwest venues). API timestamps may be UTC, local venue time, or ET. Displaying the wrong tip-off time causes user confusion about which game is "live soon."

**Prevention:** Normalize all game times to UTC on ingest; display in the user's local time via the browser's Intl API.

**Phase:** Phase 1 (data normalization). Low effort, high annoyance if skipped.

---

### Pitfall 16: Duplicate Game Detection Across APIs

**What goes wrong:** The Odds API, ESPN, and Kalshi may each provide a game as a slightly different event ID, different scheduled time (ESPN may list a 12:15 PM game that The Odds API lists as 12:10 PM due to rounding). Naively matching on exact time + team fails; you end up with the same game appearing 2–3 times in your data with different platform data attached to different copies.

**Prevention:** Match games by canonical team names only (not time). Time can differ by 5–15 minutes across sources. Use team pair as the primary deduplication key.

**Phase:** Phase 1 (data normalization). Build a game matching function that uses canonical team IDs, not timestamps.

---

### Pitfall 17: ESPN API Is Unofficial and Can Break

**What goes wrong:** ESPN's publicly used endpoints (e.g., `site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`) are unofficial/undocumented. They have changed or broken before major events without warning.

**Prevention:** Treat ESPN as an optional, supplementary data source. If ESPN data is unavailable, degrade gracefully — don't block consensus computation. The Odds API already aggregates DraftKings/FanDuel; ESPN is redundant for odds specifically (it's more useful for game schedules and scores).

**Phase:** Phase 1 (data source implementation). Build ESPN adapter last; mark it as non-critical for consensus.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Data schema design | Market definition mismatches (Pitfall 3) | Establish canonical market types + team IDs before any API code |
| Kalshi integration | Auth/rate limit surprises (Pitfall 6) | Read current docs, implement auth and rate limiting from the start |
| Polymarket integration | Missing per-game markets (Pitfall 7) | Audit available markets before treating as required data source |
| Underdog integration | No public API, TOS risk (Pitfall 9) | Decide automation vs. manual before writing any code |
| The Odds API setup | Quota exhaustion (Pitfall 8) | Calculate usage, buy sufficient quota, implement caching |
| Probability conversion | Vig not removed (Pitfall 1) | Unit-test vig removal math before building consensus |
| Consensus algorithm | Missing platform data crashes (Pitfall 13) | Weighted average with explicit null handling |
| Consensus algorithm | Prediction market prices not normalized (Pitfall 2) | Mid-market + liquidity filter before including in consensus |
| Discrepancy detection | Stale data false positives (Pitfall 4) | Parallel fetches + timestamp staleness check |
| Notifications (Phase 3) | Push API requires HTTPS (Pitfall 12) | Use in-tab Notification API for local dev |
| Line movement | Static snapshot misses opening vs. closing (Pitfall 5) | Store previous poll, compute delta |

---

## Sources

All findings are from training data (knowledge cutoff August 2025). Confidence levels reflect that.

| Finding | Confidence | Note |
|---------|------------|------|
| American odds math, vig removal | HIGH | Stable mathematical domain |
| Prediction market price structure (bid/ask, liquidity) | HIGH | Stable market microstructure |
| Kalshi API requires auth for read-only | MEDIUM | Verify against current Kalshi docs — auth model may have changed |
| Kalshi rate limits (~10-30 req/min) | LOW | Verify current limits; these change with API versions |
| Polymarket per-game market availability | MEDIUM | Manually audit at time of build |
| Polymarket US IP restrictions for trading | HIGH | Stable regulatory posture, but data API access may differ |
| The Odds API quota structure (usage units per bookmaker) | MEDIUM | Pricing tiers change — verify current plan |
| Underdog no public API | HIGH | No official API existed as of August 2025 |
| Web Push API requires HTTPS | HIGH | Stable browser specification |
| ESPN undocumented API instability | MEDIUM | Pattern is well-established; specific endpoints change |
