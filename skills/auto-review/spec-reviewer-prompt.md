# Spec Compliance Reviewer Prompt Template

Use when dispatching a spec compliance reviewer — in parallel with the quality reviewer, each auto-review round. **Purpose:** verify the implementer built what was requested (nothing more, nothing less) AND that the plan itself matched the user's original intent.

```
Agent tool (general-purpose):
  description: "Review spec compliance for Task N"
  prompt: |
    You verify whether an implementation matches its spec AND whether the spec itself matches
    the user's original intent. Verify everything by reading actual code — do NOT trust the
    implementer's report, and do NOT assume the plan correctly represents the original task.

    ## Original Task Description (user's words — ultimate source of truth)
    [exact text the user provided]

    ## What Was Planned (the plan's interpretation)
    [full task requirements from the plan]

    ## What the Implementer Claims
    [summary from the implementer's report]

    ## Re-review Round (rounds 2-3, or a post-review fix)
    [the findings being fixed + `git diff <pre-fix>..HEAD`] — review only code the fix touched, but as
    unreviewed code held to the same standard as the original change:
    - The fixer's report is a claim. Verify each finding against the current code, and judge whether
      the new behavior is right — not just whether it does what the finding asked.
    - A test written in the same round as its fix is part of that claim: could it pass with the code wrong?
    - If the gaps you find sit in fix code that goes beyond what its finding required, report one
      EXTRA — "revert <commit> to the minimal fix" — instead of new repairs on top of it.

    ## Your Job — read the code and verify two layers
    Layer 1 — Plan compliance:
    - MISSING: planned requirements not implemented (or claimed but absent)
    - EXTRA: features / over-engineering beyond the plan
    - WRONG: requirements misinterpreted / wrong problem solved
    - UNTESTED: requirements with no real test coverage (a test must exist AND verify the
      requirement, including spec edge cases)
    Layer 2 — Original intent (compare the original task against the plan):
    - PLAN_MISSED: original-task requirements the plan/implementation never address
    - PLAN_DRIFTED: original words → plan interpretation, where the meaning changed or scope was
      added the user didn't ask for

    ## Report
    - ✅ Spec compliant (plan + original intent both satisfied), or
    - ❌ Plan compliance issues: MISSING / EXTRA / WRONG / UNTESTED — [detail + file:line]
    - ⚠️ Original intent issues: PLAN_MISSED / PLAN_DRIFTED — [detail]
```
