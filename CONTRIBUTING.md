# Contributing

How work actually moves through this repo — for humans and for AI coding agents. This documents the flow already visible in `git log`, formalized around Linear.

## Branching

One branch per Linear issue, prefixed by type (all of these are already in use, per `git log`):

```
feature/TAL-XX-short-description
fix/TAL-XX-short-description
bug/TAL-XX-short-description
subtask/TAL-XX-short-description
security/TAL-XX-short-description
```

Reference the Linear issue ID in the branch name and in the PR description.
Work without a Linear issue (tooling, docs, housekeeping) uses `chore/short-description`.

Agents follow the same names. Never create or push `claude/*` branches, including from Claude Code cloud sessions that start on one: branch from an up-to-date `develop` with a conventional name instead.

After GitHub merges, follow
[`docs/operations/git-sync-workflow.md`](docs/operations/git-sync-workflow.md)
to update local `main` and `develop`, prune deleted remote branches, and refresh
VS Code Git Graph.

## Pull requests

- Open PRs **against `develop`**, never against `main`.
- `develop` is merged into `main` periodically as a release — that's a manual, deliberate step, not automatic per-PR.
- The Linear↔GitHub integration is connected: a branch containing `TAL-123` (or `Closes TAL-123` in the PR description) auto-links to the issue and can move its status automatically.
- Before opening a PR, run the pre-PR check (the `/check` recipe if you're on Claude Code, or by hand):
  ```bash
  npm run typecheck
  npm run lint
  npm test
  ```
- CI (`.github/workflows/ci.yml`) runs the same three checks on every push/PR — it should pass before merging.
- A pre-commit hook (Husky + lint-staged) auto-lints staged `.ts`/`.tsx` files on every commit. It does not run typecheck or tests — those stay in CI and in the pre-PR check so commits stay fast.

## Working with an AI coding agent

- Read [`AGENTS.md`](AGENTS.md) and [`HARNESS.md`](HARNESS.md) first — they define the rule hierarchy (`docs/current-state.md` always wins on conflict) and how MCP servers (Linear, GitHub) get configured per tool.
- Agents should read the Linear issue for the branch they're working on (via the Linear MCP server, see `HARNESS.md`) before writing code, and open the PR against `develop` following the same convention as a human would.
- For new features, follow the pattern in `.claude/commands/new-feature.md` (migration → types → server action → page → component → test), backed by the `supabase-rls` and `dashboard-component` skills in `.claude/skills/`.

## What's still missing

- No formal release process for `develop` → `main` beyond "merge when ready" — fine for a solo dev, worth revisiting once there's more than one person merging.
