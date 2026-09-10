---
name: auto-eval
description: "Use to evaluate and improve the pipeline itself — run Shipwright against a task suite, score each run from the artifacts it already emits, and feed systematic weaknesses back into planning. Triggers on: 'eval the pipeline', 'benchmark shipwright', 'score the last run', 'is the pipeline improving', 'evaluation loop', 'self-eval', 'grade the run', 'pipeline scorecard', 'regression-test the pipeline'. Two modes: score (grade completed runs, cheap) and loop (run a suite end-to-end, heavyweight). Do NOT use to evaluate application code — that's auto-review."
---

# Auto-Eval

The outer loop: Shipwright evaluating *itself*. Runs the pipeline against a task suite, scores each run from the evidence the pipeline already emits, and feeds systematic weaknesses back into the retrospective auto-plan reads. Where the inner loops make one run correct, this loop makes the *pipeline* better over time.

**Core principle:** Score from artifacts, never re-derive. The Implementation Report, gate table, Pipeline Quality reflection, E2E evidence verdicts, and plan retrospective are the evidence — reading them *is* the eval. If the run didn't record it, it doesn't score.

Meta-tooling — like `harness`, it operates *on* the pipeline, not inside it. Do NOT invoke superpowers skills.

## Iron Law

```
NO SCORE WITHOUT AN ARTIFACT BEHIND IT. NO FEEDBACK WITHOUT A CROSS-RUN PATTERN.
```

One run's stumble is noise; a weakness that recurs across runs is signal. Only signal feeds back.

## This is a loop.md loop (meta level)

The outer loop instantiates the same contract as the inner ones (`../_shared/loop.md`):

| Part | Instantiation |
|---|---|
| **State** | `.shipwright/eval-scorecard.md` — per-run scores + suite trend, survives across eval sessions |
| **Step** | run the pipeline on one task (or read a completed run) → score it from artifacts |
| **Gate** | net-positive on the pipeline — a skill/prompt change must not lower the aggregate vs the last baseline |
| **Progress** | suite mean ↑, open systematic weaknesses ↓ |
| **Termination** | suite exhausted / K runs no improvement (plateau) / aggregate regressed → revert the change |

## Modes

- **score** (default, cheap) — grade one or more already-completed runs from their artifacts. No pipeline execution. Use after any `run`, or to backfill a scorecard.
- **loop** (heavyweight — warn first) — run the task suite end-to-end via `shipwright:run`, each task on its own `shipwright/eval-*` branch (discarded after scoring — keep the score, not the code), then synthesize. Cost = N full pipelines. Default to a small suite; never launch without confirming scope.

## Phase 0: Task Suite

Read fixtures from `.shipwright/evals/*.md` — each: task text, acceptance criteria, expected size (S/M/L), known pitfalls (optional). None present? Bootstrap candidates from prior `docs/plans/`, `.shipwright-retrospective.md`, and past `shipwright/*` branches — real tasks already run are free ground truth. Still none → score-only on the most recent completed run, or ask the user for one representative task. **Never invent tasks with no basis** — an invented task measures nothing.

## Phase 1: Run or Read

- **score:** locate the run's artifacts — Implementation Report, `docs/plans/<task>`, gate table, `*RUNBOOK*`.
- **loop:** invoke `shipwright:run` per task on an isolated branch; capture its final report. One task at a time (branch isolation; never parallel runs).

## Phase 2: Score

Five dimensions, **0** (fail) / **1** (partial) / **2** (pass), from artifacts only — max 10. Record each score *with the one-line evidence that justifies it*:

| # | Dimension | Source artifact | 2 = |
|---|---|---|---|
| 1 | Outcome | production-readiness gate table | all gates passed first-class |
| 2 | Honesty | Pipeline Quality reflection | no rubber-stamp, no dishonest tests dropped late, E2E proved behavior |
| 3 | Evidence | E2E/verify verdicts (`../_shared/evidence-evaluation.md`) | PROVEN, data-level — not SUPERFICIAL |
| 4 | Efficiency | run report's Pipeline Results metrics (wall-clock per phase, suite runs, ledger reuses, subagent dispatches per model tier, model escalations), auto-debug count, review rounds, CI-fix rounds, net-positive rollbacks | churn within the band for the task size; no unchanged commit re-tested; every escalation follows a failure (`../_shared/model-selection.md`) |
| 5 | Plan fidelity | plan retrospective (auto-review Stage 4) | matched user intent, right seams, no wrong-decomposition re-plans |

A dimension with no artifact scores **0** and flags a *pipeline observability gap* — the run should have recorded it, and that's a finding in its own right.

## Phase 3: Synthesize & Feed Back

Aggregate across the scorecard. A weakness counts only if it **recurs** (≥2 runs or ≥2 tasks): e.g. "Efficiency drops on DB-migration tasks — auto-debug loops 3×"; "Evidence consistently SUPERFICIAL on API tasks — E2E asserts status, not body." For each, write ONE actionable, durable signal and append it to `.shipwright-retrospective.md` (read by auto-plan next run) — patterns not session specifics, ≤15 lines/entry (same discipline as run's retrospective). Update `.shipwright/eval-scorecard.md` with the run rows + new suite mean.

**Be honest about the mechanism:** improvement is accumulated durable guidance the skills read — not retrained weights. The loop works only while the retrospective stays actionable and the scorecard trend is real.

## Meta-Gate (evaluating a change to Shipwright itself)

Score the suite before and after the change. It ships only if the aggregate is net-positive **and no dimension regressed on any task** — `../_shared/net-positive-gate.md` applied to the pipeline. A change that raises one dimension by lowering another is not an improvement.

## Report Format

```markdown
## Eval Report — mode: score | loop
### Suite — N tasks, mean X.X/10 (Δ vs last +/-Y.Y)
### Per-Run Scorecard — table: task | size | O | H | E | Eff | Plan | total | branch
### Recurring Weaknesses — pattern | dimension | runs affected | fed-back signal
### Observability Gaps — dimensions that couldn't be scored (missing artifacts)
### Scorecard: .shipwright/eval-scorecard.md
```

## Integration

Standalone meta-tooling. Consumes every downstream artifact: Implementation Report + gate table (production-readiness), Pipeline Quality reflection + retrospective (run), E2E/verify evidence verdicts (auto-e2e, auto-verify), plan retrospective (auto-review), plans (auto-plan). Produces the scorecard + actionable retrospective signals that close the loop into auto-plan. Follows `../_shared/loop.md` (meta level) and `../_shared/net-positive-gate.md` (the meta-gate). Configure via `.shipwright.json` `eval` (`enabled`, `suiteDir`, `scorecard`, `mode`, `maxTasks`); zero-config defaults to score mode on the latest run.

## Red Flags — STOP

| Thought | Reality |
|---|---|
| "This one run scored low, change the pipeline" | One run is noise. Feed back only cross-run patterns. |
| "Run the whole suite to be thorough" | N full pipelines is expensive. Confirm scope; default small / score-only. |
| "I'll estimate the score" | Score from artifacts or not at all. No artifact = 0 + observability gap. |
| "The change feels better" | Feelings aren't the meta-gate. Score before/after; net-positive or revert. |
| "Invent some benchmark tasks" | Tasks need a basis (fixtures, past runs). Invented tasks measure nothing. |
