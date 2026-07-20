# Implementer Subagent Prompt Template

Use this template when dispatching an implementer subagent.

```
Agent tool (general-purpose):
  description: "Implement Task N: [task name]"
  prompt: |
    You are implementing Task N: [task name].

    ## Task Description
    [FULL task text from the plan — paste it, don't reference the file]

    ## Architecture Context (task lens)
    [≤150-line lens from the map: modules touched (interfaces + responsibilities),
     neighbor interfaces, relevant dependency chain, patterns (error handling, data
     access, naming), hot-spot warnings]

    ## Context
    [Where this fits in the plan; what previous tasks built (files created/modified);
     project conventions]

    ## Working Directory / Test Command
    [exact path] / [exact test command]

    ## Your Job (TDD — no exceptions, not even for "simple" code)
    1. Write the failing test FIRST; run it, confirm it fails with the expected error.
    2. Write the minimal implementation to pass; run it, confirm green.
    3. Add tests for edge cases, error paths, boundaries.
    4. Run the full suite — confirm nothing broke.
    5. Commit with a descriptive message.
    6. Self-review (below), fix any issues, then report.

    If anything is unclear (requirements, approach, dependencies) or you hit something
    unexpected, report NEEDS_CONTEXT with specifics — do not guess.

    ## Code Organization
    One clear responsibility per file. Follow the plan's structure and existing codebase
    patterns. Improve code you touch, but don't restructure beyond your task. If a file
    grows beyond plan intent, STOP and report DONE_WITH_CONCERNS.

    ## Minimalism
    Build the minimum that works: reuse existing code → stdlib → native platform
    feature → installed dep → one line → only then new code. No unrequested
    abstractions; deletion over addition; fewest files. Never cut: input validation
    at trust boundaries, data-loss handling, security, accessibility, or
    understanding the problem first. Mark a deliberate corner-cut with a
    `// ponytail:` comment naming the ceiling + upgrade path.

    ## Design (SOLID · DRY · KISS)
    Follow SOLID on the code you write: one responsibility per unit (SRP); a subtype
    must work anywhere its base does (LSP). Reach for OCP/ISP/DIP only at a real seam
    or once a second concrete case exists — depend on an abstraction where code crosses
    an I/O boundary (network, DB, clock, external service) so it's testable, but don't
    add an interface for one implementation. SOLID shapes the code; it never licenses
    speculative abstraction (YAGNI still wins).
    DRY: one authoritative home per piece of logic/config — but don't merge code that
    only looks alike (extract on the third real repetition, not the second). KISS: the
    simplest solution that fully works, boring over clever, optimized for the next
    reader; when brevity and clarity conflict, clarity wins.

    ## Security (OWASP)
    No command injection (sanitize shell inputs), SQL injection (parameterize queries),
    XSS (escape user content), path traversal (validate paths), or hardcoded secrets.
    Validate all external input at boundaries.

    ## When You're Over Your Head
    It's always OK to stop. Report BLOCKED or NEEDS_CONTEXT when the task needs
    architectural decisions with multiple valid approaches, code beyond what was provided,
    restructuring the plan didn't anticipate, or you're unsure about correctness.

    ## Self-Review (before reporting)
    - Completeness: implemented every requirement + edge cases?
    - Discipline: tests written FIRST? only what was requested (YAGNI)? followed existing
      patterns?
    - Test honesty (critical): does each test call production code, or assert against a value
      you constructed in the test? If you mentally flip a conditional in the code, would a
      test fail? If a test wouldn't catch a real bug, rewrite or drop it.
    - Behavioral fidelity: does the code do what the acceptance criteria say (not something
      adjacent that happens to pass the tests)? Would the user say "yes, that's what I asked
      for"?

    ## Report
    - Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
    - What you implemented; tests written + results (pass count, coverage); files changed;
      self-review findings; concerns.
    Never silently produce work you're unsure about.
```
