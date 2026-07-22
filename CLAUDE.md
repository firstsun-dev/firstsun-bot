# CLAUDE.md

`firstsun-bot` automates the issue-to-PR lifecycle: it watches an issue tracker's project board, and when an issue is marked "Ready" it writes a design/plan back to the issue, waits for human approval, then drives an AI coding agent to implement the change on a worktree/branch, opens a PR linked to the issue, and reconciles status through review and merge.

## Architecture Constraint: Everything Provider-Agnostic

This is a hard requirement, not a nice-to-have. The system must support swapping the issue tracker (GitHub today, GitLab later) and the AI coding agent (Claude Code today, Codex CLI / others later) without touching orchestration logic.

- **`src/providers/tracker/`** — the tracker interface (`TrackerProvider`) and concrete implementations (`github/`, later `gitlab/`). Covers: poll/watch for status transitions, read issue body + comments, post a comment, open a PR/MR linked to an issue (`Closes #N`), read PR/MR review state, update a project board status field.
- **`src/providers/agent/`** — the AI agent interface (`AgentProvider`) and concrete implementations (`claude-code/`, later `codex/`). Covers: given a repo path + task description + worktree, run the agent and return success/failure + a summary. The "analyze & write plan" step and the "implement" step both go through this interface and may use *different* concrete providers.
- **`src/orchestrator/`** — the state machine (`Ready → Plan Written → Approved → Implementing → Review → Done`) that calls only the two interfaces above — never a concrete provider, never `gh`/Octokit, never a `claude` CLI invocation directly.

**Enforcement rule**: no file outside `src/providers/tracker/github/` may import `gh`, Octokit, or any GitHub-specific SDK. No file outside `src/providers/agent/claude-code/` may shell out to `claude` or import a Claude-Code-specific SDK. If you catch yourself reaching for either from orchestration code, stop — add the capability to the interface instead, and implement it in the concrete provider.

## Secrets

This repo is **public**. Tokens (tracker PAT, AI agent API keys) are read from environment variables only, never committed, never logged. Use the installed `secret-scanning` skill's guidance (push protection, custom patterns) before any commit that touches config or provider code.

## Startup Workflow

Before writing code:

1. **Confirm working directory** with `pwd`
2. **Read this file** completely
3. **Read project docs if present** (`docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, README, or equivalent)
4. **Run `./init.sh`** to verify environment is healthy
5. **Read `feature_list.json`** to see current feature state
6. **Review recent commits** with `git log --oneline -5`

If baseline verification is failing, repair that first before adding new scope.

## Working Rules

- **One feature at a time**: Pick exactly one unfinished feature from `feature_list.json`
- **Verification required**: Don't claim done without running verification commands
- **Update artifacts**: Before ending session, update `progress.md` and `feature_list.json`
- **Keep state files short**: `progress.md` tracks only open work (~80 lines max). When a feature finishes, move it to `archive/YYYY-MM.md` (current month) as one line: name + commit hash. Keep `feature_list.json` evidence to one line — commit hash + short pointer; narrative belongs in the commit message. Rewrite `session-handoff.md` each session — overwrite, never append.
- **Stay in scope**: Don't modify files unrelated to the current feature
- **Leave clean state**: Next session must be able to run `./init.sh` immediately

## Required Artifacts

- `feature_list.json` — Feature state tracker (source of truth)
- `progress.md` — Session continuity log (open work only)
- `archive/YYYY-MM.md` — Completed work, one file per calendar month
- `init.sh` — Standard startup and verification path
- `session-handoff.md` — Optional, for larger sessions

## Definition of Done

A feature is done only when ALL of the following are true:

- [ ] Target behavior is implemented
- [ ] Required verification actually ran (tests / lint / type-check)
- [ ] Evidence recorded in `feature_list.json` or `progress.md`
- [ ] Repository remains restartable from standard startup path

## End of Session

Before ending a session:

1. Update `progress.md` with current state
2. Update `feature_list.json` with new feature status
3. Move finished items from `progress.md` to `archive/YYYY-MM.md` (one line each: name + commit hash)
4. Record any unresolved risks or blockers
5. Commit with descriptive message once work is in safe state
6. Leave repo clean enough for next session to run `./init.sh` immediately

## Verification Commands

```bash
# Full verification (recommended)
./init.sh
```

Required checks:
- `pnpm run lint`
- `pnpm run build`
- `pnpm test`

## Escalation

If you encounter:
- **Architecture decisions**: Consult project architecture docs if present, otherwise ask user
- **Unclear requirements**: Check product/requirements docs if present, otherwise ask user
- **Repeated test failures**: Update progress, flag for human review
- **Scope ambiguity**: Re-read `feature_list.json` for definition of done
