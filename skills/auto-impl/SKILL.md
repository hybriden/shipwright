---
name: auto-impl
description: Use when an implementation plan exists and needs to be executed via subagents without human interaction
---

# Auto-Impl

Execute an implementation plan by dispatching a fresh subagent per task, with automatic error recovery and re-planning for blocked tasks.

**Core principle:** Fresh subagent per task (no context pollution) + autonomous error handling (no human escalation) = reliable execution at scale.

<HARD-GATE>
This skill is part of the implementor pipeline. Do NOT invoke superpowers:subagent-driven-development, superpowers:executing-plans, or any other superpowers orchestration skill. The implementor handles implementation internally.
</HARD-GATE>

## Iron Law

```
NO TASK PROCEEDS UNTIL THE PREVIOUS TASK'S TESTS PASS
```

Violating the letter of this rule is violating the spirit. A green bar is the gate to the next task.

## When to Use

- After `implementor:auto-plan` has created a plan
- When invoked by `implementor:run` as the implementation phase
- When you have an ordered list of implementation tasks with exact file paths and code

## Process

```dot
digraph auto_impl {
    rankdir=TB;

    "Read plan, extract all tasks" [shape=box];
    "Create TaskCreate for each task" [shape=box];
    "Dispatch implementer subagent (./implementer-prompt.md)" [shape=box];
    "Check subagent status" [shape=diamond];
    "Mark task complete" [shape=box];
    "Run full test suite" [shape=box];
    "Tests pass?" [shape=diamond];
    "Dispatch fix subagent" [shape=box];
    "Fix attempts < 3?" [shape=diamond];
    "Mark task FAILED, continue" [shape=box];
    "Auto re-plan blocked task" [shape=box];
    "More tasks?" [shape=diamond];
    "Implementation complete" [shape=doublecircle];

    "Read plan, extract all tasks" -> "Create TaskCreate for each task";
    "Create TaskCreate for each task" -> "Dispatch implementer subagent (./implementer-prompt.md)";
    "Dispatch implementer subagent (./implementer-prompt.md)" -> "Check subagent status";
    "Check subagent status" -> "Run full test suite" [label="DONE"];
    "Check subagent status" -> "Run full test suite" [label="DONE_WITH_CONCERNS\n(note concerns)"];
    "Check subagent status" -> "Auto re-plan blocked task" [label="BLOCKED"];
    "Check subagent status" -> "Dispatch implementer subagent (./implementer-prompt.md)" [label="NEEDS_CONTEXT\n(provide context)"];
    "Auto re-plan blocked task" -> "Dispatch implementer subagent (./implementer-prompt.md)";
    "Run full test suite" -> "Tests pass?";
    "Tests pass?" -> "Mark task complete" [label="yes"];
    "Tests pass?" -> "Fix attempts < 3?" [label="no"];
    "Fix attempts < 3?" -> "Dispatch fix subagent" [label="yes"];
    "Fix attempts < 3?" -> "Mark task FAILED, continue" [label="no - max retries"];
    "Dispatch fix subagent" -> "Run full test suite";
    "Mark task complete" -> "More tasks?";
    "Mark task FAILED, continue" -> "More tasks?";
    "More tasks?" -> "Dispatch implementer subagent (./implementer-prompt.md)" [label="yes"];
    "More tasks?" -> "Implementation complete" [label="no"];
}
```

## Dispatching Subagents

**Always provide the full task text** to the subagent. Never make the subagent read the plan file.

**Context to include:**
- Full task description from plan (copy-paste, not reference)
- Scene-setting: where this task fits in the overall plan
- What previous tasks have built (files created/modified)
- **Inter-task learning context** (see below)
- The project's test command and conventions
- The working directory

**Use `./implementer-prompt.md` as the prompt template.**

### Inter-Task Learning

Maintain a running context log across tasks. After each task completes, record:

```
Task N: [name]
- Files created: [list]
- Files modified: [list]
- Interfaces exposed: [exported functions/classes with signatures]
- Patterns established: [naming conventions, error handling patterns, import styles used]
- Surprises: [anything that differed from the plan — different file structure, extra dependency, etc.]
- Integrity check findings: [any concerns from the integrity check]
```

**Feed this forward.** When dispatching Task N+1, include the accumulated log. This means:
- Task 3 knows what interfaces Task 1 and 2 actually created (not what the plan said they'd create)
- If Task 2 deviated from the plan (different function name, extra parameter), Task 3 gets the real interface
- If a pattern was established in Task 1 (e.g., errors are thrown as `AppError` subclasses), Task 3 follows it

**This prevents the #1 cause of subagent failures:** Task N assumes Task N-1 created exactly what the plan said, but it didn't.

## Model Selection

Use the least powerful model that can handle each task:

- **Mechanical tasks** (isolated functions, clear specs, 1-2 files): use `model: "sonnet"` or `model: "haiku"`
- **Integration tasks** (multi-file, pattern matching): use default model
- **Architecture/judgment tasks** (design decisions, broad codebase): use `model: "opus"`

**Signals:**
- Touches 1-2 files with complete spec -> cheap model
- Touches multiple files with integration concerns -> standard model
- Requires design judgment or broad understanding -> most capable model

## Handling Subagent Status

**DONE:** Before trusting the status, run the Implementation Integrity Check (see below). Then run full test suite. If tests pass, mark task complete. If tests fail, invoke `implementor:auto-debug` with the failure context (test command, output, stack trace). Auto-debug will investigate root cause and apply a fix.

**DONE_WITH_CONCERNS:** Note the concerns. If correctness-related, address before proceeding. If observational, note and proceed to integrity check + test suite.

**NEEDS_CONTEXT:** Provide the missing context. Re-dispatch the same subagent prompt with additional information. If the needed context doesn't exist, investigate the codebase to find it.

**BLOCKED:** This is where auto-impl differs from superpowers. Do NOT escalate to human. Instead:
1. Analyze the blocker
2. If context problem: investigate codebase, provide context, re-dispatch
3. If too complex: break into smaller tasks, re-dispatch each
4. If plan is wrong: re-plan this specific task using auto-plan patterns
5. If still blocked after 2 retries: mark task as FAILED in report, continue with remaining tasks

### Implementation Integrity Check

After a subagent reports DONE, do NOT blindly trust it. Before running the test suite, perform a quick independent verification:

1. **"Did the subagent actually create/modify the files the plan specified?"**
   - Run `git diff --name-only` and compare against the task's file list
   - Missing files = incomplete work. Extra files = scope creep. Both need investigation.

2. **"Does the code look like it implements the acceptance criteria, or does it implement something adjacent?"**
   - Read the key files (not all of them — just the core logic). Spend 30 seconds, not 5 minutes.
   - Does the function signature match what was planned?
   - Does the logic address the actual requirement, or a simplified version of it?

3. **"Did the subagent write tests that test the requirement, or tests that test their own code?"**
   - Glance at the test names. Do they describe behaviors from the acceptance criteria, or do they describe implementation details?
   - If every test is `test_functionName_works` instead of `test_returns_empty_list_when_no_matches`, the tests are likely shallow.

**This is a 1-minute sanity check, not a full review.** The goal is to catch obvious misses before wasting a test suite run on fundamentally wrong code. If the integrity check fails, provide feedback and re-dispatch — do NOT just run the tests hoping they'll catch it.

### Cascading Breakage Detection

After each task's tests pass, verify that *previous tasks' tests still pass too*:

1. Run the full test suite (not just the new task's tests)
2. If a previously-passing test now fails, Task N broke Task N-K
3. **Do NOT proceed to Task N+1.** Fix the regression first:
   - If it's a simple interface change: fix in-place
   - If it's a design conflict: the plan decomposed along wrong seams. Re-plan the conflicting tasks as a single task and re-dispatch
4. Record the breakage in the inter-task log — this informs the Plan Retrospective later

**Why this matters:** Without cascading detection, you can finish all 8 tasks with each passing its own tests, then discover in auto-test that tasks 3 and 5 are incompatible. Catching it immediately saves a full debug cycle.

## Model Escalation

When a subagent fails or produces low-quality work, escalate to a more capable model before re-dispatching:

| Attempt | Model | When to Escalate |
|---------|-------|-----------------|
| 1st attempt | Original selection (haiku/sonnet/default) | — |
| 2nd attempt (after failure) | Default model | If the failure was a logic or quality issue, not just missing context |
| 3rd attempt (after 2nd failure) | `model: "opus"` | When the task requires judgment the cheaper model couldn't provide |

**Do NOT escalate for context problems** — if the subagent reported NEEDS_CONTEXT, provide context and re-dispatch at the same model level. Escalation is for capability gaps, not information gaps.

**Do NOT downgrade after escalation** — once a task requires a more capable model, keep it there.

## Error Recovery

- Max 3 retries per task (original + 2 recovery attempts)
- Each retry must change something (more context, simpler scope, different approach, or more capable model)
- Never retry the exact same prompt without changes
- If a task fails, assess impact on downstream tasks before continuing
- If downstream tasks depend on the failed task, attempt to re-plan them too

## Red Flags - STOP

| Thought | Reality |
|---------|---------|
| "I'll dispatch implementers in parallel" | Parallel implementers cause file conflicts. One at a time. |
| "Tests are failing but I'll fix it in the next task" | Failing tests are a hard gate. Fix before proceeding. |
| "Let me retry the same prompt" | Same input = same output. Change something first. |
| "The subagent is BLOCKED but I'll proceed" | BLOCKED means the task isn't done. Resolve or re-plan. |
| "The subagent can read the plan file" | Never. Provide full task text. Subagent context is precious. |
| "I'll skip the test suite, nothing changed" | Something always changed. Run the suite. |
| "The subagent said DONE, so it's done" | DONE is a claim. Verify the files, glance at the code. Trust but verify. |
| "Haiku can handle this" | If the task involves judgment, design, or multi-file coordination, it probably can't. Don't penny-pinch on quality. |
| "The subagent's tests pass, so the code is correct" | Tests passing means the tests pass. Run the integrity check to verify the tests test the right thing. |

## Prompt Template

See `./implementer-prompt.md` for the full subagent prompt template.
