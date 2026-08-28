# Changelog

All notable changes to Shipwright. Format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/). Versions track the `version` field in `.claude-plugin/plugin.json`.

## [3.15.0] — 2026-08-28

- **Communication law** added to the always-on Code Laws hook: shortest fully-informative messages, no swaddling, grounded decisions, bullets preferred (simple tables for multi-dimensional data), specific and precise. Injected into every session and subagent — no per-skill wiring.

## [3.14.0] — 2026-08-27

- **Declared principle deviations.** The `ponytail:` marker now also covers any design law knowingly not upheld (name the law and why); the run report gains a **Principle Deviations** section aggregating every marker; never-fake-compliance added as an always-on Code Law.

## [3.13.0] — 2026-08-27

- Two new Code Laws: **self-explanatory code** (`_shared/comments.md` — default zero comments, delete test) and **modern-idiom concision** (`_shared/modern-idiom.md` — least idiomatic code, bounded by toolchain version). Wired into the implementer prompt and auto-review.

## [3.12.0] — 2026-07-23

- **Modernized the `harness` skill to current Claude Code and wired it into the shared foundation.** The Agent Team & Skill Architect was built on the removed `TeamCreate`/`TeamDelete` "Agent Teams" API and defaulted to it; a verification against the official docs (v2.1.178+) confirmed those tools no longer exist and the recommended model has inverted. Rewrote the mechanism layer across `SKILL.md` and the references (`agent-design-patterns.md`, `orchestrator-template.md`, `team-examples.md`, `skill-writing-guide.md`, `skill-testing-guide.md`): **Subagents (`Agent` + `SendMessage`, orchestrator-as-hub) are now the default**, and **Agent Teams are an experimental opt-in** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; automatic spawn/cleanup; no `TeamCreate`/`TeamDelete`). Generated `.claude/agents/*.md` and `.claude/skills/*/SKILL.md` now carry current **YAML frontmatter** (agent `name`/`description`/`tools`/`model`; skill `user-invocable`/`context: fork`/`allowed-tools`/…), with `model:` set in frontmatter rather than per Agent call.
- **No longer an island:** the harness now consumes the shared foundation — its bounded loops (Phase 6 validation, Phase 7 evolution, Producer-Reviewer) cite `_shared/loop.md`; model choice defers to a new **`_shared/model-selection.md`** (also referenced by `auto-impl`, deduping the model-tier principle); and generated infra is directed to obey the **Code Laws** (auto-injected by the always-on hook). Phase 7's health check is framed as `auto-eval`'s scorecard one level down.
- The durable design content — the six architecture patterns, agent separation criteria, the QA boundary-bug catalog, trigger-testing methodology, and the with/without-skill comparison — was preserved. No behavioral change to the other pipeline skills.

## [3.11.0] — 2026-07-23

- **DRY consolidation of runtime verification.** Extracted two shared references that had been re-specified across skills: `_shared/runtime-probing.md` (the app-type → tools/assertions matrix — web→Playwright, API→curl status+body, CLI→exit code+stdout, DB→queries, library→consumer test) and `_shared/project-tools.md` (the "scan `tools/`·`scripts/`·`Makefile`·package.json scripts·… then run on real input and validate with the project's own tools" discovery pattern). `auto-e2e`, `auto-verify`, and `auto-debug` now reference the one probing matrix — each keeping only its own framing (e2e adds coverage breadth; verify adds stateful-journey + domain deep layer); `auto-debug` and `auto-verify` reference the one tool-discovery pattern. The two subagent dispatch templates intentionally retain a condensed inline copy (prompt text sent to subagents that can't resolve `_shared/`), with sync notes on both sides.
- **Consume, don't re-derive:** `auto-impl`'s build gate now uses the build command `auto-setup` already detected (`.shipwright.json` `buildCommand`), auto-detecting only when run standalone. No behavioral change.

## [3.10.0] — 2026-07-23

- Added the **outer evaluation loop** — a new standalone skill `auto-eval` that closes the self-improvement loop over the pipeline itself. It runs Shipwright against a task suite and **scores each run from the artifacts the pipeline already emits** (production-readiness gate table, run's Pipeline Quality reflection, E2E/verify evidence verdicts, and the plan retrospective) across five 0–2 dimensions — Outcome, Honesty, Evidence, Efficiency, Plan fidelity — then feeds **cross-run** weaknesses back into `.shipwright-retrospective.md` (already read by `auto-plan`). A dimension with no backing artifact scores 0 and flags a pipeline *observability gap*.
- The eval loop is itself a `_shared/loop.md` loop at the meta level (State = `.shipwright/eval-scorecard.md`; Progress = suite-mean trend), and its **meta-gate** applies `net-positive-gate.md` to Shipwright itself — a change to the pipeline ships only if the suite aggregate rises with no dimension regressing on any task. Two modes: `score` (cheap, default — grade completed runs) and `loop` (heavyweight — run the suite end-to-end, warns before launching N full pipelines). New `.shipwright.json` `eval` block (`enabled`/`suiteDir`/`scorecard`/`mode`/`maxTasks`); zero-config defaults to scoring the latest run. Pure composition — reuses `run`'s branch isolation, the existing artifacts, and the retrospective channel; no new instrumentation.

## [3.9.0] — 2026-07-23

- Added a shared **iteration loop contract** (`_shared/loop.md`) — the single-sourced anatomy every Shipwright loop instantiates: **State** (the durable record carried across iterations), **Step** (one coherent change + real evidence), **Gate** (net-positive or roll back), **Progress + stall detection** (a monotonic metric plus canonical circle/no-progress signals), and **Termination** (exactly three exits — SUCCESS / BUDGET / STALL — with an escalation ladder; non-success reports PARTIAL and never fakes success or loops forever). `auto-debug` (3 hypotheses), `auto-impl` (3 attempts/task), `auto-review` (3 cycles/stage), and `auto-verify` (20 iterations) now reference the one contract and fill in only their own budget and verdict words.
- Pure DRY consolidation — **no behavioral change**. The contract *composes* the existing `net-positive-gate.md` (the Gate) and `evidence-evaluation.md` (the evidence bar) rather than duplicating them, and removes the divergent stall-detection prose that had been re-specified in each looping skill.

## [3.8.0] — 2026-07-20

- Added a **React verify gate** — in React projects only, `auto-review` (new Stage 2.6 "React Health") runs [millionco/react-doctor](https://github.com/millionco/react-doctor) (Modified-MIT) as a **deterministic static analyzer over the diff**, and treats its findings as evidence. Unlike the .NET integration (injected guidance), this is a scanner: `error`-severity findings are routed to the implementer and re-scanned under the anti-regression gate. New `hooks/react/react-doctor.js` runner — **local-only** (`--no-score --no-telemetry`, never phones home), **diff-scoped** (`--scope changed --base`, with a changed→full fallback when there is no git base), reads `.shipwright.json`, normalizes/renders findings; fetched transiently via `npx` (nothing vendored).
- New `_shared/react-doctor.md` protocol; `.shipwright.json` `reactDoctor` block (`enabled`/`scope`/`base`/`blocking`/`categories`/`version`/`maxWarnings`); opt out with `reactDoctor.enabled: false`. Empirically validated on a controlled fixture: caught 6/8 planted bugs + 2 bonus real a11y issues with zero false positives on clean idiomatic code (~0.5s scan). Coverage is not exhaustive (thin on security), so it augments rather than replaces the other review stages.

## [3.7.0] — 2026-07-20

- Added **dynamic .NET skills** — in .NET projects only, Shipwright taps [managedcode/dotnet-skills](https://github.com/managedcode/dotnet-skills) (MIT) for idiomatic .NET guidance **without vendoring any content**. New `hooks/dotnet/`: `detect.js` (near-zero-cost, pure-fs .NET gate — no process spawns, so non-.NET repos pay nothing), `engine.js` (drives the official `dotnet-skills` CLI via `install --auto` to install project-matched skills into an out-of-repo cache at `~/.claude/.shipwright/dotnet-skills/<project>/`, keeping the repo tree clean; builds a compact index; honors `.shipwright.json`), and `inject-dotnet-skills.js` (SessionStart/SubagentStart hook injecting the `[dotnet-skills]` index; ~45 ms, never installs).
- Wired into `run` as **Phase 1.75 (.NET Skills)** with a "dotnet lens" signal to plan/impl/test/review, a single-sourced consumption protocol (`_shared/dotnet-skills.md`) referenced by `auto-plan`/`auto-impl`/`auto-test`/`auto-review`, and an `auto-test` framework-detection row for `dotnet test`. New `.shipwright.json` `dotnetSkills` block (`enabled`, `installTool`, `bundled`, `refreshDays`, `only`, `exclude`); opt out with `SHIPWRIGHT_DOTNET_SKILLS=off`. Skills are Read on demand from the cache — never copied into the repo.

## [3.6.0] — 2026-07-20

- Added an **always-on Code Laws hook**: a `SessionStart` (startup/resume/clear/compact) + `SubagentStart` hook injects a distilled version of the design principles into every session and subagent, so they apply to *all* coding — not only inside the pipeline. Cross-platform (node, with a PowerShell variant); opt out with `SHIPWRIGHT_CODE_LAWS=off`. Added `hooks/` and the `hooks` field in `plugin.json`.

## [3.5.1] — 2026-07-20

- Documented the `_shared/` design principles in README and CLAUDE.md (new "Design Principles" section).
- Closed code-quality gaps so no rule is forgotten: added *small & composable functions*, *minimize hidden side effects / implicit behavior*, and *maintainability-first / no premature optimization* to `_shared/dry-kiss.md`; SRP in `_shared/solid.md` now covers splitting monolithic modules by feature/domain (reconciling minimalism's "fewest files").

## [3.5.0] — 2026-07-20

- Added **DRY & KISS** design principles (`_shared/dry-kiss.md`), threaded through plan → build → review and reconciled with SOLID and minimalism (KISS clarity beats minimalism terseness when they conflict).

## [3.4.0] — 2026-07-20

- Added an always-on **SOLID** design check (`_shared/solid.md`) across plan → build → review, balanced against minimalism — abstraction is earned only at a real I/O seam or a second concrete case.

## [3.3.0] — 2026-07-20

- Added the **minimalism / "lazy senior dev"** decision ladder (`_shared/minimalism.md`) and the standalone `auto-minimize` skill, distilled from [ponytail](https://github.com/DietrichGebert/ponytail) (MIT). Added an over-engineering review lens (auto-review Stage 3.5).

## [3.2.0] — 2026-07-20

- Condensed all 11 skills and 5 subagent prompt templates (~71% smaller, no behavioral change). Extracted shared references to `_shared/` (architecture-map consumption, net-positive gate, evidence evaluation, context budget, checkpoints).

## [3.1.0] — 2026-04-07

- Reduced over-steering, collapsed duplicate verification, and made pipeline depth adapt to task size.

## [3.0.0] — 2026-04-06

- Renamed the plugin to **Shipwright**; fixed all harness audit findings. Renamed the config file to `.shipwright.json` and updated repo URLs.

## [2.2.0] — 2026-04-06

- Added the `harness` skill (Agent Team & Skill Architect) for generating project-specific agent teams and skills.

## [2.1.0] — 2026-03-25

- Enforced continuous pipeline execution — never stop between phases.

## [2.0.0] — 2026-03-24

- Architecture mapping (`auto-map`), anti-regression gates, contract testing, and pipeline checkpoints. Also introduced `auto-verify` for iterative runtime verification (landed 2026-03-16).

## [1.6.0] — 2026-03-11

- Epistemological rigor and feedback loops across all skills.

## [1.2.0] — 2026-03-10

- Added `auto-debug` (systematic root-cause analysis); subsequently hardened to prove every fix through automated verification, with advanced debugging techniques and project-tool discovery.

## [1.1.0] — 2026-03-10

- Git branch isolation, the `auto-setup` skill, project config support (`.implementor.json`, later `.shipwright.json`), and progress updates.

## [1.0.0] — 2026-03-10

- Initial release (originally the "implementor" plugin): the autonomous pipeline — `auto-plan`, `auto-impl`, `auto-test`, `auto-e2e`, `auto-review`, `production-readiness`, and the `run` orchestrator — with plugin and marketplace manifests.
