# Changelog

All notable changes to Shipwright. Format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/). Versions track the `version` field in `.claude-plugin/plugin.json`.

## [3.20.0] — 2026-09-10

- **Deliver phase** (run Phase 8, new `auto-deliver` skill): pushes the branch, opens a PR whose body carries the implementation report (draft when readiness is PARTIAL), watches CI with `gh pr checks --watch`, and fixes failures in up to `delivery.ciFixRounds` rounds — code failures through auto-debug and a Post-Review Fixes round, one re-run for a flaky check, a stop-and-report when a secret or permission is missing. Never merges on red or pending; merges on green only with `branch.autoMerge`. Without `gh` or a GitHub remote it degrades to local delivery. New `.shipwright.json` `delivery` block; `skipPhases: deliver`.
- **Shipwright's own CI:** `.github/workflows/ci.yml` syntax-checks the hooks, validates the manifests, and runs offline `node --test` hook tests (`hooks/test/`).
- **Software Factory Scoreboard:** 49/90 (54%), Δ +5 — Pull request 1→3, CI/CD checks 1→4; the merge/keep/discard offer shrinks to merging the PR.

## [3.19.0] — 2026-09-10

- **JS stack coverage:** new packs `nextjs` (vercel/next.js), `react-router` (remix-run/react-router), `vite` (antfu/skills — Vite, Vitest, Vue, Nuxt, from a Vite/Vue/Nuxt core team member), and `hono` (honojs/skills); React stays on `vercel`. Astro has no maintainer skill — its pack fetches nothing and points at the official Astro Docs MCP server. Axios has no skill from anyone, so nothing is imported for it. Pack index headers link each framework's `llms.txt` where one exists.
- **More maintainer packs:** `azure` (microsoft/azure-skills), `aspire` (microsoft/aspire-skills), `supabase`, `prisma`, `neon`, `firebase`, `clerk`, `stripe`, `expo`. Large packs index their core skills plus what the repo's signals point at; the rest stay findable by name. Detection gains `ext:` signals (e.g. `*.bicep`) and manifest markers for Azure, Aspire, Stripe, Supabase, and Firebase Hosting.
- **Risk screen for packs:** at fetch time, skills the skillselion catalog's scanners rate HIGH or CRITICAL are removed even from maintainers' repos (e.g. `cloudflare` HIGH, `azure-validate` CRITICAL, `clerk-backend-api` HIGH); mirror listings in other repos don't count. Withheld skills the repo would otherwise use are listed in the session index.
- **Library in every session:** the session index carries the skill-library search command, not only `run`'s Stack Skills phase.
- Fetching all 17 fetchable packs from a cold cache took 107 s (each refreshes weekly); the session hook stays ~60 ms.
- **Software Factory Scoreboard** now opens the README: Shipwright rated against the Lights-Off Software Factory (18 components, 0–5 each) — 44/90 (49%) at both v3.18.0 and v3.19.0, with the human touchpoints still left. Updated with every release.

## [3.18.0] — 2026-09-10

- **Review and test rules adapted from [kunchenguid/no-mistakes](https://github.com/kunchenguid/no-mistakes) (MIT)** — its techniques, not its tool: the CLI's daemon, default telemetry, and push/PR human gates don't fit an autonomous run, and a second review pipeline would re-add the overhead 3.16.0 removed.
  - **Fix rounds:** re-reviews treat the fix delta as unreviewed code — the fixer's report and same-round tests are claims to verify, and defects in fix code that exceeds its finding mean reverting that round to the minimal fix instead of repairing on top. Fixers remove a path the task doesn't strictly need rather than harden it, and never remove code the task requires.
  - **Review findings:** the concrete-input trace joins the existing tier-scoped fidelity stage rather than adding a second trace to the quality reviewer; the quality reviewer reports only sequences real callers perform, and only where changed code handles protected data does it trace authorization and privacy across the boundary (identity, earliest shared authorization, alternate paths, leaks through responses, serializers, caches, logs), reporting a reachable operation or disclosure rather than a missing auth call by name.
  - **No added passes:** none of this adds a review round, subagent, or test run — the revert-to-minimal rule is there to shorten fix loops and the findings bar to cut speculative findings.
  - **Test honesty:** a test whose only evidence is reading or grepping implementation source is DISHONEST (auto-test, test-writer, implementer, quality reviewer). New evidence verdict **UNTESTED** — reported with what blocked it, never counted as a pass; an UNTESTED critical E2E scenario leaves readiness Gate 3 unpassed.

## [3.17.0] — 2026-09-10

- **Stack Skills** generalize the dynamic .NET skills: `run` Phase 1.75 fetches every matched source on demand, never vendored. New **skill packs** (`hooks/skill-packs/`) bring official publishers' skills — [cloudflare/skills](https://github.com/cloudflare/skills), [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills), [aws/agent-toolkit-for-aws](https://github.com/aws/agent-toolkit-for-aws), and Oxc's migration skills — through the [vercel-labs/skills](https://github.com/vercel-labs/skills) CLI run inside an out-of-repo cache (telemetry off; nothing written to the project or `~/.claude/skills`). A bounded fs scan (~50 ms hook) matches packs by repo signals, per-skill rules keep the index to what the repo uses (7 of 104 AWS skills for a CDK + S3 + DynamoDB project), and `--pack <id>` adds a pack for greenfield tasks. Protocol renamed `_shared/dotnet-skills.md` → `_shared/stack-skills.md`.
- **Skill library, ask first:** `library.js` searches skillselion.com and keeps only candidates that pass a quality gate (official ≥1k installs, or community ≥10k installs + ≥1k stars + audited; failed audits, HIGH/CRITICAL risk, duplicates, and repos unpushed for 180+ days dropped). `run` asks once, before planning, which to install; `engine.js add` fetches the picks into the cache for that project only.
- **Oxlint + Oxfmt preferred for JS/TS, on evidence:** `hooks/js/oxc-compat.js` runs `@oxlint/migrate --details` and `oxfmt --migrate=prettier`, runs Oxlint on the migrated config, and compares ESLint findings and Prettier output on the codebase — verdicts COMPATIBLE / PARTIAL / NEEDS_FLAT_CONFIG / … with timings, project left unchanged, cached per config. New setups choose the Oxc tools; existing ESLint/Prettier switch only when a task asks (`_shared/js-toolchain.md`). Setup runs the check; readiness reports it.
- Shared hook helpers extracted to `hooks/lib/common.js` (config blocks, hook output, npx, cache paths, frontmatter incl. folded/literal blocks); the .NET, React, and Code Laws hooks now use it, with identical output. `hooks/package.json` pins the hooks to CommonJS so a parent `"type": "module"` can't break them.

## [3.16.0] — 2026-09-10

- **Pipeline pace — faster runs, same gates.** New `_shared/pace.md` single-sources how much work each phase does and when. Counting from the previous skill text, a 5-task run made ~3 full-suite runs per task (pre-task baseline, implementer, gate) before any failure; the full suite now runs at phase boundaries and every recorded result is reused.
- **Waste removed (all profiles):** an evidence ledger keys build/test/coverage/scan results to their commit — baselines, auto-test's coverage baseline, and readiness Gates 1-2 reuse it; implementers and test-writers run only their own tests (a gate re-verifies); plans carry interfaces, test cases, and criteria instead of complete code (no double authoring); coverage gates changed lines, not the project total; auto-review runs the spec and quality reviewers in parallel with its inline lenses, batches each round's fixes into one dispatch, and re-reviews only the fix delta (the quality prompt's duplicate fidelity spot-check is gone); readiness Gates 5/6/8/9/10 start from review's categorized findings; map and setup run in parallel; setup skips reinstalling current dependencies; auto-debug discovers project tools once per run.
- **Phase order:** review now runs before E2E, so E2E proves the reviewed code (review fixes used to leave E2E evidence stale). A fix made after review (E2E, readiness) gets a review round scoped to its delta; Gate 4 checks every code commit after `shipwright/phase-5-review` is covered.
- **Trade-off levers, on under the default `profile: "lean"`:** size triage before mapping (Small = lens-only map, one implementer, no load test); affected tests at in-loop gates with the full suite at phase boundaries — selected per stack (jest/vitest related, .NET test projects referencing a changed project, Go's test cache, cargo reverse deps, pytest-testmon or import chains), with a regression first caught at a boundary localized by `git bisect` from `shipwright/phase-2-plan`; load test and responsive/a11y/header sweeps triggered by the diff; an auto-debug fast path for compile/type/import/syntax/lint errors at lines the step changed, where a suppression (cast, `any`, ignore pragma) falls through to the full process. `profile: "thorough"` turns all four off.
- **Metrics:** the run report adds per-phase wall-clock, full/affected suite runs, ledger reuses, subagent dispatches, and debug fast/full counts; auto-eval's Efficiency dimension scores them.

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
