---
name: auto-debug
description: Use when encountering test failures, build errors, runtime errors, or unexpected behavior during any phase of the shipwright pipeline
---

# Auto-Debug

Systematic root cause analysis and resolution for any error encountered during the shipwright pipeline. Reproduces the issue, traces the root cause, forms and tests hypotheses, then implements and verifies the fix. Zero human interaction.

**Core principle:** Never guess. Reproduce first, trace second, hypothesize third, fix last. A fix without a root cause is a bandage, not a solution.

<HARD-GATE>
This skill is part of the shipwright pipeline. Do NOT invoke superpowers:systematic-debugging or any other superpowers skill. The shipwright handles debugging internally.
</HARD-GATE>

## Iron Law

```
NO FIX WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

No exceptions. Not for "obvious" bugs. Not for "I've seen this before." Not for "the fix is simple." Investigate first, always.

Violating the letter of this rule is violating the spirit.

## When to Use

- Test failures during auto-impl or auto-test
- Build errors during auto-setup
- Runtime errors during auto-e2e
- Review issues that require debugging to understand
- Any unexpected behavior in any pipeline phase
- When invoked directly for standalone debugging

## Process

```dot
digraph auto_debug {
    rankdir=TB;

    "Receive error context" [shape=box];
    "Phase 0: Triage" [shape=box];
    "Multiple errors?" [shape=diamond];
    "Cascade analysis: find root error" [shape=box];
    "Recent code changes?" [shape=diamond];
    "Diff-narrow to changed files" [shape=box];
    "Phase 1: Reproduce" [shape=box];
    "Reproducible?" [shape=diamond];
    "Phase 2: Isolate" [shape=box];
    "Phase 3: Trace Root Cause" [shape=box];
    "Root cause found?" [shape=diamond];
    "Use git bisect?" [shape=diamond];
    "Git bisect to find breaking commit" [shape=box];
    "Phase 4: Hypothesize and Test" [shape=box];
    "Hypothesis confirmed?" [shape=diamond];
    "Phase 4.5: Baseline Capture" [shape=box];
    "Phase 4.75: Fix Impact Analysis" [shape=box];
    "Phase 5: Fix (no commit)" [shape=box];
    "Phase 5.5: Net-Positive Gate + Prove Fix" [shape=box];
    "Net-positive?" [shape=diamond];
    "Rollback fix, record regression info" [shape=box];
    "Circle detected?" [shape=diamond];
    "Phase 6: Final Verify + Commit" [shape=box];
    "Fix verified?" [shape=diamond];
    "Widen investigation" [shape=box];
    "Mark UNRESOLVED with evidence" [shape=box];
    "Clean up debug artifacts" [shape=box];
    "Debug complete" [shape=doublecircle];

    "Receive error context" -> "Phase 0: Triage";
    "Phase 0: Triage" -> "Multiple errors?";
    "Multiple errors?" -> "Cascade analysis: find root error" [label="yes"];
    "Multiple errors?" -> "Recent code changes?" [label="no"];
    "Cascade analysis: find root error" -> "Recent code changes?";
    "Recent code changes?" -> "Diff-narrow to changed files" [label="yes"];
    "Recent code changes?" -> "Phase 1: Reproduce" [label="no"];
    "Diff-narrow to changed files" -> "Phase 1: Reproduce";
    "Phase 1: Reproduce" -> "Reproducible?";
    "Reproducible?" -> "Phase 2: Isolate" [label="yes"];
    "Reproducible?" -> "Widen investigation" [label="no (intermittent)"];
    "Widen investigation" -> "Phase 2: Isolate";
    "Phase 2: Isolate" -> "Phase 3: Trace Root Cause";
    "Phase 3: Trace Root Cause" -> "Root cause found?";
    "Root cause found?" -> "Phase 4: Hypothesize and Test" [label="yes"];
    "Root cause found?" -> "Use git bisect?" [label="no"];
    "Use git bisect?" -> "Git bisect to find breaking commit" [label="regression suspected"];
    "Use git bisect?" -> "Mark UNRESOLVED with evidence" [label="no, after 3 attempts"];
    "Git bisect to find breaking commit" -> "Phase 3: Trace Root Cause";
    "Phase 4: Hypothesize and Test" -> "Hypothesis confirmed?";
    "Hypothesis confirmed?" -> "Phase 4.5: Baseline Capture" [label="yes"];
    "Hypothesis confirmed?" -> "Phase 3: Trace Root Cause" [label="no, new hypothesis"];
    "Phase 4.5: Baseline Capture" -> "Phase 4.75: Fix Impact Analysis";
    "Phase 4.75: Fix Impact Analysis" -> "Phase 5: Fix (no commit)";
    "Phase 5: Fix (no commit)" -> "Phase 5.5: Net-Positive Gate + Prove Fix";
    "Phase 5.5: Net-Positive Gate + Prove Fix" -> "Net-positive?";
    "Net-positive?" -> "Phase 6: Final Verify + Commit" [label="yes — zero regressions"];
    "Net-positive?" -> "Rollback fix, record regression info" [label="no — regressions detected"];
    "Rollback fix, record regression info" -> "Circle detected?";
    "Circle detected?" -> "Mark UNRESOLVED with evidence" [label="yes — same files/tests cycling"];
    "Circle detected?" -> "Phase 3: Trace Root Cause" [label="no — try different approach"];
    "Phase 6: Final Verify + Commit" -> "Fix verified?";
    "Fix verified?" -> "Clean up debug artifacts" [label="yes"];
    "Fix verified?" -> "Rollback fix, record regression info" [label="no"];
    "Clean up debug artifacts" -> "Debug complete";
    "Mark UNRESOLVED with evidence" -> "Clean up debug artifacts";
}
```

## Phase 0: Triage (Before Reproduction)

When receiving error context, classify and prioritize before diving in:

### Error Classification

Auto-detect the error category from the error output and apply the specialized strategy:

| Error Pattern | Category | Fast-Path Strategy |
|--------------|----------|-------------------|
| `TypeError`, `ReferenceError`, `undefined is not a function` | Type/Reference | Read the exact line, check variable scope and types |
| `ENOENT`, `MODULE_NOT_FOUND`, `Cannot find module` | Missing File/Module | Trace the import chain, check paths and package.json |
| `ECONNREFUSED`, `ETIMEDOUT`, `fetch failed` | Network/Connection | Check if service is running, verify URLs and ports |
| `SyntaxError`, `Unexpected token` | Parse Error | Check the file for syntax issues, often a bad merge |
| `ENOMEM`, `heap out of memory`, `Maximum call stack` | Resource Exhaustion | Look for infinite recursion, unbounded loops, memory leaks |
| `EACCES`, `Permission denied` | Permission | Check file permissions, user context, sudo requirements |
| `Timeout`, `exceeded`, `took too long` | Timeout/Hang | See Timeout Debugging section below |
| `race condition`, flaky pass/fail pattern | Concurrency | See Concurrency Debugging section below |
| `version`, `peer dep`, `conflicting` | Dependency Conflict | See Dependency Conflict Resolution section below |
| Multiple unrelated errors in output | Cascade | See Cascade Analysis section below |
| `BREAKING CHANGE`, `deprecated`, `not a function` | API Migration | Check changelog of updated dependency, find migration guide |

### Architecture Map Consumption

**Before investigating broadly, read the architecture map.** Check `docs/architecture-map.md` — if it exists:

1. **Locate the error in the module inventory** — which module does the stack trace point to?
2. **Check the dependency graph** — what feeds data/control to this module? The root cause is often in an upstream dependency, not the failing module itself
3. **Check hot spots** — if the error involves a hot spot module, the fix has high blast radius. Be extra careful with broader impact verification (Phase 5.5 Layer 3)
4. **Check interface contracts** — is the failing module receiving input that violates its expected interface? If so, trace backward through the dependency chain
5. **Check patterns** — does the error violate an established pattern? (e.g., error not following the project's AppError hierarchy, data access not using the repository pattern)

**This replaces blind grepping for root cause tracing.** Instead of searching the entire codebase, follow the dependency chain from the error's module backward to the source. In a large codebase, this reduces investigation scope dramatically.

**If no map exists:** Proceed with manual investigation as described below.

### Diff-Based Narrowing

**Before investigating broadly, check what changed recently:**

1. Run `git diff HEAD~5` (or since last known-good state) to see recent changes
2. Cross-reference changed files with the error's stack trace
3. If a changed file appears in the stack trace — that's your starting point
4. If no overlap — the bug may be in an unchanged dependency or environment

**This eliminates 80% of investigation time.** Most bugs are in recently changed code.

### Cascade Analysis (Multiple Errors)

When the error output contains multiple failures:

1. **Don't fix them all.** Find the root error that causes the cascade
2. **Sort errors by dependency order** — earlier failures often cause later ones
3. **Look for the first error chronologically** — not the loudest one
4. **Group errors by file** — if 10 tests in the same file fail, the file (not the tests) is broken
5. **Check for setup/teardown failures** — a broken `beforeAll` cascades to every test in the suite

```
Rule: Fix ONE error. Re-run. Count how many others disappear.
Repeat until zero errors remain.
```

**Output:** Error category, narrowed file scope (from diff), and if multiple errors: the identified root error.

### Project Tool Discovery (MANDATORY)

<HARD-GATE>
Before any verification, you MUST discover what tools the project already has. A project's own CLI, scripts, and utilities are the most authoritative way to verify a fix. Generic test commands are necessary but not sufficient — use the project's own tools to verify real behavior.
</HARD-GATE>

**Scan these locations for project-specific tools:**

| Location | What to Look For |
|----------|-----------------|
| `tools/`, `scripts/`, `bin/`, `cli/` directories | Custom CLI tools, utility scripts, validators, analyzers |
| `package.json` `scripts` section | Named commands: `build`, `lint`, `validate`, `check`, `analyze`, `migrate`, custom scripts |
| `Makefile`, `Taskfile.yml`, `justfile` | Build/run/test/validate targets |
| `*.sln`, `*.csproj` files | .NET projects — look for CLI projects (`*.CLI`, `*.Console`, `*.Tool`) |
| `cmd/`, `internal/cli/` (Go) | Go CLI entry points |
| `setup.py`, `pyproject.toml` `[project.scripts]` | Python CLI entry points |
| `Cargo.toml` `[[bin]]` sections | Rust binary targets |
| `docker-compose.yml` | Service definitions with health checks |
| `README.md`, `docs/` | Usage examples, "How to run" sections, verification instructions |
| `.shipwright.json` | Custom `testCommand`, `coverageCommand`, `startCommand` |

**Build a tool inventory:**

```
Project Tools Found:
- CLI: dotnet run --project src/MyApp.CLI -- [args]
- Validator: tools/PackageExplorer/src/... -- [file]
- Scripts: npm run validate, npm run check-types
- Makefile: make lint, make integration-test
- Start: npm start (port 3000)
```

**Use these tools for verification in Phase 5.5 and Phase 6.** They test real behavior that unit tests cannot cover:
- A converter CLI can verify that output files are valid
- A package explorer can verify internal consistency
- A migration tool can verify data integrity
- A linter can verify code quality after changes
- A build command can verify nothing is broken

**If the project has a CLI that processes input → output:**
1. Run the CLI with a representative input file
2. Verify the output is valid using the project's own validation tools
3. Compare output before and after the fix if possible
4. Check edge cases with different inputs

**Tool discovery happens ONCE during triage, then tools are used throughout debugging.**

## Anti-Circle Detection & Debug Budget

Read `references/safety-mechanisms.md` for the full anti-circle detection rules (fix history tracking, circle signals, breaking the cycle) and debug budget constraints (max hypotheses, max log injection rounds, context budget).

**Key rules (always apply):**
- Maintain a fix history log across all debug invocations
- If the same file is modified twice across fix attempts, STOP and revert — the first fix was wrong
- Max 3 hypotheses. Max 15 minutes equivalent investigation before forming a hypothesis.
- If a fix fails the Net-Positive Gate, rollback immediately and record what regressed.

## Phase 1: Reproduce

Before anything else, reproduce the error reliably:

1. Run the exact command that failed
2. Capture the full error output (stdout, stderr, exit code)
3. Note the exact error message, stack trace, and file:line references
4. Run it again to confirm it's consistent (not flaky)

**If intermittent:** Run 3 times. Note which runs fail and which pass. Look for timing dependencies, race conditions, or external state.

**Output:** Exact reproduction steps and full error output.

## Phase 2: Isolate

Narrow down where the error originates:

1. **Read the stack trace** — identify the originating file and line
2. **Read the failing code** — understand what it's trying to do
3. **Read the test** (if test failure) — understand what's being asserted
4. **Identify the boundary** — is this a code error, config error, dependency error, or environment error?

**Isolation techniques:**
- For test failures: run the single failing test in isolation
- For build errors: check the specific file that fails to compile
- For runtime errors: inject strategic logging (see Log Injection below)
- For import errors: trace the dependency chain
- For timeout errors: identify what's blocking (see Timeout Debugging below)
- For flaky tests: check for shared mutable state between tests (see Concurrency Debugging below)

### Log Injection (Tracing Execution Flow)

When the error is opaque (no clear stack trace, wrong output but no crash):

1. **Identify the code path** from input to the point of failure
2. **Add temporary `console.log`/`print` statements** at each decision point:
   ```
   console.log('[DEBUG:auto-debug] functionName entered, args:', JSON.stringify(args))
   console.log('[DEBUG:auto-debug] branch taken: else-clause at line 42')
   console.log('[DEBUG:auto-debug] value at checkpoint:', variable)
   ```
3. **Use the `[DEBUG:auto-debug]` prefix** so logs are easy to find and remove
4. **Run the failing scenario** and read the log output to trace the actual execution path
5. **Compare actual path vs expected path** — the divergence point is the bug
6. **MANDATORY: Remove all `[DEBUG:auto-debug]` log lines after debugging.** Search the codebase for the prefix and delete every one. Debug logging must never be committed.

### Git Bisect (Finding the Breaking Commit)

When the error is a regression (something that used to work):

1. Identify the last known-good commit (or estimate: `HEAD~10`, last release tag)
2. Run git bisect:
   ```bash
   git bisect start
   git bisect bad HEAD
   git bisect good <known-good-commit>
   # For each commit git checks out:
   # Run the failing test, then: git bisect good OR git bisect bad
   ```
3. Git bisect will identify the exact commit that introduced the regression
4. Read that commit's diff — the bug is in those changes
5. **Always run `git bisect reset` when done** to restore the working tree

**When to use:** When you can't tell from the current code why something broke, and the git history is available. Bisect turns an O(n) search into O(log n).

**Output:** The specific file, function, and line where the error originates, plus the error category.

## Phase 3: Trace Root Cause

Don't stop at the symptom. Trace to the actual cause:

```dot
digraph root_cause {
    "Symptom: test fails" [shape=box];
    "Why? Assertion doesn't match" [shape=box];
    "Why? Function returns wrong value" [shape=box];
    "Why? Input validation missing" [shape=box];
    "ROOT CAUSE: edge case not handled" [shape=box style=filled fillcolor=lightyellow];

    "Symptom: test fails" -> "Why? Assertion doesn't match";
    "Why? Assertion doesn't match" -> "Why? Function returns wrong value";
    "Why? Function returns wrong value" -> "Why? Input validation missing";
    "Why? Input validation missing" -> "ROOT CAUSE: edge case not handled";
}
```

**The Five Whys:** Ask "why?" at least 3 times. The first answer is rarely the root cause.

**Dependency-graph-guided tracing (if architecture map exists):**
1. Identify which module the error manifests in
2. Walk backward through the dependency chain — at each hop, check if the interface contract is being violated
3. The root cause is at the module boundary where the contract breaks
4. This is faster and more reliable than grepping — especially in large codebases where the same keywords appear in dozens of files

**Common root cause categories:**

| Category | Examples | Fix Approach |
|----------|----------|-------------|
| Logic error | Off-by-one, wrong operator, missing condition | Fix the logic |
| Missing handling | Null/undefined not checked, error not caught | Add the handling |
| Wrong assumption | API changed, data shape different, timing wrong | Update the assumption |
| Dependency issue | Version mismatch, missing package, wrong config | Fix the dependency |
| State problem | Stale cache, race condition, leaked state between tests | Fix the state management |
| Environment | Missing env var, wrong path, permission denied | Fix the environment |

**Output:** The root cause, stated as a single sentence. "The root cause is [X] because [evidence]."

## Phase 4: Hypothesize and Test

Before writing any fix:

1. **State the hypothesis:** "If I [change X], the error will be resolved because [root cause reasoning]"
2. **Predict the outcome:** "After the fix, the test should pass with [expected output]"
3. **Consider side effects:** "This change could affect [Y and Z] — I need to verify those too"

**If the hypothesis is wrong:** Don't iterate on the same theory. Go back to Phase 3 and look for a different root cause.

**Max 3 hypotheses.** If three hypotheses fail, the root cause analysis was wrong. Start over from Phase 2 with a wider scope.

## Phase 4.5: Pre-Fix Baseline Capture (MANDATORY)

<HARD-GATE>
Before writing ANY fix code, capture a baseline of the current test state. A fix that solves 1 problem but breaks 2 others is a net negative. The baseline is how you detect this.
</HARD-GATE>

### Capture the Baseline

1. **Run the full test suite** and record the results:
   ```
   Baseline captured before fix:
   - Total tests: [N]
   - Passing: [N] — [list test names or file:test pairs]
   - Failing: [N] — [list test names or file:test pairs]
   - Skipped: [N]
   ```
2. **Save the passing test list.** These are the tests that MUST still pass after the fix. Any previously-passing test that fails after the fix is a **regression introduced by the fix**.
3. **Note the specific tests that are failing** — these are the ones the fix should address.

### Why This Matters

Without a baseline, you can't distinguish between:
- "This test was already failing" (not your problem)
- "This test was passing and my fix broke it" (your problem — rollback)
- "This test is new and it fails" (investigate)

**The baseline takes 30 seconds to capture and prevents hours of circular fixing.**

## Phase 4.75: Fix Impact Analysis (MANDATORY)

<HARD-GATE>
Before writing ANY fix code, analyze the blast radius of the planned change using the architecture map's dependency graph. Understand what you might break BEFORE you break it.
</HARD-GATE>

### Analyze Impact

1. **Identify the files you plan to change** — list them explicitly
2. **Map files to modules** — which modules do these files belong to? (from the architecture map)
3. **Classify the change surface:**

   | Change Type | Detection | Blast Radius |
   |------------|-----------|-------------|
   | **Public API change** | Modifying an exported function signature, public class interface, or API endpoint contract | ALL consumers must be checked — every module that imports this interface |
   | **Data model change** | Modifying fields on a shared model/entity/DTO (from map's Data Models section) | VERY HIGH — every consumer + database + serialization formats. Check if model is persisted AND serialized. |
   | **Shared config change** | Modifying a config file listed in map's Shared Configuration | ALL readers of that config must be checked |
   | **Internal implementation change** | Modifying private/internal function bodies without changing signatures | LOW — only the changed module's own tests |
   | **Build file change** | Modifying project/package/build configuration | All downstream build dependents must rebuild |

4. **Find all dependents** — using the dependency graph, identify every module that depends on the modules you're changing. For data model changes, also check the map's Data Models section for consumer count.
5. **Identify consumer tests by type** (from the map's Test Infrastructure Classification):
   - Unit tests for the changed module (always run)
   - Integration tests that cross the changed module's boundary (run for any API/model change)
   - Contract tests at the changed module's boundary (run for any interface/model change)
   - For internal-only changes: unit tests are sufficient
6. **Record the impact scope:**
   ```
   Fix Impact Analysis:
   - Files to change: [list]
   - Change type: [public API | data model | shared config | internal | build file]
   - Modules affected: [list]
   - Dependent modules: [list from dependency graph]
   - Data models affected: [list any shared models being changed, with consumer count]
   - Consumer test files: [list — these MUST pass after the fix]
   - Contract tests at boundary: [list — critical for API/model changes]
   - Hot spots touched: [list any — extra caution required]
   ```

### Impact-Based Decision

| Impact Scope | Approach |
|-------------|----------|
| Internal change, 1 file, no shared models | Apply fix, verify baseline (unit tests sufficient) |
| Public API change, < 3 dependents | Apply fix, verify baseline + run all dependent tests + contract tests explicitly |
| Data model change (any persisted + serialized model) | CAUTION. Check every consumer. Run contract tests. Verify serialization format hasn't broken. If model has > 5 consumers, consider if there's a way to fix without changing the model. |
| Shared config change | Apply fix, verify ALL modules that read the config still work |
| Fix touches hot spot with 5+ dependents | Apply fix, verify baseline + run ALL integration and contract tests in the solution |
| Fix requires changes across multiple modules | STOP. Consider if the root cause analysis is correct. Multi-module fixes for a single bug often indicate a symptomatic fix, not a root cause fix. Re-investigate. |
| Fix requires data model change + code changes in 3+ consumers | STOP. This is an atomic change group. All changes must be made together. If the fix is this broad, the bug may be architectural, not local. |

## Phase 5: Fix

Apply the minimal fix that addresses the root cause:

1. Change only what's necessary to fix the root cause
2. Do NOT refactor, clean up, or "improve" unrelated code
3. **Write a regression test that reproduces the original bug** (see Phase 5.5)
4. If the fix changes behavior, update existing tests
5. **Do NOT commit yet** — the fix must pass the Net-Positive Gate first (Phase 5.5)

**Minimal means minimal.** A one-line fix for a one-line bug. Don't turn a bugfix into a feature.

## Phase 5.5: Prove the Fix (MANDATORY)

<HARD-GATE>
Every fix MUST be proven through automated verification. A fix without proof is not a fix — it's a hope. Use every available verification method.

CRITICAL: Every fix MUST pass the Net-Positive Gate before it can be committed. A fix that introduces regressions is not a fix — it's a trade.
</HARD-GATE>

### Layer 0: Net-Positive Gate (Always Required — Run FIRST)

Before any other verification, compare the fix against the baseline captured in Phase 4.5:

1. **Run the full test suite** with the fix applied (but not yet committed)
2. **Compare against baseline:**
   ```
   Net-Positive Gate:
   - Baseline passing: [N]
   - Now passing: [M]
   - Previously passing, now failing (REGRESSIONS): [list]
   - Previously failing, now passing (FIXED): [list]
   - New tests added: [N] (passing: [N], failing: [N])
   - Net change: [+N or -N]
   ```
3. **Apply the gate:**

| Result | Verdict | Action |
|--------|---------|--------|
| All baseline-passing tests still pass + target test(s) now pass | **PASS** | Proceed to Layer 1 |
| All baseline-passing tests still pass but target test(s) still fail | **FIX INCOMPLETE** | The fix doesn't solve the problem. Back to Phase 3. |
| Some baseline-passing tests now fail (regressions introduced) | **FAIL — ROLLBACK** | The fix breaks other things. Revert ALL changes. Back to Phase 3 with new information: "fix X causes regression in Y" |
| Different tests pass now (some fixed, some regressed) | **FAIL — NET NEGATIVE** | The fix trades one problem for another. Revert. Investigate why the fix causes regressions — the root cause analysis was likely incomplete |

<HARD-GATE>
**A fix that fails the Net-Positive Gate MUST be rolled back immediately.** Do not attempt to "also fix" the regressions it introduced — that's how you get into circular fixing. Revert, understand WHY the fix caused regressions (this is new diagnostic information), and approach the root cause differently.
</HARD-GATE>

**Rollback procedure:**
```bash
git checkout -- .                    # Discard all unstaged changes
git clean -fd                        # Remove any new untracked files
```

**After rollback:** The regression information is valuable. Record it:
```
Fix Attempt N: ROLLED BACK
- Attempted: [what the fix changed]
- Regressions caused: [which tests broke and in which modules]
- Insight: [why the fix caused regressions — e.g., "changing the serializer format
  also affects the export module which expects the old format"]
```
This insight often reveals the REAL root cause — the one that can be fixed without regressions.

### Layer 1: Regression Unit Test (Always Required)

Write a unit test that:
1. **Reproduces the original bug** — the test would FAIL without your fix
2. **Passes with your fix applied** — proves the fix works
3. **Prevents future regression** — stays in the test suite permanently

```
Test name pattern: "should [expected behavior] when [condition that caused the bug]"
Example: "should return empty array when filter matches no items"
         (not: "test bug fix #42")
```

**Verify the test proves causation:**
1. Temporarily revert the fix
2. Run the regression test — it MUST fail
3. Re-apply the fix
4. Run the regression test — it MUST pass

If the test passes both with and without the fix, the test is wrong. It doesn't prove anything. Rewrite it.

### Layer 2: Runtime Verification (When Applicable)

After the unit test proves the fix at the code level, verify it works in the running application. **Use the project tools discovered in Phase 0** — they are the most authoritative verification method.

**Project-specific tools (ALWAYS check first):**
1. Refer to the tool inventory built during Phase 0 Triage
2. Run the project's own CLI/validators/analyzers against real input
3. If the project has a converter/processor: run it on a representative input and verify output
4. If the project has a validator/explorer: run it on the output to check integrity
5. If the project has custom scripts (`npm run validate`, `make check`): run them
6. Compare output before and after the fix when possible

**Web applications (Playwright MCP):**
1. Start the application (use discovered `startCommand` or `npm start`)
2. Navigate to the affected page/flow
3. Reproduce the user action that triggered the bug
4. Use `browser_snapshot` to verify correct state
5. Use `browser_take_screenshot` to capture evidence
6. Use `browser_console_messages` to verify no JS errors
7. Use `browser_network_requests` to verify no failed requests

**API applications (HTTP):**
1. Start the server
2. Send the request that triggered the bug
3. Verify the response status, body, and headers are correct
4. Send edge-case variations of the same request
5. Capture response bodies as evidence

**CLI applications (Shell):**
1. Run the project's CLI with the input that triggered the bug
2. Verify stdout, stderr, and exit code
3. Run edge-case variations with different inputs
4. If the project has output validators — run them on the output
5. Capture all output as evidence

**Libraries (Import and call):**
1. Write an integration test that uses the library as a consumer would
2. Verify the bug scenario produces correct results
3. Run the integration test

### Layer 3: Broader Impact Verification (When Fix Touches Shared Code)

If the fix modifies shared code (utilities, middleware, base classes, config):
1. Identify all callers/consumers of the changed code
2. Run their tests specifically
3. If no tests exist for those callers, write smoke tests
4. Verify no behavior changed for existing consumers

### Verification Decision Tree

```dot
digraph verify_fix {
    rankdir=TB;
    "Fix applied" [shape=box];
    "Write regression unit test" [shape=box];
    "Test fails without fix?" [shape=diamond];
    "Rewrite test" [shape=box];
    "Test passes with fix?" [shape=diamond];
    "Fix is wrong, back to Phase 3" [shape=box];
    "App has UI/API/CLI?" [shape=diamond];
    "Run Playwright/HTTP/Shell verification" [shape=box];
    "Library only" [shape=box];
    "Write integration test" [shape=box];
    "Fix touches shared code?" [shape=diamond];
    "Verify all consumers" [shape=box];
    "Full test suite passes?" [shape=diamond];
    "Fix introduced regression, back to Phase 3" [shape=box];
    "Fix PROVEN" [shape=doublecircle];

    "Fix applied" -> "Write regression unit test";
    "Write regression unit test" -> "Test fails without fix?";
    "Test fails without fix?" -> "Test passes with fix?" [label="yes"];
    "Test fails without fix?" -> "Rewrite test" [label="no"];
    "Rewrite test" -> "Test fails without fix?";
    "Test passes with fix?" -> "App has UI/API/CLI?" [label="yes"];
    "Test passes with fix?" -> "Fix is wrong, back to Phase 3" [label="no"];
    "App has UI/API/CLI?" -> "Run Playwright/HTTP/Shell verification" [label="yes"];
    "App has UI/API/CLI?" -> "Library only" [label="no"];
    "Library only" -> "Write integration test";
    "Write integration test" -> "Fix touches shared code?";
    "Run Playwright/HTTP/Shell verification" -> "Fix touches shared code?";
    "Fix touches shared code?" -> "Verify all consumers" [label="yes"];
    "Fix touches shared code?" -> "Full test suite passes?";
    "Verify all consumers" -> "Full test suite passes?";
    "Full test suite passes?" -> "Fix PROVEN" [label="yes"];
    "Full test suite passes?" -> "Fix introduced regression, back to Phase 3" [label="no"];
}
```

## Phase 5.75: Symptomatic Fix Detector

Before final verification, honestly assess whether you fixed the root cause or just the symptom:

1. **"Did I fix where the bug manifests, or where it originates?"**
   - If your fix adds a null check at the crash site, the root cause might be: why is the value null in the first place?
   - If your fix adds a try/catch around the failing line, ask: why does it throw? Catching is not fixing.
   - If your fix changes a test assertion to match the actual output, ask: was the test wrong, or is the code wrong?

2. **"Would this bug class recur in similar code?"**
   - If the bug was a missing null check, are there other call sites with the same missing check?
   - If the bug was an off-by-one, is the same pattern used elsewhere?
   - If yes — the fix should address the pattern, not just the instance. (Don't go on a refactoring spree, but note the other locations in the report.)

3. **"Am I treating the disease or the fever?"**

| Fix Type | Symptom Fix | Root Cause Fix |
|----------|-------------|----------------|
| Null crash | Add null check at crash site | Fix the producer that emits null |
| Wrong output | Adjust the transform at the output | Fix the logic that computes the wrong value |
| Test failure | Change the assertion | Fix the code the assertion tests |
| Import error | Add a missing export | Fix the module structure that caused the gap |
| Timeout | Increase the timeout value | Fix the operation that's too slow |

**If you detect a symptomatic fix:** You don't necessarily need to redo it — sometimes a symptomatic fix is the right pragmatic choice (e.g., defensive null check is good practice). But you MUST document it in the report: "This fix addresses the symptom at [location]. The root cause is [X] at [location]. A deeper fix would involve [Y]."

## Phase 6: Final Verification

After fix is proven, net-positive gate passed, and symptomatic-fix check is done:

1. Run the originally failing test/command — it should pass
2. Run the regression test from Phase 5.5 — it should pass
3. Run the full test suite — **compare against Phase 4.5 baseline: zero regressions allowed**
4. If runtime verification was done (Playwright/HTTP/CLI), review evidence
5. If the error was in E2E, re-run the failing E2E scenario
6. If the error was environment-related, verify the setup phase still works
7. Verify the predicted outcome from Phase 4 matches reality
8. **Only now commit** the fix and regression test together with a descriptive message

**If verification fails:** Rollback the fix (`git checkout -- .`). Go back to Phase 3, not Phase 5. The root cause needs re-investigation, not a bigger patch. Record what broke as diagnostic information for the next attempt.

## Advanced Debugging Techniques

For specialized debugging strategies, read `references/advanced-techniques.md`. It covers:
- **Concurrency debugging** — race conditions, flaky tests, shared mutable state
- **Timeout and hang debugging** — unresolved promises, infinite loops, blocked I/O
- **Dependency conflict resolution** — peer dep mismatches, CJS/ESM conflicts, lock file drift
- **Environment fingerprinting** — cross-environment issues, version mismatches
- **Error message decoding** — mapping misleading error messages to actual causes

Load this reference when the error category (from Phase 0 Triage) matches one of these patterns.

## Integration with Pipeline

Auto-debug is called by other shipwright skills when they encounter failures:

| Calling Skill | Trigger | Debug Scope |
|---------------|---------|-------------|
| `auto-setup` | Build fails, tests can't run | Environment, dependencies, config |
| `auto-impl` | Tests fail after implementation | Implementation code, test code |
| `auto-test` | New tests fail or break existing | Test logic, missing edge cases |
| `auto-e2e` | App won't start, scenarios fail | Runtime behavior, integration |
| `auto-review` | Reviewer identifies bugs | Code correctness |
| `production-readiness` | Gates fail | Whatever the gate checks |

**When called by another skill:**
- Receive the error context (command, output, file references)
- Execute the full debug process (Phases 1-6)
- Report back: RESOLVED (with fix details) or UNRESOLVED (with investigation evidence)

**When invoked standalone:**
- Receive a bug description or error report
- Execute the full debug process
- Commit the fix and report

## Dispatch as Subagent

When called from auto-impl or other skills, use the dispatch template in `references/dispatch-template.md`. The template includes the full subagent prompt with architecture context, error context, fix history, and the complete debug process instructions.

## Cleanup (MANDATORY)

Before declaring debug complete, clean up all debug artifacts:

1. **Remove all `[DEBUG:auto-debug]` log lines** — search the entire codebase for this prefix
2. **Run `git bisect reset`** if git bisect was used
3. **Remove any temporary test files** created during investigation
4. **Revert any temporary config changes** made for debugging (port changes, mock overrides, etc.)
5. **Verify the working tree is clean** except for the actual fix and regression test

```
Debug artifacts in committed code = tech debt. Always clean up.
```

## Red Flags - STOP

| Thought | Reality |
|---------|---------|
| "The fix is obvious" | Obvious fixes for non-obvious causes create new bugs. Investigate first. |
| "I've seen this error before" | Same symptom ≠ same cause. Reproduce and trace. |
| "Let me just try this fix" | A fix without a hypothesis is a guess. Hypothesize first. |
| "The fix works, ship it" | Does it fix the root cause or mask the symptom? Verify the root cause is gone. |
| "This is an environment issue" | Check the environment fingerprint from auto-setup. If it matches, it's a code issue. |

## Anti-Patterns

**Shotgun debugging:** Changing random things hoping something works. STOP. Go back to Phase 1.

**Fix-and-pray:** Applying a fix without understanding why it works. STOP. Go back to Phase 3.

**Scope creep:** "While I'm here, let me also fix..." STOP. Fix only the root cause. File other issues separately.

**Error suppression:** Wrapping in try/catch, adding `|| true`, ignoring return codes. STOP. These hide bugs, they don't fix them.

**Blame shifting:** "It's a framework bug" / "The test is wrong." Maybe. But verify with evidence before dismissing.

**Regression chasing:** Fix A breaks test B, so you fix test B, which breaks test C, so you fix test C... STOP. You're in a circle. Revert ALL fixes back to the last known-good state and rethink the approach. The problem is that fix A was wrong — not that it needs more fixes.

**Committing regressions:** Committing a fix that breaks previously-passing tests, intending to fix those "in the next step." STOP. Never commit a net-negative change. The Net-Positive Gate exists precisely for this.

**Trading problems:** A fix that makes different tests pass (some fixed, some regressed) is not progress — it's shuffling failure. The total passing count must strictly increase.
