---
name: production-readiness
description: "Use when a final production readiness verdict is needed before shipping. Triggers on: 'is this ready for production', 'production readiness', 'can we ship this', 'readiness check', 'final verification', 'pre-ship checklist', 'production gates', 'are all gates passing', 'ready to deploy'. Also triggers on: 'recheck readiness', 'gates still failing', 'run the gates again'. 11-gate verification including security, load testing, and definition-of-done."
---

# Production Readiness

Final verification gate. Runs every check required to declare code production-grade: tests pass, coverage met, E2E verified, review approved, security scanned, load tested (if applicable), and all definition-of-done criteria satisfied.

**Core principle:** Production is unforgiving. Every gate exists because skipping it has caused an outage. Pass all gates or don't ship.

<HARD-GATE>
This skill is part of the shipwright pipeline. Do NOT invoke superpowers:verification-before-completion, superpowers:finishing-a-development-branch, or any other superpowers skill. The shipwright handles verification internally.
</HARD-GATE>

## Iron Law

```
NO COMPLETION CLAIM WITHOUT ALL GATES PASSING
```

No exceptions. Not for "low-risk changes." Not for "it's just a config update." Not for "we'll fix it in the next release." All gates, every time.

## When to Use

- After `shipwright:auto-review` has approved the code
- When invoked by `shipwright:run` as the final phase
- When you need to verify production readiness of any codebase

## Gate Relevance Scoring

Before running gates, classify the project type and score each gate's relevance. This prevents wasting cycles on gates that don't apply while ensuring relevant gates get full rigor.

| Gate | Web Server | API Server | CLI Tool | Library | Script |
|------|-----------|-----------|---------|---------|--------|
| 1: Unit Tests | FULL | FULL | FULL | FULL | FULL |
| 2: Coverage | FULL | FULL | FULL | FULL | LIGHT |
| 3: E2E Tests | FULL | FULL | FULL | N/A | N/A |
| 4: Code Review | FULL | FULL | FULL | FULL | FULL |
| 5: Security | FULL | FULL | LIGHT | LIGHT | LIGHT |
| 6: Error Handling | FULL | FULL | FULL | FULL | LIGHT |
| 7: Load Test | FULL | FULL | N/A | N/A | N/A |
| 8: Code Hygiene | FULL | FULL | FULL | FULL | FULL |
| 9: Logging | FULL | FULL | LIGHT | N/A | N/A |
| 10: Degradation | FULL | FULL | LIGHT | N/A | N/A |
| 11: Definition of Done | FULL | FULL | FULL | FULL | FULL |

- **FULL:** Execute the gate thoroughly with all checks.
- **LIGHT:** Spot-check the most relevant items. Don't skip but don't exhaustively verify.
- **N/A:** Skip with justification.

**Gate 11 is always FULL.** It's the only gate that checks intent. Never skip or lighten it.

## Gates Checklist

Every FULL gate must pass. LIGHT gates must not have critical findings. N/A gates need documented justification.

**Configuration:** Read `.shipwright.json` in the project root for overrides to coverage targets, load test parameters, and skippable phases. See `shipwright:auto-setup` (`./shipwright-config.md`) for the full config reference.

### Gate 1: Unit Tests Pass

```bash
[project test command]
```

- All tests pass (zero failures)
- No skipped tests without documented reason
- No flaky tests (run twice if any intermittent failures suspected)

### Gate 2: Coverage Meets Target

```bash
[project coverage command]
```

- Line coverage >= 80% (or project target)
- Branch coverage >= 80% (or project target)
- No critical paths with 0% coverage
- Coverage report saved as evidence

### Gate 3: E2E Tests Pass

- All E2E scenarios from auto-e2e passed
- Evidence (screenshots, response captures) available
- No console errors or failed network requests (web apps)
- All API endpoints return correct status codes
- All CLI commands produce expected output
- **Libraries:** Mark N/A with justification (libraries have no user-facing entry point)

### Gate 4: Code Review Approved

- Spec compliance: PASS
- Code quality: APPROVED or APPROVED_WITH_NOTES
- No unresolved Critical or Important issues
- All review cycles documented

### Gate 5: Security Scan

Verify by code inspection:

- [ ] No command injection (inputs to shell sanitized)
- [ ] No SQL injection (queries parameterized)
- [ ] No XSS (user content escaped)
- [ ] No path traversal (file paths validated)
- [ ] No hardcoded secrets (credentials, API keys, tokens)
- [ ] No sensitive data in logs
- [ ] Authentication/authorization on all protected endpoints
- [ ] Input validation at all external boundaries
- [ ] Dependencies don't have known critical vulnerabilities

Check dependencies:
```bash
# Node.js
npm audit --audit-level=critical

# Python
pip-audit || safety check

# Go
govulncheck ./...

# Rust
cargo audit
```

### Gate 6: Error Handling

Verify by code inspection of all new/modified files:

- [ ] All external calls (network, file, database) have error handling
- [ ] Errors provide useful context (not generic "something went wrong")
- [ ] Errors propagated correctly (not swallowed silently)
- [ ] Graceful degradation for non-critical failures
- [ ] User-facing errors don't leak internal details

### Gate 7: Load Testing (Conditional)

**Applies to:** Web servers, APIs, services handling concurrent requests.
**Skip for:** Libraries, CLI tools, scripts, batch processors.

**Tools (in preference order):**
1. k6 (preferred — scriptable, lightweight)
2. artillery (alternative — YAML config)
3. ab/wrk (fallback — basic but available everywhere)

**Default configuration:**
```javascript
// k6 script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },   // ramp up
    { duration: '40s', target: 100 },   // sustained load
    { duration: '10s', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],    // p99 < 500ms
    http_req_failed: ['rate<0.01'],      // error rate < 1%
  },
};

export default function () {
  // Test each endpoint
  const res = http.get('[URL]');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

**Pass criteria:**
- p99 latency < 500ms
- Error rate < 1%
- No memory leaks (stable RSS over test duration)
- No connection exhaustion
- Throughput within acceptable range for the use case

**If load test fails:** Document the bottleneck. Common causes:
- Missing connection pooling
- Synchronous I/O in request path
- Unbounded concurrent operations
- Missing caching
- N+1 query patterns

### Gate 8: Code Hygiene

Scan all new/modified files:

- [ ] No TODO/FIXME/HACK comments in new code
- [ ] No commented-out code blocks
- [ ] No debug logging (console.log, print(), etc.) left in
- [ ] No unused imports or variables
- [ ] All new functions/methods have clear names (no documentation needed)
- [ ] Consistent formatting with project standards

```bash
# Search for hygiene violations in new code
grep -rn "TODO\|FIXME\|HACK\|console\.log\|debugger\|print(" [changed files]
```

### Gate 9: Logging and Observability

For production services:

- [ ] Key operations logged (startup, shutdown, errors, slow operations)
- [ ] Log levels appropriate (ERROR for errors, WARN for degradation, INFO for operations)
- [ ] Structured logging format (JSON preferred for production)
- [ ] No sensitive data in logs (passwords, tokens, PII)
- [ ] Request/response logging at appropriate level

### Gate 10: Graceful Degradation

- [ ] Application handles downstream service failures gracefully
- [ ] Timeouts configured for all external calls
- [ ] Circuit breaker pattern for critical dependencies (if applicable)
- [ ] Application starts up and shuts down cleanly
- [ ] No resource leaks (connections, file handles, memory)

### Gate 11: Definition of Done — Does This Actually Solve the Problem?

**This is the gate that catches pipeline-level dishonesty.** All prior gates verify *technical* properties: tests pass, code is clean, coverage is high. This gate verifies *intent*: did we build the right thing?

**Step 1: Re-read the original task description.** Not the plan. Not the implementation report. The *original words the user typed.* Copy them into this gate's output verbatim.

**Step 2: Sentence-by-sentence verification.** For each distinct requirement in the task description, fill in this table:

| Requirement (user's words) | Implemented? | Evidence | Confidence |
|----------------------------|-------------|----------|------------|
| "add user search" | Yes | `src/search.ts`, E2E scenario 3 screenshot showing search results | HIGH — verified through E2E with correct results |
| "results should be paginated" | Partial | Pagination exists but only tested with <10 results | MEDIUM — works for small sets, untested at scale |
| "search should be fast" | Unknown | No load test for search endpoint | LOW — functional but no performance evidence |

**Confidence levels:**
- **HIGH:** Feature demonstrated working through E2E evidence with verified correct output, or through multiple unit tests that exercise real behavior.
- **MEDIUM:** Feature exists and tests pass, but evidence is limited (only happy path tested, only small inputs, only in isolation).
- **LOW:** Feature exists but no real evidence of correctness. Tests are shape-only or evidence is superficial.
- **NONE:** Feature is missing or broken.

**Step 3: Check for implicit requirements.** Things the user expects but didn't explicitly state:
- Error messages: Are they helpful or generic?
- Performance: Is it fast enough for real use?
- Edge cases: Does it handle empty states, long strings, special characters?
- UX: If it has a UI, does it look finished or scaffolded?

**Step 4: Verdict.**
- **SOLVED:** Every requirement has HIGH or MEDIUM confidence. No NONE entries. Implicit requirements are reasonable.
- **PARTIALLY_SOLVED:** Core requirements are HIGH/MEDIUM but some requirements are LOW or missing. List specifically what's missing.
- **WRONG_PROBLEM:** Implementation is technically sound but the requirements table shows a fundamental mismatch between user intent and what was built. This is a plan failure.

**If WRONG_PROBLEM:** This is a pipeline failure. The final report must explain what happened and why.

## Generating the Final Report

After evaluating all gates:

```markdown
# Implementation Report

## Task
[Original task description]

## Status: COMPLETE | PARTIAL | FAILED

## Changes
- Files created: [list with paths]
- Files modified: [list with paths]
- Lines added: [count]
- Lines removed: [count]

## Production Readiness Gates

| Gate | Status | Notes |
|------|--------|-------|
| Unit Tests | PASS/FAIL | X passed, Y failed |
| Coverage | PASS/FAIL | Line: X%, Branch: Y% |
| E2E Tests | PASS/FAIL/N/A | X scenarios, Y passed |
| Code Review | PASS/FAIL | Spec: ✅, Fidelity: ✅, Quality: ✅ |
| Security | PASS/FAIL | [findings] |
| Error Handling | PASS/FAIL | [findings] |
| Load Test | PASS/FAIL/N/A | p99: Xms, errors: Y% |
| Code Hygiene | PASS/FAIL | [findings] |
| Logging | PASS/FAIL/N/A | [findings] |
| Graceful Degradation | PASS/FAIL/N/A | [findings] |
| Definition of Done | SOLVED/PARTIALLY_SOLVED/WRONG_PROBLEM | [original task vs. what was built] |

## Evidence
- Test output: [summary]
- Coverage report: [key numbers]
- E2E screenshots: [list]
- Load test results: [key metrics]
- Security scan: [output]

## Unresolved Issues
[Any gates that failed or items that need human attention]

## Recommendations
[Post-deployment monitoring, follow-up tasks, known limitations]
```

## Integration

Production-readiness is the final gate before shipping:

| Relationship | Skill | Data Flow |
|-------------|-------|-----------|
| **Consumes from** | `auto-test` | Coverage data (Gate 2), honesty check results, dropped test count |
| **Consumes from** | `auto-e2e` | E2E evidence and verdicts (Gate 3), evidence evaluation verdicts |
| **Consumes from** | `auto-review` | Review report (Gate 4), behavioral fidelity findings, architecture boundary violations |
| **Consumes from** | `auto-impl` | All code changes on the feature branch |
| **Consumes from** | `auto-plan` | Original task description (Gate 11 — Definition of Done) |
| **Consumes from** | `auto-map` | Architecture map — hot spots, data models for security and boundary review |
| **Produces for** | `shipwright:run` | Final verdict (COMPLETE/PARTIAL/FAILED), gate table, pipeline quality section |

**Invoked by:** `shipwright:run` (Phase 7)
**Invokes:** Nothing — production-readiness is a verification-only skill, it does not fix issues
**Signals produced:** Gate verdicts (11 gates), final implementation report, pipeline quality reflection
**Signals consumed:** All prior phase outputs, `.shipwright.json` config for coverage/load test targets

## Anti-Patterns

**Gate skipping:** Marking gates as N/A without justification. Every N/A needs a documented reason. If most gates are N/A, the project type classification is wrong.

**Premature completion:** Declaring COMPLETE because all technical gates pass without checking Gate 11 (Definition of Done). Technical correctness is not the same as solving the user's problem.

**Lowering the bar:** Reducing coverage targets or load test thresholds to make gates pass. If the defaults are wrong for this project, configure them in `.shipwright.json` before running — don't adjust mid-pipeline.

**Evidence-free gates:** Marking security or error handling gates as PASS based on "I read the code and it looks fine." These gates require specific checklist items verified with evidence (grep results, audit output, test results).

**Single-pass satisfaction:** If every gate passes on the first attempt with no issues found anywhere, either the implementation was perfect or the gates aren't probing hard enough. The pipeline integrity reflection should flag this.

## Red Flags - STOP

| Thought | Reality |
|---------|---------|
| "All tests pass, ship it" | Tests are gate 1 of 11. Keep going. |
| "Load testing is overkill" | Every production outage thought that. Test it. |
| "Security review is for the security team" | You ARE the security review. Check OWASP. |
| "It's just a small change" | Small changes cause big outages. All gates. |
| "We can monitor and fix" | Monitor AFTER shipping quality. Not instead of. |
| "The deadline is tight" | Shipping broken code costs more than missing a deadline. |
| "N/A for everything" | If most gates are N/A, you're skipping verification. Justify each. |
| "All gates pass, we're done" | Did you check Gate 11? Does it actually solve the user's problem? |
| "The plan said X, we built X" | The plan is an intermediary. The user's words are the spec. Go back to the original. |
| "Technically correct is the best kind of correct" | Not in production. Correct for the *user* is the only kind that matters. |
