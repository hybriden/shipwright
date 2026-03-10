# Implementor

A Claude Code plugin providing an autonomous development pipeline.

## Plugin Structure

- `skills/run/` - Master orchestrator (entry point)
- `skills/auto-setup/` - Environment and dependency setup
- `skills/auto-plan/` - Autonomous task planning
- `skills/auto-impl/` - Subagent-driven implementation
- `skills/auto-test/` - Unit and integration testing
- `skills/auto-e2e/` - End-to-end testing (Playwright for web, HTTP for APIs, shell for CLIs)
- `skills/auto-review/` - Two-stage code review (spec + quality)
- `skills/production-readiness/` - Final verification gate

## Usage

Invoke `implementor:run` with a task description. The system handles everything autonomously: branch isolation, environment setup, planning, implementation, unit testing, E2E user testing, code review, and production readiness verification. Customize behavior with `.implementor.json` in the project root.

## Philosophy

Zero human interaction during execution. Evidence-based completion only. Every phase must pass before the next begins.
