# Iteration Loop Contract

Shared reference for every Shipwright skill that changes a system and re-checks it in a loop: **auto-debug** (per hypothesis), **auto-impl** (per task), **auto-review** (per stage cycle), **auto-verify** (per iteration). They all run the *same* loop — only the budget and the verdict words differ. This file defines the shared anatomy so each skill fills in parameters, not mechanics.

A loop missing any of the five parts below is how an autonomous run wastes iterations, fakes success, or circles forever.

## The five parts

Every Shipwright loop MUST specify all five:

| Part | What it is | Composed from |
|---|---|---|
| **1. State** | The durable record carried across iterations — the single source of truth that survives context compression and session handoff. | per skill: runbook / fix-history log / inter-task log |
| **2. Step** | One iteration: **observe → one coherent change → gather evidence**. Never batch changes; evidence must prove the result, not that the system merely ran. | `evidence-evaluation.md` (the evidence bar) |
| **3. Gate** | The change is net-positive vs the pre-step baseline, or it rolls back — never "also fix" the regression. | `net-positive-gate.md` |
| **4. Progress + stall** | A metric that must move toward done each step, plus detection when it stops. | below + `net-positive-gate.md` (anti-circle) |
| **5. Termination** | Exactly three exits — SUCCESS, BUDGET, STALL. Non-success reports PARTIAL with the State record; it never loops silently or claims success it can't evidence. | below |

## 1. State — write it every iteration

Updated after *every* step, even one that changed nothing (a no-change step is itself a finding). Holds: what was tried, the evidence, what passed/failed, what regressed, and learnings. It is the resume point after a crash or compression — if it isn't written down, it didn't happen.

## 2. Step — one change, real evidence

Observe the current state → apply the single smallest change that targets the root cause → gather evidence that proves the *result* (`evidence-evaluation.md`). One change per step: a step that changes two things can't tell you which one worked.

## 3. Gate — net-positive or roll back

Capture the baseline before the step; re-compare after (`net-positive-gate.md`). Total passing must strictly increase (or hold, for a step whose only goal is non-regression). A step that regresses a previously-green item rolls back immediately — chasing the regression starts a circle.

## 4. Progress + stall detection

Pick one **progress metric** the loop must monotonically improve — passing checks ↑, open findings ↓, or distance-to-target ↓ — and record it in State each step. **Stall** = the metric isn't moving. Canonical signals (any one → stop retrying; change approach or escalate):

- **Same target still failing** after the step aimed at it — the change missed the root cause.
- **Same file changed in 2+ steps** — fixes are fighting; the file needs one coherent change.
- **A previously-green item regresses** — two changes are incompatible; fix the shared cause once.
- **K consecutive no-progress steps** (K = 3 by default) — the approach is wrong.

Retrying harder is not progress. On a stall, climb the escalation ladder — never re-run an identical step.

## 5. Termination — three exits, no fourth

| Exit | Condition | Action |
|---|---|---|
| **SUCCESS** | Target met AND gate green AND evidence clears the bar | Close the loop; report the success verdict |
| **BUDGET** | Iteration cap reached without success | Report PARTIAL with the State record — what's done, what's left, what's needed |
| **STALL** | A §4 signal fired | Escalate one rung; if the top rung fails, report PARTIAL/UNRESOLVED with the fix history |

**Escalation ladder** (climb on stall; never skip a rung, never loop at one): more context → simpler/smaller scope → different approach → stronger model → re-plan → report. Every rung must *change something* vs the last step.

A loop never ends by giving up quietly or by declaring success it can't evidence. It ends at one of these three, in writing.

## How each skill instantiates the contract

| Skill | State | Budget (cap) | Verdict words |
|---|---|---|---|
| auto-debug | fix-history log | 3 hypotheses | RESOLVED / UNRESOLVED |
| auto-impl | inter-task learning log | 3 attempts / task | task DONE / FAILED |
| auto-review | cycle notes / findings | 3 cycles / stage | APPROVED / NEEDS_ATTENTION |
| auto-verify | runbook + Fix History | 20 iterations (scaled) | VERIFIED / PARTIAL / FAILED |

Different numbers, one loop. Change the mechanics here; change the parameters in the skill.
