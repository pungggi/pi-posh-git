# pi-posh-git

A **posh-git** style persistent git status footer for [pi](https://pi.dev).

Displays branch, ahead/behind, staged/unstaged counts, and stash count — always visible on the right side of the pwd line in the footer. Replaces pi's built-in footer branch display to avoid duplication. No commands needed.

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

## Requirements

- [pi](https://pi.dev) coding agent
- Git installed and available in `PATH`
- Node.js ≥ 20

## License

MIT
