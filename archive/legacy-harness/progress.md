# Session Progress Log

**Last updated:** 2026-11-25 · Project planning only. Completed setup decisions: [archive/2026-07.md](archive/2026-07.md).

## Open work
- feat-001: repository/harness exists on GitHub; no package.json, TypeScript config or app code on main. Scaffold and verify init.sh first.
- feat-002/004: define TrackerProvider and AgentProvider contracts before concrete providers. Existing feature dependencies remain unchanged.
- Architecture: self-hosted Node service for local clone/worktree/test execution; provider abstraction mandatory. Keep secrets out of git. See CLAUDE.md.
