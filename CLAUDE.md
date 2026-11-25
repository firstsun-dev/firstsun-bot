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

## Start

Read this file, then only what the task needs. From an issue: read it and what it links. Resuming: read the
Draft PR description, commits, checks and review comments before editing.

## Task tracking and handoff

- Tasks and backlog: GitHub Issues. Priority and status: [Project #6](https://github.com/orgs/firstsun-dev/projects/6).
- Progress and handoff: branch, commits, Draft PR. Unfinished work goes to an issue.
- History: git log; retired state files are in `archive/legacy-harness/` (do not load by default).

## Scope

- One task per branch (a worktree when sessions run in parallel). Check open PRs for overlap.
- No unrelated refactoring; file an issue instead.

## Verification and Definition of Done

```bash
./init.sh   # npm run lint, build, test
```

There is no `package.json` yet, so this is NOT RUN until #1 scaffolds the project.

The PR records each check as PASS, FAIL, SKIP or NOT RUN (with the reason). Never call a failure
pre-existing without reproducing it on the base branch.
