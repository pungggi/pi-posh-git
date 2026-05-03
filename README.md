# pi-posh-git

A [pi](https://github.com/badlogic/pi-mono) extension that shows a persistent **posh-git** style git status line below the editor.

No commands needed — it's always there, just like posh-git in PowerShell.

## Install

Add to your pi `settings.json`:

```json
{
  "extensions": ["./path/to/pi-posh-git"]
}
```

Or copy/symlink into `~/.pi/agent/extensions/`.

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
| **Diverged** | `↕2↑3` | Behind & ahead |
| **Gone** | `×` | Upstream deleted |
| **Staged** | `+1 ~2 -0` | Green (index changes) |
| **Delimiter** | `\|` | Yellow separator |
| **Unstaged** | `+0 ~1 -0` | Red (working tree) |
| **Clean** | `≡` | Green |
| **Staged only** | `~` | Cyan |
| **Dirty** | `!` | Red |
| **Stash** | `(3)` | Stash count |

Auto-refreshes on session start and after every tool execution.
