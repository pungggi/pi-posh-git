# Publishing `pi-posh-git`

Tag-driven CI publish with npm provenance.

```bash
# bump version in package.json, commit, then:
git tag v1.2.2
git push origin master --follow-tags
gh run watch
```

## Auth (one-time) — Trusted Publisher / OIDC

1. npmjs.com → `pi-posh-git` → **Settings → Trusted Publisher**
2. Add GitHub Actions:
   - **Organization or user:** `pungggi`
   - **Repository:** `pi-posh-git`
   - **Workflow filename:** `release.yml`
3. Leave `NPM_TOKEN` unset for pure OIDC.

Fallback: Classic **Automation** token as `NPM_TOKEN` repo secret.
