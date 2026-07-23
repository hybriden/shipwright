# Auto-Verify Dispatch Template

## Dispatch as Subagent

When other skills need runtime verification, dispatch auto-verify as a subagent. (Step 2d's app-type probing mirrors `../../_shared/runtime-probing.md`, condensed inline because the subagent can't resolve `_shared/` — keep the two in sync.)

```
Agent tool (general-purpose):
  description: "Verify: [what to verify]"
  prompt: |
    You are performing iterative runtime verification of code changes.

    ## Architecture Context
    [Task-focused lens from docs/architecture-map.md — max 150 lines. Include:
     - Modules involved in the changes (with interfaces and responsibilities)
     - Dependency chain from changed modules to dependent modules
     - Hot spots affected (if any)
     - Relevant patterns (error handling, data access conventions)
     This gives you structural understanding of the codebase without reading every file.
     When tracing root causes, follow the dependency chain — don't grep blindly.]

    ## Changes to Verify
    [What was changed and why]

    ## Verification Context
    - System: [URL, path, or connection info]
    - Deploy command: [how to deploy/start]
    - Reset command: [how to reset state]
    - Blast radius: [from dependency graph — which parts of the system could be affected]
    - Checks:
      1. [What to verify and what "correct" looks like]
      2. [...]

    ## Previous Runbooks (if any)
    [Reference to docs/*RUNBOOK* files with established patterns]

    ## Your Job
    Follow the auto-verify process:
    1. Create a runbook at docs/<feature>-VERIFY-RUNBOOK.md
       - Include an "Architecture Context" section with involved modules,
         dependency chain, hot spots, and blast radius (from the lens above).
         This section survives context compression and informs fix subagents.
    2. For each iteration (max 20):
       a. Reset system state
       b. Deploy/import changes
       c. Wait for system readiness
       d. Execute verification checks using appropriate tools:
          - Web: Playwright MCP (browser_navigate, browser_snapshot, browser_click, browser_take_screenshot)
          - API: curl with response body capture
          - CLI: run command, capture stdout/stderr/exit code
          - DB: run queries, verify counts and values
       e. Evaluate evidence (PROVEN/SUPERFICIAL/INSUFFICIENT)
       f. If issues found:
          - Document in runbook with evidence
          - Trace root cause using the dependency graph (follow module boundaries
            backward from the symptom to the source — don't grep blindly)
          - Invoke shipwright:run for the fix, including the runbook's
            Architecture Context section so the fix subagent has structural understanding
       g. After fix: return to step 2a (reset, redeploy, re-verify ALL checks)
       h. If all checks pass: close iteration
    3. Document ALL findings in the runbook
    4. After each iteration, update the runbook's "Codebase Learnings" section
       with anything discovered about the system that wasn't in the architecture map
       (e.g., "the ContentSerializer silently drops null properties" or
       "the auth middleware returns 302, not 401, for unauthenticated requests")

    Report:
    - **Status:** VERIFIED | PARTIAL | FAILED
    - **Iterations:** N/20
    - **Checks:** [pass/fail/blocked counts]
    - **Issues discovered:** [list with root causes traced through dependency graph]
    - **Runtime issues not caught by unit tests:** [most valuable findings]
    - **Codebase learnings:** [things discovered about the system during verification]
    - **Runbook:** [path to runbook file]
    - **Evidence:** [summary of what was proven and how]
```
