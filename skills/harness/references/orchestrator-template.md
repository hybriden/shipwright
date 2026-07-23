# Orchestrator Templates

Complete templates for building orchestrator skills. Use these as starting points in Phase 4 when generating the orchestrator skill.

**Default: the Subagent Orchestrator (Template B).** Subagents are the standard Claude Code multi-agent primitive — spawn them with the `Agent` tool (formerly `Task`, renamed in v2.1.63; `Task` still works as an alias), they run and return to the orchestrator, and `run_in_background: true` gives you parallelism. Follow up with an already-spawned agent via `SendMessage` (`to: <agent-id-or-name>`). The orchestrator is the hub; peers do not message each other. Start here.

The **Agent Team Orchestrator (Template A) is experimental and opt-in**, gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Reach for it only when teammates must message each other directly during execution. Under the flag, spawning and cleanup are automatic — there is no manual team create/delete step.

---

## Template B: Subagent Orchestrator (default)

Use this template when agents work independently and only the orchestrator integrates their output. This is the right choice for almost every harness.

### Skeleton

```markdown
---
name: [project-prefix]:run
description: "[Aggressive trigger description]"
---

# [Project] Orchestrator

[One paragraph: what this does, what agents it coordinates, what the end result is]

## Iron Law

\`\`\`
[THE ONE RULE THAT OVERRIDES EVERYTHING]
\`\`\`

## Process

### Phase 0: Context Check

1. Check for `_workspace/[project]/` directory
   - **Exists with incomplete artifacts** → partial re-run. Read state, resume from last completed phase.
   - **Exists with complete artifacts** → new run. Archive previous artifacts.
   - **Does not exist** → first run. Create directory.
2. Read input: task description, configuration, constraints
3. Save to `_workspace/[project]/input.md`

### Phase 1: Preparation

1. Analyze the input to determine which agents to spawn and with what context
2. Create `_workspace/[project]/plan.md` with the analysis
3. Prepare the prompt for each subagent (critical — the prompt IS the agent's entire context)

### Phase 2: Parallel Dispatch

Spawn subagents in parallel:

\`\`\`
Agent(
  description: "[short task description]",
  prompt: "[complete, self-contained task with all necessary context]",
  subagent_type: "[agent type or custom agent name]",
  model: "[opus | sonnet | haiku]",
  run_in_background: true
)
\`\`\`

**Critical:** each subagent prompt must be self-contained — subagents have NO access to the conversation history or to other subagents' work. Include:
- The full task description
- All relevant context (file paths, data, constraints)
- Expected output format
- Success/failure criteria

To follow up with an already-spawned agent (add context, request a revision), use `SendMessage` (`to: <agent-id-or-name>`). The orchestrator is the hub; subagents do not message each other.

### Phase 3: Collection

Wait for all subagents to complete. For each:
1. Read the result
2. Verify it meets the expected format
3. Extract the key outputs

If a subagent fails:
1. Retry once with additional context (`SendMessage`, or a fresh `Agent` call)
2. If still fails, note the gap and proceed with partial results

### Phase 4: Integration

Read each subagent's result, integrate the outputs into a cohesive whole, resolve inconsistencies, generate the final deliverable, save to `_workspace/[project]/output.md`, and output the result to the user.
```

> Optional frontmatter: alongside `name` and `description`, a skill may also declare `user-invocable`, `context: fork`, and `allowed-tools`. Add them only when a specific need calls for it.

### Parallel Dispatch Pattern

When spawning multiple subagents that can run simultaneously, issue ALL `Agent` calls in a single message:

```
Agent(description: "Research angle A", prompt: "...", subagent_type: "...", model: "...", run_in_background: true)
Agent(description: "Research angle B", prompt: "...", subagent_type: "...", model: "...", run_in_background: true)
Agent(description: "Research angle C", prompt: "...", subagent_type: "...", model: "...", run_in_background: true)
```

This maximizes parallelism. Do NOT spawn one, wait for it, then spawn the next — that defeats the purpose.

### Progress Update Pattern

```
[project] Phase 0: Context check — [first run | resuming | new run]
[project] Phase 1: Preparing — [N] subagents needed for this task
[project] Phase 2: Dispatched — [agent list], running in parallel
[project] Phase 3: [agent A] complete ✅ | [agent B]: working
[project] Phase 3: All subagents complete ✅
[project] Phase 4: Integrating outputs
[project] Phase 4: Done — [summary of result]
```

---

## Template A: Agent Team Orchestrator (experimental — requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)

Use this template only when agents must communicate with each other during execution. Teammates run as separate sessions. **Spawning and cleanup are automatic**: under the env flag the lead spawns teammates by issuing a natural-language request (internally via the `Agent` tool), and the team is torn down for you when the work ends — there is no manual team create/delete step. Peer communication uses `SendMessage` plus a shared task list (`TaskCreate`/`TaskGet`/`TaskList`/`TaskUpdate`). Note: agent teams have known limitations.

### Skeleton

```markdown
---
name: [project-prefix]:run
description: "[Aggressive trigger description listing every phrase that should invoke this skill]"
---

# [Project] Orchestrator

[One paragraph: what this orchestrator does, what agents it coordinates, what the end result is]

## Iron Law

\`\`\`
[THE ONE RULE THAT OVERRIDES EVERYTHING]
\`\`\`

## Process

### Phase 0: Context Check

Same as Template B — check `_workspace/`, read input, save state.

### Phase 1: Preparation

1. Analyze the input to determine which teammates are needed, the expected output, and the quality criteria
2. Create `_workspace/[project]/plan.md` with the analysis
3. Prepare teammate assignments

### Phase 2: Team Composition

1. Spawn teammates by describing the team you need in natural language — the lead spawns them via the `Agent` tool automatically under the env flag (no manual create step).

2. Create shared tasks:
   \`\`\`
   TaskCreate for each assignment with:
   - Clear description
   - Input data
   - Expected output format
   - Dependencies (which tasks must complete first)
   \`\`\`

3. Assign tasks to teammates via SendMessage:
   \`\`\`
   SendMessage to [agent]: "Your task is [ID]. Input: [data]. Output format: [spec]. Dependencies: [list]."
   \`\`\`

### Phase 3: Execution & Monitoring

1. Teammates self-coordinate via SendMessage
2. Orchestrator monitors via TaskGet/TaskList
3. Intervention triggers:
   - Agent stuck for >2 minutes without TaskUpdate → SendMessage to check status
   - Agent reports BLOCKED → assess and unblock or reassign
   - Agent reports FAILED → invoke error handling

**Error handling table:**

| Scenario | Action |
|----------|--------|
| Single agent fails | Retry once with additional context. If still fails, reassign to another agent or report partial result. |
| Majority of agents fail | Stop the pipeline. Report failure with evidence from all agents. |
| Agent timeout | Send status check. If no response, mark task as failed and reassign. |
| Data conflict between agents | Orchestrator resolves based on priority rules defined in team architecture. |
| Agent produces unexpected format | Send format correction message. If persists, extract what you can and log the format issue. |

### Phase 4: Integration

Same as Template B Phase 4 — collect artifacts from all teammates (Read their output files), integrate into a cohesive result, resolve inconsistencies, generate the final deliverable, save to `_workspace/[project]/output.md`.

### Phase 5: Cleanup

1. Notify all teammates: "Pipeline complete. Thank you."
2. Cleanup is automatic — the team is dismissed for you when the work ends.
3. Preserve `_workspace/[project]/` for the audit trail
4. Output the final result to the user
```

### Progress Update Pattern

```
[project] Phase 0: Context check — [first run | resuming | new run]
[project] Phase 1: Preparing — [N] agents needed for this task
[project] Phase 2: Team assembled — [agent list]
[project] Phase 3: Executing — [agent A]: working, [agent B]: working
[project] Phase 3: [agent A] complete ✅ | [agent B]: working
[project] Phase 3: All agents complete ✅
[project] Phase 4: Integrating outputs
[project] Phase 5: Done — [summary of result]
```

---

## Orchestrator Description Writing Guide

The orchestrator's SKILL.md description is the most important piece of text in the entire harness. If the description doesn't trigger correctly, the entire harness is dead.

### Structure

```yaml
description: "[Primary trigger phrase]. [Secondary trigger phrase]. [Tertiary trigger phrase]. Use when [condition 1], [condition 2], or [condition 3]. Triggers on: '[keyword 1]', '[keyword 2]', '[keyword 3]', '[keyword 4]'. Also triggers on follow-up keywords: 're-run', 'update', 'modify', 'improve', 'try again', 'fix the [domain term]'."
```

### Rules

1. **Be aggressively inclusive.** List every phrase variant the user might say. "Build," "create," "make," "generate," "set up," "implement" — all of these.

2. **Include follow-up keywords.** After the first run, users say things like "re-run it," "try again," "update the output." These must trigger the same skill.

3. **Include domain terms.** If the project is about "recipes," include "recipe" in the trigger phrases. If it's about "invoices," include "invoice."

4. **Include negative triggers in the body, not the description.** The description should be inclusive. Inside the SKILL.md body, add a "When NOT to use" section that redirects to the right skill.

5. **Test the description.** Read it from Claude's perspective: "Given this description, would I trigger this skill for the user's message?" If the answer is "maybe," strengthen it.

---

## Data Flow Design

### Subagent Data Flow (default)

In Subagent mode, all data flows through the main agent:

```markdown
## Data Flow

### Dispatch
- Main agent → Subagent A: [full context in prompt]
- Main agent → Subagent B: [full context in prompt]

### Collection
- Subagent A → Main agent: [result in return message]
- Subagent B → Main agent: [result in return message]

### Integration
- Main agent reads all results, merges, produces final output
```

### Agent Teams Data Flow (experimental)

Under `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, data flows through three channels:

1. **Task artifacts** — files in `_workspace/` that agents read and write
2. **Messages** — real-time communication via SendMessage
3. **Task updates** — status and metadata via TaskCreate/TaskUpdate

Design the data flow explicitly:

```markdown
## Data Flow

### Artifacts (files)
- Input: `_workspace/project/input.md` (orchestrator writes, all agents read)
- Agent A output: `_workspace/project/agent-a-output.md`
- Agent B output: `_workspace/project/agent-b-output.md`
- Final: `_workspace/project/final-output.md` (orchestrator writes after integration)

### Messages (real-time)
- Orchestrator → Agent A: task assignment, context updates
- Agent A → Agent B: discoveries that affect B's work
- Agent B → Orchestrator: status updates, blockers
- Any agent → Orchestrator: escalation when blocked

### Tasks (tracking)
- Task 1: "Agent A assignment" (assigned to Agent A)
- Task 2: "Agent B assignment" (assigned to Agent B, depends on Task 1)
- Task 3: "Integration" (assigned to Orchestrator, depends on Tasks 1 and 2)
```

---

## Error Handling Patterns

### Graceful Degradation

When an agent fails, the orchestrator should degrade gracefully rather than abort entirely:

```markdown
## Error Handling

### Single Agent Failure
1. Retry once with enriched context
2. If retry fails, mark that agent's contribution as "unavailable"
3. Continue with remaining agents
4. In the final output, note: "[aspect] was not completed due to [agent] failure: [reason]"

### Critical Agent Failure
If the ORCHESTRATOR itself encounters an error:
1. Save all current state to `_workspace/`
2. Report what was accomplished
3. Report what failed and why
4. Provide instructions for resuming
```

### Checkpoint Recovery

For long-running orchestrators, implement checkpoints:

```markdown
## Checkpoint Recovery

After each phase completes:
1. Write phase status to `_workspace/project/status.md`:
   \`\`\`
   phase_0: complete
   phase_1: complete
   phase_2: in_progress (agent_a: done, agent_b: working)
   \`\`\`
2. On re-run, read status.md and resume from the last incomplete phase
3. Never re-do completed phases unless explicitly requested
```

---

## Test Scenarios

Every orchestrator should be validated against these scenarios:

### Normal Flow
1. Fresh run with valid input → all phases complete → correct output
2. Re-run with existing `_workspace/` → resumes correctly
3. Large input that requires all agents → proper parallel execution

### Error Flow
1. One agent fails → graceful degradation, partial result
2. Input is malformed → clear error message, no partial execution
3. Agent produces wrong format → format correction or extraction
4. All agents fail → clean failure report with evidence
5. Orchestrator context limit approached → save state, report progress

### Edge Cases
1. Task requires only one agent → skip the team, invoke a single subagent directly
2. Task is ambiguous → orchestrator makes a decision and documents it
3. Previous run's artifacts are stale → archive and start fresh
