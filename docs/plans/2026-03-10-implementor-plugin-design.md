# Implementor Plugin Design

## Purpose

A Claude Code plugin that takes a development task and delivers production-grade code with zero human interaction. Full pipeline: plan, implement, unit test, E2E user test, code review, load test, and production readiness verification.

## Philosophy

**"Task in, production-grade system out."** One invocation, zero interaction. The system gathers all context upfront, makes every decision autonomously, and only returns when the definition of done is met.

## Architecture

```
User invokes implementor:run with task description
        |
        v
+---------------------+
|  implementor:run     |  Master orchestrator
|  (gather > decide    |
|   > execute > verify)|
+---------+-----------+
          |
    +-----+-----+----------+----------+----------+
    v           v          v          v          v
 auto-plan  auto-impl  auto-test  auto-e2e  auto-review
    |           |          |          |          |
    |      (subagents)  (unit+integ) (Playwright) (2-stage)
    |           |          |          |          |
    +-----+-----+----------+----------+----------+
          |
          v
+---------------------+
| production-readiness |  Final gate
| (load test + verify  |
|  + coverage + DoD)   |
+---------------------+
          |
          v
    Result Report
```

## Skills

### implementor:run (Rigid)
Master orchestrator. Invokes all sub-skills in sequence. Handles errors by re-planning failed tasks. Reports final status.

### implementor:auto-plan (Flexible)
- Reads full codebase structure
- Identifies tech stack, patterns, test infrastructure
- Decomposes task into ordered implementation steps
- Each step has: exact file paths, acceptance criteria, test strategy
- Adapts plan granularity to task complexity

### implementor:auto-impl (Rigid)
- Dispatches each plan task to a fresh subagent
- Subagent implements + writes tests + commits
- BLOCKED tasks get re-planned by orchestrator
- No human escalation

### implementor:auto-test (Rigid)
- Unit + integration tests written alongside implementation
- Coverage target: 80% line + branch (configurable)
- Must cover: happy path, edge cases, error paths, boundaries
- Full suite runs after each task; failures fixed before proceeding

### implementor:auto-e2e (Rigid)
- Playwright MCP for browser-based apps
- CLI/API testing for non-browser apps
- Test scenarios derived from original task description
- Covers: navigation, forms, error states, responsiveness
- Screenshots captured as evidence
- Accessibility basics validated

### implementor:auto-review (Rigid)
- Stage 1: Spec compliance (does code match plan and task?)
- Stage 2: Code quality (clean, secure, follows conventions?)
- Issues loop back to implementer for fixes
- Max 3 review cycles

### implementor:production-readiness (Rigid)
Iron Law: NO COMPLETION CLAIM WITHOUT ALL GATES PASSING

Gates:
- All unit tests pass
- Coverage meets threshold
- All E2E tests pass
- Code review approved (both stages)
- No security vulnerabilities (OWASP top 10)
- Error handling at all external boundaries
- Load test passes (web services/APIs only)
- No TODO/FIXME/HACK in new code
- Appropriate logging in new code
- Graceful degradation under failure

### Load Testing
- Tools: k6 or artillery (auto-detected/installed)
- Default: 100 concurrent users, 60s duration
- Pass: p99 < 500ms, error rate < 1%
- Skipped for non-server code

## Plugin Structure

```
implementor/
  plugin.json
  CLAUDE.md
  skills/
    run/
      SKILL.md
    auto-plan/
      SKILL.md
    auto-impl/
      SKILL.md
      implementer-prompt.md
    auto-test/
      SKILL.md
      test-writer-prompt.md
    auto-e2e/
      SKILL.md
      e2e-tester-prompt.md
    auto-review/
      SKILL.md
      spec-reviewer-prompt.md
      quality-reviewer-prompt.md
    production-readiness/
      SKILL.md
  docs/
    plans/
```

## Subagent Prompts

Each subagent receives a specialized prompt:
- **implementer-prompt.md**: Full implementation context, project conventions, commit requirements
- **test-writer-prompt.md**: Testing philosophy, coverage requirements, edge case patterns
- **e2e-tester-prompt.md**: Playwright patterns, user journey mapping, evidence capture
- **spec-reviewer-prompt.md**: Plan compliance, acceptance criteria verification
- **quality-reviewer-prompt.md**: Code quality standards, security checks, convention adherence

## Definition of Done Report

The orchestrator produces a structured report covering: changes made, test results, coverage, review status, production readiness gates, and evidence (screenshots, logs, load test output).

## Key Constraints

- Zero human interaction during execution
- Every decision documented in the plan
- Evidence-based completion claims only
- Subagents get fresh context (no pollution)
- Max 3 review cycles before hard stop
- Adapts to any tech stack by reading the project first
