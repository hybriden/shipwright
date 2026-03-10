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

1. **Plan** — Scans codebase, detects tech stack, decomposes task into ordered steps
2. **Implement** — Dispatches fresh subagent per task with TDD enforcement
3. **Unit Test** — Verifies coverage (80%+ line and branch), fills gaps
4. **E2E Test** — Browser testing (Playwright), API testing, or CLI testing depending on app type
5. **Code Review** — Two-stage: spec compliance first, then code quality
6. **Production Readiness** — 10-gate verification including load testing, security, and error handling

Returns a structured report with evidence when complete.

## Skills

Each skill is independently usable:

| Skill | Purpose |
|-------|---------|
| `implementor:run` | Master orchestrator — full pipeline |
| `implementor:auto-plan` | Autonomous task planning |
| `implementor:auto-impl` | Subagent-driven implementation |
| `implementor:auto-test` | Unit and integration test coverage |
| `implementor:auto-e2e` | End-to-end user testing |
| `implementor:auto-review` | Two-stage code review |
| `implementor:production-readiness` | Final verification gate |

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Playwright plugin (for web E2E testing): `superpowers@claude-plugins-official`

## License

MIT
