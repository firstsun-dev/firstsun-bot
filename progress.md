# Session Progress Log

<!--
  CLEANUP CADENCE: this file tracks only what's still open. When a feature
  finishes, move its narrative to archive/YYYY-MM.md (current month) as a
  one-line entry (name + commit hash) and remove it from here. Once a
  decision under "Decisions Made" is no longer active context for open work
  (the feature it applied to is done, or it's been superseded), move it to
  the same archive file under a "## Decisions" heading — one line: the
  decision + why, no alternatives-considered narrative. Archive once this
  file passes ~80 lines — "What's Done" and "Decisions Made" are snapshots,
  not a permanent changelog.
-->

Completed work and settled decisions are archived in [archive/](./archive/), one file per calendar month — this file only tracks what's still open.

## Current State

**Last Updated:** 2026-07-22
**Session ID:** docs-requirements-spec
**Active Feature:** feat-001 - Project Setup (next)

## Status

### What's Done

- [x] Harness scaffolded; skills installed
- [x] feat-000: `docs/REQUIREMENTS.md`, `docs/SPEC.md`, `docs/TEST-PLAN.md` written

### What's In Progress

- [ ] feat-001: no package.json / tsconfig / lint-test tooling exists yet — `./init.sh` will fail until this lands
  - Scope is now fully specified in `docs/SPEC.md` §2.1–2.3.2 and §11 step 1
  - Includes switching `init.sh` **and** `CLAUDE.md` verification commands from npm to pnpm

### What's Next

1. feat-001 per SPEC §11 step 1
2. feat-002 / feat-004: freeze both provider interfaces before any concrete implementation

## Blockers / Risks

- [ ] **TypeScript pinned to ~6.0.3, not latest 7.0.2.** No typescript-eslint release (incl. canary 8.65.1-alpha.4) supports TS 7 — peer is `>=4.8.4 <6.1.0`. The project's hard architecture constraints (AC-01~03) depend entirely on eslint zoning, so keeping typed lint wins. Recorded in SPEC §2.2. **Revisit when typescript-eslint ships TS 7 support**; upgrade both together and re-run TEST-PLAN §5.1 lint negative checks.
- [ ] **CI not yet defined.** All gates currently depend on someone running `./init.sh`. TEST-PLAN §9 recommends a minimal GitHub Actions workflow after feat-001, before feat-003.
- [ ] **FR-13 has no test case.** (Plan Written → back to Ready should invalidate the old marker and regenerate.) Must either add U-50 during feat-007 or demote FR-13 to a later milestone — TEST-PLAN §9.
- [ ] Local pnpm is 10.33.0 but `packageManager` will pin 11.15.1 — needs `corepack enable` on this machine.

## Decisions Made

- **Provider abstraction is mandatory**: TrackerProvider (GitHub now, GitLab later) and AgentProvider (Claude Code now, Codex later) as swappable interfaces from day one, enforced by eslint import zoning + arch tests.
- **Self-hosted Node service, not Cloudflare Worker**: needs local clone/worktree/test-run.
- **Public repo**: secrets via env only; push protection + pre-commit regex scan (the latter is speed, not security).
- **Trigger = long-running polling loop**, not webhooks or GitHub Actions — keeps the tracker abstraction clean.
- **State storage = hybrid**: tracker is the sole source of truth for workflow state; local `state.json` holds only rebuildable data (cursor, attempts, inflight lease). Deleting it must not change the sequence of tracker writes.
- **Idempotency via comment markers**, not local state: bot comments carry an HTML-comment marker; write order is always agent → comment → setStatus.
- **Approval signal is configurable** (board-status / comment-keyword / label). First version implements board-status only; the other two throw at *registration* time so misconfiguration fails loudly at boot.
- **First milestone = vertical slice Ready → Plan Written** (feat-001~007). PR/implement/merge interfaces are defined now but unimplemented, to avoid later type churn.
- **pnpm over npm**: `hoist=false` makes undeclared transitive imports fail at resolution — a second layer under the provider-isolation constraint.
- **Read-only status UI (feat-013) accepted**, scheduled after the vertical slice. Designed in SPEC §9.5; the `RuntimeSnapshot` seam lands early in feat-006 so feat-013 never reaches into poller internals. Interactive/write UI remains a non-goal.

## Files Modified This Session

- `docs/REQUIREMENTS.md` (new) - FR-01~28, NFR-01~11, AC-01~06, glossary, 6 open questions
- `docs/SPEC.md` (new) - interfaces, polling/idempotency design, pinned versions, husky/commitlint, status UI design, file tree, 9-step implementation order
- `docs/TEST-PLAN.md` (new) - test layers, fakes, U-01~61, A-01~06, requirement traceability, known gaps
- `feature_list.json` - added feat-000 (done) and feat-013; feat-001 description expanded to match SPEC

## Evidence of Completion

- [ ] Tests pass: n/a — no code yet
- [ ] Type check clean: n/a — no code yet
- [x] Cross-document traceability checked: every FR/NFR/AC has at least one TEST-PLAN case except FR-13 (logged above)

## Notes for Next Session

Start feat-001 directly from `docs/SPEC.md` §11 step 1 — no architecture questions should remain. Note that step 1 must also edit `init.sh` and `CLAUDE.md` (npm → pnpm), which is the one place this session's plan touches pre-existing harness files.
