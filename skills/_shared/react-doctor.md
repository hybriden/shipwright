# react-doctor — React Verify Gate

Shared reference for skills that verify React code (auto-review primary; production-readiness and auto-debug may consult). Applies **only in React projects** (a `react` dependency in `package.json`).

[react-doctor](https://github.com/millionco/react-doctor) (Modified-MIT, by the Million.js team) is a **deterministic** static analyzer for React — state & effects, performance, architecture, security, accessibility. Shipwright runs it as a **verification gate over the diff**, treats its findings as evidence, and routes fixable ones back through the normal fix loop. Nothing is vendored — react-doctor is fetched transiently via `npx`.

## Non-negotiable flags

Always run **local-only** and **diff-scoped**:

```
npx --yes react-doctor@latest --json --no-score --no-telemetry --yes --scope changed --base <base-branch>
```

- `--no-score --no-telemetry` — **mandatory.** react-doctor calls a score/share API and crash reporting by default; these flags keep private code local. Never omit them.
- `--scope changed --base <base-branch>` — judge only the change under review (the run's original branch, or the PR base), not the repo's pre-existing debt. Omit `--base` to let it auto-detect.
- `--json` — structured report on stdout (a `diagnostics[]` array with `severity`, `category`, `rule`, `filePath`, `line`, `message`).
- If `--scope changed` errors because there is no git base, re-run with `--scope full` (whole project).

**Canonical wrapper:** `hooks/react/react-doctor.js` enforces all of the above plus `.shipwright.json` config and the changed→full fallback. Prefer it when the plugin path is resolvable (`node <plugin>/hooks/react/react-doctor.js report --project . --base <base> --md`); otherwise run the `npx` command above directly.

## Consuming the findings

| Severity | Treatment |
|---|---|
| `error` | Must fix — dispatch the implementer for the specific `file:line` + rule, then **re-scan** (changed scope) and hold the `../_shared/net-positive-gate.md` line: new errors must not appear, existing passes must not regress. |
| `warning` | Report as Important/Minor per judgment; fix the clearly-correct ones (e.g. `no-array-index-as-key`, `exhaustive-deps`), note the rest. |
| `Maintainability/unused-file` on a real diff | Usually real dead code; on rootless fixtures it is noise — judge in context. |

Findings are deterministic (stable rule ids); prefer them over re-deriving the same issues by eye. But they are **not exhaustive** — react-doctor's security coverage is thin (e.g. it does not flag `dangerouslySetInnerHTML`), so the reviewer's own security/spec checks still apply.

## Config & opt-out

`.shipwright.json` `reactDoctor` block: `enabled`, `scope`, `base`, `blocking`, `categories`, `version`, `maxWarnings` (see `auto-setup/shipwright-config.md`). Disable with `reactDoctor.enabled: false`. Degrade-never-block: no `npx`/offline/scan error ⇒ skip and continue.
