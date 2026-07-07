# HARNESS.md

How to wire up **any** AI coding agent (Claude Code, Cursor, Windsurf, Zed, GitHub Copilot, Amp, Codex CLI, whatever comes next) to work productively on `talia-client`. Nothing here is tied to one vendor. This is v0 — expect gaps (marked below).

---

## What "harness" means here

Not "which tool you use" — that's genuinely your choice. This is about how the *rules* (what the agent should know about this repo) and the *tooling* (MCP servers, setup/check recipes) get loaded into whatever agent you run, so it actually knows about accounts/venues, `should_generate_draft`, `talia-ai`, etc. instead of guessing from stale training data.

---

## Rule hierarchy — read in this order of authority

1. [`docs/current-state.md`](docs/current-state.md) — **wins on any conflict, always.** Real, current product state.
2. [`AGENTS.md`](AGENTS.md) — the portable, cross-tool rules file (following the open [agents.md](https://agents.md) convention). This is the one file most agentic coding tools auto-detect at the repo root today (Cursor, Zed, Amp, Codex CLI, and others read it directly; Claude Code reads it via the `@AGENTS.md` import in `CLAUDE.md`). Keep it short and low-risk-of-going-stale — right now it mostly just points back to `docs/current-state.md`, which is correct behavior, don't bloat it.
3. Tool-specific supplement files, if any exist for your tool (see table below) — these can add extra instructions on top of `AGENTS.md`, but should never contradict `docs/current-state.md`.

Practically: if an agent's answer contradicts `docs/current-state.md`, the doc is right and whatever rules file it read is stale — not the other way around.

### Which file each tool actually reads

| Tool | Auto-loads |
|---|---|
| Claude Code | `CLAUDE.md` (which imports `AGENTS.md` via `@AGENTS.md`) |
| Cursor | `AGENTS.md` at repo root; optionally finer-grained `.cursor/rules/*.mdc` (not set up in this repo yet) |
| Zed | `AGENTS.md` |
| Amp, Codex CLI, and other agents.md-compatible tools | `AGENTS.md` |
| GitHub Copilot (VS Code) | Historically `.github/copilot-instructions.md`; growing `AGENTS.md` support — not set up in this repo yet |

Only `CLAUDE.md` and `AGENTS.md` exist today. If your tool needs its own supplement file and doesn't read `AGENTS.md` natively, add it (e.g. `.github/copilot-instructions.md`) and keep it a thin pointer to `AGENTS.md` + `docs/current-state.md` — don't fork the rules into multiple bodies of text that can drift apart.

`CLAUDE.md`'s body was refreshed to match `docs/current-state.md` (accounts/venues/profiles model, `talia-ai`, n8n as temporary adapter) — it's a reliable secondary source now, not just the rule-import wrapper.

---

## Setup / check / new-feature recipes

These exist today as Claude Code slash-commands in `.claude/commands/`, but they're just plain checklists — run them with any tool by pasting the steps as a prompt, or by hand:

- **Setup**: `npm install` → confirm `.env.local` has the Supabase vars → `npx supabase start` → `npm run db:migrate` → `npm run db:types` → `npm run dev`.
- **Pre-PR check**: `npm run typecheck` → `npm run lint` → `npm test`. Fix and re-run on failure. `.github/workflows/ci.yml` now runs the same three checks on every push/PR, and a Husky pre-commit hook lints staged files automatically — see `CONTRIBUTING.md`. Verified end-to-end: a real syntax error in a staged file gets blocked by the hook (lint-staged reverts the stage and aborts the commit); note that today's ESLint config treats things like unused vars as **warnings**, which don't block the commit — only actual errors do. The repo currently has zero warnings, so tightening `eslint --fix` to `eslint --fix --max-warnings=0` later would be low-risk if we want a stricter gate.
- **New feature**: migration in `/supabase/migrations` (multi-tenant RLS) → regenerate types (`npm run db:types`) → zod types in `/src/types/` → server action → page (Server Component) → co-located test → update sidebar nav. Backed by two real skills under `.claude/skills/`: `supabase-rls` and `dashboard-component`.

If you're on Claude Code, `.claude/commands/` gives you these as `/setup`, `/check`, `/new-feature`. If your tool has an equivalent mechanism (Cursor commands, custom prompts, etc.), port them there — the underlying steps above are the source of truth, not the Claude-specific wrapper.

---

## MCP servers (Linear + GitHub)

MCP (Model Context Protocol) is an open standard — the same Linear/GitHub server can in principle be wired into Claude Code, Cursor, Windsurf, VS Code, etc., just through different config surfaces:

| Tool | Where MCP servers are configured |
|---|---|
| Claude Code | `claude mcp add ...`, or a project `.mcp.json` |
| Cursor | Settings → MCP, or project `.cursor/mcp.json` |
| VS Code | `.vscode/mcp.json` |
| Others | check the tool's own MCP docs |

A project-scoped [`.mcp.json`](.mcp.json) now exists at the repo root, pointing at Linear's and GitHub's official hosted MCP servers:

```json
{
  "mcpServers": {
    "linear": { "type": "sse", "url": "https://mcp.linear.app/sse" },
    "github": { "type": "http", "url": "https://api.githubcopilot.com/mcp/" }
  }
}
```

⚠️ **Status: config exists, but not yet verified end-to-end by anyone on the team.** No tokens are committed — each dev authenticates on first use (OAuth login flow prompted by their tool, e.g. `/mcp` in Claude Code). If a URL below is stale by the time you read this (these endpoints can change), fix it here and note the correction:

- **Linear**: first connection should trigger an OAuth prompt in your tool. If it doesn't, check Linear's current MCP docs for the right URL/transport.
- **GitHub**: same — first connection should trigger GitHub OAuth (or ask for a PAT, depending on the tool). Scope it to `talia-client` + `talia-ai`.

**TODO:** once someone actually completes the OAuth flow and confirms both servers work, remove this warning and replace it with "confirmed working as of `<date>`."

---

## Known gaps in this file (v0)

- [ ] `.mcp.json` (Linear + GitHub) exists but the OAuth flow hasn't been completed/verified by anyone yet, on any tool.
- [ ] Tool-specific rule supplements for non-Claude-Code tools that don't read `AGENTS.md` natively (e.g. `.github/copilot-instructions.md`), if we decide we need them.
- [ ] Same setup (CI, Husky, MCP, harness docs, skills) still needs replicating in `talia-ai` — done separately.
