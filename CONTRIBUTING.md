# Contributing

How work actually moves through this repo — for humans and for AI coding agents. This documents the flow already visible in `git log`, formalized around Linear.

## Branching

One branch per Linear issue, prefixed by type (all of these are already in use, per `git log`):

```
feature/LIN-XX-short-description
fix/LIN-XX-short-description
bug/LIN-XX-short-description
subtask/LIN-XX-short-description
security/LIN-XX-short-description
```

Reference the Linear issue ID in the branch name and in the PR description.

## Pull requests

- Open PRs **against `develop`**, never against `main`.
- `develop` is merged into `main` periodically as a release — that's a manual, deliberate step, not automatic per-PR.
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

- Linear/GitHub MCP servers are configured in `.mcp.json` but not yet verified end-to-end by anyone on the team — see `HARNESS.md` gaps.
- No formal release process for `develop` → `main` beyond "merge when ready" — fine for a solo dev, worth revisiting once there's more than one person merging.
