---
phase: 01-odds-math-engine
plan: 02
subsystem: api
tags: [typescript, vitest, tdd, sports-odds, vig-removal, team-resolution, pure-functions]

# Dependency graph
requires:
  - phase: 01-odds-math-engine
    plan: 01
    provides: "TDD RED test suite for all 4 math modules + team-map.json"
provides:
  - americanToImplied and impliedToAmerican functions (NORM-01)
  - removeVig with TwoSidedMarket/NoVigMarket types (NORM-02)
  - simpleConsensus function (NORM-03)
  - resolveTeam function backed by 68-team JSON dictionary (NORM-04)
  - Barrel index.ts re-exporting all public functions and types
affects: [02-data-fetchers, 03-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure function modules — all math modules are stateless, zero runtime dependencies
    - Barrel export pattern — index.ts exposes full math API via single import path
    - Multiplicative vig normalization — fairA/fairB always sum to exactly 1.0
    - Null-return contract — resolveTeam returns null (not throw) for unknown teams

key-files:
  created:
    - backend/src/math/odds.ts
    - backend/src/math/vig.ts
    - backend/src/math/consensus.ts
    - backend/src/math/teams.ts
    - backend/src/math/index.ts
  modified: []

key-decisions:
  - "Simple JSON import without `with { type: 'json' }` assertion — tsconfig resolveJsonModule:true handles it cleanly"
  - "resolveTeam returns null (not throw) for unknown team names — caller decides how to handle gaps"
  - "No runtime dependencies added — all math is pure TypeScript, zero external packages"

patterns-established:
  - "Pattern 5: Barrel index.ts — consumers import all math from backend/src/math/index.ts"
  - "Pattern 6: null-return contract for dictionary lookups — undefined keys return null, never throw"

requirements-completed: [NORM-01, NORM-02, NORM-03, NORM-04]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 01 Plan 02: Odds Math Engine Implementation Summary

**Four pure-function TypeScript modules (americanToImplied, removeVig, simpleConsensus, resolveTeam) turning 31 TDD RED tests GREEN with zero runtime dependencies.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T23:48:59Z
- **Completed:** 2026-03-19T23:51:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- odds.ts: American odds to/from implied probability with RangeError on 0, round-trip verified
- vig.ts: multiplicative normalization strips vig from two-sided markets; fairA + fairB == 1.0 invariant holds for all test inputs
- consensus.ts: simple average over variable-length array; throws on empty input
- teams.ts: resolves 68 March Madness team name variants to canonical slug IDs via JSON dictionary
- index.ts barrel re-exports all public functions and types from a single import path

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement odds.ts and vig.ts** - `dd9a3ed` (feat)
2. **Task 2: Implement consensus.ts, teams.ts, and index.ts barrel** - `b6f9f33` (feat)

## Files Created/Modified
- `backend/src/math/odds.ts` - americanToImplied + impliedToAmerican, RangeError on odds===0
- `backend/src/math/vig.ts` - removeVig with TwoSidedMarket/NoVigMarket interfaces
- `backend/src/math/consensus.ts` - simpleConsensus, throws on empty array
- `backend/src/math/teams.ts` - resolveTeam via team-map.json dictionary lookup
- `backend/src/math/index.ts` - barrel re-export of all functions and types

## Decisions Made
- Used plain `import teamMap from '../data/team-map.json'` (no `with { type: 'json' }` assertion) — tsconfig's `resolveJsonModule: true` handles it cleanly without the newer import assertion syntax
- resolveTeam returns `null` rather than throwing for unknown names — Phase 2 data fetchers will encounter unknown team names during live API integration and need to handle gaps gracefully without crashing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TDD GREEN phase complete: all 31 tests pass across odds, vig, consensus, and teams modules
- Phase 2 data fetchers can import from `backend/src/math/index.ts` to consume the full odds math engine
- Known gap: team-map.json variants may not match exact strings returned by live Kalshi/Polymarket/ESPN APIs — null returns from resolveTeam() will surface naturally during Phase 2 integration testing

---
*Phase: 01-odds-math-engine*
*Completed: 2026-03-19*

## Self-Check: PASSED

All 5 math source files verified present. Both task commits confirmed in git log (dd9a3ed, b6f9f33). Full test suite: 31 tests pass.
