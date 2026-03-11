# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable, secure).

**Only dispatch after spec compliance review passes.**

```
Agent tool (general-purpose):
  description: "Review code quality for [component]"
  prompt: |
    You are reviewing code quality for a verified-spec-compliant implementation.
    The code does what was requested. Your job is to verify it's well-built.

    ## What Was Implemented

    [From implementer's report]

    ## Changes to Review

    [Git diff or list of files changed with line ranges]
    Base SHA: [commit before implementation]
    HEAD SHA: [current commit]

    ## Project Conventions

    [Detected coding patterns, naming conventions, architecture patterns]

    ## Your Job

    Review all changed code for:

    **Architecture & Design:**
    - Does each file have one clear responsibility?
    - Are interfaces well-defined?
    - Can components be understood and tested independently?
    - Does the implementation follow the file structure from the plan?
    - Are new files already too large? (flag if >300 lines of logic)

    **Code Quality:**
    - Are names clear, accurate, and consistent?
    - Is the code readable without comments?
    - Are functions focused and reasonably sized?
    - Is there unnecessary duplication?
    - Are there dead code paths or unused imports?
    - Does it follow project conventions?

    **Security (OWASP Top 10):**
    - Command injection: are inputs to shell commands sanitized?
    - SQL injection: are queries parameterized?
    - XSS: is user content escaped in HTML output?
    - Path traversal: are file paths validated?
    - Secrets: are there hardcoded credentials, API keys, tokens?
    - Auth: are endpoints properly protected?
    - Input validation: is all external input validated?

    **Error Handling:**
    - Are all external boundaries protected (network, file, user input)?
    - Do errors provide useful context for debugging?
    - Are errors propagated appropriately (not swallowed)?
    - Is there graceful degradation for non-critical failures?

    **Production Readiness:**
    - Is there appropriate logging for production debugging?
    - Are there TODO/FIXME/HACK comments in new code?
    - Are hardcoded values that should be configurable?
    - Are there performance concerns (N+1 queries, unbounded loops)?

    **Test Quality:**
    - Do tests verify behavior (not implementation details)?
    - Are test names descriptive of the behavior tested?
    - Is test setup clean (arrange-act-assert)?
    - Are mocks used appropriately (not excessively)?
    - Do tests cover error paths, not just happy paths?
    - Are any tests self-referential (asserting against values the test constructed)?
    - Would each test catch a real bug if one were introduced in the production code?

    **Behavioral Fidelity (spot-check 2-3 key functions):**
    - Read the test assertion. Read the code. Are they testing the same thing?
    - Does the code silently return defaults, truncate input, or swallow errors
      in ways the tests don't exercise?
    - Do tests and code agree on boundary conditions (off-by-one, max values)?

    ## Issue Severity

    - **Critical:** Security vulnerabilities, data loss risk, broken functionality
    - **Important:** Poor patterns, missing error handling, bad naming, missing tests
    - **Minor:** Style preferences, minor readability improvements

    ## Report Format

    **Strengths:** [What was done well — be specific]

    **Issues:**
    - [CRITICAL] file:line — description and fix suggestion
    - [IMPORTANT] file:line — description and fix suggestion
    - [MINOR] file:line — description (no fix required)

    **Assessment:** APPROVED | NEEDS_CHANGES (if any Critical or Important issues)

    Be specific. Reference exact file paths and line numbers.
    Don't flag pre-existing issues — focus only on what this change introduced.
```
