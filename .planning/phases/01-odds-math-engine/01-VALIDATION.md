---
phase: 1
slug: odds-math-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `backend/vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `npm --prefix backend run test -- --reporter=verbose` |
| **Full suite command** | `npm --prefix backend run test` |
| **Estimated runtime** | ~2 seconds (pure functions, no I/O) |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix backend run test -- --reporter=verbose`
- **After every plan wave:** Run `npm --prefix backend run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | — | scaffold | `ls backend/package.json` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | NORM-01 | unit | `npm --prefix backend run test -- odds.test` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | NORM-02 | unit | `npm --prefix backend run test -- vig.test` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | NORM-03 | unit | `npm --prefix backend run test -- consensus.test` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | NORM-04 | unit | `npm --prefix backend run test -- teams.test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/package.json` — Node project with vitest, typescript, @types/node
- [ ] `backend/tsconfig.json` — strict mode, ESM output
- [ ] `backend/vitest.config.ts` — minimal config
- [ ] `backend/src/math/odds.test.ts` — stubs for NORM-01 (American odds conversion)
- [ ] `backend/src/math/vig.test.ts` — stubs for NORM-02 (vig removal)
- [ ] `backend/src/math/consensus.test.ts` — stubs for NORM-03 (consensus average)
- [ ] `backend/src/teams/teams.test.ts` — stubs for NORM-04 (team name resolution)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Team map covers all 68 March Madness 2026 teams | NORM-04 | Team names not knowable until bracket is set | Verify `team-map.json` has entries for all 68 teams once bracket is announced |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
