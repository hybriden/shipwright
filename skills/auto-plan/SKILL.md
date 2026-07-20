---
name: auto-plan
description: "Use when a development task needs to be decomposed into an implementation plan. Triggers on: 'plan this', 'plan the task', 'break this down', 'decompose this', 'create an implementation plan', 'what's the plan', 'how should I implement', 'task decomposition', 'plan before coding', 'write a plan'. Also triggers on: 're-plan', 'update the plan', 'the plan needs fixing'. Use before any code is written."
---

# Auto-Plan

Analyze a codebase and decompose a development task into an ordered implementation plan with exact file paths, acceptance criteria, and a test strategy for every step.

**Core principle:** Understand everything before touching anything. Read first, plan second, implement never (that's auto-impl's job).

Part of the shipwright pipeline — do NOT invoke superpowers skills. Leaf skill (writes no code).

## Iron Law

```
NO IMPLEMENTATION WITHOUT A PLAN FIRST
```

Not for "quick fixes." Not for "obvious changes." Not for "just one file."

## When to Use

Any development task, before implementation; as run Phase 2.

## Process

Learn from past runs → analyze codebase → decompose → viability check (refine until all viable) → plan simulation (fix context/ordering) → output.

## Phase 0: Learn from Past Runs

Read prior "Plan Retrospective" sections in `docs/plans/*` and `.shipwright-retrospective.md` (cross-run learnings). Common lessons: wrong decomposition seams → follow real boundaries; vague criteria → be explicit; frequent NEEDS_CONTEXT → more context per task; wrong granularity → adjust. Apply them (e.g. "tasks modifying src/utils always conflict" → plan those as one task). No retrospectives → first run, plan conservatively.

## Phase 1: Codebase Analysis

**Read the architecture map first** (`docs/architecture-map.md`) per `../_shared/architecture-map.md` — it gives module boundaries, interfaces, dependency direction, patterns, and hot spots, so you can skip broad scanning and focus reading on the task's modules. **No map** → manual scan: Glob the structure; Grep for package manager/deps, test framework config, existing test patterns, CI/CD, lint config, entry points; read key files for conventions, architecture, error/logging patterns.

## Phase 2: Task Decomposition

Guided by the map: decompose **along module boundaries** (not feature lines), order by the **build dependency graph** (upstream before dependents), flag hot-spot tasks (extra context + stronger model), include 1-hop neighbor interfaces in each task's context, and reference the map's patterns explicitly.

**Plan the minimal solution** (per `../_shared/minimalism.md`): reuse / stdlib / native before new code, no unrequested abstractions, the fewest tasks that actually solve it. Never simplify away the safety carve-outs listed there. Structure the design to SOLID (`../_shared/solid.md`) — separate responsibilities (SRP) and place abstractions at real I/O seams, but not before a second concrete case earns them.

**Atomic change groups — must change together or not at all:**
- Interface + all implementations (splitting → build failures between tasks)
- Data model + all consumers (splitting → half the codebase sees the old shape)
- Shared config + all readers
- Migration + the code that depends on it

**Shared resource conflicts — merge or strictly order:** two tasks touching the same config file, two adding migrations (ordering is critical), two modifying the same build file or shared utility.

Break each task into one-action steps (2-5 min): write the failing test → run it (fails) → minimal implementation → run (passes) → commit.

## Phase 3: Viability Check

Stress-test each task before output:

1. **Can a subagent implement this in isolation?** Real file paths + defined interfaces, no hidden whole-system dependency, no circular dependency on a later task.
2. **Are acceptance criteria verifiable?** Each must map to a command + expected output. "Handles errors gracefully" ✗; "returns 400 `{error:'missing field'}` when name omitted" ✓.
3. **Right seams?** Boundaries match real modules; no two tasks edit the same files; no hidden coupling; no atomic group split; no shared-resource conflict; order respects build deps.
4. **Behavioral not structural tests?** Plan tests that assert behavior + error paths, not "function exists and returns a type."

Verdict per task: VIABLE / NEEDS_REFINEMENT / SHOULD_SPLIT / SHOULD_MERGE / WRONG_ORDER. Any non-VIABLE → fix before output.

## Phase 4: Plan Simulation

Mentally execute as a fresh subagent (only task description + context block + test command; no plan file, no memory of other tasks). Per task ask: do I have the signature, import path, and precise expected behavior to write the test? After implementing, can I get a clear pass/fail? Will my work survive the next task (does it modify my files or change my interfaces — and is that acknowledged)? Any failure → add context, clarify interfaces, reorder, or merge. 2-3 min here saves 20 min of subagent failures.

## Phase 5: Plan Output

Save to `docs/plans/YYYY-MM-DD-<task-name>.md`:

```markdown
# [Task] Implementation Plan
**Goal / Architecture / Architecture Map / Modules Involved / Hot Spots Affected / Tech Stack / Test Framework / Coverage Target**
---
### Task N: [Component]
**Files:** Create · Modify (path:line-range) · Test
**Acceptance Criteria:** [specific, verifiable]
**Steps:** 1 write failing test [code] · 2 run → FAIL "[error]" · 3 minimal impl [code] · 4 run → PASS · 5 commit [message]
```

Adaptation: small 1-3 tasks; medium 3-8 (group by component); large 8+ (group by layer/module, mark inter-task deps). Always: exact paths, complete code, exact test commands + expected output, explicit criteria, and a test strategy in every task (not an afterthought).

## Integration

run Phase 2; leaf skill. Consumes the map (auto-map), pre-flight findings (auto-setup), plan retrospectives (auto-review), and `.shipwright-retrospective.md` (run). Produces the plan file (`docs/plans/*.md`) for auto-impl (execution), auto-review (spec compliance), and production-readiness (Gate 11 Definition of Done).

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "Too simple to plan" | Simple tasks have the most assumptions. Plan it. |
| "The criteria are obvious" | Then writing them takes 10 seconds. Do it. |
| "The subagent will figure it out" | Subagents are context-limited. Spell out interfaces, imports, deps. |
| "This decomposition is clean" | Clean ≠ correct. Does it match the actual code seams? |
| Split an atomic change group | Interface in task 2, impl in task 5 = guaranteed build failure. |
| Ignore build order | A downstream task before its upstream = the subagent can't compile. |
| Vague language ("appropriate error handling") | Unverifiable. Rewrite as a testable criterion. |
| Plan for code you haven't read | Always read existing files before planning modifications. |
