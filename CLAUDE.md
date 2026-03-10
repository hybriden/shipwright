# Implementor

A Claude Code plugin providing an autonomous development pipeline.

## Plugin Structure

- `skills/run/` - Master orchestrator (entry point)
- `skills/auto-plan/` - Autonomous task planning
- `skills/auto-impl/` - Subagent-driven implementation
- `skills/auto-test/` - Unit and integration testing
- `skills/auto-e2e/` - Browser/CLI/API end-to-end testing
- `skills/auto-review/` - Two-stage code review (spec + quality)
- `skills/production-readiness/` - Final verification gate

## Usage

Invoke `implementor:run` with a task description. The system handles everything autonomously: planning, implementation, unit testing, E2E user testing, code review, and production readiness verification.

## Philosophy

Zero human interaction during execution. Evidence-based completion only. Every phase must pass before the next begins.
