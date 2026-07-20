# Net-Positive Gate, Baseline & Anti-Circle Detection

Shared reference for skills that change code and must not regress it (auto-impl per task, auto-debug per fix, auto-verify per iteration). A change that fixes 1 thing but breaks 2 is a net negative. The baseline is how you detect it.

## Baseline — capture BEFORE the change

Record the full state before writing any fix / task / iteration:
- **Passing** tests or checks — these MUST all still pass afterward; any that fail = a regression YOU introduced
- **Failing** tests or checks — these are what the change should address

Takes 30 seconds; prevents hours of circular fixing.

## Net-Positive comparison — AFTER the change, before commit

Re-run the full suite/checks and compare to baseline:

| Result | Verdict | Action |
|---|---|---|
| All baseline passes hold + target now passes | PASS | Proceed |
| All baseline passes hold + target still fails | INCOMPLETE | Change doesn't solve it — reinvestigate root cause |
| Any baseline pass now fails | FAIL — ROLLBACK | Revert everything. Do NOT "also fix" the regression — that starts a circle |
| Some fixed, some regressed | NET-NEGATIVE | Revert; the root-cause analysis was incomplete |

Total passing count must strictly increase. Never commit a net-negative change.

**Rollback:** `git checkout -- . && git clean -fd`. Then record *why* it regressed — that insight often reveals the real root cause:

```
Attempt N: ROLLED BACK — changed [X], regressed [tests/modules Y]. Insight: [why X caused Y].
```

## Anti-circle detection

Track a fix history across attempts/iterations:

| Iteration | Files changed | Fixed | Regressed | Net | Reverted? |
|---|---|---|---|---|---|

Stop and revert to the last all-green state (the "high-water mark") when:
- **Same file changed in 2+ attempts** — fixes are fighting; the file needs one coherent change, not incremental patches
- **A previously-fixed test/check fails again** — the two fixes are incompatible; find the shared dependency and fix it once
- **3+ reverts**, or **net progress ≤ 0 over the last 3 attempts** — the approach is wrong. Report PARTIAL/UNRESOLVED with the fix history; it shows exactly where the approach breaks

Two things that can't be fixed independently must be changed together — merge them into a single task/change.
