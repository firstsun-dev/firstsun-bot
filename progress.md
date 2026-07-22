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
**Session ID:** feat-001-project-setup
**Active Feature:** feat-002 / feat-004 (next)

## Status

### What's Done

- [x] feat-000, feat-001 — see [archive/2026-07.md](./archive/2026-07.md)

### What's Next

1. feat-002: `src/domain/types.ts`, `providers/tracker/{types,errors}.ts` + `test/arch/boundaries.test.ts` (SPEC §11 step 2)
2. feat-004: `providers/agent/{types,errors}.ts` (SPEC §11 step 3) — independent of feat-002, freeze both interfaces before any concrete implementation lands
3. Config/state/util step (SPEC §11 step 4, "前置"): `config/*`, `state/*`, `util/*`, `firstsun-bot.config.example.json` + tests

## Blockers / Risks

- [ ] **TypeScript pinned to ~6.0.3, not latest 7.0.2.** No typescript-eslint release supports TS 7 yet. Recorded in SPEC §2.2. **Revisit when typescript-eslint ships TS 7 support**; upgrade both together and re-run TEST-PLAN §5.1 lint negative checks.
- [ ] **CI not yet defined.** All gates currently depend on someone running `./init.sh`. TEST-PLAN §9 recommends a minimal GitHub Actions workflow before feat-003.
- [ ] **FR-13 has no test case.** (Plan Written → back to Ready should invalidate the old marker and regenerate.) Must either add U-50 during feat-007 or demote FR-13 to a later milestone — TEST-PLAN §9.

## Decisions Made

- **Eslint boundary zones are per-directory, not per-rule-merge.** Flat config replaces (doesn't merge) a rule setting when two matching config objects both set the same rule key for the same file — two overlapping `files: ['src/**/*.ts']` blocks each setting `no-restricted-imports` will silently clobber one another. `eslint.config.js` avoids this by giving each directory exactly one `no-restricted-imports` block containing that zone's full merged pattern list.

## Files Modified This Session

- `package.json`, `.npmrc`, `.nvmrc`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (new)
- `tsconfig.json`, `tsconfig.build.json` (new)
- `eslint.config.js` (new) — 3 boundary zones (GitHub SDK, Claude/spawn, orchestrator purity) + reserved http/composition zones
- `vitest.config.ts`, `.prettierrc.json`, `.prettierignore` (new)
- `.gitignore`, `.env.example` (new)
- `.husky/{pre-commit,commit-msg}`, `.lintstagedrc.json`, `commitlint.config.js` (new)
- `src/index.ts`, `test/index.smoke.test.ts` (new) — startup banner + smoke test
- `init.sh`, `CLAUDE.md` — verification commands switched from npm to pnpm

## Evidence of Completion

- [x] `./init.sh` green (lint, build, test)
- [x] TEST-PLAN §5.1 negative checks 1-3, 5-9, 11 run manually and reverted: forbidden octokit import → lint fails; `execFile('claude', ...)` in orchestrator → lint fails; undeclared transitive import (`esbuild`) → build fails (hoist=false); lint-broken staged file → pre-commit rejects; non-conventional commit message → commit-msg rejects; disallowed scope → commit-msg rejects; valid conventional commit → accepted; staged fake `ghp_...` token → pre-commit secret scan rejects; `pnpm install --frozen-lockfile` → no lockfile drift
- [x] Repository restartable from `./init.sh` — verified after all temporary test changes reverted

## Notes for Next Session

feat-001 is done. `docs/SPEC.md` §11 step 2 (feat-002) and step 3 (feat-004) are independent and can be done in either order — freeze both provider interfaces before any concrete implementation (feat-003/feat-005) lands, per the ordering rationale in SPEC §11.
