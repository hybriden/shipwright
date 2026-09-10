---
name: auto-impl
description: "Use when an implementation plan exists and needs to be executed via subagents. Triggers on: 'implement the plan', 'execute the plan', 'run the implementation', 'start implementing', 'dispatch subagents', 'build from plan', 'implement these tasks'. Also triggers on: 'resume implementation', 'continue implementing', 'retry the implementation'. Executes autonomously with zero human interaction."
---

# Auto-Impl

Execute an implementation plan by dispatching a fresh subagent per task, with automatic error recovery and re-planning for blocked tasks.

**Core principle:** Fresh subagent per task (no context pollution) + autonomous error handling (no human escalation) = reliable execution at scale.

Part of the shipwright pipeline — do NOT invoke superpowers skills.

## Iron Laws

```
NO TASK PROCEEDS UNTIL THE PREVIOUS TASK'S TESTS PASS AND THE BUILD IS CLEAN.
```

A green bar AND a clean build are the gate to the next task.

## When to Use

After auto-plan produces a plan; as the run implementation phase; whenever you have an ordered task list with exact file paths, interfaces, and acceptance criteria.

## Process

For each task in order: dispatch implementer → integrity-check the DONE claim → build gate → test gate → net-positive gate → checkpoint → next. After the last task: the phase-end full suite. On BLOCKED, re-plan the task. On failure, dispatch a fix subagent (≤3 attempts, escalating the model). Each task runs as a Shipwright iteration loop (`../_shared/loop.md`): the inter-task learning log is its **State**, 3 attempts its **budget**, and every retry must change something (see Error Recovery) — its **escalation ladder**.

Test runs follow `../_shared/pace.md`: the task gate runs the affected tests (`lean`) or the full suite (`thorough`), and baselines come from the evidence ledger — never a fresh pre-task run.

**Small tier (`lean`):** one implementer gets every task's full text in order and commits per task; then run the integrity check, build gate, phase-end full suite, and net-positive gate once for the whole plan, with one checkpoint.

## Dispatching Subagents

Use `./implementer-prompt.md`. Always paste the **full task text** — never make the subagent read the plan file. Assemble context within budget (see `../_shared/context-budget.md`): full task description, task lens, scene-setting (where it fits), what previous tasks built, the inter-task learning log, the affected-test command for the task's files, the working directory.

**Task lens:** if `docs/architecture-map.md` exists, extract a ≤150-line lens per subagent — the task's modules (interfaces + responsibilities), 1-hop neighbor interfaces, relevant hot spots and patterns. Pass the lens, not the full map (their context is precious). Hot-spot tasks get the full dependency chain and a stronger model.

**Stack lens:** when a `[dotnet-skills]` or `[skill-packs]` index is present, point the subagent at the matched skill(s) for its task (their `SKILL.md` paths) so it Reads that guidance before writing the stack's code. Reference the path — never copy the content. Protocol: `../_shared/stack-skills.md`.

## Inter-Task Learning

Maintain a running log; after each task record: files created/modified, interfaces exposed (with signatures), patterns established (naming, error handling, imports), surprises (deviations from the plan), and integrity-check findings. Feed it forward to task N+1 so later tasks use the **real** interfaces previous tasks created — not what the plan predicted. This prevents the #1 subagent failure: assuming task N-1 built exactly what the plan said.

## Model Selection & Escalation

Per `../_shared/model-selection.md`: start with the least capable model that fits; escalate only for capability gaps, never for information gaps.

| Task | Start model |
|---|---|
| 1-2 files, complete spec | haiku / sonnet |
| Multi-file, integration | default |
| Design judgment, broad codebase | opus |

After a failure: attempt 2 → default (if it was a logic/quality issue), attempt 3 → opus. Do NOT escalate for NEEDS_CONTEXT — provide context and re-dispatch at the same level. Never downgrade once escalated.

## Handling Subagent Status

- **DONE** — run the integrity check, then the build gate + test gate. Tests fail → auto-debug with the failure context, the profile, and the ledger baseline.
- **DONE_WITH_CONCERNS** — address correctness concerns before proceeding; note observational ones.
- **NEEDS_CONTEXT** — provide the missing context, re-dispatch the same prompt. If it doesn't exist, find it in the codebase.
- **BLOCKED** — do NOT escalate to a human. Analyze: context problem → provide + re-dispatch; too complex → split into smaller tasks + re-dispatch each; wrong plan → re-plan this task. Still blocked after 2 retries → mark FAILED, continue with remaining tasks.

## Implementation Integrity Check (before trusting DONE)

A 1-minute independent sanity check, not a full review:

1. Did it create/modify the planned files? (`git diff --name-only` vs the task's file list — missing = incomplete, extra = scope creep.)
2. Does the code implement the acceptance criteria, or something adjacent? (Read the core logic ~30s; do signatures match?)
3. Do the tests test the requirement or the implementation? (Behavior-named tests, not `test_functionName_works`.)

Fails → give feedback and re-dispatch; don't run the suite hoping it catches fundamentally wrong code.

## Build Verification Gate (before the test gate)

Run the build using the command auto-setup already detected (`.shipwright.json` `buildCommand`, passed forward from setup — don't re-derive it); only when running standalone without a setup signal, auto-detect (`dotnet build` / `npm run build` / `cargo build` / `go build ./...`). Record the result in the ledger. Build fails → do NOT run tests (build errors cascade into meaningless failures). Check whether the task changed a shared interface/model/upstream module without updating consumers, or split an atomic change group; dispatch a fix subagent with the build error + the build-dependency chain from the map.

## Net-Positive Gate (after the test gate)

Baseline = each test's most recent result in the evidence ledger (setup's run for task 1, then each gate's run) — don't re-run the suite to capture it. After the task, the gate's run must be net-positive vs baseline (see `../_shared/net-positive-gate.md`). A regression in a previously-passing test means: fix within the current task's scope if it's a simple interface mismatch; **re-plan the conflicting tasks as one** if it's a design conflict (the plan decomposed along wrong seams). Record breakage + resolution in the inter-task log — it informs the plan retrospective.

## Phase-End Full Suite

After the last task, run the full suite with the coverage command on HEAD — auto-test reuses it as its baseline. Reuse the last gate's run instead if it already was the full suite with coverage on HEAD. A regression the affected-test gates missed → find the commit that introduced it (`../_shared/checkpoints.md` → Localize) and handle it as that task's failure: auto-debug with that task's diff, net-positive gate, checkpoint.

## Checkpoints

Tag after each task passes build + tests (`shipwright/checkpoint-task-N`); see `../_shared/checkpoints.md`. Roll back when a task fails 3 attempts with worsening failures, a fix is net-negative, or circular fixing is detected.

## Error Recovery

Max 3 attempts per task (original + 2). Every retry must change something — more context, simpler scope, different approach, or a stronger model; never re-run the identical prompt. If a task fails, assess and re-plan its downstream dependents before continuing.

## Integration

Phase 3 of shipwright:run. Consumes the plan (auto-plan), the map lens (auto-map), and build/test commands + env fingerprint + first ledger entries (auto-setup). Produces committed code + initial tests, the inter-task learning log, checkpoint tags, the phase-end suite + coverage run (for auto-test), and cascading-breakage incidents for auto-test and auto-review. Invokes auto-debug on test/build failure.

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| Dispatch implementers in parallel | File conflicts. One at a time, always. |
| Reuse one subagent across tasks | Context pollution. Fresh subagent + inter-task log only (a Small `lean` plan is the one exception). |
| "Tests fail, I'll fix it next task" | Hard gate. Fix before proceeding. |
| "The subagent said DONE" | A claim, not proof. Integrity-check first. |
| Retry the same prompt | Same input = same output. Change something. |
| Skip the build gate | Tests on a broken build = hundreds of cascading errors. |
| Re-run the suite before each task for a baseline | The ledger has it. Same commit, same result. |
| "Haiku can handle this" (judgment task) | Probably can't. Escalate for design / multi-file coordination. |

## Prompt Template

See `./implementer-prompt.md`.
