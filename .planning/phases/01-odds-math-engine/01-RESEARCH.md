# Phase 1: Odds Math Engine - Research

**Researched:** 2026-03-19
**Domain:** Sports odds normalization, TypeScript utility library, unit testing
**Confidence:** HIGH (math is textbook; tooling is standard Node/TypeScript)

---

## Summary

Phase 1 builds the pure-math foundation that every other phase depends on. It has no external API calls, no database, and no UI — just a set of deterministic TypeScript functions that convert odds formats, strip vig, compute consensus, and resolve team names. Because the domain is arithmetic, not infrastructure, the risk profile is very low. The formulas are industry-standard with no meaningful controversy.

The right structure is a standalone `backend/src/math/` module (or `backend/src/normalizer/`) with one file per concern: `odds.ts`, `vig.ts`, `consensus.ts`, `teams.ts`. Every exported function must be pure (no I/O, no state), making them trivially testable. Vitest is the correct test runner — it runs TypeScript natively via esbuild with zero configuration overhead, which is ideal for a pure-function utility library in a Vite-adjacent project.

The team name dictionary (NORM-04) is the only judgment-call: a static JSON map is correct for Phase 1. The match set is bounded (64 teams × 3 sources), the tournament is 3 weeks, and the cost of getting it wrong is low — just add a mapping. Do not add fuzzy matching or normalization libraries in Phase 1. The planner should keep this as a data task, not an algorithm task.

**Primary recommendation:** Build `backend/src/math/` as four pure-function modules, tested with Vitest, exporting a clean interface for Phase 2's data fetchers to consume.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NORM-01 | App converts all American odds to implied probability using standard formula | Formula fully documented in FEATURES.md; positive/negative cases differ; see Code Examples |
| NORM-02 | App removes vig from sportsbook-style implied probabilities before computing consensus (Kalshi/Polymarket prices used directly) | Multiplicative normalization formula documented; Kalshi/Polymarket need no vig removal |
| NORM-03 | App computes consensus implied probability as simple average of available reference sources per market | Simple mean; must handle variable N (Polymarket may be absent); see Architecture Patterns |
| NORM-04 | App maintains a team name dictionary to match the same team across Kalshi, Polymarket, and ESPN naming conventions | Static JSON map is correct for Phase 1; 64-team bounded set; see Don't Hand-Roll |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Language | Type safety on odds math; catches unit mismatches (probability vs. American odds) at compile time; shared types with Phase 3 frontend |
| Node.js | 24.x (runtime) | Runtime | Already on machine; no dependency to add |
| Vitest | 4.1.0 | Test runner + assertions | Runs TypeScript natively; no ts-jest or Babel config; `vitest run` is zero-config for pure TS files |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.21.0 | TypeScript execution for scripts | Running one-off TS scripts during development; not needed at test time |
| @types/node | 25.5.0 | Node type definitions | Required for any Node built-ins; include from day one |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest 30 | Jest requires `ts-jest` transform config or Babel; Vitest runs TS natively. For a pure math module with no DOM, Vitest is strictly less setup. |
| Vitest | Node's built-in test runner | Node test runner lacks watch mode, coverage integration, and `expect` matchers. Vitest wins for DX. |
| Static JSON team map | `fuse.js` fuzzy matching | Fuzzy matching introduces false positives (e.g., "Duke" matching "Duke Blue Devils" sometimes and "Duke" another time). The team set is bounded and known — explicit mapping is safer and debuggable. |

**Installation:**
```bash
# From backend/ (or project root if monorepo not yet structured)
npm install -D typescript vitest @types/node tsx
```

**Version verification (run before writing package.json):**
```bash
npm view vitest version      # 4.1.0 confirmed 2026-03-19
npm view typescript version  # 5.9.3 confirmed 2026-03-19
npm view @types/node version # 25.5.0 confirmed 2026-03-19
npm view tsx version         # 4.21.0 confirmed 2026-03-19
```

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
  src/
    math/
      odds.ts          # NORM-01: American odds ↔ implied probability
      vig.ts           # NORM-02: vig removal (two-sided market normalization)
      consensus.ts     # NORM-03: simple average of fair probabilities
      teams.ts         # NORM-04: team name resolution to canonical ID
      index.ts         # re-exports all public functions
    data/
      team-map.json    # Static mapping: source-name → canonical team ID
  tests/
    math/
      odds.test.ts
      vig.test.ts
      consensus.test.ts
      teams.test.ts
  tsconfig.json
  vitest.config.ts
  package.json
```

The `math/` module has zero external dependencies. Phase 2 imports from `math/index.ts` — the interface is stable regardless of how the internals evolve.

### Pattern 1: Pure Function Exports

**What:** Every function in `math/` takes primitive inputs and returns primitive outputs. No classes, no state, no I/O.

**When to use:** Always for math utilities. Pure functions are trivially testable, composable, and have no hidden failure modes.

**Example:**
```typescript
// backend/src/math/odds.ts

/**
 * Converts American moneyline odds to implied probability.
 * Positive odds (underdog): +150, +300, etc.
 * Negative odds (favorite): -110, -200, etc.
 * Returns probability in [0, 1].
 */
export function americanToImplied(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    const abs = Math.abs(odds);
    return abs / (abs + 100);
  }
}

/**
 * Converts implied probability to American moneyline odds.
 * p must be in (0, 1) exclusive.
 */
export function impliedToAmerican(p: number): number {
  if (p >= 0.5) {
    return -(p / (1 - p)) * 100;
  } else {
    return ((1 - p) / p) * 100;
  }
}
```

### Pattern 2: Vig Removal via Multiplicative Normalization

**What:** Given raw implied probabilities from both sides of a two-sided sportsbook market, normalize so they sum to exactly 1.0.

**When to use:** For any odds sourced from DraftKings, FanDuel, or other traditional sportsbooks. Do NOT apply to Kalshi or Polymarket prices — those are already probability-denominated.

**Example:**
```typescript
// backend/src/math/vig.ts

export interface TwoSidedMarket {
  impliedA: number;  // raw implied probability, side A
  impliedB: number;  // raw implied probability, side B
}

export interface NoVigMarket {
  fairA: number;     // vig-removed fair probability, side A
  fairB: number;     // vig-removed fair probability, side B
  overround: number; // total before normalization (e.g. 1.045 = 4.5% vig)
}

/**
 * Removes vig from a two-sided market by multiplicative normalization.
 * fairA + fairB === 1.0 exactly.
 */
export function removeVig(market: TwoSidedMarket): NoVigMarket {
  const overround = market.impliedA + market.impliedB;
  return {
    fairA: market.impliedA / overround,
    fairB: market.impliedB / overround,
    overround,
  };
}
```

### Pattern 3: Consensus as Simple Average

**What:** Average the fair probabilities from N sources, where N may vary per game (Polymarket may be absent).

**When to use:** Always. Phase 1 ships simple average; weighted average is a v1.1 enhancement.

**Example:**
```typescript
// backend/src/consensus.ts

/**
 * Computes consensus fair probability as simple average.
 * Accepts variable-length array; handles N=1 (single source) gracefully.
 * Throws if sources is empty — consensus of zero is undefined.
 */
export function simpleConsensus(fairProbs: number[]): number {
  if (fairProbs.length === 0) {
    throw new Error('Cannot compute consensus: no source probabilities provided');
  }
  return fairProbs.reduce((sum, p) => sum + p, 0) / fairProbs.length;
}
```

### Pattern 4: Team Name Dictionary — Static JSON Map

**What:** A hardcoded JSON file mapping each known source-specific team name variant to a canonical team ID.

**When to use:** For NORM-04. The canonical ID is a stable slug (e.g., `duke-blue-devils`), not a number — human-readable IDs survive schema changes and are easier to debug.

**Example:**
```typescript
// backend/src/math/teams.ts
import teamMap from '../data/team-map.json';

// team-map.json structure:
// {
//   "Duke": "duke-blue-devils",
//   "Duke Blue Devils": "duke-blue-devils",
//   "DUKE": "duke-blue-devils",
//   "Kansas": "kansas-jayhawks",
//   "Kansas Jayhawks": "kansas-jayhawks",
//   ...
// }

/**
 * Resolves a source-specific team name to a canonical team ID.
 * Returns null if the team is not in the dictionary (caller decides how to handle).
 */
export function resolveTeam(sourceName: string): string | null {
  return (teamMap as Record<string, string>)[sourceName] ?? null;
}
```

### Anti-Patterns to Avoid

- **Float accumulation without tolerance:** Never assert `fairA + fairB === 1.0` using `===` in production code — floating-point arithmetic means the result is `0.9999999999999999` or `1.0000000000000002`. Use `Math.abs(sum - 1.0) < 1e-10` in assertions.
- **Assuming odds=0 is valid:** Odds of exactly 0 have no financial meaning. Treat as invalid input and throw.
- **Mixing probability units:** Kalshi/Polymarket return prices in [0,1] or sometimes [0,100] depending on the endpoint. Decide on one internal unit (use [0,1] throughout) and convert at the source boundary, not in the math layer.
- **Using `any` types for odds values:** Define a branded or union type (`type AmericanOdds = number` at minimum, or a branded type) so TypeScript catches callers passing probabilities where odds are expected.
- **Putting the team map in the math layer:** The map is data, not logic. It lives in `data/team-map.json`. The math layer imports it read-only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner | Custom test harness | Vitest | Writing test infrastructure is the most common Phase 1 time sink. Vitest's `expect` API is complete; no need to build assertion helpers. |
| Fuzzy team name matching | Levenshtein distance implementation | Static JSON map | Fuzzy matching introduces unpredictable false positives in a 64-team bounded set. Explicit mapping is always more debuggable. |
| Floating-point equality | Custom epsilon comparison function | `expect(x).toBeCloseTo(y, 10)` in Vitest | Vitest's `toBeCloseTo` handles decimal precision correctly. Use it in all probability assertions. |
| Probability validation | Schema validator | Simple guard clauses | `if (p < 0 || p > 1) throw new RangeError(...)` is 2 lines and zero dependencies. |

**Key insight:** The entire math engine can be written in four files with zero runtime dependencies. Any library added to the production bundle of this phase is probably wrong.

---

## Common Pitfalls

### Pitfall 1: The -100/+100 Boundary

**What goes wrong:** Odds of exactly -100 and +100 both mean 50% probability. The formulas handle them correctly, but callers sometimes pass 0 (thinking "even money") or omit the sign. `americanToImplied(0)` would return `100 / 100 = 1.0` (100% probability — wrong).

**Why it happens:** American odds convention is that -100 and +100 are equivalent even-money bets, but "0" is not a valid American odds value.

**How to avoid:** Guard at the top of `americanToImplied`: `if (odds === 0) throw new RangeError('American odds of 0 is not valid')`. Document that the function expects non-zero input.

**Warning signs:** Test case `americanToImplied(0)` returns a value instead of throwing.

### Pitfall 2: Single-Side Markets Breaking Vig Removal

**What goes wrong:** Caller only has odds for one side of a market (e.g., ESPN sometimes only publishes the favorite's spread, not both sides). Attempting `removeVig` with only one side produces nonsensical output.

**Why it happens:** Data fetchers in Phase 2 may not always return complete two-sided markets.

**How to avoid:** `removeVig` should require both sides (enforced by TypeScript via the `TwoSidedMarket` type). If Phase 2 fetches a single-sided market, it should either (a) not call `removeVig` and treat the single probability as the best available estimate, or (b) return `null` to indicate no vig-removal was possible. Document this contract in the function signature.

**Warning signs:** A single-sourced game being passed through vig removal without Phase 2 checking for completeness.

### Pitfall 3: Kalshi/Polymarket Prices Getting Double-Vig-Stripped

**What goes wrong:** Phase 2 applies `removeVig` to Kalshi or Polymarket prices, which are already fair probabilities. This incorrectly skews the consensus.

**Why it happens:** All sources go through the same pipeline; a missing conditional.

**How to avoid:** In the consensus pipeline (Phase 2), each source's data must be tagged with `source_type: 'sportsbook' | 'prediction_market'`. Only `'sportsbook'` sources go through `removeVig`. Kalshi and Polymarket prices pass through directly.

**Warning signs:** Consensus probability for a heavily-favored team comes out lower than either individual Kalshi or Polymarket price.

### Pitfall 4: Team Map Gaps During the Tournament

**What goes wrong:** A team's name on Kalshi uses "UConn" but the map only has "Connecticut Huskies". `resolveTeam` returns `null`, the game is silently dropped from consensus.

**Why it happens:** Team name variants are not knowable in advance without seeing real API responses.

**How to avoid:** Phase 2 should log every `null` return from `resolveTeam` as a warning. Build a gap-reporting mechanism early so the user sees "Could not resolve team: UConn" and can add it to the map in 5 seconds.

**Warning signs:** Consensus results for a game show fewer sources than expected.

### Pitfall 5: Floating-Point Precision in Probability Assertions

**What goes wrong:** `removeVig` produces `fairA + fairB = 0.9999999999999998` and an assertion `=== 1.0` fails.

**Why it happens:** IEEE 754 floating-point arithmetic.

**How to avoid:** In tests, always use `toBeCloseTo(expected, 10)` for probability assertions. In production, never check exact equality of floating-point values.

---

## Code Examples

Verified patterns from project FEATURES.md and standard sports betting math:

### American Odds to Implied Probability

```typescript
// Source: FEATURES.md §1, industry-standard formula
// Positive moneyline (underdog): p = 100 / (odds + 100)
// Negative moneyline (favorite): p = |odds| / (|odds| + 100)

americanToImplied(+150) // → 0.4000  (40.0%)
americanToImplied(-200) // → 0.6667  (66.7%)
americanToImplied(-110) // → 0.5238  (52.4%)
americanToImplied(+100) // → 0.5000  (50.0%)
americanToImplied(-100) // → 0.5000  (50.0%)
```

### Vig Removal — Typical Sportsbook Market

```typescript
// Source: FEATURES.md §2
// A standard -110 / -110 spread market (2-sided)
const sideA = americanToImplied(-110); // 0.52381
const sideB = americanToImplied(-110); // 0.52381
const overround = sideA + sideB;       // 1.04762 (4.76% vig)

// After removal:
// fairA = 0.52381 / 1.04762 = 0.50000
// fairB = 0.52381 / 1.04762 = 0.50000
// fairA + fairB = 1.00000 exactly (within float precision)
```

### Consensus from Three Sources

```typescript
// Source: FEATURES.md §6
// Kalshi: 0.62, DraftKings (no-vig): 0.60, FanDuel (no-vig): 0.61
simpleConsensus([0.62, 0.60, 0.61]) // → 0.6100

// With one source missing (Polymarket geo-blocked):
simpleConsensus([0.62, 0.60])       // → 0.6100 (still valid, N=2)
```

### EV Calculation (for Phase 2 reference — not implemented in Phase 1)

```typescript
// Source: FEATURES.md §7
// Underdog offers +130, consensus fair probability = 0.50
// EV = p_fair * (odds / 100) - (1 - p_fair) * 1    [positive odds case]
// EV = 0.50 * 1.30 - 0.50 * 1 = 0.65 - 0.50 = +0.15
// Documents the formula so Phase 2 can implement it consistently
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest with `ts-jest` transform | Vitest (native TS) | 2022-2023 | Zero transform config; faster cold start; same `expect` API |
| Manual tsconfig for Node | `@types/node` + `moduleResolution: bundler` | TS 5.x | Less boilerplate; better ESM/CJS interop |
| `require()` for JSON imports | `import teamMap from './team-map.json' assert { type: 'json' }` or `resolveJsonModule: true` | TS 4.1+ | Enable `resolveJsonModule: true` in tsconfig; no `fs.readFileSync` needed |

**Deprecated/outdated:**
- `ts-jest`: Still functional but adds config overhead; Vitest renders it unnecessary for new projects.
- `jasmine` / `mocha` + `chai`: Perfectly functional but no native TS; Vitest is the modern default.

---

## Open Questions

1. **Monorepo structure finalized?**
   - What we know: STACK.md describes `backend/` and `frontend/` at the root. Phase 1 creates `backend/src/math/`.
   - What's unclear: Whether `backend/` exists yet, whether there's a root `package.json`, and whether the Vite workspace setup is in place.
   - Recommendation: Phase 1 Wave 0 should create `backend/` with its own `package.json` and `tsconfig.json`. Do not couple to the existing `wishlist-app/` or `chore-app/` setups.

2. **Canonical team ID format**
   - What we know: 64 NCAA tournament teams, three sources (Kalshi, Polymarket, ESPN) with different name variants.
   - What's unclear: The exact name strings each source uses — these are only knowable from live API responses. The map will need to be populated incrementally as Phase 2 fetches real data.
   - Recommendation: Seed the map with common variants (full name, abbreviation, city nickname) for all 64 teams. Build a `logUnresolvedTeam()` helper that Phase 2 calls on `null` returns so gaps surface immediately.

3. **Spread and O/U lines: probability vs. points**
   - What we know: FEATURES.md §4-5 recommends comparing spread and O/U as raw point deltas, not converting to probability. This is correct for Phase 1 scope.
   - What's unclear: Phase 1 requirements (NORM-01 through NORM-04) are specifically about moneyline/winner probability normalization. Spread/O-U delta comparison is simpler and may not need a Phase 1 function at all.
   - Recommendation: Phase 1 should implement `americanToImplied` (NORM-01), `removeVig` (NORM-02), `simpleConsensus` (NORM-03), and `resolveTeam` (NORM-04). Spread/O-U delta functions (`spreadDelta`, `totalDelta`) are trivial one-liners that Phase 2 can add inline without a dedicated math function.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `backend/vitest.config.ts` (Wave 0 gap — does not exist yet) |
| Quick run command | `npm --prefix backend test -- --run` |
| Full suite command | `npm --prefix backend test -- --run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NORM-01 | American odds → implied probability | unit | `npm --prefix backend test -- --run tests/math/odds.test.ts` | Wave 0 gap |
| NORM-02 | Vig removal normalizes two-sided market to sum=1.0 | unit | `npm --prefix backend test -- --run tests/math/vig.test.ts` | Wave 0 gap |
| NORM-03 | Simple average of N probabilities (variable N) | unit | `npm --prefix backend test -- --run tests/math/consensus.test.ts` | Wave 0 gap |
| NORM-04 | Team name resolution to canonical ID | unit | `npm --prefix backend test -- --run tests/math/teams.test.ts` | Wave 0 gap |

### Specific Test Cases — Required Inputs and Expected Outputs

#### NORM-01: `americanToImplied(odds)`

| Input | Expected Output | Notes |
|-------|----------------|-------|
| `+150` | `0.4` (within 1e-10) | Standard underdog |
| `-200` | `0.6667` (within 1e-4) | Standard favorite |
| `-110` | `0.5238` (within 1e-4) | Typical spread line |
| `+100` | `0.5` (within 1e-10) | Even money, positive form |
| `-100` | `0.5` (within 1e-10) | Even money, negative form |
| `+300` | `0.25` (within 1e-10) | Big underdog |
| `0` | throws `RangeError` | Invalid input |
| `-10000` | `~0.9901` (within 1e-4) | Heavy favorite edge case |
| `+10000` | `~0.0099` (within 1e-4) | Heavy underdog edge case |

#### NORM-02: `removeVig(market)`

| Input (impliedA, impliedB) | Expected fairA | Expected fairB | Expected overround | Notes |
|---------------------------|----------------|----------------|-------------------|-------|
| (0.52381, 0.52381) | 0.5 | 0.5 | ~1.04762 | Standard -110/-110 spread |
| (0.6667, 0.4) | ~0.6250 | ~0.3750 | ~1.0667 | Asymmetric market |
| (0.5, 0.5) | 0.5 | 0.5 | 1.0 | No vig (theoretical) |
| fairA + fairB | 1.0 (within 1e-10) | — | — | Sum invariant, ALL inputs |

#### NORM-03: `simpleConsensus(fairProbs)`

| Input | Expected Output | Notes |
|-------|----------------|-------|
| `[0.62, 0.60, 0.61]` | `0.61` (within 1e-10) | Three sources |
| `[0.62, 0.60]` | `0.61` (within 1e-10) | Two sources (Polymarket absent) |
| `[0.60]` | `0.60` (within 1e-10) | Single source (valid) |
| `[]` | throws `Error` | Empty input — consensus undefined |
| `[0.0, 1.0]` | `0.5` (within 1e-10) | Boundary probabilities |

#### NORM-04: `resolveTeam(sourceName)`

| Input | Expected Output | Notes |
|-------|----------------|-------|
| `"Duke"` | `"duke-blue-devils"` | Short name |
| `"Duke Blue Devils"` | `"duke-blue-devils"` | Full name |
| `"DUKE"` | `"duke-blue-devils"` | All-caps variant |
| `"Kansas"` | `"kansas-jayhawks"` | Common abbreviation |
| `"Kansas Jayhawks"` | `"kansas-jayhawks"` | Full name |
| `"UConn"` | `"connecticut-huskies"` | Nickname form |
| `"Connecticut"` | `"connecticut-huskies"` | State name |
| `"UnknownTeamXYZ"` | `null` | Missing from map — returns null, does not throw |

### Sampling Rate

- **Per task commit:** `npm --prefix backend test -- --run`
- **Per wave merge:** `npm --prefix backend test -- --run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/package.json` — `"test": "vitest"` script, devDependencies: vitest, typescript, @types/node
- [ ] `backend/tsconfig.json` — `"resolveJsonModule": true`, `"moduleResolution": "bundler"`, `"strict": true`
- [ ] `backend/vitest.config.ts` — minimal config, points to `tests/` directory
- [ ] `backend/tests/math/odds.test.ts` — covers NORM-01 test cases above
- [ ] `backend/tests/math/vig.test.ts` — covers NORM-02 test cases above
- [ ] `backend/tests/math/consensus.test.ts` — covers NORM-03 test cases above
- [ ] `backend/tests/math/teams.test.ts` — covers NORM-04 test cases above
- [ ] `backend/src/data/team-map.json` — seeded with all 64 March Madness 2026 teams × 3 name variants minimum

---

## Sources

### Primary (HIGH confidence)

- `FEATURES.md` (project research) — §1 American odds formula, §2 vig removal formula, §6 consensus construction, §7 EV formula. All formulas are textbook with HIGH confidence per prior researcher.
- `STACK.md` (project research) — Recommended backend stack: Node 22.x, TypeScript 5.x, Express, SQLite. Node/TypeScript choices are HIGH confidence.
- npm registry (live query 2026-03-19) — Vitest 4.1.0, TypeScript 5.9.3, @types/node 25.5.0, tsx 4.21.0 confirmed current.

### Secondary (MEDIUM confidence)

- Vitest documentation (vitest.dev) — Native TypeScript support, zero-config for pure TS projects. Well-established as of 2026.
- Sports betting industry standard — The American odds → implied probability formula is the same across Pinnacle, Action Network, Unabated, and all practitioner sources. No meaningful disagreement exists in the literature.

### Tertiary (LOW confidence)

- None — all claims in this document are either textbook math (HIGH) or verified package versions (HIGH).

---

## Metadata

**Confidence breakdown:**
- NORM-01 formula: HIGH — textbook, zero ambiguity
- NORM-02 formula: HIGH — industry standard multiplicative normalization
- NORM-03 formula: HIGH — simple average is unambiguous
- NORM-04 structure: HIGH (static map is correct); LOW for specific team name variants (depends on live API responses)
- Vitest as test framework: HIGH — current, native TS, zero config overhead
- Package versions: HIGH — confirmed from npm registry 2026-03-19

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain — math does not change; package versions stable over 30 days)
