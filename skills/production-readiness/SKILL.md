---
name: production-readiness
description: "Use when a final production readiness verdict is needed before shipping. Triggers on: 'is this ready for production', 'production readiness', 'can we ship this', 'readiness check', 'final verification', 'pre-ship checklist', 'production gates', 'are all gates passing', 'ready to deploy'. Also triggers on: 'recheck readiness', 'gates still failing', 'run the gates again'. 11-gate verification including security, load testing, and definition-of-done."
---

# Production Readiness

Final verification gate. Every check required to declare code production-grade: tests pass, coverage met, E2E verified, review approved, security scanned, load tested (if applicable), and every definition-of-done criterion satisfied.

**Core principle:** Production is unforgiving. Every gate exists because skipping it has caused an outage. Pass all relevant gates or don't ship. **Verification only — this skill does NOT fix issues** (it reports; run routes fixes to auto-debug).

Part of the shipwright pipeline — do NOT invoke superpowers skills.

## Iron Law

```
NO COMPLETION CLAIM WITHOUT ALL RELEVANT GATES PASSING
```

Not for "low-risk changes." Not for "just a config update." Not for "we'll fix it next release."

## When to Use

After auto-review approves; as run Phase 7; whenever a production-readiness verdict is needed.

## Gate Relevance Scoring

Classify the project type, then score each gate FULL / LIGHT / N/A before running — full rigor where it matters, no wasted cycles where it doesn't.

| Gate | Web | API | CLI | Library | Script |
|---|---|---|---|---|---|
| 1 Unit tests | FULL | FULL | FULL | FULL | FULL |
| 2 Coverage | FULL | FULL | FULL | FULL | LIGHT |
| 3 E2E | FULL | FULL | FULL | N/A | N/A |
| 4 Code review | FULL | FULL | FULL | FULL | FULL |
| 5 Security | FULL | FULL | LIGHT | LIGHT | LIGHT |
| 6 Error handling | FULL | FULL | FULL | FULL | LIGHT |
| 7 Load test | FULL | FULL | N/A | N/A | N/A |
| 8 Code hygiene | FULL | FULL | FULL | FULL | FULL |
| 9 Logging | FULL | FULL | LIGHT | N/A | N/A |
| 10 Degradation | FULL | FULL | LIGHT | N/A | N/A |
| 11 Definition of Done | FULL | FULL | FULL | FULL | FULL |

FULL = all checks; LIGHT = spot-check key items; N/A = skip with justification. **Gate 11 is always FULL** — it's the only gate that checks intent. Config overrides (coverage, load, skips) from `.shipwright.json`.

## Gates

Every FULL gate must pass; LIGHT gates must have no critical findings; N/A needs a documented reason.

1. **Unit tests** — all pass, zero failures; no undocumented skips; no flaky tests (re-run if suspected).
2. **Coverage** — line ≥80% + branch ≥80% (or target); no critical path at 0%; report saved as evidence.
3. **E2E** — all auto-e2e scenarios passed with evidence; no console errors / failed requests (web); correct status codes (API); expected output (CLI). Libraries N/A (no user-facing entry point).
4. **Code review** — spec PASS; quality APPROVED / APPROVED_WITH_NOTES; no unresolved Critical/Important; cycles documented.
5. **Security** — by code inspection: no command/SQL injection, XSS, path traversal, hardcoded secrets, sensitive data in logs; auth on protected endpoints; input validation at boundaries; dependency audit (`npm audit --audit-level=critical` / `pip-audit` / `govulncheck ./...` / `cargo audit`).
6. **Error handling** — all external calls (network/file/DB) handled; errors give useful context; not swallowed; graceful degradation for non-critical failures; user-facing errors don't leak internals.
7. **Load test** (conditional — web/API/services; skip libraries/CLI/scripts): k6 (preferred) / artillery / ab-wrk. Default ramp 20→100 users over ~60s. Pass: p99 <500ms, error rate <1%, stable RSS (no leak), no connection exhaustion. Fail → document the bottleneck (missing pooling, sync I/O in request path, unbounded concurrency, missing cache, N+1).
8. **Code hygiene** — new code has no TODO/FIXME/HACK, no commented-out blocks, no debug logging (console.log/print/debugger), no unused imports/vars; clear names; consistent formatting. (`grep -rn "TODO\|FIXME\|HACK\|console\.log\|debugger" [changed files]`)
9. **Logging** (services) — key operations logged; appropriate levels; structured (JSON) format; no sensitive data; request/response at appropriate level.
10. **Graceful degradation** — handles downstream failures; timeouts on all external calls; circuit breakers for critical deps (if applicable); clean startup/shutdown; no resource leaks.
11. **Definition of Done — does this actually solve the problem?** Cross-references auto-review's spec findings against the *original task*; doesn't redo the analysis. (a) Re-read the original task — the user's actual words, not the plan. (b) Cross-reference vs auto-review: every distinct requirement covered? plan drift? implicit requirements (error messages, performance, edge cases, UX) neither addressed? (c) Confidence per uncovered requirement: HIGH (E2E/behavioral proof) / MEDIUM (exists, tests pass, limited evidence) / LOW (exists, no evidence) / NONE (missing). (d) Verdict: **SOLVED** (all HIGH/MEDIUM, no NONE) / **PARTIALLY_SOLVED** (some LOW or missing) / **WRONG_PROBLEM** (intent mismatch — a plan failure).

## Final Report

Canonical Implementation Report — run reuses this and adds its own sections:

```markdown
# Implementation Report
## Task
## Status: COMPLETE | PARTIAL | FAILED
## Changes — files created/modified, +/- lines
## Production Readiness Gates
| Gate | Status | Notes |   (11 rows: PASS/FAIL/N/A + key metric)
## Evidence — test output, coverage, E2E screenshots, load metrics, security scan
## Unresolved Issues
## Recommendations — monitoring, follow-ups, known limitations
```

## Integration

run Phase 7; verification-only (invokes nothing to fix — it reports so run can route to auto-debug). Consumes coverage + honesty (auto-test), E2E evidence (auto-e2e), the review report + fidelity + boundary findings (auto-review), all code (auto-impl), the original task (auto-plan — Gate 11), and the map (auto-map). Produces the 11 gate verdicts, the final report, and pipeline-quality inputs for run.

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "All tests pass, ship it" | Tests are gate 1 of 11. Keep going. |
| "It's just a small change" | Small changes cause big outages. All relevant gates. |
| "N/A for everything" | If most gates are N/A, the project-type classification is wrong. Justify each. |
| "All gates pass, we're done" | Did you check Gate 11 — does it solve the user's problem? |
| "The plan said X, we built X" | The plan is an intermediary. The user's words are the spec. |
| Lowering coverage/load thresholds to pass | Configure defaults in `.shipwright.json` before running, never mid-pipeline. |
| "Read the code, looks fine" for security/error gates | These need checklist items verified with evidence (grep, audit output, tests). |
