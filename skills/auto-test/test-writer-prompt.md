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
    5. Run the full test suite to verify nothing is broken
    6. Run coverage to verify improvement
    7. Commit your tests

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

    ## Report Format

    When done, report:
    - **Status:** DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
    - Tests written (count and names)
    - Coverage before and after (line %, branch %)
    - Files changed
    - Any paths that couldn't be tested (with reason)
```
