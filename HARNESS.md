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

`CLAUDE.md`'s body was refreshed to match `docs/current-state.md` (accounts/venues/profiles model and `talia-ai` as the active runtime) — it's a reliable secondary source now, not just the rule-import wrapper.

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

A project-scoped [`.mcp.json`](.mcp.json) now exists at the repo root:

```json
{
  "mcpServers": {
    "linear": { "type": "http", "url": "https://mcp.linear.app/mcp" },
    "github": {
      "command": "github-mcp-server",
      "args": ["stdio"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}" }
    }
  }
}
```

✅ **Status: both confirmed working (2026-07-07).** No tokens are committed — `${GITHUB_PERSONAL_ACCESS_TOKEN}` is expanded from each dev's own shell environment, never written to this file.

- **Linear** uses Linear's hosted remote MCP server, OAuth-authenticated per user. Originally configured as `{ "type": "sse", "url": "https://mcp.linear.app/sse" }`, which failed with `SDK auth failed: Protected resource https://mcp.linear.app/mcp does not match expected https://mcp.linear.app/sse` — Linear's OAuth protected-resource metadata declares the canonical resource as `/mcp` (Streamable HTTP), not `/sse`. Fixed to `{ "type": "http", "url": "https://mcp.linear.app/mcp" }`; the OAuth prompt (click **Authenticate** in the MCP servers panel, or `/mcp` → linear → Authenticate) then completes normally.
- **GitHub** does **not** use the hosted `api.githubcopilot.com/mcp/` endpoint — two things went wrong there, in order:
  1. Plain OAuth failed with `SDK auth failed: Incompatible auth server: does not support dynamic client registration` — that endpoint doesn't support the dynamic client registration (RFC 7591) that Claude Code's generic OAuth flow expects.
  2. Switching to a static `Authorization: Bearer <PAT>` header against the same hosted endpoint failed differently: `Streamable HTTP error: ... bad request: Authorization header is badly formatted` — the endpoint appears to only accept tokens issued by its own OAuth flow, not a raw personal access token, regardless of header formatting.
  - **Fix**: use GitHub's official `github-mcp-server` **locally** instead of the remote endpoint (installed via `brew install github-mcp-server`; also distributable via Docker, see the project's own docs). Running locally in `stdio` mode, it accepts a plain PAT via the `GITHUB_PERSONAL_ACCESS_TOKEN` env var directly — no OAuth involved at all. Config above. Smoke-tested locally (server starts and connects cleanly with the token, no auth error in its logs).
  - To use it: `brew install github-mcp-server`, create a fine-grained GitHub PAT scoped to `taliaeventstech-cyber/talia-client` (+ `talia-ai`) with Contents, Pull requests and Issues read/write permissions, then export it in your own shell profile (never in the repo):
    ```bash
    export GITHUB_PERSONAL_ACCESS_TOKEN="github_pat_..."
    ```
  - **macOS gotcha**: if your AI tool is launched as a GUI app (not from a terminal), it won't inherit variables exported in `~/.zshrc` — that file is only sourced by interactive shells. Run `launchctl setenv GITHUB_PERSONAL_ACCESS_TOKEN "..."` too, then fully quit and reopen the app (a "Reconnect" click alone won't reload `.mcp.json` or pick up a newly-set env var — the app needs to restart).

---

## Known gaps in this file (v0)

- [ ] Tool-specific rule supplements for non-Claude-Code tools that don't read `AGENTS.md` natively (e.g. `.github/copilot-instructions.md`), if we decide we need them.
- [ ] Same setup (CI, Husky, MCP, harness docs, skills) still needs replicating in `talia-ai` — done separately. Note `github-mcp-server` is now a machine-level Homebrew install, not repo-specific, so it doesn't need reinstalling per repo.
