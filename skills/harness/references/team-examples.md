# Team Examples

Five complete worked examples showing how to design agent teams for different project types. Reference these in Phase 2-3 for pattern selection and agent definition guidance.

> **Execution modes.** **Subagents are the default.** The orchestrator spawns each agent with the `Agent` tool (it runs and returns its result to the orchestrator; add `run_in_background: true` to run several in parallel) and follows up with an already-spawned agent via `SendMessage` (`to: <agent-id-or-name>`). The orchestrator is the hub: peers do **not** message each other by default — the orchestrator relays discoveries between them.
>
> **Agent Teams are experimental and opt-in** (env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`): teammates run in separate sessions (spawned and cleaned up automatically — there is no `TeamCreate`/`TeamDelete`), coordinate peer-to-peer with `SendMessage`, and share a task list (`TaskCreate`/`TaskGet`/`TaskList`/`TaskUpdate`). Reach for Agent Teams **only** when live peer-to-peer coordination is essential; otherwise stay with subagents.
>
> Set an agent's `model` in its frontmatter, not per `Agent` call. Every custom agent file (`.claude/agents/<name>.md`) **starts with YAML frontmatter** — `name` and `description` (required), plus optional `tools`, `model`, `effort`, `isolation` — then the Markdown body (the system prompt).

---

## Example 1: Full-Stack Web Application

**Project:** E-commerce platform (Next.js frontend, Node.js API, PostgreSQL)
**Pattern:** Fan-out/Fan-in + Producer-Reviewer
**Execution Mode:** Subagents (orchestrator as hub) — Agent Teams optional (experimental)

### Why This Pattern

The frontend and backend can be developed in parallel (fan-out), but both need a shared review process (producer-reviewer). The reviewer needs to see both sides to catch integration mismatches. By default the orchestrator spawns backend and frontend as subagents and **relays the API contract** from backend to frontend — no direct peer messaging required.

### Agent Roster

| Agent | Role | Type | Model |
|-------|------|------|-------|
| `frontend` | React/Next.js implementation, component design, client state | custom | default |
| `backend` | API design, database queries, business logic | custom | default |
| `qa` | Cross-boundary testing, integration verification | custom | opus |
| `reviewer` | Code quality, security, performance | custom | opus |

### Agent Definition: `frontend.md`

```markdown
---
name: frontend
description: React/Next.js implementation — pages, components, forms, client state. Use for all user-facing UI work.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---
# Frontend Agent

You are the frontend specialist for this e-commerce platform. You implement
React components, pages, and client-side logic using Next.js conventions.

## Core Role

Implement all user-facing UI: pages, components, forms, and client-side state
management. You own everything in `src/app/`, `src/components/`, and
`src/hooks/`.

## Work Principles

1. Use existing component patterns — read 3 existing components before creating new ones
2. Every component gets a test. Use the existing test framework (check `package.json`).
3. API integration uses the hooks in `src/hooks/api/`. Create new hooks for new endpoints.
4. Never hardcode API URLs. Use environment variables or the existing API client.

## Input Protocol

**Receives (relayed by the orchestrator):**
- Task description with acceptance criteria
- API contract from the backend agent (endpoint, request/response shapes)
- Design requirements (if any)

**Required context:**
- The API endpoint this UI connects to
- The data shape returned by the API

## Output Protocol

**Produces:**
- Component files in `src/components/`
- Page files in `src/app/`
- Hook files in `src/hooks/`
- Test files alongside each component

**Completion signal:**
- All components render without errors
- All tests pass
- Return your result to the orchestrator: status "complete" + list of files created

## Communication Protocol

**Reports to:** orchestrator (return your result; the orchestrator is the hub).
**Receives:** task brief + the backend's API contract + reviewer issues, all relayed by the orchestrator.

**Report to the orchestrator when:**
- The API contract doesn't match what the UI needs → the orchestrator relays the gap to backend
- You find an existing pattern that affects the backend → the orchestrator relays it
- Your work is ready for testing → the orchestrator dispatches qa

(Experimental Agent Teams mode only: replace "report to the orchestrator" with `SendMessage` straight to backend/qa.)

## Error Handling

| Error | Action |
|-------|--------|
| API contract missing | Report to orchestrator: "Need API contract for [endpoint]" (it relays to backend) |
| Existing component conflicts | Read it, adapt, don't duplicate |
| Test framework not configured | Report to orchestrator |
```

### Orchestrator Flow

```
1. Orchestrator receives task: "Add product search with filters"
2. Orchestrator spawns `backend` (subagent): "Design and implement
   /api/products/search with filter params; return the API contract"
3. Backend returns the API contract → orchestrator relays it into the
   `frontend` subagent's brief: "Build search page + filter sidebar against
   this contract: ..."
4. Contract follow-ups (e.g. pagination) round-trip through the orchestrator —
   SendMessage to an already-spawned agent, or re-dispatch
5. Both complete → orchestrator spawns `qa` for integration tests
6. QA passes → orchestrator spawns `reviewer` over both diffs
7. Reviewer approves or returns issues → orchestrator relays fixes to
   frontend/backend (max 3 cycles)
8. All approved → orchestrator merges and reports
```

**Experimental Agent Teams alternative:** set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` if you want backend and frontend to message each other directly (e.g. rapid contract negotiation) instead of round-tripping through the orchestrator.

### Communication Pattern (orchestrator-mediated, default)

```
Backend → Orchestrator: "API contract: GET /api/products/search?q=&category=&minPrice=&maxPrice= returns {products: [], total: number, page: number}"
Orchestrator → Frontend: relays the contract
Frontend → Orchestrator: "Need pagination in the response — offset and limit params"
Orchestrator → Backend: relays the request
Backend → Orchestrator: "Added. Updated contract: ...?offset=&limit=25"
Orchestrator → Frontend: relays the update
Frontend → Orchestrator: "Search page ready for testing at /search"
Orchestrator → QA: dispatch integration test
QA → Orchestrator: "Filter sidebar doesn't clear when navigating away and back"; "Search returns 500 when minPrice > maxPrice — needs validation"
Orchestrator → Frontend / Backend: relays each fix
```

---

## Example 2: Data Pipeline

**Project:** ETL pipeline (Python, Apache Airflow, PostgreSQL → BigQuery)
**Pattern:** Pipeline + Expert Pool
**Execution Mode:** Subagents

### Why This Pattern

ETL is inherently sequential (extract → transform → load), and each stage needs different expertise (source systems, data transformation, target systems). Stages don't need to communicate mid-execution.

### Agent Roster

| Agent | Role | Type | Model |
|-------|------|------|-------|
| `extractor` | Source system integration, data retrieval, schema detection | custom | default |
| `transformer` | Data cleaning, normalization, business rule application | custom | opus |
| `loader` | Target system integration, schema mapping, upsert logic | custom | default |
| `validator` | Data quality checks, row counts, schema validation | custom | default |

### Orchestrator Flow (Subagent Mode)

```python
# Pseudocode for orchestrator logic

# Phase 1: Extract
result_extract = Agent(
    description="Extract data from source",
    prompt=f"Extract data from {source}. Schema: {schema}. Output to _workspace/extracted/",
    subagent_type="extractor",
    model="sonnet"
)

# Phase 2: Validate extraction
result_validate_1 = Agent(
    description="Validate extracted data",
    prompt=f"Validate _workspace/extracted/. Expected: {row_counts}. Check: nulls, types, ranges.",
    subagent_type="validator"
)

# Phase 3: Transform (only if validation passed)
result_transform = Agent(
    description="Transform data",
    prompt=f"Transform _workspace/extracted/ → _workspace/transformed/. Rules: {business_rules}",
    subagent_type="transformer",
    model="opus"  # Complex business rules need strong reasoning
)

# Phase 4: Validate transformation
result_validate_2 = Agent(
    description="Validate transformed data",
    prompt=f"Validate _workspace/transformed/. Check: business rules applied, no data loss.",
    subagent_type="validator"
)

# Phase 5: Load
result_load = Agent(
    description="Load to target",
    prompt=f"Load _workspace/transformed/ → {target}. Upsert on {key_columns}.",
    subagent_type="loader"
)
```

> The per-call `model=` above is illustrative; prefer setting each agent's `model` in its frontmatter so the choice lives with the agent, not the dispatch site.

### Why Subagents Here

Each stage is self-contained. The extractor doesn't need to talk to the transformer mid-extraction. The transformer doesn't need to ask the loader about target schema mid-transformation. Data flows strictly forward through files in `_workspace/`.

---

## Example 3: Content Platform

**Project:** Blog platform with AI-assisted writing (Next.js, MDX, OpenAI API)
**Pattern:** Producer-Reviewer with 2 cycles
**Execution Mode:** Subagents (orchestrator runs the loop) — Agent Teams optional (experimental)

### Agent Roster

| Agent | Role | Type | Model |
|-------|------|------|-------|
| `writer` | Content generation, structure, narrative | custom | opus |
| `editor` | Quality review, fact-checking, style consistency | custom | opus |
| `seo` | Search optimization, meta tags, keyword density | custom | default |

### Agent Definition: `editor.md`

```markdown
---
name: editor
description: Reviews content for accuracy, flow, readability, and style-guide adherence. Use to review drafts — it improves, it does not write.
tools: Read, Grep, Glob
model: opus
---
# Editor Agent

You are the editor for this content platform. You review content for quality,
accuracy, consistency, and reader engagement. You do not write — you improve.

## Core Role

Review all content produced by the writer agent. Check for factual accuracy,
logical flow, readability, and adherence to the platform's style guide.

## Work Principles

1. Read the style guide first (`docs/style-guide.md`)
2. Check facts — if a claim is made, verify it or flag it
3. Be specific in feedback — "paragraph 3 is unclear" is useless; "paragraph 3 claims X but the evidence shows Y" is actionable
4. Respect the writer's voice — edit for clarity, not for preference
5. Max 2 review cycles. After that, approve with notes.

## Input Protocol

**Receives (relayed by the orchestrator):**
- Draft content from the writer
- The original brief/prompt that generated the content
- Any previous review notes (for cycle 2+)

## Output Protocol

**Produces:**
- Review report: list of issues categorized as MUST_FIX, SHOULD_FIX, SUGGESTION
- Overall verdict: APPROVED, NEEDS_REVISION, REJECTED

**Verdicts:**
- APPROVED: Content is ready to publish. May have SUGGESTION items.
- NEEDS_REVISION: Has MUST_FIX items. Send back to writer with specific feedback.
- REJECTED: Fundamentally off-topic or off-brand. Requires complete rewrite.

## Communication Protocol

**Reports to:** orchestrator (return your review report).
**Receives:** the writer's draft + original brief + prior review notes, relayed by the orchestrator.

**Mandatory rule:** When you return NEEDS_REVISION, include:
1. Numbered list of specific issues
2. For each issue: location, problem, suggested fix
3. The original acceptance criterion that each issue violates

The orchestrator relays these to the writer, and routes any content-structure
findings to `seo`. (Experimental Agent Teams mode: SendMessage the writer/seo directly.)
```

### Review Cycle Flow

The orchestrator runs the producer-reviewer loop directly — spawn `writer`, hand its draft to `editor`, relay the verdict back — as a **bounded loop** (see `../../_shared/loop.md`):

```
Cycle 1:
  Orchestrator spawns writer → draft. Spawns editor over the draft.
  Editor: NEEDS_REVISION (3 MUST_FIX items)
  → Orchestrator relays the issues to writer → writer fixes all 3 → editor re-reviews

Cycle 2:
  Editor: APPROVED (1 SUGGESTION remaining)
  → Orchestrator spawns seo to optimize meta tags, keywords
  → Orchestrator publishes

Loop bound: max 2 cycles. If still NEEDS_REVISION after cycle 2:
  → Orchestrator escalates to user with the editor's notes
```

**Experimental Agent Teams alternative:** with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, writer and editor run as teammates and pass drafts/feedback directly via `SendMessage`. Rarely worth it here — the loop is short and strictly two-party, which the orchestrator handles cleanly.

---

## Example 4: Code Review Team

**Project:** Large monorepo (TypeScript, 200+ files, multiple packages)
**Pattern:** Fan-out + Discussion
**Execution Mode:** Subagents (orchestrator cross-references) — strongest Agent Teams (experimental) candidate

### Why This Pattern

Reviewers frequently discover issues that cross domains:
- Security reviewer finds an unvalidated input → performance reviewer should check if that input hits the database
- Performance reviewer finds an N+1 query → test reviewer should verify tests cover the optimized path
- Test reviewer finds untested error paths → security reviewer should check if those paths have security implications

By default, run the three reviewers as parallel subagents (`run_in_background: true`). Each returns its findings **plus any out-of-domain observations**, and the orchestrator cross-references them — routing, say, a security reviewer's "unvalidated input" note to the performance and test reviewers as follow-up dispatches.

### Agent Roster

| Agent | Role | Type | Model |
|-------|------|------|-------|
| `security-reviewer` | OWASP top 10, auth patterns, input validation, secrets | custom | opus |
| `performance-reviewer` | Algorithms, database queries, caching, bundle size | custom | opus |
| `test-reviewer` | Test coverage, test quality, behavioral testing | custom | default |

### Cross-Discovery Protocol

Every reviewer's agent definition includes:

```markdown
## Cross-Discovery Protocol

When you find something outside your domain:
1. Continue your own review (don't switch domains)
2. Record it in your returned report under "Cross-domain observations":
   file path, line number, what you noticed, why it matters, and which
   reviewer should follow up
3. Do NOT attempt to fix cross-domain issues yourself

The orchestrator routes each observation to the right reviewer.
```

### Experimental: live cross-discovery via Agent Teams

This is the strongest genuine peer-communication case. With `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, the reviewers run as teammates and share discoveries in real time via `SendMessage` instead of round-tripping through the orchestrator:

```
security-reviewer → performance-reviewer: "DISCOVERY: User input at src/api/search.ts:45 is passed directly to SQL query. Check if this affects query performance too."
performance-reviewer → test-reviewer: "DISCOVERY: Refactored src/db/queries.ts to batch queries. Existing tests at tests/db/ need updating."
test-reviewer → security-reviewer: "DISCOVERY: No tests for auth middleware error paths. Are these security-sensitive?"
```

In this mode, step 2 of the Cross-Discovery Protocol becomes: `SendMessage to the relevant reviewer: "[your-name] DISCOVERY: [finding]"`. Reach for it only when the review benefits from reviewers reacting to each other live rather than in a single cross-reference pass.

### Integration

Either way, the orchestrator collects all three review reports (and any cross-domain observations) and produces a unified review:

```markdown
## Code Review Summary

### Security: [PASS | ISSUES_FOUND]
- [list of findings with severity]

### Performance: [PASS | ISSUES_FOUND]
- [list of findings with impact]

### Test Coverage: [PASS | GAPS_FOUND]
- [list of coverage gaps]

### Cross-Domain Findings
- [findings shared between reviewers]

### Verdict: [APPROVED | NEEDS_CHANGES | BLOCKED]
```

---

## Example 5: API Service Migration

**Project:** Migrating REST API from Express to Fastify (Node.js, 50+ endpoints)
**Pattern:** Supervisor + Workers
**Execution Mode:** Subagents (orchestrator as supervisor) — Agent Teams worker-pool optional (experimental)

### Why This Pattern

The work is a large batch of near-identical, independent units (per-endpoint migrations) that need consistent style and shared middleware handled once. By default the **orchestrator acts as the supervisor**: it reads the routes, batches the work, dispatches per-file migrations to worker subagents (in parallel via `run_in_background: true`), and integrates the results. Workers never edit the same file at once, so no live peer coordination is needed.

### Agent Roster

| Agent | Role | Type | Model |
|-------|------|------|-------|
| `supervisor` | Task distribution, progress tracking, conflict resolution | custom | opus |
| `migrator-1` | Endpoint migration (worker 1) | custom | default |
| `migrator-2` | Endpoint migration (worker 2) | custom | default |
| `migrator-3` | Endpoint migration (worker 3) | custom | default |

### Supervisor Definition

By **default** the orchestrator plays the supervisor role itself — reading the routes, batching work, dispatching worker subagents, and integrating results — so no separate agent is required. The definition below applies when you spin up a dedicated `supervisor` agent (or use the experimental Agent Teams worker-pool). Key sections:

```markdown
---
name: supervisor
description: Distributes endpoint-migration tasks, tracks progress, resolves file conflicts, and enforces consistency across a batch migration. Use to coordinate multiple migration workers.
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---
# Supervisor Agent

## Core Role

Distribute endpoint migration tasks to worker agents, monitor progress,
resolve conflicts, and ensure consistency across migrated endpoints.

## Work Principles

1. Batch endpoints by module — don't spread workers across unrelated endpoints
2. Handle shared middleware first (auth, logging, error handling) before endpoint migration
3. Keep a migration checklist in `_workspace/migration/checklist.md`
4. Spot-check 1 in 5 migrated endpoints for style consistency

## Task Distribution Strategy

1. Read all endpoints from the Express routes directory
2. Group by module (auth, users, products, orders, etc.)
3. Identify shared dependencies (middleware, utilities, types)
4. Assign shared dependencies as the FIRST task (to one worker)
5. Distribute module groups evenly across workers
6. Track assignments in `_workspace/migration/assignments.md`

## Conflict Resolution

When two workers need to modify the same file:
1. Assign the file to ONE worker
2. The other worker reports what it needs added to the orchestrator/supervisor
3. The assigned worker handles both changes
4. Never let two workers edit the same file simultaneously
```

### Worker Agent Definition (Shared)

All three migrators are the same agent, spawned as parallel instances:

```markdown
---
name: migrator
description: Migrates one Express endpoint to Fastify, preserving behavior and porting its tests. Use per-endpoint in a batch migration.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---
# Migrator Worker

You migrate Express endpoints to Fastify. One endpoint at a time.

## Core Role

Take an Express route handler and produce the equivalent Fastify route handler.
Preserve all behavior. Change only the framework interface.

## Migration Checklist (Per Endpoint)

1. Read the Express handler
2. Identify middleware chain (auth, validation, etc.)
3. Create Fastify equivalent:
   - `app.get()` → `fastify.get()`
   - `req.body` → `request.body` (same, but add schema validation)
   - `req.params` → `request.params`
   - `res.json()` → `reply.send()`
   - `res.status(X).json()` → `reply.code(X).send()`
4. Add Fastify JSON schema for request/response validation
5. Port existing tests to use Fastify's `inject()` instead of supertest
6. Verify the migrated endpoint passes all tests
7. Commit: "migrate: [endpoint path] from Express to Fastify"

## Communication

**Reports to:** the orchestrator/supervisor — return your result (files changed, tests status) when the endpoint is migrated.
**Receives:** an endpoint (or module) assignment.

**Shared discoveries:** when you find a reusable pattern, report it to the
orchestrator, which relays it to the other workers so they don't redo the work:

"DISCOVERY: Express middleware `requireAuth` maps to Fastify `preHandler` hook. I created a shared adapter at `src/middleware/fastify-auth.ts`. Use this instead of rewriting auth checks per endpoint."

(Experimental Agent Teams mode: post the discovery to the shared task list, or SendMessage teammates directly.)
```

### Supervisor Workflow

```
1. Orchestrator (as supervisor) reads all Express routes → 52 endpoints found
2. Groups by module:
   - auth (8 endpoints)
   - users (12 endpoints)
   - products (15 endpoints)
   - orders (10 endpoints)
   - admin (7 endpoints)
3. Shared dependencies: auth middleware, error handler, validation utils
4. Phase 1: dispatches shared-deps migration to one worker subagent (others wait)
5. Phase 2: dispatches module groups to worker subagents in parallel
   (`run_in_background: true`):
   - migrator-1: auth + admin (15 endpoints)
   - migrator-2: users + orders (22 endpoints)
   - migrator-3: products (15 endpoints)
6. Collects each worker's returned result as it finishes
7. Spot-checks migrator-2's work at endpoint 5 → finds missing schema →
   re-dispatches a correction
8. All workers complete → runs full test suite → reports result
```

**Experimental Agent Teams path:** a dynamic peer worker-pool that self-assigns from a shared task list (`TaskCreate`/`TaskList`/`TaskUpdate`) alongside a dedicated `supervisor` teammate. Worth it only when the endpoint count is large enough that pull-based self-assignment beats the orchestrator pushing batches.

---

## Pattern Selection Guide

| Project Characteristics | Recommended Pattern | Agents |
|------------------------|-------------------|--------|
| Feature with frontend + backend | Fan-out/Fan-in + Producer-Reviewer | 3-4 |
| Sequential data processing | Pipeline | 3-4 |
| Content with quality review | Producer-Reviewer | 2-3 |
| Code review / multi-angle analysis | Fan-out + Discussion | 3 |
| Batch migration / processing | Supervisor + Workers | 3-5 |
| Simple enhancement to existing code | Single subagent (no team needed) | 1 |
| Complex system with sub-teams | Hierarchical | 4-6 |

All patterns run as **subagents by default** — the orchestrator is the hub, spawning agents (with `run_in_background: true` for parallel fan-out) and relaying discoveries between them. Reach for **experimental Agent Teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) only when peers must coordinate live — most often the code-review / multi-angle case, occasionally a large pull-based worker pool.
