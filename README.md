# pi-posh-git

A **posh-git** style persistent git status widget for [pi](https://pi.dev).

Displays branch, ahead/behind, staged/unstaged counts, and stash count — always visible as a widget line below the editor. No commands needed.

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

A persistent widget line below the input editor:

```
~/projects/app [main ↑3 +1 ~0 -0 | +0 ~2 -0 !]>
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
| **Clean** | `≡` | Green |
| **Staged only** | `~` | Cyan |
| **Dirty** | `!` | Red |
| **Stash** | `(3)` | Stash count |

Auto-refreshes on session start and after every tool execution.

## Requirements

- [pi](https://pi.dev) coding agent
- Git installed and available in `PATH`
- Node.js ≥ 20

## License

MIT
