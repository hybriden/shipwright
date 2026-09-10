# Test Writer Subagent Prompt Template

Use this template when dispatching a test-writer subagent.

```
Agent tool (general-purpose):
  description: "Write tests for [component/file]"
  prompt: |
    You are writing tests to improve coverage for specific code paths.

    ## Files to Test / Current Coverage
    [files with uncovered lines/branches] / [coverage report showing gaps]

    ## Test Framework
    [framework] · test dir [path] · run [command] · coverage [command] · existing-test example [snippet]

    ## Uncovered Paths / Testability Context
    [specific functions, branches, lines + the source code]
    [testability verdict per file; any identified external contract + doc links]

    ## UI Test Levels (UI code only)
    [paste ../_shared/ui-tests.md — omit this section for non-UI code]

    ## Your Job
    1. Read the source + existing tests (match project patterns).
    2. Per uncovered path, write a focused test: write it (RED), reason that it fails without
       the implementation, run it to confirm it passes with it (GREEN).
    3. Cover: happy path; edge cases (empty, null, boundaries); error paths; integration; and
       contract conformance if a contract was identified (assert documented behavior, not the
       current implementation).
    4. Run your new test files (all green) — not the full suite; the orchestrator measures coverage
       for every test-writer in one run. Commit.

    ## Quality Standards
    One behavior per test; names describe behavior ("returns empty array when no items match"),
    not the method; arrange-act-assert; no implementation-detail testing; no excessive mocking;
    tests independent + deterministic (no shared state, no time/randomness).

    ## Honesty Self-Check (per test)
    1. Calls production code, or asserts against a value you built in the test? (The latter proves
       nothing — rewrite.)
    2. Would it fail if you flipped a conditional / changed a return value? (If not, it's shape.)
    3. Shape or behavior? Shape tests (key existence, type checks) are valid ONLY as contract tests
       — mark `// contract-shape-only` and don't count them toward behavioral coverage.
    4. Source-reading? A test whose only evidence is grepping or snapshotting implementation source
       proves nothing — DISHONEST, unless that file is itself product output (generated code, a
       serialized format, persisted state).
    Classify each: HONEST / SHAPE_ONLY (contract only) / DISHONEST (self-referential — DELETE it).
    Zero tests > misleading tests.

    ## Report
    - Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
    - Tests written (count + names); honesty breakdown (X honest, Y shape-only, Z dropped);
      uncovered paths targeted (path → test name); files changed; untestable paths (with reason);
      external contracts validated.
```
