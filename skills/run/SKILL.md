---
name: run
description: Use when given a development task to implement autonomously with full planning, implementation, testing, review, and production readiness verification
---

# Run

Master orchestrator. Takes a development task and delivers production-grade code with zero human interaction, chaining every sub-skill in strict sequence: triage, map + setup, stack skills, plan, implement, unit test, review, E2E test, readiness.

**Core principle:** Task in, production-grade system out. Every phase passes before the next begins. Evidence before claims — and evidence already gathered is reused, never re-proven (`../_shared/pace.md`).

While run is active it **overrides all superpowers skills** — the shipwright handles planning, implementation, and review internally. Ignore any suggestion to invoke a superpowers skill.

## Iron Law

```
EVERY PHASE MUST COMPLETE BEFORE THE NEXT BEGINS.
```

A passing phase is the gate to the next. Map and setup form one parallel step: both gates pass before Plan.

## Execution Rules (hard)

- **Never skip a phase** (unless `.shipwright.json` `skipPhases` allows). Size tiers scale a phase's depth, never whether it runs.
- **Never ask the user for input mid-run** — decide autonomously, document why. The one exception is asked before planning starts: the skill-library offer in Phase 1.75.
- **Never stop between phases.** Emit the progress line AND start the next phase in the same turn. The only valid stopping points are the final report (success) or a failure report (recovery exhausted).
- **Never declare completion** without all production-readiness gates passing.

## When to Use

Any development task, when autonomy is expected and production-grade quality is the target.

## The Pipeline

Each phase is invoked via the **Skill tool**, gated, and checkpointed. Any failure routes to Error Recovery.

| # | Phase | Skill |
|---|---|---|
| 0 | Branch isolation | inline |
| 1 | Context, config + size triage | inline |
| 1.25 | Map (parallel with 1.5) | auto-map |
| 1.5 | Setup | auto-setup |
| 1.75 | Stack skills (when a source matches) | inline |
| 2 | Plan | auto-plan |
| 3 | Implement | auto-impl |
| 4 | Unit test | auto-test |
| 5 | Review | auto-review |
| 6 | E2E test | auto-e2e |
| 7 | Production readiness | production-readiness |

Review precedes E2E so E2E proves the final, reviewed code — review fixes can't leave its evidence stale.

Then: final report → offer merge / keep branch for PR / discard.

## Phase Tracking (mandatory, every phase)

1. `TaskCreate` "Phase N: [name]"; set `in_progress`; record the start timestamp.
2. Invoke the sub-skill via the **Skill tool** — never read its SKILL.md and follow it inline (that pollutes context and breaks phase isolation). Map is the one exception to where it runs: a background subagent invokes it via the Skill tool (see Phases 1.25 + 1.5).
3. When its gate passes: `TaskUpdate` → completed; create a checkpoint (see `../_shared/checkpoints.md`); emit the progress line; **immediately start the next phase** — no gap, same turn.

## Progress Updates

Emit a plain-text line at every transition; the user should see continuous progress, not silence:

```
[shipwright] Phase 3/8: Implementing task 2/5 — AuthService
[shipwright] Phase 4/8: Testing (coverage 62% → 84%)
[shipwright] COMPLETE: all gates passed. Branch: shipwright/add-user-auth
```

## Pace

`../_shared/pace.md` governs every phase's depth and test runs. You own its run-level state and pass it to every phase:

- **Profile** — `lean` (default) or `thorough`, from `.shipwright.json`.
- **Size tier** — triaged in Phase 1, re-checked after Plan.
- **Evidence ledger** — every build/test/coverage/scan result with its commit, so no unchanged commit is re-tested.
- **Metrics** — phase timestamps and run counts, for the report.

## Cross-Phase Signal Propagation

Don't invoke skills blindly — pass forward what each phase learned:

| From | Signal | To | Use |
|---|---|---|---|
| Triage | Profile + size tier | all | depth, test selection, load/E2E triggers |
| Map | Map + task lens | all | boundaries, deps, hot spots, compressed context |
| Map | Data models + contract gaps | plan, test, review | atomic groups, contract tests, blast radius |
| Setup | Env fingerprint | debug | code bug vs env bug |
| Setup | First ledger entries (build, suite results + duration) | impl, test, debug | task-1 baseline, fast-suite exception |
| Setup | Pre-flight findings | plan, impl | decomposition constraints |
| Setup | Oxc verdict (JS/TS) | plan, readiness | lint/format tooling choice; Recommendations |
| Stack skills | stack lens (matched SKILL.md paths) | plan, impl, test, review | Read the matched skill on demand for the stack's idioms |
| Plan | Task viability verdicts + files touched | impl, run | flagged tasks get more context / stronger model; tier re-check |
| Impl | Inter-task learning log | impl (next task) | real interfaces, patterns, surprises |
| Impl | Cascading breakage incidents | review | wrong-decomposition signal |
| Impl | Phase-end suite + coverage run | test | coverage baseline |
| Test | Honesty + testability results | review, readiness | which tests are shape-only |
| Review | Categorized quality findings | readiness | Gates 5, 6, 8, 9, 10 start from them |
| Review | Fidelity + plan retrospective | readiness, plan (next run) | quality signals, feedback loop |
| E2E | Evidence verdicts | readiness | Gate 3: proven vs superficial |
| All | Evidence ledger | readiness | Gates 1-2 reuse results on an unchanged commit |

## Phase 0: Branch Isolation

Require a clean tree (`git status`; if dirty, report and abort). Note the current branch as `originalBranch`. Create `shipwright/<task-slug>` (lowercase, hyphens, ≤50 chars; prefix from `.shipwright.json` `branch.prefix`) and check it out. **On failure:** all commits stay on the feature branch, original untouched — report the branch name. **On success:** offer merge / keep for PR / discard (unless `branch.autoMerge`).

## Phase 1: Context, Config + Size Triage

Read `.shipwright.json` (pass to all phases). Detect the stack from manifests (package.json / requirements.txt / go.mod / Cargo.toml / *.csproj / *.sln / …) and read CLAUDE.md / lint / editorconfig conventions. Leave structure to auto-map and command detection to auto-setup — one scan each, not three. Classify the size tier per `../_shared/pace.md`. Output: parsed config, profile, stack, conventions, tier.

## Phases 1.25 + 1.5: Map ∥ Setup

Independent — map reads code, setup installs and verifies. Dispatch a background subagent (Agent tool) that invokes `shipwright:auto-map` via the Skill tool with the task, tier, and profile; meanwhile invoke auto-setup yourself. Plan starts when both gates pass. Skip setup if `skipPhases` includes `setup`.

## Phase 1.75: Stack Skills (when a source matches)

Make project- and task-matched skills available on demand — never vendored. Protocol: `../_shared/stack-skills.md`. Skip when `skipPhases` includes `stackSkills` (or the legacy `dotnetSkills`). Everything lands in out-of-repo caches, so this phase changes **nothing in the repo** — no checkpoint.

1. **Acquire what the repo signals.** The always-on hooks surface the exact commands: `[dotnet-skills]` in .NET repos (`node "…/dotnet/engine.js" acquire --project "…"`) and `[skill-packs]` (`node "…/skill-packs/engine.js" acquire --project "…"`). Run each one present.
2. **Add what the task targets.** A platform the task builds on that the repo doesn't show yet ("add a Cloudflare Worker", "store uploads in S3") → the same `acquire` command with `--pack <id>`.
3. **Offer the skill library — the run's only question.** When the task builds something specific that no source above covers (a payment provider, auth service, database, test framework, …), run `node "…/skill-packs/library.js" search "<2-3 keywords>"` from the project root. If candidates pass its quality gate, ask once with `AskUserQuestion` (multiSelect; each option shows publisher, official or community, installs, audit status), then run the printed `engine.js add` command for each pick. No candidates, no picks, or no interactive user → continue without asking.
4. **Degrade, never block.** A failed fetch or search (offline, no SDK or `npx`) is noted and the run continues — these are enhancements, not gates.
5. **Build the stack lens.** From the refreshed indexes, pick the skills the task touches (EF migrations → `entity-framework-core`; Worker bindings → `workers-best-practices`; S3 uploads → `aws-storage`) and record their `SKILL.md` paths — the lens passed to plan/impl/test/review.
6. **Pass forward.** Subagents already receive the indexes via the SubagentStart hooks; when dispatching, also point each at the matched skill(s) for its task.

Progress line: `[shipwright] Phase 1.75: stack skills — 7 matched (aws 5, dotnet 2); library: 1 added` (or `— none matched`).

## Phases 2–7

Invoke each sub-skill via the Skill tool, passing the signals above plus profile, tier, and ledger. Each skill owns its own process — the orchestrator's job is to feed context in and gate the output:

- **2 Plan** (auto-plan) → plan in `docs/plans/`. Re-check the tier against the plan's files touched; upgrade per `../_shared/pace.md` if bigger.
- **3 Implement** (auto-impl) → committed code + tests, per-task progress, and a phase-end full suite with coverage.
- **4 Unit test** (auto-test) → gap-fill changed code to the coverage target.
- **5 Review** (auto-review) → spec + quality reviewers in parallel with the inline lenses (fidelity, architecture, React, over-engineering); batched fix rounds (≤3).
- **6 E2E** (auto-e2e) → detect app type, run diff-targeted scenarios with evidence on the reviewed code. Skip for libraries or `skipPhases: e2e`, with justification.
- **7 Readiness** (production-readiness) → 11 gates from the ledger, review findings, and deterministic checks + final report.

## Error Recovery

On any phase failure, invoke **auto-debug** with full error context (command, output, stack trace, files) plus the profile, the ledger baseline, and the project-tool inventory from any earlier invocation.

- **RESOLVED** → resume at the failed phase; a fix made after Phase 5 first gets auto-review's Post-Review Fixes round.
- **UNRESOLVED** → one manual recovery attempt appropriate to the phase (setup: alt install; plan: broaden context; impl: re-plan the task; test: check assumptions; review: fix + re-review; e2e: fix startup/interaction; readiness: address the failing gate).
- **Recovery fails** → roll back to the last checkpoint (`git reset --hard <tag>` — preserves completed phases) and write a failure report: phases completed (with tags), auto-debug evidence, exact failure, what would need to change, the branch name, and the rollback point.

## Autonomous Decision Defaults

Naming/architecture: match existing conventions, else language idiom / simplest pattern that works. Dependencies: prefer stdlib, add external only when clearly needed. Test framework: use the project's. JS/TS lint + format: Oxlint + Oxfmt for new setups; where ESLint/Prettier exist, follow setup's Oxc verdict and switch only when the task asks (`../_shared/js-toolchain.md`). Errors: fail fast with useful messages, never swallow. Logging: structured JSON for services, simple for CLIs. Files: one responsibility, grouped by feature.

## Pipeline Integrity Reflection

Before the final report, one honest self-assessment (documentation, not a gate — becomes the report's "Pipeline Quality" section):

1. **Real quality or box-ticking?** Did any phase rubber-stamp — review approved first pass with zero findings, everything passed first try, E2E only proved pages load?
2. **Where did it struggle, and why?** Repeated auto-debug → wrong plan. Many review findings → underpowered implementer. Hard-won coverage → testability problems. Did pace cut too deep — a regression first caught at a phase-end suite, a fast-path fix that fell through, a load test N/A'd on a diff that reached the request path?
3. **Would I ship this with my name on it?** Re-read the diff for overall coherence — one author's voice, an approach a senior engineer would approve?

## Retrospective (feedback loop)

Append to `.shipwright-retrospective.md` (read by auto-plan next run). Per run: status, task size, what went well/wrong per phase, plan-quality notes (from review), and **actionable** signals for future runs ("tasks touching src/utils always conflict"; "this codebase needs a mocking library"). Append-only, ≤15 lines/entry, patterns not session specifics; summarize the oldest 50 if it exceeds 100 entries. The outer eval loop (`shipwright:auto-eval`) scores completed runs and appends cross-run improvement signals to the same file — closing the loop into planning.

## Report Format

Use the production-readiness Implementation Report (task, status, changes, gate table, evidence) plus these run-specific sections:

- **Branch** — feature + original.
- **Pace** — profile; size tier, and any upgrade after planning.
- **Pipeline Results** — per-phase table: status, key metric, wall-clock (Map/Setup/Stack skills/Plan/Impl/Tests/Review/E2E/Readiness); run totals: full-suite runs, affected-test runs, ledger reuses, subagent dispatches, auto-debug fast/full.
- **Pipeline Quality** — the integrity-reflection findings: phases that flagged issues vs passed first try, model escalations, dishonest tests dropped, fidelity concerns, plan-retrospective highlights, symptomatic fixes, Definition-of-Done verdict.
- **Principle Deviations** — grep the final diff for `ponytail:` markers; list each with the law/ceiling it names and why, or `None`.
- **Commits** — list.

## Red Flags — STOP

| Thought | Reality |
|---|---|
| "I'll skip the plan, it's obvious" | Obvious tasks hide complexity. Plan it. |
| "It's Small, skip review" | Tiers scale depth, never gates. |
| "Re-run the suite to be safe" | Same commit, same result. Reuse the ledger; re-run only for suspected flakiness. |
| "I need to ask the user about X" | Decide it. Document why. (Only the Phase 1.75 library offer is asked.) |
| "This community skill looks useful, I'll install it" | Only after the user picks it from a gated `library.js` search. |
| "Recovery failed, try again" | One attempt, then report failure. |
| "I'll work on main" | Never. Feature branch first. |
| "I'll copy the skill's content into the repo" | Never. Read the cached SKILL.md on demand; it stays out-of-repo and refreshes from upstream. |
| "Every phase passed first try" | Perfect code, or a pipeline not probing hard enough? Reflect. |
| "I'll update the user, then continue" | No. Emit the progress line and start the next phase in the same turn. |
