---
name: run
description: Use when given a development task to implement autonomously with full planning, implementation, testing, review, and production readiness verification
---

# Run

Master orchestrator. Takes a development task and delivers production-grade code with zero human interaction, chaining every sub-skill in strict sequence: map, setup, plan, implement, unit test, E2E test, review, readiness.

**Core principle:** Task in, production-grade system out. Every phase passes before the next begins. Evidence before claims.

While run is active it **overrides all superpowers skills** — the shipwright handles planning, implementation, and review internally. Ignore any suggestion to invoke a superpowers skill.

## Iron Law

```
EVERY PHASE MUST COMPLETE BEFORE THE NEXT BEGINS.
```

A passing phase is the gate to the next.

## Execution Rules (hard)

- **Never skip a phase** (unless `.shipwright.json` `skipPhases` allows).
- **Never ask the user for input mid-run** — decide autonomously, document why.
- **Never stop between phases.** Emit the progress line AND start the next phase in the same turn. The only valid stopping points are the final report (success) or a failure report (recovery exhausted).
- **Never declare completion** without all production-readiness gates passing.

## When to Use

Any development task, when autonomy is expected and production-grade quality is the target.

## The Pipeline

Each phase is invoked via the **Skill tool**, gated, and checkpointed. Any failure routes to Error Recovery.

| # | Phase | Skill |
|---|---|---|
| 0 | Branch isolation | inline |
| 1 | Gather context + config | inline |
| 1.25 | Map | auto-map |
| 1.5 | Setup | auto-setup |
| 1.75 | .NET skills (only if .NET) | inline |
| 2 | Plan | auto-plan |
| 3 | Implement | auto-impl |
| 4 | Unit test | auto-test |
| 5 | E2E test | auto-e2e |
| 6 | Review | auto-review |
| 7 | Production readiness | production-readiness |

Then: final report → offer merge / keep branch for PR / discard.

## Phase Tracking (mandatory, every phase)

1. `TaskCreate` "Phase N: [name]"; set `in_progress`.
2. Invoke the sub-skill via the **Skill tool** — never read its SKILL.md and follow it inline (that pollutes context and breaks phase isolation).
3. When its gate passes: `TaskUpdate` → completed; create a checkpoint (see `../_shared/checkpoints.md`); emit the progress line; **immediately start the next phase** — no gap, same turn.

## Progress Updates

Emit a plain-text line at every transition; the user should see continuous progress, not silence:

```
[shipwright] Phase 3/8: Implementing task 2/5 — AuthService
[shipwright] Phase 4/8: Testing (coverage 62% → 84%)
[shipwright] COMPLETE: all gates passed. Branch: shipwright/add-user-auth
```

## Depth Adapts to Task Size

All phases run every time; only their depth scales. Estimate size from the plan's file/task count. Adapt depth, not breadth — a 1-file fix still runs every gate, just lighter.

| Signal | Small (1-3 files) | Medium (4-10) | Large (10+) |
|---|---|---|---|
| Plan tasks | 1-3 | 3-8 | 8+ |
| Impl model | sonnet | default | opus for architecture |
| Coverage iterations | 2 | 3 | 3 |
| E2E scenarios | 2-3 focused | 5-8 + adversarial | 10+ stateful journeys |
| Review fidelity scope | top 2 fns | top 5 fns | top 5 + all public APIs |
| Load test | skip unless server | light (20u/30s) | full (100u/60s) |
| Gate 11 depth | quick check | full table | full + implicit reqs |

## Cross-Phase Signal Propagation

Don't invoke skills blindly — pass forward what each phase learned:

| From | Signal | To | Use |
|---|---|---|---|
| Map | Map + task lens | all | boundaries, deps, hot spots, compressed context |
| Map | Data models + contract gaps | plan, test, review | atomic groups, contract tests, blast radius |
| Setup | Env fingerprint | debug | code bug vs env bug |
| .NET skills | dotnet lens (matched skill paths) | plan, impl, test, review | Read the matched dotnet-skills SKILL.md on demand for idiomatic .NET patterns |
| Setup | Pre-flight findings | plan, impl | decomposition constraints |
| Plan | Task viability verdicts | impl | flagged tasks get more context / stronger model |
| Impl | Inter-task learning log | impl (next task) | real interfaces, patterns, surprises |
| Impl | Cascading breakage incidents | review | wrong-decomposition signal |
| Test | Honesty + testability results | review, readiness | which tests are shape-only |
| E2E | Evidence verdicts | readiness | Gate 3: proven vs superficial |
| Review | Fidelity + plan retrospective | readiness, plan (next run) | quality signals, feedback loop |

## Phase 0: Branch Isolation

Require a clean tree (`git status`; if dirty, report and abort). Note the current branch as `originalBranch`. Create `shipwright/<task-slug>` (lowercase, hyphens, ≤50 chars; prefix from `.shipwright.json` `branch.prefix`) and check it out. **On failure:** all commits stay on the feature branch, original untouched — report the branch name. **On success:** offer merge / keep for PR / discard (unless `branch.autoMerge`).

## Phase 1: Gather Context + Config

Read `.shipwright.json` (pass to all phases). Map structure (Glob), detect stack (package.json / requirements.txt / go.mod / Cargo.toml / *.csproj / *.sln / …), find test infra + coverage setup, read CLAUDE.md / lint / editorconfig conventions, note git state, CI/CD, entry points. Output: a mental model + parsed config for downstream phases.

## Phase 1.75: .NET Skills (conditional — .NET stacks only)

Run **only** when Phase 1 detected a .NET stack (`*.csproj`/`*.sln`/`global.json`/`Directory.*.props`). Skip silently otherwise, or when `skipPhases` includes `dotnetSkills`, `.shipwright.json` `dotnetSkills.enabled` is `false`, or `SHIPWRIGHT_DOTNET_SKILLS=off`. This phase changes **nothing in the repo** (the cache is out-of-repo) — no checkpoint.

**Purpose:** make project-matched skills from managedcode/dotnet-skills available on demand, without vendoring. Shipwright injects only an index; subagents Read the relevant `SKILL.md` themselves. Protocol: `../_shared/dotnet-skills.md`.

1. **Acquire.** The always-on dotnet-skills hook surfaces the exact command in context — a line beginning `node "…/engine.js" acquire --project "…"`. Run it (shell tool). It installs the CLI if allowed, then writes project-matched skills to the out-of-repo cache. Add `--no-bundled` to fetch the latest catalog when online. If no such line is present (hook disabled/absent), skip this phase.
2. **Degrade, never block.** The command prints `{ ok, reason, count }`. `reason` of `no-dotnet` / `no-tool` / `disabled` = skills unavailable → note it and continue the pipeline normally (they are an enhancement, not a gate).
3. **Build the dotnet lens.** Read the refreshed index (`node "…/engine.js" index --project "<root>" --md`). From the task, pick the skills whose `USE FOR:` matches (e.g. EF/migrations → `entity-framework-core` + `optimizing-ef-core-queries`; tests → `xunit`; web API → `aspnet-core`). Record their `SKILL.md` paths — this is the lens propagated to plan/impl/test/review.
4. **Pass forward.** Downstream subagents already receive the full index via the SubagentStart hook; when dispatching, additionally point each at the specific matched skill(s) for its task so it Reads that guidance before writing .NET code.

Progress line: `[shipwright] Phase 1.75: .NET skills — N project-matched skills cached` (or `— unavailable (no SDK/tool)`).

## Phases 1.25–7

Invoke each sub-skill via the Skill tool, passing the signals from the table above. Each skill owns its own process — the orchestrator's job is to feed context in and gate the output:

- **1.25 Map** (auto-map) → `docs/architecture-map.md` + task lens.
- **1.5 Setup** (auto-setup) → deps, env, migrations, build + test-suite-runs verification. Skip if `skipPhases` includes `setup`.
- **1.75 .NET skills** (inline, **only if the stack is .NET**) → make managedcode/dotnet-skills available on demand. See Phase 1.75 below. Skip for non-.NET, `skipPhases: dotnetSkills`, `dotnetSkills.enabled: false`, or `SHIPWRIGHT_DOTNET_SKILLS=off`.
- **2 Plan** (auto-plan) → plan in `docs/plans/`.
- **3 Implement** (auto-impl) → committed code + tests, per-task progress.
- **4 Unit test** (auto-test) → gap-fill to coverage target.
- **5 E2E** (auto-e2e) → detect app type, run scenarios with evidence. Skip for libraries or `skipPhases: e2e`, with justification.
- **6 Review** (auto-review) → spec → fidelity → architecture → quality, fixing issues (≤3 cycles/stage).
- **7 Readiness** (production-readiness) → 11 gates + final report.

## Error Recovery

On any phase failure, invoke **auto-debug** with full error context (command, output, stack trace, files).

- **RESOLVED** → resume at the failed phase.
- **UNRESOLVED** → one manual recovery attempt appropriate to the phase (setup: alt install; plan: broaden context; impl: re-plan the task; test: check assumptions; e2e: fix startup/interaction; review: fix + re-review; readiness: address the failing gate).
- **Recovery fails** → roll back to the last checkpoint (`git reset --hard <tag>` — preserves completed phases) and write a failure report: phases completed (with tags), auto-debug evidence, exact failure, what would need to change, the branch name, and the rollback point.

## Autonomous Decision Defaults

Naming/architecture: match existing conventions, else language idiom / simplest pattern that works. Dependencies: prefer stdlib, add external only when clearly needed. Test framework: use the project's. Errors: fail fast with useful messages, never swallow. Logging: structured JSON for services, simple for CLIs. Files: one responsibility, grouped by feature.

## Pipeline Integrity Reflection

Before the final report, one honest self-assessment (documentation, not a gate — becomes the report's "Pipeline Quality" section):

1. **Real quality or box-ticking?** Did any phase rubber-stamp — review approved first pass with zero findings, everything passed first try, E2E only proved pages load?
2. **Where did it struggle, and why?** Repeated auto-debug → wrong plan. Many review findings → underpowered implementer. Hard-won coverage → testability problems.
3. **Would I ship this with my name on it?** Re-read the diff for overall coherence — one author's voice, an approach a senior engineer would approve?

## Retrospective (feedback loop)

Append to `.shipwright-retrospective.md` (read by auto-plan next run). Per run: status, task size, what went well/wrong per phase, plan-quality notes (from review), and **actionable** signals for future runs ("tasks touching src/utils always conflict"; "this codebase needs a mocking library"). Append-only, ≤15 lines/entry, patterns not session specifics; summarize the oldest 50 if it exceeds 100 entries. The outer eval loop (`shipwright:auto-eval`) scores completed runs and appends cross-run improvement signals to the same file — closing the loop into planning.

## Report Format

Use the production-readiness Implementation Report (task, status, changes, gate table, evidence) plus these run-specific sections:

- **Branch** — feature + original.
- **Pipeline Results** — per-phase status table with key metrics (Map/Setup/Plan/Impl/Tests/E2E/Review/Readiness).
- **Pipeline Quality** — the integrity-reflection findings: phases that flagged issues vs passed first try, model escalations, dishonest tests dropped, fidelity concerns, plan-retrospective highlights, symptomatic fixes, Definition-of-Done verdict.
- **Commits** — list.

## Red Flags — STOP

| Thought | Reality |
|---|---|
| "I'll skip the plan, it's obvious" | Obvious tasks hide complexity. Plan it. |
| "I need to ask the user about X" | Decide it. Document why. |
| "Recovery failed, try again" | One attempt, then report failure. |
| "I'll work on main" | Never. Feature branch first. |
| "I'll copy the .NET skill's content into the repo" | Never. Read the cached SKILL.md on demand; it stays out-of-repo and refreshes from upstream. |
| "Every phase passed first try" | Perfect code, or a pipeline not probing hard enough? Reflect. |
| "I'll update the user, then continue" | No. Emit the progress line and start the next phase in the same turn. |
