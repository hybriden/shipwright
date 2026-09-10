# JS/TS Lint & Format — Oxlint + Oxfmt

Shared reference for JavaScript/TypeScript projects: auto-setup checks, auto-plan decides, auto-impl follows, production-readiness reports. Shipwright prefers [Oxlint](https://oxc.rs/docs/guide/usage/linter) and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) to ESLint and Prettier because they are Rust-native and much faster — but a switch that changes findings or reformats code isn't free, so compatibility is checked with evidence first.

## Policy

| Situation | Action |
|---|---|
| Project already on Oxlint / Oxfmt | Use them for every lint/format step |
| No linter / formatter, and the task sets one up or scaffolds a project | Choose Oxlint / Oxfmt |
| ESLint / Prettier in use, task unrelated to tooling | Run the check; **don't switch** — report the verdict under the final report's Recommendations |
| ESLint / Prettier in use, task asks to migrate or rework lint/format tooling | Run the check, then migrate what the verdict allows (below) with the Oxc skills `migrate-oxlint` / `migrate-oxfmt` (skill pack `oxc`) |
| Biome | Leave it — already native-speed, so the performance case doesn't apply |

Why never switch silently: changing a project's toolchain inside an unrelated task is scope creep, and a formatter swap rewrites files the task never touched.

## The check

`node "<plugin>/hooks/js/oxc-compat.js" report --project .` — in repos with ESLint or Prettier, the `[skill-packs]` block surfaces the exact command on an `[oxc]` line. It needs dependencies installed (the ESLint config imports its plugins), leaves the project unchanged (generated configs are removed), and caches the verdict for 7 days while `package.json`, the lockfile, ignore files, and lint/format configs are unchanged (`--fresh` re-checks). `.shipwright.json` `oxc.parity: false` skips the ESLint/Prettier comparison runs on very large repos.

| Verdict | Lint (ESLint → Oxlint) | Format (Prettier → Oxfmt) |
|---|---|---|
| COMPATIBLE | every rule migrates (JS plugins allowed) and Oxlint misses no ESLint finding on this codebase | no unsupported plugin/option, and zero files Oxfmt formats differently than Prettier |
| PARTIAL | lists the rules not migrated and the findings Oxlint missed | lists unsupported plugins/options and the drift files |
| NEEDS_FLAT_CONFIG | legacy `.eslintrc*` — convert with `npx @eslint/migrate-config` first | — |
| ADOPTED · COEXISTING · GREENFIELD · NOT_APPLICABLE | already switched · both installed · none installed · Biome | same |
| UNKNOWN | the reason (deps not installed, tool failure) — not cached, re-run after setup | same |

Timings are reported only when the slower tool takes ≥3s; below that npx startup dominates and a comparison would mislead.

## Migrating (only when the task asks)

- **Lint COMPATIBLE** → replace ESLint with Oxlint per `migrate-oxlint`. ESLint plugins listed under `jsPlugins` stay installed; ESLint itself can go.
- **Lint PARTIAL** → Oxlint first for the rules it covers, ESLint for the listed leftovers with `eslint-plugin-oxlint` turning off the overlap (`oxlint && eslint`) — or drop leftovers the task owner accepts losing.
- **Format COMPATIBLE** → replace Prettier with Oxfmt per `migrate-oxfmt`; `oxfmt --check` must pass on the unchanged tree.
- **Format PARTIAL** → keep Prettier, or migrate and land the listed drift as its own formatting-only commit — never mixed into feature changes.
- **Afterwards** → update scripts, CI, and editor settings; re-run the check (expect ADOPTED); the net-positive gate applies — no new lint failures.
