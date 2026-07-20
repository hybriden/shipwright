# Changelog

All notable changes to Shipwright. Format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/). Versions track the `version` field in `.claude-plugin/plugin.json`.

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
