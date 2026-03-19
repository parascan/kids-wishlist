---
phase: 01-odds-math-engine
plan: 01
subsystem: testing
tags: [vitest, typescript, tdd, sports-odds, team-resolution]

# Dependency graph
requires: []
provides:
  - Backend project scaffold with TypeScript + Vitest configuration
  - TDD RED test suite for NORM-01 (americanToImplied, impliedToAmerican)
  - TDD RED test suite for NORM-02 (removeVig two-sided market normalization)
  - TDD RED test suite for NORM-03 (simpleConsensus variable-N average)
  - TDD RED test suite for NORM-04 (resolveTeam name dictionary lookup)
  - Static team-map.json seeded with 68 March Madness teams, 3+ variants each
affects: [01-02-odds-math-engine-implementation, 02-data-fetchers, 03-frontend]

# Tech tracking
tech-stack:
  added:
    - vitest 4.1.0 (test runner with native TypeScript support)
    - typescript 5.9.3 (strict mode, ESM, resolveJsonModule, bundler resolution)
    - "@types/node 25.5.0"
    - tsx 4.21.0 (TypeScript script executor)
  patterns:
    - TDD RED phase: all tests written before any source implementation
    - Pure function module structure: one file per concern in backend/src/math/
    - Static JSON team dictionary at backend/src/data/team-map.json
    - ESM-native Node project (type: module in package.json)

key-files:
  created:
    - backend/package.json
    - backend/tsconfig.json
    - backend/vitest.config.ts
    - backend/tests/math/odds.test.ts
    - backend/tests/math/vig.test.ts
    - backend/tests/math/consensus.test.ts
    - backend/tests/math/teams.test.ts
    - backend/src/data/team-map.json
  modified: []

key-decisions:
  - "Vitest over Jest: native TypeScript execution, zero transform config, same expect API"
  - "Static JSON team map over fuzzy matching: bounded 68-team set, explicit mapping is debuggable"
  - "backend/ as standalone package: isolated from wishlist-app/ and chore-app/ Vite projects"
  - "moduleResolution: bundler in tsconfig for clean ESM/CJS interop with Vitest"

patterns-established:
  - "Pattern 1: TDD RED first — all test contracts defined before any implementation"
  - "Pattern 2: Pure function modules — odds.ts, vig.ts, consensus.ts, teams.ts are zero-dependency"
  - "Pattern 3: toBeCloseTo for all probability assertions — avoids IEEE 754 false failures"
  - "Pattern 4: Canonical team IDs as slugs — duke-blue-devils format, human-readable, stable"

requirements-completed: [NORM-01, NORM-02, NORM-03, NORM-04]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 01 Plan 01: Odds Math Engine Scaffold Summary

**Backend project scaffolded with Vitest 4.1.0 + TypeScript, 27 failing test cases across 4 test files defining behavioral contracts for all odds math functions (NORM-01 through NORM-04), and team-map.json seeded with 68 March Madness teams.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T23:43:02Z
- **Completed:** 2026-03-19T23:46:06Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Backend project scaffolded at `backend/` (sibling to wishlist-app/, chore-app/) with correct ESM + TypeScript + Vitest configuration
- 27 failing test cases written for NORM-01 through NORM-04 — behavioral contracts locked before implementation
- team-map.json seeded with 68 March Madness teams at 324 lines (3+ name variants per team including full name, short name, ALL-CAPS, and nickname forms)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold backend project with TypeScript and Vitest** - `e38bd0b` (chore)
2. **Task 2: Write failing tests for NORM-01, NORM-02, NORM-03** - `f388340` (test)
3. **Task 3: Write failing tests for NORM-04 and seed team-map.json** - `3e90313` (test)

## Files Created/Modified
- `backend/package.json` - ESM Node project, vitest run script, devDependencies
- `backend/tsconfig.json` - Strict TypeScript, moduleResolution bundler, resolveJsonModule
- `backend/vitest.config.ts` - Vitest pointing to tests/**/*.test.ts
- `backend/package-lock.json` - 52 packages, 0 vulnerabilities
- `backend/tests/math/odds.test.ts` - 13 test cases for americanToImplied + impliedToAmerican (NORM-01)
- `backend/tests/math/vig.test.ts` - 4 test cases for removeVig (NORM-02)
- `backend/tests/math/consensus.test.ts` - 5 test cases for simpleConsensus (NORM-03)
- `backend/tests/math/teams.test.ts` - 9 test cases for resolveTeam (NORM-04)
- `backend/src/data/team-map.json` - 68 teams x 3+ variants = 324 lines of name mappings

## Decisions Made
- Vitest over Jest: native TypeScript execution, zero transform config overhead
- Static JSON team map over fuzzy matching (fuse.js): 68-team bounded set makes explicit mapping safer and more debuggable
- backend/ as its own standalone Node package, not coupled to existing Vite apps
- moduleResolution: "bundler" in tsconfig enables clean import of .js extensions in test files

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TDD RED phase complete: all 4 test files fail because source modules (src/math/odds.ts, vig.ts, consensus.ts, teams.ts) do not yet exist
- Plan 01-02 implements the source modules to turn these tests GREEN
- team-map.json has a known gap: exact team name strings from live Kalshi/Polymarket/ESPN APIs are unknowable until Phase 2 fetches real data — gaps will surface as null returns from resolveTeam() and should be logged/added incrementally

---
*Phase: 01-odds-math-engine*
*Completed: 2026-03-19*

## Self-Check: PASSED

All files verified present. All 3 task commits confirmed in git log (e38bd0b, f388340, 3e90313).
