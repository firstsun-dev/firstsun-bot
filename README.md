# Firstsun Bot

**Provider-agnostic automation for the issue-to-PR engineering lifecycle.**

Firstsun Bot is an emerging Firstsun Dev project for coordinating a human-approved software delivery flow:

> Issue ready → plan written → human approval → implementation → pull request → review / merge reconciliation

The core design goal is to keep orchestration independent from both the issue tracker and the coding agent. GitHub may be the tracker today and Claude Code may be the implementation agent today, but neither should leak into the orchestration layer.

> [!IMPORTANT]
> **Current status: architecture and project-harness stage.**
>
> This repository does not yet contain a production-ready issue-to-PR implementation. The provider boundaries, state-machine contract, verification workflow, and implementation plan are being established first. Public documentation intentionally reflects the current state instead of presenting planned behavior as shipped behavior.

## Why this exists

Coding agents can implement scoped changes, but reliable delivery requires more than invoking an agent from a script. The surrounding workflow needs durable state, explicit approval boundaries, provider isolation, verification, and a way to reconcile what happened back into the tracker.

Firstsun Bot is intended to make that lifecycle explicit rather than building a collection of provider-specific automations.

## Architecture

The design separates three responsibilities.

```text
┌──────────────────────┐
│   Tracker provider   │
│ GitHub / GitLab / …  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│     Orchestrator     │
│                      │
│ Ready                │
│   ↓                  │
│ Plan Written         │
│   ↓                  │
│ Approved             │
│   ↓                  │
│ Implementing         │
│   ↓                  │
│ Review               │
│   ↓                  │
│ Done                 │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    Agent provider    │
│ Claude / Codex / …   │
└──────────────────────┘
```

### Tracker provider

`TrackerProvider` owns tracker-specific behavior such as:

- detecting project / issue state transitions
- reading issue content and comments
- writing plan or progress comments
- opening a PR or merge request linked to the issue
- reading review state
- updating project-board status

GitHub-specific code belongs inside the GitHub tracker provider rather than the orchestrator.

### Agent provider

`AgentProvider` owns coding-agent execution. The planning step and implementation step may use different providers without changing orchestration logic.

Provider-specific CLI or SDK calls stay behind the provider boundary.

### Orchestrator

The orchestrator owns the lifecycle state machine and calls provider interfaces only.

The intended state sequence is:

```text
Ready → Plan Written → Approved → Implementing → Review → Done
```

The human approval boundary between planning and implementation is intentional. The system should not turn an issue marked ready into autonomous code changes without an explicit approval step.

## Design constraints

### Provider-agnostic orchestration

The orchestration layer must not directly depend on GitHub, GitLab, Claude Code, Codex, or another concrete provider.

Capabilities needed by orchestration should be added to the provider interfaces and implemented by each concrete provider.

### Public repository, private credentials

This repository is public. Tracker tokens and coding-agent credentials must come from environment or external secret management and must never be committed or logged.

### Evidence before promotion

Firstsun Bot is currently treated as an **emerging** project rather than a Firstsun Dev flagship.

Stronger placement should be earned through:

- a working end-to-end implementation
- provider-boundary tests
- a reproducible demo
- real Firstsun dogfooding
- delivery and failure evidence from actual issue-to-PR runs

## Current repository state

The repository currently contains the agent-harness and project-state artifacts used to develop the system deliberately:

- [`CLAUDE.md`](./CLAUDE.md) — architecture constraints and working rules
- [`feature_list.json`](./feature_list.json) — implementation scope and feature state
- [`progress.md`](./progress.md) — current development progress
- [`init.sh`](./init.sh) — baseline verification entry point
- `archive/` — completed-work history

This structure is development infrastructure, not the final product architecture.

## Verification

The project contract requires the standard verification entry point to remain runnable:

```bash
./init.sh
```

As implementation is added, the expected gates are lint, build, and test verification appropriate to the chosen runtime.

## Road to a usable release

The project should not claim completion until the public evidence surface catches up with the design. The next meaningful milestones are:

1. implement tracker and agent provider interfaces
2. implement the orchestration state machine
3. add a GitHub tracker provider and initial coding-agent provider
4. prove the human approval boundary end to end
5. add failure / retry / reconciliation behavior
6. publish a reproducible demo and dogfooding evidence

## Firstsun Dev

Firstsun Bot is a Firstsun Dev project.

Firstsun Dev is the engineering arm of Firstsun / 首陽問路.

> Build useful things. Operate them well. Share what we learn.
