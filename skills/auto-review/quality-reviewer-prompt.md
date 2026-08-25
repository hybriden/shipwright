# Code Quality Reviewer Prompt Template

Use when dispatching a code quality reviewer. **Only dispatch after spec compliance passes.** **Purpose:** verify the implementation is well-built (clean, tested, maintainable, secure).

```
Agent tool (general-purpose):
  description: "Review code quality for [component]"
  prompt: |
    The code is already verified spec-compliant. Verify it's well-built. Review only what this
    change introduced (not pre-existing issues). Be specific — exact file:line.

    ## What Was Implemented / Changes / Conventions
    [impl summary] · [git diff or files + line ranges; base SHA → HEAD] · [detected patterns]

    ## Review For
    - Architecture/design (SOLID): one responsibility per unit (SRP); subtypes honor their
      base's contract (LSP); depend on abstractions at real I/O seams, not concretes (DIP); no
      fat interfaces (ISP); extend without editing working code where a second case exists (OCP).
      Flag violations that hurt correctness or testability — not missing abstractions for
      hypothetical futures. Well-defined interfaces; independently testable; follows the plan's
      structure; flag new files >300 logic lines.
    - Code quality (DRY/KISS): clear consistent names; readable without comments (boring over
      clever); focused functions; one home per piece of logic — but don't flag look-alike code
      that changes for different reasons; no dead code or unused imports; follows conventions.
    - Modern idiom & concision: new code uses the current language features and platform APIs
      the project's toolchain version supports — flag legacy patterns and hand-rolled versions
      of stdlib/language features with the modern replacement and lines saved. Don't flag
      legacy style the toolchain forces, untouched pre-existing code, or concision that costs
      clarity (a dense one-liner that hides intent is the bug, not the fix).
    - Comments (delete test): every comment must state what the code cannot — a non-obvious
      why, constraint, or footgun. Flag as comment-noise: narration of what code does, restated
      names, section banners, notes about the change itself, commented-out code (Important if
      pervasive, Minor otherwise). Don't flag doc comments that follow the project's existing
      public-API convention.
    - Security (OWASP): command/SQL injection, XSS, path traversal, hardcoded secrets, endpoint
      auth, input validation at boundaries.
    - Error handling: all external boundaries protected; useful context; not swallowed; graceful
      degradation for non-critical failures.
    - Production readiness: appropriate logging; no TODO/FIXME/HACK in new code; no hardcoded
      values that should be config; no N+1 / unbounded loops.
    - Test quality: behavior not implementation; descriptive names; arrange-act-assert; mocks not
      excessive; error paths covered; no self-referential tests; each test would catch a real bug.
    - Behavioral fidelity (spot-check 2-3 key functions): read the assertion, read the code — same
      thing? Silent defaults / truncation / swallowed errors the tests don't exercise? Boundary
      agreement (off-by-one, max values)?

    ## Report
    - Strengths: [specific]
    - Issues: [CRITICAL / IMPORTANT / MINOR] file:line — description + fix suggestion
      (Critical: security, data loss, broken functionality. Important: poor patterns, missing error
      handling/tests, bad naming. Minor: style.)
    - Assessment: APPROVED | NEEDS_CHANGES (if any Critical or Important)
```
