# Test Writer Subagent Prompt Template

Use this template when dispatching a test writer subagent.

```
Agent tool (general-purpose):
  description: "Write tests for [component/file]"
  prompt: |
    You are writing tests to improve coverage for specific code paths.

    ## Files to Test

    [List of files with their uncovered lines/branches]

    ## Current Coverage

    [Coverage report showing gaps]

    ## Test Framework

    Framework: [jest/vitest/pytest/go test/etc.]
    Test directory: [path to test files]
    Run command: [exact test command]
    Coverage command: [exact coverage command]
    Existing test patterns: [example of existing test from project]

    ## Uncovered Code Paths

    [Specific functions, branches, and lines that need tests]
    [Include the actual source code for context]

    ## Testability Context

    [Include the testability audit verdict for these files]
    [If external contracts were identified, include the contract name and doc links]

    ## Your Job

    1. Read the source code for the files listed above
    2. Read existing tests to understand project test patterns
    3. For each uncovered path, write a focused test:
       a. Write the test (RED)
       b. Verify it would fail without the implementation (reason about it)
       c. Run it to verify it passes with the implementation (GREEN)
    4. Cover these categories:
       - Happy path (if not already covered)
       - Edge cases: empty input, null/undefined, boundary values
       - Error paths: invalid input, failures, exceptions
       - Integration: components working together
       - Contract conformance (if an external contract was identified):
         assert against documented contract behavior, not just current implementation
    5. Run the full test suite to verify nothing is broken
    6. Run coverage to verify improvement
    7. **Self-check every test for honesty** (see below)
    8. Commit your tests

    ## Test Quality Standards

    - Each test tests ONE behavior (single assertion focus)
    - Test names describe the behavior, not the method
      - Good: "returns empty array when no items match filter"
      - Bad: "test filterItems"
    - Use arrange-act-assert pattern
    - No testing of implementation details
    - No excessive mocking (prefer real dependencies where feasible)
    - Tests should be independent (no shared mutable state)
    - Tests should be deterministic (no randomness, no time-dependence)

    ## Test Honesty Self-Check

    Before reporting, review every test you wrote and answer for each:

    1. Does this test actually call production code, or am I asserting against
       a value I constructed inside the test itself?
       → If the expected value mirrors the implementation logic and was built
         in the test, the test proves nothing. Rewrite it.

    2. If I mentally flip a conditional or change a return value in the
       production code, would this test fail?
       → If not, the test is asserting shape, not behavior.

    3. Is this a shape test or a behavior test?
       → Shape tests (key existence, type checks, field presence) are valid
         ONLY as explicit contract tests. Mark them with a comment:
         // contract-shape-only: validates structure, not computed behavior
       → They do NOT count toward behavioral coverage.

    Classify each test:
    - HONEST: exercises production code, would catch real bugs
    - SHAPE_ONLY: validates structure, acceptable as contract test only
    - DISHONEST: self-referential or wouldn't catch any bug — DELETE IT

    Zero tests > misleading tests. Drop dishonest tests rather than ship them.

    ## Report Format

    When done, report:
    - **Status:** DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
    - Tests written (count and names)
    - **Honesty breakdown:** X honest, Y shape-only, Z dropped as dishonest
    - Coverage before and after (line %, branch %)
    - Files changed
    - Any paths that couldn't be tested (with reason)
    - External contracts validated (if any)
```
