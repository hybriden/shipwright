---
name: auto-verify
description: "Use when code changes need iterative verification against a real running system. Triggers on: 'verify this in the real system', 'test against the running system', 'deploy and verify', 'verify the import', 'check the live system', 'runtime verification', 'does it work when deployed', 'verify the integration'. Also triggers on: 're-verify', 'verification failed', 'run another iteration', 'check the system again'. Iterative change-deploy-verify cycles with a runbook tracking findings."
---

# Auto-Verify

Iterative verification of code changes against a real running system. Deploy, verify behavior through browser/API/CLI, document findings in a runbook, fix issues, repeat until the system behaves correctly. Only verified behavior counts.

**Core principle:** Code that passes tests is not code that works. Code verified through the same interface a user uses is. The gap between them is where bugs live.

Part of the shipwright pipeline — do NOT invoke superpowers skills. **Not auto-e2e:** auto-e2e writes scenarios for new code and proves features in isolation; auto-verify iteratively verifies changes against a real deployed system, discovers runtime-only issues, fixes, and re-verifies.

## Iron Law

```
NO ITERATION CLOSES WITHOUT VERIFIED EVIDENCE FROM THE RUNNING SYSTEM
```

A green build, a passing suite, an approving review — none close an iteration. Only evidence from the running system does: screenshots, response bodies, DB queries, CLI output.

## When to Use

After impl + unit tests, when behavior must be verified in a real system; for import/export, data pipelines, and integrations where unit tests can't catch format issues; when verification needs a running external system (CMS, DB, third-party); when prior iterations revealed runtime issues; standalone or called by other skills needing runtime verification.

## Phase 0: Gather Verification Context

<HARD-GATE>
If you don't know HOW to verify — what to deploy to, what URL to hit, what to check, what "correct" looks like — you MUST ask the user. Do not guess or invent verification steps.
</HARD-GATE>

Read the architecture map first (per `../_shared/architecture-map.md`) to identify involved modules, the blast-radius dependency chain, hot spots, and interface contracts; record this as the runbook's "Architecture Context" (fix subagents consume it). Then gather (in order) from: the user's message; project docs (docs/, README, CLAUDE.md); `.shipwright.json` (`startCommand`, `verifyCommand`, `verifyUrl`); previous runbooks (`docs/*RUNBOOK*`); the project's tool inventory (`../_shared/project-tools.md`).

Before proceeding you need: how to deploy/start, how to access (URL/port/creds), what to verify, what "correct" looks like, and how to reset state. Good context is specific — not "check that it works" but "import the .episerverdata via /api/import, then verify only 4 pages appear in the tree at /optimizely/cms." Insufficient → ask the user specific questions (how to access; which exact behavior/values; how to reset).

## Phase 1: Create Runbook

Create `docs/<FEATURE>-VERIFY-RUNBOOK.md` — the single source of truth, surviving context compression and resumable across sessions:

```markdown
# [Feature] Verification Runbook
**Date / Branch / System under test / Changes being verified**
## Architecture Context   — modules involved, dependency chain, hot spots, blast radius, key interfaces, patterns (consumed by fix subagents)
## Verification Checklist — [ ] each check: specific behavior + expected result
## Setup Steps            — deploy/start/reset, exact copy-pasteable commands
## Stateful Resources     — see Phase 1.5
## Iteration Log          — per iteration: baseline, reset, deployed, checks (PASS/FAIL + evidence), anti-regression comparison, issues + root cause, fixes, reverts, status
## Fix History            — table: iteration | files | fixed | regressed | net | reverted?
## Codebase Learnings     — runtime behaviors discovered
```

**Codebase Learnings** accumulate runtime knowledge across iterations (e.g. "ContentSerializer silently drops null props"; "auth returns 302 to /login, not 401"; "import endpoint is async, returns 202"). Update after every iteration, even with no issues — it saves fix subagents rediscovering behaviors and can feed back into the architecture map.

## Phase 1.5: Stateful Resource Inventory

Stateful resources are the #1 source of false passes. Inventory ALL of them before looping — per resource: type, location/connection, reset command, verify-clean command (DB, cache, blob storage, search index, message queue, output files, session/auth state). Detect from the map: persisted models → DB; shared config → connection strings/cache URLs/paths; service modules → stateful deps. Record in the runbook.

**Pre-iteration checklist:** all resources accessible + in clean state (verified), app builds + starts, health checks respond. Any failure → fix before entering the loop.

## Phase 2: Deploy & Verify (iteration loop, max 20 — `../_shared/loop.md`)

1. **Reset state** — reset ALL inventory resources, then confirm each with its verify-clean command (a silent reset failure leaves stale state → false passes). Never verify against stale state.
2. **Deploy** — build, start/import, poll until ready (curl until 200/302).
3. **Execute verification** by system type per `../_shared/runtime-probing.md` (web → Playwright, API → curl status+body, CLI/pipelines → exit code + output validated by the project's own tools, DB → queries); multi-page journeys must prove state persists across navigation. CMS / file-format / DB / multi-service specifics: `references/verification-strategies.md`.
4. **Evidence evaluation gate** — apply `../_shared/evidence-evaluation.md` before marking any check PASS; verify DATA, not the container.
5. **Document** each check: PASS (evidence proves correct behavior) / FAIL (expected vs actual + root cause) / BLOCKED (why).
6. **Fix (if issues)** — delegate to `shipwright:run`; auto-verify verifies, it doesn't implement. Document the finding; trace the root cause via the dependency graph (the cause is usually in the module producing bad input, not the one failing on it); invoke `shipwright:run` with the root-cause analysis + evidence + runbook path + Architecture Context section. Then return to step 1 and re-verify ALL checks. **Trivial fixes only** (one-line, obvious typo/constant) may be fixed directly (minimal fix + regression test + full suite + commit) — use rarely. Never batch fixes; never skip re-verification.

## Anti-Regression & Circular-Fix Detection

This is a Shipwright iteration loop (`../_shared/loop.md`): the runbook + Fix History table are its **State**, the checklist its **progress metric**, VERIFIED/PARTIAL/FAILED its **termination** verdicts. Each iteration must be net-positive vs the previous — apply `../_shared/net-positive-gate.md` (baseline = passing checks + unit tests before the iteration; a previously-passing check now failing = revert). Track the Fix History table; the stall signals and high-water-mark revert live in `../_shared/loop.md` and `net-positive-gate.md` — on any stall (3 consecutive no-progress iterations, oscillation, or a repeatedly-changed file) report PARTIAL with the fix history rather than retrying.

## Iteration Budget

Max 20 (complex integrations surface issues layer by layer). Scale depth to change scope: single bug fix 1-3; feature 3-7; integration/format 5-15; major refactor/migration 10-20.

## Architecture-Guided Root Cause Tracing

Follow the dependency chain backward from the symptom module; verify the interface contract at each hop; the root cause is where the contract breaks. Full algorithm + worked example: `references/verification-strategies.md`.

## Dispatch as Subagent

When other skills need runtime verification, use `references/dispatch-template.md`.

## Integration

Standalone; callable by run (task mentions external-system verification) and by auto-debug (Layer 2 runtime verification). Consumes the map, changed files (impl), test results (test/e2e), and user verification context. Produces the runbook (iteration history + architecture context + codebase learnings), the list of runtime-only issues, a verdict (VERIFIED/PARTIAL/FAILED), a regression test for each fix, and codebase learnings that can feed back into the map.

## Report Format

```markdown
## Verification Report — VERIFIED | PARTIAL | FAILED
### System / Iterations N/20
### Checklist Results — table: check | status | evidence | notes
### Issues Discovered and Fixed — dependency trace, root cause (module), fix commit, regression test
### Issues Remaining — evidence, trace so far, what's needed
### Codebase Learnings / Runtime Issues Not Caught by Unit Tests
### Progress Tracking + Fix History tables
### Runbook: [path]
```

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "Unit tests pass, so it works" | Units prove code logic; runtime verification proves system behavior. Different. |
| "Skip the reset, just re-run" | Stale state hides bugs. Reset + verify-clean before every iteration. |
| "Fixed check 3 but broke check 2" | Trading problems, not progress. Revert; find a fix that doesn't regress. |
| "Same error, let me try harder" | Same error = root cause not fixed. Investigate deeper, don't retry. |
| "Batch these fixes, verify once" | Fix one, verify, then the next. Batching hides causality. |
| Screenshot-as-proof / evidence inflation | Prove correct content, not volume of screenshots. |
| Inventing verification steps | Ask, or read docs; wrong expectations produce false passes. |
| Skipping the runbook | It's how findings survive context compression and handoffs. |
