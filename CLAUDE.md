# Shipwright

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
- `skills/auto-minimize/` - Minimalism (lazy-senior-dev): build the leanest solution that works, and hunt over-engineering (adapted from ponytail, MIT)
- `skills/_shared/` - Shared reference snippets linked by multiple skills (architecture-map consumption, net-positive gate, evidence evaluation, context budget, checkpoints, minimalism ladder, SOLID / DRY / KISS principles, dotnet-skills consumption protocol) to avoid duplication
- `hooks/` - Always-on Code Laws: a SessionStart/SubagentStart hook (`inject-code-laws.js`) injects the distilled design principles (`code-laws.md`) into every session and subagent. Opt out with `SHIPWRIGHT_CODE_LAWS=off`
- `hooks/dotnet/` - Dynamic .NET skills (`.NET projects only`): `detect.js` (near-zero-cost .NET gate), `engine.js` (acquisition engine — drives the official managedcode/dotnet-skills CLI to install project-matched skills into an out-of-repo cache, builds an index), and `inject-dotnet-skills.js` (SessionStart/SubagentStart hook that injects the index). Nothing is vendored; skills are Read on demand. Opt out with `SHIPWRIGHT_DOTNET_SKILLS=off`. Wired into `run` Phase 1.75 and consumed via `skills/_shared/dotnet-skills.md`.

## Usage

Invoke `shipwright:run` with a task description. The system handles everything autonomously: branch isolation, environment setup, **architecture mapping**, planning, implementation, unit testing, E2E user testing, code review, and production readiness verification. The architecture map (`docs/architecture-map.md`) provides compressed structural understanding to all subagents, enabling better decisions in large codebases. Customize behavior with `.shipwright.json` in the project root.

## Philosophy

Zero human interaction during execution. Evidence-based completion only. Every phase must pass before the next begins.

## Design Principles

Code is held to a single-sourced set of design principles in `skills/_shared/`, applied automatically across planning, implementation, and review: **minimalism** (least code — reuse/stdlib/native first), **SOLID** (structure), and **DRY/KISS** (one source of truth, simplest clear solution). They reconcile explicitly — abstraction is earned at a real seam or second concrete case (never speculative), clarity beats terseness, and the safety carve-outs (trust-boundary validation, data-loss handling, security, accessibility, understanding the problem) are never simplified away. See the README "Design Principles" section for the full table.
