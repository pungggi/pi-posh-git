# pi-posh-git

A **posh-git** style persistent git status footer for [pi](https://pi.dev) — plus a **note + git status feed** injected into the agent context.

Inspired by [dahlbyk/posh-git](https://github.com/dahlbyk/posh-git) — the excellent PowerShell module that pioneered rich git status in the prompt.

It does two things:

- **Footer (UI)** — branch, ahead/behind, staged/unstaged counts, and stash count, always visible on the right side of the pwd line. Replaces pi's built-in footer branch display to avoid duplication. No commands needed.
- **Context feed (LLM)** — a timestamped note plus a compact one-line git status, injected at startup, on every turn, and whenever the note file changes — so the agent is no longer blind to your scratchpad or branch state. See [Note + git context feed](#note--git-context-feed).

## Install

```bash
pi install npm:pi-posh-git
```

Or add manually to your pi `settings.json`:

```json
{
  "packages": ["npm:pi-posh-git"]
}
```

## What it looks like

Git status appears on the right side of the pwd line in the footer:

```
~/projects/app [main ↑3 +1 ~0 -0 | +0 ~2 -0 !]
```

| Element | Symbol | Meaning |
|---------|--------|---------|
| **Brackets** | `[` `]` | Yellow |
| **Branch** | `main` | Cyan/accent |
| **Identical** | `≡` | Up to date with remote |
| **Ahead** | `↑3` | 3 commits ahead |
| **Behind** | `↓2` | 2 commits behind |
| **Diverged** | `↓2 ↑3` | Behind & ahead |
| **Gone** | `×` | Upstream deleted |
| **Staged** | `+1 ~2 -0` | Green (index changes) |
| **Delimiter** | `\|` | Yellow separator |
| **Unstaged** | `+0 ~1 -0` | Red (working tree) |
| **Clean** | *(none)* | No local-status symbol when working tree and index are clean |
| **Staged only** | `~` | Cyan |
| **Dirty** | `!` | Red |
| **Stash** | `(3)` | Stash count |

Auto-refreshes on session start and after every tool execution.

### Footer integration

The extension replaces pi's built-in footer with a custom one that shows the same information (pwd, token stats, context usage, model name) **with the git status appended to the right side of the pwd line**. The built-in footer is automatically restored when the session shuts down.

## Note + git context feed

The agent is no longer blind to your scratchpad or branch state. pi-posh-git feeds a timestamped note (plus a compact, colorless git status) into the **LLM context**:

```
[pi-posh-git note · 2026-03-30T18:42:11+02:00 · project]
git: note ↑1 +0 ~1 -0 !

Ship via tag only — never npm publish from the laptop.
```

The git line mirrors posh-git's symbols (`≡ ↑ ↓ × | ! ~`) so it stays recognizable next to the colored footer, with the same `getGitStatus` call shared between the two (cached per turn so the footer and the feed never spawn git twice).

| Event | Action |
|-------|--------|
| Session start | Read note + git → inject (`nextTurn`, no wake) |
| Note file change | Re-read → inject with new timestamp (silent by default) |
| Every agent turn | Attach current payload via `before_agent_start` |
| After tools / turn end | Refresh git quietly (picked up on next turn) |
| Context build | Drop all but the newest `pi-posh-git-note` message |

### `/note` command

| Command | Action |
|---------|--------|
| `/note` / `/note show` | Print the current note + git payload |
| `/note set <text>` | Replace the note body and inject |
| `/note append <text>` | Append a line and inject |
| `/note clear` | Empty the note file |
| `/note edit` | Open note in `$PI_POSH_GIT_NOTE_EDITOR` / `$EDITOR` / notepad |
| `/note path` | Show active / project / global paths |
| `/note reload` | Force re-read + inject |
| `/note git on\|off` | Toggle the git block (session-local) |

### Note file locations (first match wins)

| Priority | Path |
|----------|------|
| 1 | `$PI_POSH_GIT_NOTE_PATH` |
| 2 | `<cwd>/.pi/note.md` (project — wins if the file exists) |
| 3 | `~/.pi-posh-git/note.md` (global) |

`/note set` and `/note edit` write the **project** note by default (unless an override is set), so notes stay repo-local.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PI_POSH_GIT_NOTE_PATH` | *(unset)* | Force a specific note file |
| `PI_POSH_GIT_NOTE_GIT` | `1` | Set `0` to disable the git block |
| `PI_POSH_GIT_NOTE_TRIGGER_TURN` | `0` | Set `1` to wake the agent when the note file changes |
| `PI_POSH_GIT_NOTE_EDITOR` | `$EDITOR` / `$VISUAL` | Editor for `/note edit` |

## Requirements

- [pi](https://pi.dev) coding agent
- Git installed and available in `PATH`
- Node.js ≥ 20

## License

MIT
