# Implementor

Autonomous development pipeline for Claude Code. Give it a task, get production-grade code back — with planning, implementation, unit tests, E2E tests, code review, systematic debugging, and production readiness verification. Zero interaction required.

## Installation

```
/plugin marketplace add hybriden/implementor
/plugin install implementor@hybriden-implementor
```

## Usage

Invoke the master orchestrator with any development task:

```
/implementor:run
```

Then describe your task. The system handles everything autonomously:

1. **Branch Isolation** — Creates `implementor/<task>` feature branch
2. **Setup** — Installs dependencies, configures environment, verifies build
3. **Plan** — Scans codebase, detects tech stack, decomposes task into ordered steps
4. **Implement** — Dispatches fresh subagent per task with TDD enforcement
5. **Unit Test** — Verifies coverage (80%+ line and branch), fills gaps
6. **E2E Test** — Browser testing (Playwright), API testing, or CLI testing depending on app type
7. **Code Review** — Two-stage: spec compliance first, then code quality
8. **Production Readiness** — 10-gate verification including load testing, security, and error handling

Any failure at any phase triggers **auto-debug** automatically — no manual intervention needed.

Progress updates throughout:
```
[implementor] Phase 3/9: Implementing task 2/5 — AuthService
[implementor] Phase 4/9: Testing (coverage: 62% -> 84%)
[implementor] COMPLETE: All gates passed. Branch: implementor/add-user-auth
```

## Auto-Debug

The debugger is integrated into every pipeline phase and can also be used standalone on any project:

```
/implementor:auto-debug
```

### How It Works

Auto-debug follows a rigorous process — no guessing, no shotgun fixes:

1. **Triage** — Classifies the error type, checks recent `git diff` to narrow scope, and cascade-analyzes multiple errors to find the root one
2. **Project Tool Discovery** — Scans for the project's own CLIs, validators, scripts, and build targets to use them for verification later
3. **Reproduce** — Runs the exact failing command, captures full output, confirms consistency
4. **Isolate** — Traces the stack to the originating file/function/line, uses log injection or git bisect when needed
5. **Root Cause** — Applies the Five Whys technique (minimum 3 levels deep) to find the actual cause, not the symptom
6. **Hypothesize** — States the hypothesis, predicts the outcome, and considers side effects before writing any fix
7. **Fix** — Applies the minimal change that addresses the root cause
8. **Prove** — Every fix must be proven through multiple verification layers (see below)
9. **Cleanup** — Removes all debug artifacts (injected logs, bisect state, temp files)

### Fix Verification (Mandatory)

Every fix is proven through up to three layers:

| Layer | What | When |
|-------|------|------|
| Regression unit test | Must FAIL without fix, PASS with fix | Always |
| Project tool verification | Run the project's own CLI/validators on real input | When project has tools |
| Runtime verification | Playwright (web), HTTP requests (API), shell (CLI) | When app is runnable |
| Broader impact | Run tests for all consumers of changed code | When fix touches shared code |

### Advanced Techniques

Auto-debug includes specialized strategies for hard-to-diagnose issues:

- **Error pattern recognition** — Auto-classifies 17 error categories with fast-path strategies
- **Diff-based narrowing** — Cross-references `git diff` with stack traces to eliminate 80% of investigation
- **Git bisect** — Binary search through commits to find the exact regression-introducing change
- **Log injection** — Strategic `[DEBUG:auto-debug]` prefixed logging with mandatory cleanup
- **Cascade analysis** — When multiple errors exist, finds and fixes the root error first
- **Concurrency debugging** — Race conditions, flaky tests, shared state, missing `await`
- **Timeout/hang debugging** — Unresolved promises, infinite loops, blocked I/O, open handles
- **Dependency conflict resolution** — Peer dep mismatches, CJS/ESM conflicts, lock file drift
- **Environment fingerprinting** — Captures runtime versions, env vars, and OS info to diagnose cross-environment issues
- **Error message decoding** — Maps misleading error messages to their actual causes

## Configuration

Create `.implementor.json` in your project root to customize behavior. All fields are optional:

```json
{
  "coverage": { "line": 80, "branch": 80 },
  "skipPhases": ["e2e"],
  "testCommand": "npm test",
  "coverageCommand": "npx vitest run --coverage",
  "startCommand": "npm start",
  "loadTest": { "users": 100, "duration": "60s", "p99": 500 },
  "e2eType": "auto",
  "branch": { "prefix": "implementor", "autoMerge": false }
}
```

See `skills/auto-setup/implementor-config.md` for the full reference.

## Skills

Each skill is independently usable:

| Skill | Purpose |
|-------|---------|
| `implementor:run` | Master orchestrator — full pipeline |
| `implementor:auto-setup` | Environment and dependency setup |
| `implementor:auto-plan` | Autonomous task planning |
| `implementor:auto-impl` | Subagent-driven implementation |
| `implementor:auto-test` | Unit and integration test coverage |
| `implementor:auto-e2e` | End-to-end user testing |
| `implementor:auto-review` | Two-stage code review |
| `implementor:auto-debug` | Systematic root cause analysis with proven fixes |
| `implementor:production-readiness` | Final verification gate |

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Playwright plugin (for web E2E testing): `playwright@claude-plugins-official`

## License

MIT
