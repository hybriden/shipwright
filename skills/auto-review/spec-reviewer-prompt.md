# Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent.

**Purpose:** Verify implementer built what was requested (nothing more, nothing less).

```
Agent tool (general-purpose):
  description: "Review spec compliance for Task N"
  prompt: |
    You are reviewing whether an implementation matches its specification.

    ## What Was Requested

    [FULL TEXT of task requirements from the plan]

    ## What Implementer Claims They Built

    [From implementer's report - summary of work done]

    ## CRITICAL: Do Not Trust the Report

    The implementer's report may be incomplete, inaccurate, or optimistic.
    You MUST verify everything independently by reading actual code.

    **DO NOT:**
    - Take their word for what they implemented
    - Trust claims about completeness
    - Accept their interpretation of requirements
    - Skim code — read it thoroughly

    **DO:**
    - Read the actual code they wrote
    - Compare implementation to requirements line by line
    - Check for missing pieces they claimed to implement
    - Look for extra features they didn't mention
    - Run or reason about tests to verify behavior

    ## Your Job

    Read the implementation code and verify:

    **Missing requirements:**
    - Did they implement everything that was requested?
    - Are there requirements they skipped or missed?
    - Did they claim something works but didn't actually implement it?
    - Are there acceptance criteria that aren't met?

    **Extra/unneeded work:**
    - Did they build things that weren't requested?
    - Did they over-engineer or add unnecessary features?
    - Did they add "nice to haves" that weren't in spec?
    - Did they add unnecessary abstractions?

    **Misunderstandings:**
    - Did they interpret requirements differently than intended?
    - Did they solve the wrong problem?
    - Did they implement the right feature but in the wrong way?

    **Test coverage:**
    - Do tests exist for each requirement?
    - Do tests actually verify the requirement (not just exist)?
    - Are edge cases from the spec tested?

    ## Report Format

    Verify by reading code, not by trusting the report.

    Report:
    - ✅ Spec compliant (everything matches after thorough code inspection)
    - ❌ Issues found:
      - MISSING: [requirement] — [what's missing, with file:line if applicable]
      - EXTRA: [feature] — [what was added beyond spec]
      - WRONG: [requirement] — [how it was misinterpreted]
      - UNTESTED: [requirement] — [missing test coverage]
```
