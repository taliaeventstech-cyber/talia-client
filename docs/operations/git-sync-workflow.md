# Git Synchronization Workflow

Use this procedure after pull requests have been merged on GitHub. It updates
the local `main` and `develop` branches, removes stale remote references, and
refreshes the commit information shown by VS Code Git Graph.

This guide applies to both repositories:

- `~/talia-client`
- `~/talia-ai`

## Before synchronizing

Check that each repository has no uncommitted work:

```bash
git -C ~/talia-client status --short
git -C ~/talia-ai status --short
```

An empty result means the working tree is clean. If either command lists files,
commit, stash, or otherwise preserve that work before switching branches.

## Synchronize both repositories

Run:

```bash
for repo in "$HOME/talia-client" "$HOME/talia-ai"; do
  git -C "$repo" fetch origin --prune

  git -C "$repo" switch develop
  git -C "$repo" pull --ff-only origin develop

  git -C "$repo" switch main
  git -C "$repo" pull --ff-only origin main

  git -C "$repo" switch develop
done
```

What these commands do:

- `fetch origin --prune` downloads remote commits and removes local references
  to remote branches that GitHub has deleted.
- `switch` selects the local branch to update.
- `pull --ff-only` updates the branch without silently creating a merge commit.
- The final `switch develop` leaves the repository on the normal base branch
  for starting the next issue.

## Synchronize one repository

From the repository directory:

```bash
git status --short
git fetch origin --prune
git switch develop
git pull --ff-only origin develop
git switch main
git pull --ff-only origin main
git switch develop
```

## Verify the result

Check the branch pointers and inspect the graph:

```bash
git branch -vv
git log --graph --decorate --oneline --all -n 60
```

In VS Code Git Graph, run **Git Graph: Refresh** from the Command Palette. If
the view still shows stale references, close and reopen Git Graph or run
**Developer: Reload Window**.

The colored lines in Git Graph represent commit ancestry. They do not need to
be visually straight or collapse into one line. The important checks are that:

- local `main` matches `origin/main`;
- local `develop` matches `origin/develop`;
- merged work is an ancestor of the expected target branch.

## Remove merged local branches

List branches already merged into `develop`:

```bash
git branch --merged develop
```

Delete only branches that are no longer needed:

```bash
git branch -d feature/TAL-XX-short-description
```

The safe `-d` option refuses to delete a branch whose commits are not merged.
Do not use `-D` unless the branch is intentionally being discarded.

## If `--ff-only` fails

Do not force the pull and do not use `git reset --hard`. First inspect the
divergence:

```bash
git status
git log --oneline --left-right --cherry-pick HEAD...@{upstream}
```

This usually means the local `main` or `develop` branch contains commits that
are not on GitHub. Preserve those commits on a separate branch and ask for a
review before changing branch history.

## Start the next issue

Always branch from an updated `develop`:

```bash
git switch develop
git pull --ff-only origin develop
git switch -c feature/TAL-XX-short-description
```

Use the appropriate `feature/`, `fix/`, `bug/`, `subtask/`, or `security/`
prefix and include the Linear issue identifier.
