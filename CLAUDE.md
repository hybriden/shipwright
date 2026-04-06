# Implementor

A Claude Code plugin providing an autonomous development pipeline.

## Plugin Structure

- `skills/run/` - Master orchestrator (entry point)
- `skills/auto-setup/` - Environment and dependency setup
- `skills/auto-map/` - Codebase architecture mapping (module inventory, dependency graph, interfaces, hot spots)
- `skills/auto-plan/` - Autonomous task planning (consumes architecture map)
- `skills/auto-impl/` - Subagent-driven implementation (passes task lenses to subagents)
- `skills/auto-test/` - Unit, integration, and contract testing with module boundary coverage
- `skills/auto-e2e/` - End-to-end testing (Playwright for web, HTTP for APIs, shell for CLIs)
- `skills/auto-review/` - Three-stage code review (spec + fidelity + architecture boundaries + quality)
- `skills/auto-debug/` - Systematic root cause analysis with dependency-graph tracing, net-positive gate, and anti-circle detection
- `skills/auto-verify/` - Iterative runtime verification with architecture-aware context, anti-regression gate, and stateful resource management
- `skills/production-readiness/` - Final verification gate
- `skills/harness/` - Agent Team & Skill Architect (generates project-specific agent teams and skills)

## Usage

Invoke `implementor:run` with a task description. The system handles everything autonomously: branch isolation, environment setup, **architecture mapping**, planning, implementation, unit testing, E2E user testing, code review, and production readiness verification. The architecture map (`docs/architecture-map.md`) provides compressed structural understanding to all subagents, enabling better decisions in large codebases. Customize behavior with `.implementor.json` in the project root.

## Philosophy

Zero human interaction during execution. Evidence-based completion only. Every phase must pass before the next begins.
