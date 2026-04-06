# Debug Safety Mechanisms

## Anti-Circle Detection

<HARD-GATE>
Circular fixing — where fix A breaks B, fix B breaks A — is the most dangerous failure mode in complex codebases. It wastes context, time, and can leave the codebase in a worse state than it started. Detect and break the cycle early.
</HARD-GATE>

### Fix History Tracking

Maintain a **fix history log** across all debug invocations within a pipeline run. After every fix attempt (successful or rolled back), record:

```
Fix History:
  Attempt 1: [files changed] → [result: passed / rolled back because X]
  Attempt 2: [files changed] → [result: passed / rolled back because X]
  Attempt 3: [files changed] → [result: passed / rolled back because X]
```

### Circle Detection Rules

Before applying any fix, check the fix history:

| Signal | Detection | Action |
|--------|-----------|--------|
| **Same file modified twice** | Fix N touches `src/utils/serialize.ts`, fix M also touches it | STOP. The first fix was likely wrong or incomplete. Don't patch a patch — revert to before fix N and find the real root cause. |
| **Regression is a previously-fixed test** | Fix N fixed test A. Fix M breaks test A again. | STOP. Fixes N and M are in conflict. They can't both be right. Revert both and investigate the shared dependency. |
| **Oscillating test results** | Test A: pass → fail → pass → fail across fix attempts | STOP. Something structural is wrong. The individual fixes are treating symptoms of a deeper issue. |
| **Fix count exceeds 3 for same error class** | Three different fixes attempted for the same type of failure | STOP. Mark UNRESOLVED. The root cause is not what you think it is. |
| **Net test count not improving** | After 2+ fixes, the total passing test count hasn't increased | STOP. You're trading problems, not solving them. |

### Breaking the Cycle

When circular fixing is detected:

1. **Revert ALL fixes in the cycle** — go back to the last known-good state (before the first fix in the cycle)
2. **Re-read the full error context** with fresh eyes — what are ALL the tests that fail, not just the one you were focused on?
3. **Look for the shared dependency** — circular fixes almost always mean two things depend on the same code in incompatible ways. Find that shared code.
4. **Consider a different approach entirely:**
   - If fixes keep conflicting in a utility module, the module's interface may need to change (not just its implementation)
   - If fixes keep oscillating in a data format, the format specification may be ambiguous — clarify it before fixing
   - If fixes in module A keep breaking module B, the architecture map's dependency graph may reveal a hidden coupling that needs explicit resolution
5. **If still stuck after one revert-and-rethink cycle:** Mark UNRESOLVED with the full fix history as evidence. The fix history is extremely valuable diagnostic information for a human or a future agent with fresh context.

## Debug Budget

Debugging can consume unlimited time and context. Set a budget before starting:

- **Max 3 hypotheses.** If three root cause theories fail, mark UNRESOLVED. (Already enforced.)
- **Max 3 log injection rounds.** If three rounds of strategic logging don't reveal the execution path, the bug is deeper than trace-level debugging can reach. Escalate to a different technique (git bisect, environment comparison).
- **Max 15 minutes equivalent of investigation** before you must have a hypothesis. If you're still in "I have no idea" territory after reading the stack trace, the failing code, the test, the recent diff, and injecting one round of logs — stop widening the search and formulate your best guess. A wrong hypothesis that can be tested is better than infinite exploration.
- **Context budget:** If your debug investigation has consumed more tool calls than the original implementation task, something is wrong. Either the bug is environmental (not a code fix), the plan was fundamentally flawed, or you're chasing a symptom. Step back, re-triage from Phase 0, and consider marking UNRESOLVED with evidence.

**The budget exists because debugging has diminishing returns.** The first 5 minutes find 80% of bugs. The next 20 minutes find 15%. The last 5% require a fundamentally different approach — and marking UNRESOLVED with good evidence is more valuable than an exhausted agent with no answer.
