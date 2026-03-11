---
name: auto-plan
description: Use when a development task needs to be decomposed into an implementation plan before any code is written
---

# Auto-Plan

Autonomously analyze a codebase and decompose a development task into an ordered implementation plan with exact file paths, acceptance criteria, and test strategy for every step.

**Core principle:** Understand everything before touching anything. Read first, plan second, implement never (that's auto-impl's job).

<HARD-GATE>
This skill is part of the implementor pipeline. Do NOT invoke superpowers:brainstorming, superpowers:writing-plans, or any other superpowers orchestration skill. The implementor handles planning internally.
</HARD-GATE>

## Iron Law

```
NO IMPLEMENTATION WITHOUT A PLAN FIRST
```

No exceptions. Not for "quick fixes." Not for "obvious changes." Not for "just one file." Plan first, always.

## When to Use

- Given a development task of any size
- Before any implementation begins
- When invoked by `implementor:run` as the first phase

## Process

```dot
digraph auto_plan {
    rankdir=TB;
    "Receive task description" [shape=box];
    "0: Learn from past runs" [shape=box];
    "1: Scan codebase, detect stack" [shape=box];
    "2: Decompose into ordered steps" [shape=box];
    "3: Viability check" [shape=box];
    "All viable?" [shape=diamond];
    "Refine tasks" [shape=box];
    "4: Plan simulation" [shape=box];
    "Simulation passes?" [shape=diamond];
    "Fix context/ordering" [shape=box];
    "5: Output structured plan" [shape=box];

    "Receive task description" -> "0: Learn from past runs";
    "0: Learn from past runs" -> "1: Scan codebase, detect stack";
    "1: Scan codebase, detect stack" -> "2: Decompose into ordered steps";
    "2: Decompose into ordered steps" -> "3: Viability check";
    "3: Viability check" -> "All viable?";
    "All viable?" -> "4: Plan simulation" [label="yes"];
    "All viable?" -> "Refine tasks" [label="no"];
    "Refine tasks" -> "3: Viability check";
    "4: Plan simulation" -> "Simulation passes?";
    "Simulation passes?" -> "5: Output structured plan" [label="yes"];
    "Simulation passes?" -> "Fix context/ordering" [label="no"];
    "Fix context/ordering" -> "4: Plan simulation";
}
```

### Phase 0: Learn from Past Runs

Before analyzing anything, check for lessons from previous pipeline runs:

1. **Read previous plan retrospectives.** Search `docs/plans/` for existing plan files. If any contain a "Plan Retrospective" section (added by `auto-review`), read it. Common lessons:
   - "Decomposition was along wrong seams" → pay attention to actual module boundaries
   - "Acceptance criteria were vague" → be more explicit this time
   - "Frequent NEEDS_CONTEXT" → provide more context per task
   - "Tasks too large/small" → adjust granularity

2. **Read `.implementor-retrospective.md`** if it exists in the project root. This file accumulates cross-run learnings (written by `implementor:run`). It tells you what has gone wrong before in this specific codebase.

3. **Apply lessons.** Don't just read them — adjust your planning approach based on what failed before. If the last retrospective says "tasks that modify `src/utils/` always conflict," plan those modifications as a single task.

**If no retrospectives exist:** This is the first run. Proceed normally but plan conservatively.

### Phase 1: Codebase Analysis

Use Glob to map the full project structure. Use Grep to find:
- Package manager and dependencies (package.json, requirements.txt, go.mod, Cargo.toml, etc.)
- Test framework configuration (jest.config, pytest.ini, vitest.config, etc.)
- Existing test files and their patterns
- CI/CD configuration (.github/workflows, .gitlab-ci.yml, etc.)
- Linting and formatting config (.eslintrc, .prettierrc, ruff.toml, etc.)
- Entry points and main modules

Read key files to understand:
- Coding conventions (naming, structure, patterns)
- Architecture (monolith, microservices, modules)
- Error handling patterns
- Logging patterns

### Phase 2: Task Decomposition

Break the task into ordered implementation steps where each step is **one action (2-5 minutes)**:

- "Write the failing test" - one step
- "Run it to verify it fails" - one step
- "Implement minimal code to pass" - one step
- "Run tests to verify they pass" - one step
- "Commit" - one step

### Phase 3: Plan Viability Check

Before outputting the plan, stress-test it. For each task in the decomposition, answer:

1. **"Can a subagent actually implement this in isolation?"**
   - Does the task have all the context it needs, or does it secretly depend on understanding the whole system?
   - Are the file paths real and the interfaces defined, or is the subagent expected to figure them out?
   - If the task says "integrate with X" — is X already built by a previous task, or is this a circular dependency?

2. **"Are the acceptance criteria actually verifiable?"**
   - Can each criterion be checked by running a command and reading the output?
   - Vague criteria like "handles errors gracefully" are not verifiable. "Returns 400 with `{error: 'missing field'}` when `name` is omitted" is verifiable.
   - If you can't write the test command and expected output for a criterion, the criterion is too vague. Rewrite it.

3. **"Is this decomposition along the right seams?"**
   - Do the task boundaries match the code's actual module boundaries?
   - Will subagents need to modify the same files in multiple tasks? (If yes, you decomposed wrong — group by file, not by feature.)
   - Are there hidden coupling points where Task 3 will silently break Task 1's work?

4. **"Am I planning for tests that prove behavior, or tests that prove structure?"**
   - If the test in the plan asserts that a function exists and returns the right type, that's a structure test. Plan behavioral tests instead.
   - If the test only checks the happy path, the plan is incomplete. Error paths must be planned explicitly.

**Verdicts per task:**
- **VIABLE:** Task is self-contained, criteria are verifiable, a subagent can execute it.
- **NEEDS_REFINEMENT:** Task has vague criteria, hidden dependencies, or wrong boundaries. Refine before outputting.
- **SHOULD_SPLIT:** Task is too large or has mixed concerns. Split into smaller tasks.
- **SHOULD_MERGE:** Task is too small to be useful alone or creates artificial file-conflict boundaries with an adjacent task. Merge.

**If any task is NEEDS_REFINEMENT:** Fix it now. Do not output a plan with known viability issues.

### Phase 4: Plan Simulation

Mentally execute the plan as a subagent would. For each task, in order:

1. **Pretend you are a fresh subagent** with only the task description, context block, and test command. No access to the plan file, no memory of other tasks.
2. **Ask: "Do I have everything I need to start writing the test?"**
   - Do I know the function signature I'm testing?
   - Do I know the import path?
   - Do I know the expected behavior precisely enough to write an assertion?
   - If I need to call code from a previous task, is that code's interface specified in my context?
3. **Ask: "After I implement, will I know if I succeeded?"**
   - Can I run the test command and get a clear pass/fail?
   - Are the acceptance criteria binary (pass/fail), or are they subjective ("should work well")?
4. **Ask: "Will my work survive the next task?"**
   - Does the next task modify files I created?
   - Does the next task change interfaces I depend on?
   - If yes, is the dependency acknowledged in the next task's context?

**If any task fails the simulation:** Fix it. Add missing context, clarify interfaces, reorder tasks, or merge conflicting tasks.

**This takes 2-3 minutes.** It saves 20 minutes of subagent failures, re-dispatches, and debugging.

### Phase 5: Plan Output

Save the plan to `docs/plans/YYYY-MM-DD-<task-name>.md` using this format:

```markdown
# [Task Name] Implementation Plan

**Goal:** [One sentence]
**Architecture:** [2-3 sentences about approach]
**Tech Stack:** [Detected technologies]
**Test Framework:** [Detected test framework and run command]
**Coverage Target:** [80% default or project-specific]

---

### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ext`
- Modify: `exact/path/to/existing.ext:line-range`
- Test: `tests/exact/path/to/test.ext`

**Acceptance Criteria:**
- [Specific, verifiable criterion]
- [Another criterion]

**Step 1: Write the failing test**
[Exact test code]

**Step 2: Run test to verify it fails**
Run: `[exact command]`
Expected: FAIL with "[specific error]"

**Step 3: Write minimal implementation**
[Exact implementation code]

**Step 4: Run test to verify it passes**
Run: `[exact command]`
Expected: PASS

**Step 5: Commit**
[Exact git commands with commit message]
```

## Adaptation Rules

**Small task (1-3 files):** 1-3 plan tasks, minimal context needed
**Medium task (4-10 files):** 3-8 plan tasks, group by component
**Large task (10+ files):** 8+ plan tasks, group by layer/module, identify dependencies between tasks

**Always:**
- Exact file paths (never "in the appropriate directory")
- Complete code (never "add validation logic here")
- Exact test commands with expected output
- Explicit acceptance criteria per task
- Test strategy included in every task (not as an afterthought)

## Anti-Patterns

**Do NOT output plans that:**
- Have acceptance criteria you can't write a test command for
- Decompose by feature when the code is organized by module (or vice versa)
- Assume subagents will "figure out" interfaces, imports, or dependencies
- Put "write tests" as a separate task from implementation (TDD means tests come first in every task)
- Have tasks that silently depend on shared files without declaring it
- Use vague language: "add appropriate error handling," "implement validation logic," "connect to the API"

**Do NOT:**
- Skip the viability check because the plan "looks right"
- Output a plan where you couldn't verify every acceptance criterion yourself
- Decompose along clean theoretical boundaries that don't match the actual code structure
- Plan for code you haven't read — always read existing files before planning modifications

## Red Flags - STOP

| Thought | Reality |
|---------|---------|
| "This is too simple to plan" | Simple tasks have the most assumptions. Plan it. |
| "I already know what to do" | Knowledge isn't a plan. Write it down. |
| "Planning is overhead" | Debugging unplanned code is the real overhead. |
| "Let me just start coding" | That's auto-impl's job. You plan. |
| "The user wants speed" | A 2-minute plan saves 20 minutes of rework. |
| "I can plan as I go" | That's how you miss edge cases and tests. |
| "The acceptance criteria are obvious" | If they're obvious, writing them explicitly takes 10 seconds. Do it. |
| "The subagent will figure it out" | Subagents are context-limited. Spell everything out. |
| "This decomposition is clean" | Clean != correct. Does it match the actual code seams? |
