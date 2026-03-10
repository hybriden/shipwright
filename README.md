# Implementor

Autonomous development pipeline for Claude Code. Give it a task, get production-grade code back — with planning, implementation, unit tests, E2E tests, code review, and production readiness verification. Zero interaction required.

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

Progress updates throughout:
```
[implementor] Phase 3/9: Implementing task 2/5 — AuthService
[implementor] Phase 4/9: Testing (coverage: 62% -> 84%)
[implementor] COMPLETE: All gates passed. Branch: implementor/add-user-auth
```

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
| `implementor:auto-debug` | Systematic root cause analysis and resolution |
| `implementor:production-readiness` | Final verification gate |

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Playwright plugin (for web E2E testing): `playwright@claude-plugins-official`

## License

MIT
