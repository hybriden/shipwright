---
name: auto-deliver
description: "Use when a finished, verified branch needs to ship as a pull request with CI green. Triggers on: 'open a PR', 'create a pull request', 'ship this branch', 'watch CI', 'fix CI', 'CI is failing', 'get CI green', 'deliver the change'. Pushes the branch, opens a PR that carries the implementation report, watches CI to a verdict, and fixes CI failures in bounded rounds."
---

# Auto-Deliver

Ship a verified branch: push it, open a pull request that carries the evidence, watch CI to a verdict, and fix what CI catches — with no person in the loop until the merge decision, and not even then under `branch.autoMerge`.

**Core principle:** local gates prove the change on this machine; CI proves it where the team ships from. A PR isn't delivered until its checks are green — or honestly reported red.

Part of the shipwright pipeline — do NOT invoke superpowers skills.

## Iron Law

```
NEVER MERGE ON RED OR PENDING. NEVER SILENCE A CHECK TO GET GREEN.
```

Skipping, disabling, or weakening a check, workflow, or test to pass CI is a failure, not a fix.

## When to Use

run Phase 8, after production-readiness; standalone for any branch that should ship through a PR.

## Preconditions — degrade, never block

- `gh` installed and authenticated (`gh auth status`), an `origin` remote on GitHub, a clean tree on the feature branch.
- Any missing → skip delivery, keep the branch, and report exactly what's missing (`gh auth login`, add a remote). The run still completes locally.
- `skipPhases: ["deliver"]` or `.shipwright.json` `delivery.pr: false` → local-only delivery, as before.

## 1. Push

`git push -u origin <branch>`. A rejected push (the remote moved) → `git pull --rebase`, re-run the affected tests, push again. Force-push only commits nobody else has pulled.

## 2. Open the PR

- **Title:** a conventional summary of the task (`feat: …`, `fix: …`), ≤72 characters.
- **Body** — written to a temp file outside the repo and passed with `--body-file`: the user's original task words; production-readiness's Implementation Report (status, changes, gate table, evidence summary, unresolved issues, recommendations); run's Pipeline Results and Principle Deviations. Link logs and artifacts instead of pasting them; GitHub caps a body at 65,536 characters. A queue run (`run --queue`) adds `Closes #<n>`, so merging closes the issue.
- `gh pr create --base <originalBranch> --head <branch> --title "…" --body-file <file>`, adding `--draft` when readiness status is PARTIAL (unresolved issues or UNTESTED critical scenarios).
- An open PR already exists for the branch → `gh pr edit <pr> --body-file <file>` instead of opening another.

## 3. Watch CI

- Run `gh pr checks <pr> --watch --fail-fast --interval 30` in the background — checks often outlast a single tool call. Past `delivery.ciTimeoutMinutes` (default 60), stop and report the checks still pending.
- Read the verdict from `gh pr checks <pr> --json name,state,bucket,link`: every check `pass` or `skipping` → green; any `fail` or `cancel` → red.
- No checks reported → record "no CI configured" and deliver on the local gates alone. Say so in the report; never call it a CI pass.

## 4. Fix CI Failures (≤ `delivery.ciFixRounds`, default 3)

Each round is a Shipwright iteration loop (`../_shared/loop.md`): **State** = the CI round log (check, failure, cause, fix commit), **budget** = the rounds, **verdicts** SHIPPED / CI_RED.

1. **Pull the failure:** the run id from the failed check's `link`, then `gh run view <run-id> --log-failed` — read only the failing step's tail.
2. **Classify and act:**
   - **Code or test failure** → reproduce locally, then auto-debug with the log, the failing command, and the ledger baseline; the fix gets auto-review's Post-Review Fixes round.
   - **Environment drift** (OS, runtime or SDK version, stale lockfile, tool version) → fix the project's config or pin — not the test.
   - **Flaky or infrastructure** (runner outage, network timeout, rate limit) → one `gh run rerun <run-id> --failed`; the same failure again → treat it as code.
   - **Needs a secret, permission, or external service** the pipeline can't provide → stop and report exactly what's needed; the branch can't fix it.
3. **Commit, push, watch again.** Stall — the same check still failing after a fix aimed at it → climb the escalation ladder. Budget exhausted → CI_RED with the round log.

## 5. Land

- CI green and `branch.autoMerge: true` → `gh pr merge <pr> --squash --delete-branch`. Branch protection blocks it → report why; never bypass it.
- Otherwise leave the PR open: the merge decision is the only step left for a person.
- **Report:** PR URL, CI verdict per check, CI rounds used, and anything still waiting on a person.

## Integration

run Phase 8. Consumes the feature branch and `originalBranch` (run Phase 0), the Implementation Report (production-readiness), Pipeline Results and Principle Deviations (run), and the evidence ledger. Invokes auto-debug and auto-review's Post-Review Fixes round for CI failures. Produces the PR URL, CI verdicts, and CI rounds for run's final report and auto-eval's Efficiency score.

## Red Flags — STOP

| Thought | Reality |
|---|---|
| "That check is flaky, skip it" | Re-run once; a repeat is a real failure. |
| "Mark the test skipped to get green" | Silencing a check is a failure (Iron Law). |
| "Force-push over the remote" | Only unpublished commits of your own; otherwise rebase. |
| "No CI, so it passed" | Report "no CI configured" — the local gates are the evidence. |
| "Merge now, CI will finish" | Never merge on red or pending. |
| "Paste the whole CI log into the PR" | Link it; the body carries verdicts and a summary. |
