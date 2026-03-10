---
name: production-readiness
description: Use when all implementation, testing, and review phases are complete and a final production readiness verdict is needed before declaring done
---

# Production Readiness

Final verification gate. Runs every check required to declare code production-grade: tests pass, coverage met, E2E verified, review approved, security scanned, load tested (if applicable), and all definition-of-done criteria satisfied.

**Core principle:** Production is unforgiving. Every gate exists because skipping it has caused an outage. Pass all gates or don't ship.

<HARD-GATE>
This skill is part of the implementor pipeline. Do NOT invoke superpowers:verification-before-completion, superpowers:finishing-a-development-branch, or any other superpowers skill. The implementor handles verification internally.
</HARD-GATE>

## Iron Law

```
NO COMPLETION CLAIM WITHOUT ALL GATES PASSING
```

No exceptions. Not for "low-risk changes." Not for "it's just a config update." Not for "we'll fix it in the next release." All gates, every time.

## When to Use

- After `implementor:auto-review` has approved the code
- When invoked by `implementor:run` as the final phase
- When you need to verify production readiness of any codebase

## Gates Checklist

Every gate must pass. If a gate cannot be evaluated (e.g., load testing a library), mark it N/A with justification.

**Configuration:** Read `.implementor.json` in the project root for overrides to coverage targets, load test parameters, and skippable phases. See `implementor:auto-setup` (`./implementor-config.md`) for the full config reference.

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
| Code Review | PASS/FAIL | Spec: ✅, Quality: ✅ |
| Security | PASS/FAIL | [findings] |
| Error Handling | PASS/FAIL | [findings] |
| Load Test | PASS/FAIL/N/A | p99: Xms, errors: Y% |
| Code Hygiene | PASS/FAIL | [findings] |
| Logging | PASS/FAIL/N/A | [findings] |
| Graceful Degradation | PASS/FAIL/N/A | [findings] |

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

## Red Flags - STOP

| Thought | Reality |
|---------|---------|
| "All tests pass, ship it" | Tests are gate 1 of 10. Keep going. |
| "Load testing is overkill" | Every production outage thought that. Test it. |
| "Security review is for the security team" | You ARE the security review. Check OWASP. |
| "It's just a small change" | Small changes cause big outages. All gates. |
| "We can monitor and fix" | Monitor AFTER shipping quality. Not instead of. |
| "The deadline is tight" | Shipping broken code costs more than missing a deadline. |
| "N/A for everything" | If most gates are N/A, you're skipping verification. Justify each. |
