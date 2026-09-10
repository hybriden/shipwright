# Auto-Debug Dispatch Template

## Dispatch as Subagent

When called from auto-impl or other skills, dispatch as a subagent. (Step 7's app-type probing mirrors `../../_shared/runtime-probing.md`, and the fast path + test set mirror `../../_shared/pace.md` — condensed inline because the subagent can't resolve `_shared/`; keep them in sync.)

```
Agent tool (general-purpose):
  description: "Debug: [error summary]"
  prompt: |
    You are debugging a failure in the shipwright pipeline.

    ## Architecture Context
    [Task-focused lens from docs/architecture-map.md — max 150 lines. Include:
     - Module where the error manifests (with interfaces and responsibilities)
     - Dependency chain leading to this module (upstream modules that feed it)
     - Hot spots in the dependency chain (if any)
     - Relevant patterns (error handling, data access conventions)
     Use the dependency graph to trace root causes — walk backward from the
     symptom module through its dependencies instead of grepping blindly.]

    ## Error Context
    [Full error output, stack trace, command that failed]

    ## Files Involved
    [Files referenced in the error, mapped to modules from the architecture map]

    ## What Was Attempted
    [What the previous subagent was trying to do; the files the current step changed]

    ## Profile, Baseline & Test Set
    [profile: lean | thorough]
    [baseline: per-test pass/fail at the current commit, from the caller's evidence ledger — or "none"]
    [test set: the affected-test command for the changed files (lean), or the full suite (thorough,
     a suite that runs in ≤60s, or a fix touching shared config / build files / test infra /
     a hot spot / a data model with >3 consumers)]

    ## Project Tools Available
    [List any project-specific CLIs, validators, scripts discovered by the caller.
     If not provided, you MUST discover them yourself — scan: tools/, scripts/, bin/,
     package.json scripts, Makefile, *.sln/*.csproj CLI projects, README.md usage sections]

    ## Fix History (if provided)
    [Previous fix attempts in this debug cycle — files changed, results, reverts.
     Check for circular patterns: same file modified twice = likely wrong approach.
     Use regression info from rolled-back fixes as diagnostic evidence.]

    ## UI Test Levels (UI bug only)
    [paste ../../_shared/ui-tests.md — omit this section otherwise]

    ## Your Job
    FAST PATH (profile lean only): if the failure is a build/compile, type, import, syntax, or
    lint error at a file:line the current step changed, and the message names the defect
    unambiguously — fix it without leaving the step's changed files, then re-run the failing
    command + the test set. Green → report RESOLVED (path: fast). Fix the code, never silence the
    checker: a cast/type assertion, `any`, `!`, `@ts-ignore`, `# type: ignore`/`# noqa`,
    `eslint-disable`, `#pragma warning disable`, or a loosened config is not a fast-path fix. One
    attempt. If the error survives or changes form, the fix needs another file, only a suppression
    would clear it, or any test fails → full process.

    Full process:
    0. Triage: classify error type, discover project tools (unless provided), check git diff, cascade-analyze if multiple errors
    1. Reproduce the error (run exact command, capture full output)
    2. Isolate to specific file/function/line (use log injection with [DEBUG:auto-debug] prefix if needed)
    3. Trace root cause using dependency graph (ask "why?" 3+ times, walk backward through module dependencies, use git bisect if regression suspected)
    4. Hypothesize and predict outcome
    4.5. BASELINE (MANDATORY): use the provided baseline; if none, run the test set BEFORE applying the fix. Record exactly which tests pass and which fail. This is how you detect regressions.
    4.75. FIX IMPACT ANALYSIS: Use the architecture map to identify all modules that depend on the code you're about to change. Their tests join the test set and must pass after the fix.
    5. Apply minimal fix (DO NOT COMMIT YET)
    6. NET-POSITIVE GATE (MANDATORY — run BEFORE any other verification):
       a. Run the test set with the fix applied
       b. Compare against the baseline from step 4.5
       c. If ANY previously-passing test now fails: ROLLBACK the fix immediately (git checkout -- .)
          Record what regressed and why — this is diagnostic info for the next attempt.
          Go back to step 3 with new information.
       d. Only proceed if all baseline-passing tests still pass AND the target test is fixed.
    7. Prove the fix:
       a. Write regression unit test that FAILS without fix, PASSES with fix
       b. Run project's own CLI/validators/analyzers on real input to verify output correctness
       c. If app has UI: use Playwright MCP (browser_navigate, browser_snapshot, browser_take_screenshot) to verify
       d. If app has API: send HTTP requests to verify correct responses
       e. If app has CLI: run the CLI with representative input and verify output with project validators
       f. If fix touches shared code: run tests for all consumers
    8. If production code changed after step 6, re-run the test set — compare against baseline: zero regressions allowed
    9. Only now commit the fix and regression test together
    10. Clean up: remove ALL [DEBUG:auto-debug] log lines, run git bisect reset if used

    ANTI-CIRCLE RULE: If you find yourself modifying a file that was already
    changed in a previous fix attempt (check Fix History), STOP. The previous
    fix was likely wrong. Revert to before that fix and rethink the approach.

    Report:
    - **Status:** RESOLVED | UNRESOLVED
    - **Path:** fast | full
    - **Root cause:** [one sentence]
    - **Fix:** [what was changed and why]
    - **Baseline:** [test counts before fix, and whether it came from the ledger]
    - **Net-positive gate:** [PASSED — N tests passing before, M after, zero regressions]
    - **Fix attempts:** [N — include any rolled-back attempts with reason]
    - **Regression test:** [test name, file path, and proof it fails without fix — or N/A (fast path)]
    - **Project tool verification:** [which project tools were used, commands run, output summary — or N/A (fast path)]
    - **Runtime verification:** [what was verified and how — Playwright/HTTP/CLI evidence]
    - **Test set result:** [pass/fail count, comparison against baseline]
    - **Files changed:** [list]
    - **Side effects:** [any other tests/behavior affected]
```
