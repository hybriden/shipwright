# Pipeline Pace

Shared reference for how much work each phase does, and when — **run** (profile, triage, ledger, metrics), **auto-map**, **auto-setup**, **auto-plan**, **auto-impl**, **auto-test**, **auto-review**, **auto-e2e**, **production-readiness**, **auto-debug**.

**Principle:** spend verification where it can still change the outcome. Never re-prove what hasn't changed; never scale ceremony past the change's risk. Gates are never skipped — only their depth and timing scale.

## Profile

`.shipwright.json` `profile`: `"lean"` (default) or `"thorough"`. `thorough` turns off the four trade-off levers below. Everything else in this file applies to both profiles — it removes waste, not checks.

| Trade-off lever (`lean`) | `thorough` |
|---|---|
| Small-tier breadth cuts: lens-only map, one implementer, no load test | Small gets a 150-line map, one implementer per task, and a light load test on web/API |
| Affected tests at in-loop gates (impl task, debug fix, review fix); full suite at phase boundaries | Full suite at every in-loop gate |
| Load test and E2E responsive/a11y/header sweeps triggered by the diff | Load test on every web/API change; sweeps on every tested page and endpoint |
| auto-debug fast path for mechanical errors | Full root-cause process for every failure |

## Size Triage (run Phase 1 — before mapping)

Classify from the task text plus a quick Grep/Glob of the paths and symbols it names:

| Tier | Signals |
|---|---|
| Small | 1-3 files in one module; no shared data model, public API, migration, or hot spot |
| Medium | 4-10 files, or 2-3 modules |
| Large | 10+ files, cross-cutting, or touches a shared data model, migration, or hot spot |

Unsure → round up: under-sizing costs rework, over-sizing only time. After planning, re-check against the plan's file count. If it lands in a bigger tier, upgrade: produce what the bigger tier adds (e.g. the full map) and re-run auto-plan's viability check against it before implementing. Never downgrade mid-run.

## Depth by Tier

| Signal | Small | Medium | Large |
|---|---|---|---|
| Map (budgets: auto-map) | lens-only scan | full map | full map, full depth |
| Plan tasks | 1-3 | 3-8 | 8+ |
| Implementers | one for the whole plan | one per task | one per task |
| Impl start model | sonnet | default | opus for architecture / hot spots |
| Coverage iterations | 2 | 3 | 3 |
| E2E scenarios | 2-3 focused | 5-8 + adversarial | 10+ incl. stateful journeys |
| Review fidelity scope | top 2 fns | top 5 fns | top 5 + all public APIs |
| Load test, when triggered | N/A | light (20 users / 30s) | full (100 users / 60s) |
| Gate 11 depth | quick check | full table | full + implicit reqs |

## Test Economy

Test runs are the largest wall-clock cost in a run. Three rules.

**1. Evidence ledger — never re-test an unchanged commit.** run records every deterministic result — build, test run, coverage, react-doctor, dependency audit — as one line: check · commit · verdict · per-test pass/fail · duration. A later step reuses a result while HEAD is still that commit and `git status` shows no changes outside pipeline docs (`docs/architecture-map.md`, `docs/plans/`). The chain: setup's suite run → task 1's baseline; each task gate → the next task's baseline; auto-impl's phase-end run with coverage → auto-test's baseline; the last green full run → readiness Gates 1-2. Re-run an unchanged commit only when flakiness is suspected. No record (compaction, resume) → run it; never assume a result.

**2. Affected tests inside loops; full suite at phase boundaries.**

- **Always:** implementers and test-writers run only their own new and affected tests — a gate re-verifies after them, so their own full run is a duplicate.
- **`lean`:** in-loop gates — auto-impl task gates, auto-debug fix gates, review fix rounds — also run the affected tests. **`thorough`:** those gates run the full suite.

Affected tests = test files the step changed, contract tests at boundaries it touched, and every test whose dependency chain reaches a changed file — selected per stack:

| Stack | Selection |
|---|---|
| JS/TS | `jest --findRelatedTests <files>` / `vitest related <files>` — both walk the import graph transitively |
| .NET | each test project that references a changed project, directly or through a `<ProjectReference>` chain: `dotnet test <test project>`. Don't narrow with `--filter` — DI and reflection wiring hide which test classes reach a change |
| Go | `go test ./...` without `-count=1` (which disables the cache) — the test cache re-runs only packages whose inputs changed, which is exactly the affected set |
| Rust | `cargo test -p <crate>` for each changed crate and each crate depending on it (`cargo tree -i <crate>`) |
| Python | `pytest --testmon` when pytest-testmon is installed; else test files whose import chain reaches a changed module (grep imports, following the chain upward) |
| Other | test files whose import chain reaches a changed file |

Use the full suite instead when the step changes shared config, build files, test infrastructure (setup files, fixtures, runner config), a hot spot, or a data model with >3 consumers — or when the affected set can't be determined with confidence. **Fast-suite exception:** if setup's full run took ≤60s, gates run the full suite instead of affected tests; selection isn't worth its risk.

The full suite runs at: setup; auto-impl's phase end; each auto-test iteration (with coverage); review's end, if the tree changed; readiness (ledger first). A test's baseline is its most recent recorded result; tests new in the step are targets, not baseline. A regression first caught at a phase-end run is localized per `checkpoints.md` → Localize.

**3. Coverage targets apply to changed code.** In a pipeline run, `coverage.*` gates the source lines added or modified on the feature branch (`git diff -U0 <merge-base>...HEAD`, tests excluded), read from the per-line report (lcov / Cobertura) or `diff-cover` when installed. The project total is reported, not gated. Standalone auto-test with no task diff: the files the user named, else the project.

## Diff-Aware Gates (`lean`)

- **Load test** (web/API/services): runs when the diff reaches the request path — routes, controllers, handlers, middleware; data access (queries, ORM calls, repositories); caching; connection/pool config; response serialization. Otherwise Gate 7 is N/A, citing the changed files.
- **E2E breadth:** scenarios target the flows the diff touches (changed routes, pages, commands); every acceptance criterion still gets ≥1 scenario and the adversarial minimums hold. Responsive (375/768px) and a11y sweeps run on pages/components whose markup or styles changed; header/CORS/timing checks on changed endpoints.

## Metrics (every run)

run records a timestamp at each phase transition and counts full-suite runs, affected-test runs, ledger reuses, subagent dispatches, and auto-debug invocations (fast path / full). They go in the report's Pipeline Results and feed auto-eval's Efficiency score — the evidence that pace didn't cost quality.
