---
name: harness
description: "Triggers on: 'build a harness', 'design a harness', 'create agent team', 'harness audit', 'harness inspection', 'agent sync', 'skill sync', 'update harness', 'extend harness', 'add agent', 'add skill', 'team architecture', 'agent architecture'. Use when the user wants to generate, audit, extend, or maintain a project-specific agent team and skill infrastructure. Creates .claude/agents/ and .claude/skills/ files, registers them in CLAUDE.md, and validates the full harness."
---

# Harness

Agent Team & Skill Architect. Analyzes a project's domain, stack, and workflows, then generates a complete agent-team infrastructure — agent definitions in `.claude/agents/`, skills in `.claude/skills/`, and an orchestrator — all registered in CLAUDE.md. A living system that evolves through feedback.

**Core principle:** Understand the domain deeply, then generate the minimal agent team that covers it completely. Every agent must justify its existence; every skill must earn its token cost.

<HARD-GATE>
When harness is active it is the sole orchestrator — do NOT invoke run, auto-plan, or any pipeline skill. The harness generates infrastructure, it does not execute dev tasks: "build X" (a feature) → route to run; "build a harness / design an agent team" → this skill.
Agent definitions MUST be files in `.claude/agents/`, never inline Agent-tool prompts. Test skill triggers. Never skip CLAUDE.md registration — without it the harness is invisible next session.
</HARD-GATE>

## Iron Law

```
EVERY AGENT MUST JUSTIFY ITS EXISTENCE WITH A UNIQUE CAPABILITY NO OTHER AGENT PROVIDES.
```

Agent sprawl is worse than no agents. Overlap → merge. Role handled by a skill alone → not an agent. Fewer, sharper agents beat many blurry ones.

## When to Use

Generate a project-specific agent team; audit or extend an existing harness; "build a harness," "add an agent," "design agent team."

## Pipeline

Phase 0 audit → route → (1 domain analysis → 2 team architecture →) 3 agent generation → 4 skill generation → 5 integration → 6 validation → 7 evolution → deliver.

## Phase 0: Audit Existing Harness

Inspect `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, CLAUDE.md registration, `_workspace/harness/`. Classify and route:

| State | Intent | Route |
|---|---|---|
| No harness | Build a harness | Full (1-7) |
| Exists | Add an agent | 0→3→5→6 |
| Exists | Add a skill | 0→4→5→6 |
| Exists | Restructure | 0→2→3→4→5→6 |
| Exists | Audit/inspect | 0→6 |
| Exists | Feedback | 0→7 |

Write findings to `_workspace/harness/audit.md` (the harness's working memory — never delete `_workspace/harness/`).

## Phase 1: Domain Analysis

- **Stack:** languages/frameworks, architecture (monolith/microservices/monorepo/plugin), build system, test infra, CI/CD, infrastructure, domain-specific tools (CMS/ORM/API framework).
- **Workflow:** how features ship, recurring task types, pain points, integration points, data flow.
- **User profile:** skill level, team size, domain knowledge, autonomy preference.
- **Complexity axes:** breadth (concern areas), depth (domain rules per area), integration (external systems), quality gates, operations.

Save to `_workspace/harness/domain-analysis.md`.

## Phase 2: Team Architecture

**Execution mode:** 2+ agents that must communicate mid-execution → Agent Teams (`TeamCreate` + `SendMessage`); independent agents reporting to a coordinator → Subagents (`Agent`); single specialist → Subagent. Default Agent Teams; Subagents when truly independent. (Full taxonomy: `references/agent-design-patterns.md`.)

**Pattern** (6; composites encouraged): Pipeline (sequential dependent phases), Fan-out/Fan-in (parallel independent analysis), Expert Pool (context-dependent routing), Producer-Reviewer (generate→validate loops), Supervisor (dynamic distribution), Hierarchical (top-down delegation).

**Separation criteria — each candidate agent must pass all 4:** distinct expertise (else merge), parallelism (else consider merging), context burden (keep separate if it'd overload another), reusability (else make it a skill).

**Team size:** small 1-2, medium 2-4, large 3-6 agents. Never exceed 8 (use hierarchical sub-teams).

Save to `_workspace/harness/team-architecture.md` (execution mode, pattern, roster with role + justification + type + I/O + communication, data flow, error handling).

## Phase 3: Agent Definition Generation

Generate `.claude/agents/{name}.md`. Required sections: identity paragraph; Core Role; Work Principles (why-first); Input Protocol (receives + required context); Output Protocol (produces + completion signal); Team Communication Protocol (Agent Teams only — reports to / receives from / shares / escalates + formats); Error Handling table (missing input / service failure / quality-gate failure / timeout); Domain Knowledge (can be extensive).

**Model per agent:** deep analysis/architecture → opus; standard impl/review → default; mechanical/format → haiku. Specify explicitly in every Agent call.

**Writing standards:** command tone, why-first, specific (exact paths/commands/formats), honest about limitations + escalation paths.

**CLAUDE.md incremental sync:** register agents (table: agent | role | file) immediately after generating them — if the harness crashes mid-run, already-generated agents stay usable.

## Phase 4: Skill Generation

Generate `.claude/skills/{name}/SKILL.md`. Categories: orchestrator (coordinates the team), domain skills (specialized workflows), utility skills (common ops not needing the full team). Standards (`references/skill-writing-guide.md`): **description is the trigger** — aggressive, lists every triggering phrase (err toward over-triggering); **progressive disclosure** — metadata always loaded, SKILL.md body on trigger (<500 lines), references on demand; structure: frontmatter, one-paragraph summary, Iron Law, process flow, phases, Red Flags, Integration.

**Orchestrator** (`references/orchestrator-template.md`) MUST: accept a task, decompose into assignments, invoke agents, monitor, handle failures (retry/reassign/escalate), integrate outputs, deliver. MUST NOT: do the work itself, make domain decisions, skip error handling.

CLAUDE.md sync: register skills (table: skill | purpose | trigger).

## Phase 5: Integration & Orchestration

Verify every agent-to-agent data flow (producer output format matches consumer input; the orchestrator passes data, not just invokes; error propagation works). Write the full CLAUDE.md Harness section (agents, skills, pattern, execution mode, usage, config). Save the blueprint to `_workspace/harness/blueprint.md` (domain analysis, architecture, roster + justifications, skills, data flow, rationale — the audit trail of *why*).

## Phase 6: Validation & Testing

- **Structural:** every roster agent has a file; every skill has SKILL.md; CLAUDE.md registered with correct paths; no orphan agents (each referenced by ≥1 skill) or skills (each in CLAUDE.md); model specified in every Agent call; agent defs complete; descriptions aggressive.
- **Trigger testing:** per skill, 5+ should-trigger prompts (explicit, implicit, varied phrasing) and 5+ should-NOT-trigger (adjacent, unrelated, ambiguous). Read the description and honestly assess whether it fires; "maybe not" → strengthen. (`references/skill-testing-guide.md`)
- **Dry run:** pick a representative task, mentally walk the orchestrator, verify each agent has enough context + a clear output format + the orchestrator knows what to do with each output; note gaps.
- **With/without comparison:** if the harness doesn't clearly beat baseline Claude on a domain task, it's overhead — simplify.

Save `_workspace/harness/validation.md` (structural checks, trigger results, dry run, verdict READY / NEEDS_FIXES). NEEDS_FIXES → loop to Phase 3/4/5, max 2 fix cycles.

## Phase 7: Evolution

The harness is a living system. Track use in `_workspace/harness/run-log.md`; map feedback to action:

| Feedback | Target | Action |
|---|---|---|
| Wrong output | agent definition | refine instructions, add examples |
| Missed edge case | agent domain knowledge | add knowledge |
| Skill didn't trigger | description | add trigger phrases |
| Triggered wrongly | description | add NOT-trigger conditions |
| Wrong agent for task | team architecture | reassign |
| Missing capability | roster | add/extend an agent |
| Too many agents | team architecture | merge |
| Orchestrator lost track | orchestrator skill | add checkpoints / error handling |

Append changes to `_workspace/harness/changelog.md`. Periodic health check (score 1-5): coverage, efficiency, quality, resilience, ergonomics; <3 in any → route to the right phase.

## Adaptation

Project size: small → 1-2 agents, 1-2 skills, structural validation; medium → 2-4 agents, 3-5 skills, full triggers; large → 3-6 agents, 5-10 skills, full validation + dry run. Domain focus: CRUD → quality (implementer + reviewer); data pipeline → correctness (ingester + validator + monitor); content → generation + moderation; API service → reliability (developer + security + ops); full-stack → coverage (frontend + backend + infra + QA).

## Progress Updates

Emit `[harness] Phase N: …` at every transition (audit → domain → architecture → per-agent generation → per-skill generation → integration → validation → COMPLETE).

## Integration

Standalone; complements the pipeline — the harness generates infrastructure, run executes within it, auto-verify can verify harness-generated systems. References (load on demand — progressive disclosure applies to the harness itself): `agent-design-patterns.md`, `orchestrator-template.md`, `team-examples.md`, `skill-writing-guide.md`, `skill-testing-guide.md`, `qa-agent-guide.md`.

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "This project needs 10 agents" | Start with 3-4, prove you need more. |
| "Every workflow needs its own agent" | Skills define workflows; agents provide capabilities. Workflows share agents. |
| "Agent Teams are always better" | For independent parallel work, Subagents are simpler and sufficient. |
| "The orchestrator can do this itself" | If it can, you don't need agents. If it's complex, delegate. |
| "Skip validation, the structure looks right" | Structure ≠ correctness. Test triggers, run the dry run. |
| "CLAUDE.md can wait till the end" | A crash at Phase 4 loses Phase 3 without incremental sync. |
| "This agent overlaps but that's fine" | Merge them or sharpen the boundary. |
| "I'll add agents for future needs" | YAGNI. Generate for current reality; Phase 7 handles evolution. |
| Teams-without-communication / single-use agents | Use Subagents / make it a skill. |
| Orchestrator holding domain knowledge or doing the work | Put domain knowledge in specialists; the orchestrator delegates. |
