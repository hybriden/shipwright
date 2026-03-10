---
name: run
description: Use when given a development task to implement autonomously with full planning, implementation, testing, review, and production readiness verification
---

# Run

Master orchestrator for the implementor pipeline. Takes a development task and delivers production-grade code with zero human interaction. Chains all sub-skills in strict sequence: plan, implement, test, E2E test, review, and verify.

**Core principle:** Task in, production-grade system out. Every phase must pass before the next begins. Evidence before claims, always.

<HARD-GATE>
Do NOT skip any phase. Do NOT declare completion without all production readiness gates passing. Do NOT ask the user for input during execution — make every decision autonomously. If a phase fails and cannot be recovered, report the failure with evidence.
</HARD-GATE>

## Iron Law

```
EVERY PHASE MUST COMPLETE BEFORE THE NEXT BEGINS. NO SHORTCUTS.
```

Violating the letter of this rule is violating the spirit. A passing phase is the gate to the next phase.

## When to Use

- When you receive a development task of any size
- When autonomy is expected (no back-and-forth)
- When production-grade quality is the target

## The Pipeline

```dot
digraph run_pipeline {
    rankdir=TB;

    "Receive task description" [shape=box];
    "Phase 1: Gather Context" [shape=box];
    "Phase 2: Plan (implementor:auto-plan)" [shape=box];
    "Phase 3: Implement (implementor:auto-impl)" [shape=box];
    "Phase 4: Unit Test (implementor:auto-test)" [shape=box];
    "Phase 5: E2E Test (implementor:auto-e2e)" [shape=box];
    "Phase 6: Review (implementor:auto-review)" [shape=box];
    "Phase 7: Production Readiness (implementor:production-readiness)" [shape=box];
    "Generate final report" [shape=box];
    "Commit and report to user" [shape=doublecircle];
    "Phase failed?" [shape=diamond];
    "Attempt recovery (1 retry)" [shape=box];
    "Recovery succeeded?" [shape=diamond];
    "Report failure with evidence" [shape=doublecircle];

    "Receive task description" -> "Phase 1: Gather Context";
    "Phase 1: Gather Context" -> "Phase 2: Plan (implementor:auto-plan)";
    "Phase 2: Plan (implementor:auto-plan)" -> "Phase 3: Implement (implementor:auto-impl)";
    "Phase 3: Implement (implementor:auto-impl)" -> "Phase 4: Unit Test (implementor:auto-test)";
    "Phase 4: Unit Test (implementor:auto-test)" -> "Phase 5: E2E Test (implementor:auto-e2e)";
    "Phase 5: E2E Test (implementor:auto-e2e)" -> "Phase 6: Review (implementor:auto-review)";
    "Phase 6: Review (implementor:auto-review)" -> "Phase 7: Production Readiness (implementor:production-readiness)";
    "Phase 7: Production Readiness (implementor:production-readiness)" -> "Generate final report";
    "Generate final report" -> "Commit and report to user";

    "Phase 2: Plan (implementor:auto-plan)" -> "Phase failed?" [style=dashed];
    "Phase 3: Implement (implementor:auto-impl)" -> "Phase failed?" [style=dashed];
    "Phase 4: Unit Test (implementor:auto-test)" -> "Phase failed?" [style=dashed];
    "Phase 5: E2E Test (implementor:auto-e2e)" -> "Phase failed?" [style=dashed];
    "Phase 6: Review (implementor:auto-review)" -> "Phase failed?" [style=dashed];
    "Phase 7: Production Readiness (implementor:production-readiness)" -> "Phase failed?" [style=dashed];
    "Phase failed?" -> "Attempt recovery (1 retry)";
    "Attempt recovery (1 retry)" -> "Recovery succeeded?";
    "Recovery succeeded?" -> "Resume at failed phase" [label="yes" style=dashed];
    "Resume at failed phase" -> "Commit and report to user" [label="pipeline completes" style=dashed];
    "Recovery succeeded?" -> "Report failure with evidence" [label="no"];
}
```

## Checklist

You MUST create a task for each phase and complete them in order:

1. **Gather context** — scan codebase, detect tech stack, understand conventions
2. **Plan** — invoke auto-plan to decompose task
3. **Implement** — invoke auto-impl to execute plan via subagents
4. **Unit test** — invoke auto-test to verify and improve coverage
5. **E2E test** — invoke auto-e2e for user-facing verification
6. **Review** — invoke auto-review for two-stage code review
7. **Production readiness** — invoke production-readiness for final gate
8. **Report** — generate and present completion report

## Phase 1: Gather Context

Before anything else, understand the battlefield:

1. **Project structure:** Use Glob to map all directories and files
2. **Tech stack:** Read package.json/requirements.txt/go.mod/Cargo.toml/etc.
3. **Test infrastructure:** Find test config, existing tests, coverage setup
4. **Conventions:** Read CLAUDE.md, .editorconfig, linting config
5. **Git state:** Verify clean working tree, note current branch
6. **CI/CD:** Check for existing pipelines
7. **Entry points:** Find main files, server start commands, CLI entry points

**Output:** Mental model of the project. Used to inform all subsequent phases.

## Invoking Sub-Skills

Use the `Skill` tool to invoke each sub-skill. This ensures proper context isolation. Do NOT read sub-skill SKILL.md files and follow them inline — invoke them as skills.

## Phase 2: Plan

Invoke `implementor:auto-plan` with:
- The original task description
- Context gathered in Phase 1 (tech stack, conventions, test framework)
- Any constraints from the user's request

**Output:** Implementation plan saved to `docs/plans/`.

## Phase 3: Implement

Invoke `implementor:auto-impl` with:
- The plan from Phase 2
- Project context from Phase 1

**Output:** Working implementation with initial tests, committed to git.

## Phase 4: Unit Test

Invoke `implementor:auto-test` to:
- Run existing + new tests
- Analyze coverage gaps
- Write additional tests to meet coverage target
- Verify all tests pass

**Output:** Comprehensive test suite meeting coverage targets.

## Phase 5: E2E Test

Invoke `implementor:auto-e2e` to:
- Detect app type (web/API/CLI/library)
- Generate test scenarios from task description
- Execute E2E tests with evidence capture
- Report results

**Output:** E2E test results with screenshots/captures as evidence.

**If app type is library:** Skip with documented justification.

## Phase 6: Review

Invoke `implementor:auto-review` to:
- Stage 1: Verify spec compliance
- Stage 2: Verify code quality
- Fix any issues found (max 3 cycles per stage)

**Output:** Review report (APPROVED / APPROVED_WITH_NOTES).

## Phase 7: Production Readiness

Invoke `implementor:production-readiness` to:
- Run all 10 gates
- Generate load test (if applicable)
- Produce final report with evidence

**Output:** Production readiness verdict with full evidence.

## Error Recovery

If any phase fails:
1. Analyze the failure
2. Attempt one recovery:
   - Plan phase: re-analyze with broader context
   - Impl phase: re-plan the failed task(s) and retry
   - Test phase: fix failing tests or implementation bugs
   - E2E phase: fix app startup or interaction issues
   - Review phase: fix identified issues and re-review
   - Readiness phase: address failing gates
3. If recovery succeeds, resume the pipeline from the recovered phase
4. If recovery fails, generate a failure report with:
   - What was accomplished before failure
   - Exact failure details with evidence
   - What would need to change for success
   - All work done so far (committed to git)

## Autonomous Decision Making

When faced with decisions, apply these defaults:
- **Naming:** Follow existing project conventions, or language idioms if greenfield
- **Architecture:** Match existing patterns, or use the simplest pattern that works
- **Dependencies:** Prefer standard library, add external deps only when clearly needed
- **Test framework:** Use what's already in the project, or the standard for the language
- **Error handling:** Fail fast with useful messages, never swallow errors
- **Logging:** Structured JSON for services, simple for CLIs
- **File organization:** One responsibility per file, group by feature not by type

## Report Format

After all phases complete, output:

```markdown
# Implementation Report

## Task
[Original task description]

## Status: COMPLETE | PARTIAL | FAILED

## Summary
[2-3 sentences: what was built, key decisions made]

## Changes
- Files created: [list]
- Files modified: [list]
- Total: +[added] -[removed] lines

## Pipeline Results

| Phase | Status | Details |
|-------|--------|---------|
| Plan | ✅ | [task count] tasks in plan |
| Implement | ✅ | [task count] tasks completed |
| Unit Tests | ✅ | [X] tests, [Y]% line coverage |
| E2E Tests | ✅/N/A | [X] scenarios passed |
| Code Review | ✅ | Spec: ✅, Quality: ✅ |
| Prod Readiness | ✅ | [X]/[Y] gates passed |

## Production Readiness Gates
[Full gate table from production-readiness]

## Evidence
[Test output, coverage numbers, screenshots, load test results]

## Commits
[List of commits made during implementation]
```

## Red Flags - STOP

| Thought | Reality |
|---------|---------|
| "Phase 5 is overkill for this" | The pipeline is the pipeline. All phases, every time. |
| "I'll skip the plan, it's obvious" | Obvious tasks have hidden complexity. Plan it. |
| "Tests pass, let's call it done" | Tests are phase 4 of 7. Keep going. |
| "The user said it's urgent" | Shipping broken code is never urgent. |
| "I need to ask the user about X" | No. Make the decision. Document why. |
| "Recovery failed, try again" | One recovery attempt. Then report failure. |
| "This gate doesn't apply" | Mark N/A with justification. Don't skip silently. |

## Integration

This skill is the entry point. It invokes:
- **implementor:auto-plan** — Phase 2
- **implementor:auto-impl** — Phase 3
- **implementor:auto-test** — Phase 4
- **implementor:auto-e2e** — Phase 5
- **implementor:auto-review** — Phase 6
- **implementor:production-readiness** — Phase 7

Each sub-skill is independently usable but designed to chain in this order.
