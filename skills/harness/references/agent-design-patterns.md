# Agent Design Patterns

Comprehensive taxonomy of agent team architectures, execution modes, and separation criteria. Reference this when designing team architecture in Phase 2. (Per-agent model choice: see `../../_shared/model-selection.md`.)

## Two Execution Modes

### Subagents (Default — use this for virtually everything)

**Mechanism:** the `Agent` tool (renamed from `Task` in v2.1.63; `Task(...)` still works as a backward-compatible alias).

The orchestrator spawns a subagent, which executes a task and returns its result. Subagents:
- Have their own context window (no shared-memory pollution)
- Return results to the spawning agent — the orchestrator is the hub
- Can run in the background (`run_in_background: true`)
- Can be followed up / continued via `SendMessage` (`to: <agent-id-or-name>`)
- Do NOT talk to each other — every discovery routes through the orchestrator

**Use when:** almost always. Any workflow where the orchestrator can be the sole coordinator and integrator — which is the vast majority of real work.

**Architecture:**
```
┌──────────────────────────────────┐
│         Orchestrator             │
│  (spawns subagents, collects     │
│   results, integrates)           │
├────────┬───────────┬─────────────┤
│        ↓           ↓             │
│   Subagent A   Subagent B       │
│   (returns)    (returns)         │
│        ↓           ↓             │
│   Result A     Result B          │
│        ↓           ↓             │
│  ┌─────────────────────┐        │
│  │ Orchestrator merges │        │
│  └─────────────────────┘        │
└──────────────────────────────────┘
```

### Agent Teams (Experimental — opt-in)

**Mechanism:** `SendMessage` (peer-to-peer between teammates) + a shared task list (`TaskCreate`/`TaskGet`/`TaskList`/`TaskUpdate`). Enabled only with the env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

Teammates are separate Claude Code sessions, each with its own context window. **Spawning and cleanup are automatic** — the lead uses the `Agent` tool internally on a natural-language request; there is no explicit create/delete step. (`TeamCreate`/`TeamDelete` were removed in v2.1.178.) Each teammate can message any other teammate directly and read/write the shared task list.

**Use ONLY when:** agents genuinely must coordinate peer-to-peer mid-task — share discoveries live, challenge each other's work, or react in real time (e.g. a reviewer flagging issues while the implementer is still working) — AND the experimental flag is enabled.

**Known limitations:** no session resumption with in-process teammates; task-status can lag.

**Architecture:**
```
┌─────────────────────────────────────┐
│           Orchestrator (lead)       │
│  (assigns tasks, monitors progress; │
│   spawn/cleanup is automatic)       │
├──────┬──────────┬──────────┬───────┤
│      ↓          ↓          ↓       │
│  Agent A    Agent B    Agent C     │
│      ↕          ↕          ↕       │
│  (direct communication between     │
│   teammates via SendMessage)       │
└─────────────────────────────────────┘
```

### Decision Matrix

| Criterion | Subagents (default) | Agent Teams (experimental) |
|-----------|--------------------|-----------------------------|
| Recommended for | Virtually everything | Rare genuine peer-to-peer cases |
| Inter-agent communication | ❌ Orchestrator relays | ✅ Direct peer `SendMessage` |
| Independent parallel tasks | ✅ Simpler | ✅ Works |
| Discovery sharing mid-task | Via orchestrator | ✅ Native |
| Coordination overhead | Lower | Higher |
| Context isolation | ✅ Separate windows | ✅ Separate windows |
| Setup | Just `Agent` calls | Automatic — set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, no TeamCreate step |
| Fault tolerance | Orchestrator must handle | Teammates can compensate |

**Default to Subagents.** Reach for Agent Teams only when a live peer link is essential and the flag is on.

**Rule of thumb:** If you draw the data flow and an arrow goes between two non-orchestrator agents, that's the *experimental* Agent Teams path — enable the flag only if the live peer link is truly essential. By default, route every peer discovery back through the orchestrator.

## Six Architecture Patterns

### Pattern 1: Pipeline

Sequential dependent phases where each phase's output feeds the next.

```
[Phase 1] → [Phase 2] → [Phase 3] → [Phase 4]
```

**When to use:**
- Work flows through well-defined stages
- Each stage needs the previous stage's output
- Stages have distinct expertise requirements

**Example:** Document production
- Research Agent → Outline Agent → Writing Agent → Editing Agent

**Execution mode:** Subagents (default) — strictly forward-flowing phases; the orchestrator passes each phase's output to the next. Backward communication (an editor asking the writer for clarification mid-flight) is the experimental Agent Teams case; by default, loop back through the orchestrator.

**Pitfalls:**
- Bottleneck: slowest phase sets the pace. Consider parallelizing within phases.
- Error propagation: a mistake in Phase 1 cascades through all subsequent phases. Add quality gates between phases.
- Context loss: each phase may lose context from earlier phases. Pass explicit context, not just artifacts.

### Pattern 2: Fan-out/Fan-in

Parallel independent analysis converging into an integrated result.

```
         ┌→ [Agent A] →┐
[Input] →├→ [Agent B] →├→ [Integrator]
         └→ [Agent C] →┘
```

**When to use:**
- Multiple independent perspectives are needed on the same input
- Work is embarrassingly parallel
- The value is in combining diverse analyses

**Example:** Multi-angle research
- Official Sources Agent → ┐
- Community Sources Agent → ├→ Research Integrator
- Technical Analysis Agent → ┘

**Execution mode:** Subagents (default) — fan out parallel subagents, let each return, and the orchestrator integrates. Only if agents must share discoveries *while still running* (Agent A finds X and Agent B must adjust its search immediately) does the experimental Agent Teams path help; otherwise discoveries surface at return and the orchestrator reconciles.

**Pitfalls:**
- Integration is the hard part. The integrator needs clear criteria for resolving conflicts between agents.
- Unbalanced agents: one finishes in 10 seconds, another in 5 minutes — the orchestrator waits for the slowest. In experimental teams, `TaskUpdate` surfaces live progress.
- Redundant work: agents may cover the same ground. Define clear boundaries in agent definitions.

### Pattern 3: Expert Pool

Context-dependent routing to specialists based on input characteristics.

```
              ┌→ [Security Expert]
[Input] → [Router] →├→ [Performance Expert]
              └→ [Architecture Expert]
```

**When to use:**
- Different inputs need different specialists
- Expertise areas are clearly separable
- Not all experts are needed for every input

**Example:** Code review routing
- Router examines the diff → routes to relevant expert(s)
- Security Expert: reviews auth, input validation, SQL injection
- Performance Expert: reviews algorithms, database queries, caching
- Architecture Expert: reviews patterns, coupling, abstractions

**Execution mode:** Subagents. The router (orchestrator) examines the input, decides which experts to invoke, and collects their reports. Experts analyze independently — no peer communication needed.

**Pitfalls:**
- Routing errors: if the router misclassifies the input, the wrong expert is invoked. Define clear routing criteria.
- Overlap: some inputs need multiple experts. Plan for multi-expert cases.
- Expert staleness: domain knowledge in agent definitions can become stale. Include "check current state" instructions.

### Pattern 4: Producer-Reviewer

Generate-then-validate loop with bounded retries.

```
[Producer] → [Reviewer] → Approved? → Done
                ↓ (No)
           [Producer fixes] → [Reviewer] → ...
```

**When to use:**
- Output quality matters and benefits from external validation
- The producer and reviewer need different perspectives
- A bounded retry loop can converge to quality

**Example:** Code implementation
- Implementer writes code → Reviewer checks quality/correctness
- If issues found → Implementer fixes → Reviewer re-checks
- Max 3 cycles → escalate if not resolved

**Execution mode:** Subagents (default) — the orchestrator runs the producer, passes its output to the reviewer, and relays issues back for the next cycle. Real-time reviewer-to-producer commentary is the experimental Agent Teams case; a batch review loop through the orchestrator is simpler and usually enough.

**Critical rule:** ALWAYS bound the retry loop. Max 2-3 cycles. If the producer can't satisfy the reviewer in 3 cycles, the issue is fundamental — escalate, don't loop.

**Pitfalls:**
- Infinite loops: unbounded retries waste tokens and never converge. ALWAYS set a max.
- Reviewer drift: the reviewer may change criteria between cycles. Lock criteria at cycle 1.
- Producer regression: fixing issue A breaks the fix for issue B. Require the producer to run all previous checks.

### Pattern 5: Supervisor

Central coordinator with dynamic task distribution and shared task list.

```
        ┌→ [Worker A] ←┐
[Supervisor] →├→ [Worker B] ←├→ [Shared Task List]
        └→ [Worker C] ←┘
```

**When to use:**
- Many similar tasks to distribute (batch processing)
- Workers are interchangeable
- Dynamic load balancing is needed
- Task count is large or variable

**Example:** Code migration
- Supervisor creates task list: "migrate file X to new API"
- Workers claim tasks, execute, report completion
- Supervisor monitors progress, redistributes if workers are slow/stuck

**Execution mode:** Subagents (default) — the orchestrator *is* the supervisor: it holds the task list, dispatches work to interchangeable worker subagents, collects completions, and redistributes. A truly dynamic peer team where workers claim from a shared list themselves needs the experimental Agent Teams flag (`TaskCreate`/`TaskList`/`TaskUpdate`) — use it only when worker self-coordination genuinely beats orchestrator dispatch.

**Pitfalls:**
- Task dependencies: if tasks aren't truly independent, workers will conflict. Verify independence before distributing.
- Worker divergence: workers may solve the same type of task differently. Include a style guide in the worker agent definition.
- Supervisor bottleneck: if the supervisor does too much checking, it becomes the bottleneck. Trust workers, spot-check.

### Pattern 6: Hierarchical Delegation

Top-down recursive delegation through management layers.

```
[Project Lead]
    ├→ [Team Lead A]
    │      ├→ [Worker A1]
    │      └→ [Worker A2]
    └→ [Team Lead B]
           ├→ [Worker B1]
           └→ [Worker B2]
```

**When to use:**
- Project is too large for a single coordinator
- Natural groupings exist (frontend/backend, module A/B)
- Team leads need autonomy within their domain

**Execution mode:** Subagents (default) — the orchestrator delegates to lead subagents, and a lead (a `general-purpose` agent, which has the `Agent` tool) spawns its own worker subagents. Cross-team coordination flows up through the orchestrator. Only if leads must talk peer-to-peer does the experimental Agent Teams path apply.

**Max 2 levels of delegation.** Deeper hierarchies lose context and introduce coordination overhead that outweighs the benefit.

**Pitfalls:**
- Over-engineering: most projects don't need this. Only use for genuinely large, multi-domain projects.
- Communication overhead: cross-team communication must go through leads. Design explicit cross-team protocols.
- Context loss: each level of delegation loses some context. Pass explicit artifacts, not assumptions.

## Composite Patterns

Real-world harnesses often combine patterns:

| Composite | Components | Example |
|-----------|-----------|---------|
| Pipeline + Fan-out | Sequential phases, some parallelized | Build → [parallel tests] → deploy |
| Fan-out + Producer-Reviewer | Parallel work with quality gates | [parallel features] → review cycle |
| Supervisor + Expert Pool | Dynamic distribution to specialists | File migration routed by file type |
| Pipeline + Producer-Reviewer | Sequential phases with validation loops | Plan → implement → [review loop] → ship |
| Hierarchical + Fan-out | Teams working in parallel under leads | Frontend team and backend team in parallel |

**Design the composite intentionally.** Don't accidentally create one by stacking patterns without thinking about how they interact.

## Agent Types

### Built-in Types

| Type | Tools Available | Use Case |
|------|----------------|----------|
| `general-purpose` | All tools (Read, Write, Edit, Glob, Grep, Bash, Agent, WebSearch, WebFetch, etc.) | Default. Full capability. |
| `Explore` | Read-only tools (Read, Glob, Grep, Bash for read-only commands). NO Edit, Write, Agent. | Research, analysis, codebase exploration |
| `Plan` | Read-only tools. NO Edit, Write, Agent. | Architecture planning, design decisions |

### Custom Types (`.claude/agents/<name>.md`)

A custom agent is a Markdown file in `.claude/agents/`: **YAML frontmatter** (`name` and `description` required; optional `tools`, `disallowedTools`, `model`, `effort`, `isolation`, `permissionMode`, `maxTurns`, `color`) followed by a **Markdown body that becomes the system prompt**. Set `model:`/`effort:` in the frontmatter — not in every `Agent` call. Otherwise custom agents have full tool access like `general-purpose`, but with:
- Domain-specific instructions and knowledge (the body)
- Defined input/output protocols
- Peer-communication conventions (relevant only in experimental team mode)
- Error handling specific to their role

**When to use custom vs built-in:**
- Built-in `general-purpose`: one-off tasks, no specialized knowledge needed
- Built-in `Explore`: read-only research, no risk of accidental writes
- Built-in `Plan`: architecture decisions, read-only by design
- Custom agent: recurring role with domain knowledge, specific protocols, or (in experimental team mode) peer-communication needs

## Agent Separation Criteria

When deciding whether to create a separate agent or merge with an existing one, evaluate on 4 axes:

### Axis 1: Expertise

Does this agent need knowledge that would dilute or conflict with another agent's knowledge?

- **Separate:** Security reviewer needs OWASP knowledge, performance reviewer needs profiling knowledge. Combining them would create a superficial generalist.
- **Merge:** Two agents that both need "understanding of the project's data model" don't need separate data model agents.

### Axis 2: Parallelism

Can this agent's work run at the same time as other agents?

- **Separate:** Frontend and backend work can genuinely run in parallel.
- **Merge:** If Agent A always waits for Agent B, they might as well be one agent with two phases.

### Axis 3: Context Burden

Would including this agent's full context overload another agent's context window?

- **Separate:** A QA agent that needs to hold the full test plan, coverage data, and project structure would overload an implementer that also needs to hold the implementation plan and code.
- **Merge:** Two agents that each need ~500 tokens of context can easily be one agent.

### Axis 4: Reusability

Will this agent be used across multiple workflows?

- **Separate:** A code reviewer is useful in review workflows, PR workflows, and audit workflows.
- **Merge:** An agent that only runs in one specific workflow and nowhere else might be better as a phase within a skill.

### Separation Decision Matrix

| Expertise | Parallelism | Context | Reusability | Verdict |
|-----------|------------|---------|-------------|---------|
| Distinct | Parallel | Heavy | Multi-workflow | **Definitely separate** |
| Distinct | Sequential | Heavy | Single-workflow | **Probably separate** (context is the driver) |
| Shared | Parallel | Light | Multi-workflow | **Maybe separate** (parallelism benefits) |
| Shared | Sequential | Light | Single-workflow | **Merge** |

When in doubt, start merged and separate later when you have evidence of a problem. It's easier to split a working agent than to debug two agents that should be one.
