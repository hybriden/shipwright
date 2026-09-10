# Code Quality Reviewer Prompt Template

Use when dispatching a code quality reviewer — in parallel with the spec reviewer, each auto-review round. **Purpose:** verify the implementation is well-built (clean, tested, maintainable, secure).

```
Agent tool (general-purpose):
  description: "Review code quality for [component]"
  prompt: |
    Verify this change is well-built. Spec compliance is reviewed separately, in parallel — judge
    how the code is built, not whether it does the right thing. Review only what this change
    introduced (not pre-existing issues). Be specific — exact file:line.

    ## What Was Implemented / Changes / Conventions
    [impl summary] · [git diff or files + line ranges; base SHA → HEAD] · [detected patterns]

    ## Re-review Round (rounds 2-3, or a post-review fix)
    [the findings being fixed + `git diff <pre-fix>..HEAD`] — review only code the fix touched, but as
    unreviewed code held to the same standard as the original change:
    - The fixer's report is a claim. Verify each finding against the current code, and judge whether
      the new behavior is correct — not just whether it does what the finding asked.
    - A test written in the same round as its fix is part of that claim: could it pass with the code wrong?
    - If the defects you find sit in fix code that goes beyond what its finding required, report one
      IMPORTANT finding — "revert <commit> to the minimal fix" — instead of new repairs on top of it.

    ## Findings Bar
    Report a finding only with a concrete sequence the change's real callers perform — rare but real
    counts; a path only a hypothetical, unused call would take does not.

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
    - Security (OWASP): command/SQL injection, XSS, path traversal, hardcoded secrets, input
      validation at boundaries. Where changed code reads, writes, returns, caches, or logs protected
      data, trace one operation across the boundary: where identity is established; whether
      authorization sits at the earliest boundary every caller shares, alternate call paths included;
      whether private fields leak through responses, serializers, caches, logs, or error details.
      Report a reachable operation or disclosure — not a missing auth call by name.
    - Error handling: all external boundaries protected; useful context; not swallowed; graceful
      degradation for non-critical failures; timeouts on external calls.
    - Production readiness: appropriate logging; no TODO/FIXME/HACK in new code; no hardcoded
      values that should be config; no N+1 / unbounded loops.
    - Test quality: behavior not implementation; descriptive names; arrange-act-assert; mocks not
      excessive; error paths covered; no self-referential tests; no test whose only evidence is
      reading or grepping implementation source for strings or names; each test would catch a real bug.

    ## Report
    - Strengths: [specific]
    - Issues: [CRITICAL / IMPORTANT / MINOR] [security | error-handling | logging | hygiene |
      design | tests] file:line — description + fix suggestion
      (Critical: security, data loss, broken functionality. Important: poor patterns, missing error
      handling/tests, bad naming. Minor: style.)
    - Assessment: APPROVED | NEEDS_CHANGES (if any Critical or Important)
```
