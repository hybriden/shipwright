# Team Examples

Five complete worked examples showing how to design agent teams for different project types. Reference these in Phase 2-3 for pattern selection and agent definition guidance.

---

## Example 1: Full-Stack Web Application

**Project:** E-commerce platform (Next.js frontend, Node.js API, PostgreSQL)
**Pattern:** Fan-out/Fan-in + Producer-Reviewer
**Execution Mode:** Agent Teams

### Why This Pattern

The frontend and backend can be developed in parallel (fan-out), but both need a shared review process (producer-reviewer). The reviewer needs to see both sides to catch integration mismatches.

### Agent Roster

| Agent | Role | Type | Model |
|-------|------|------|-------|
| `frontend` | React/Next.js implementation, component design, client state | custom | default |
| `backend` | API design, database queries, business logic | custom | default |
| `qa` | Cross-boundary testing, integration verification | custom | opus |
| `reviewer` | Code quality, security, performance | custom | opus |

### Agent Definition: `frontend.md`

```markdown
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

**Receives:**
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
- TaskUpdate with status: "complete" and list of files created

## Team Communication Protocol

**Reports to:** orchestrator
**Receives from:** backend (API contracts), reviewer (issues to fix)
**Shares discoveries with:** backend, qa

**Communication triggers:**
- When you discover the API contract doesn't match what the UI needs → SendMessage to backend
- When you find an existing pattern that affects the backend → SendMessage to backend
- When your work is ready for testing → SendMessage to qa

## Error Handling

| Error | Action |
|-------|--------|
| API contract missing | SendMessage to backend: "Need API contract for [endpoint]" |
| Existing component conflicts | Read it, adapt, don't duplicate |
| Test framework not configured | Report to orchestrator |
```

### Orchestrator Flow

```
1. Orchestrator receives task: "Add product search with filters"
2. Orchestrator creates team with frontend, backend, qa, reviewer
3. Orchestrator assigns:
   - Backend: "Design and implement /api/products/search endpoint with filter params"
   - Frontend: "Build search page with filter sidebar" (waits for backend API contract)
4. Backend shares API contract → Frontend begins implementation
5. Both complete → QA runs integration tests
6. QA passes → Reviewer reviews both sides
7. Reviewer approves or sends issues back → fix cycle (max 3)
8. All approved → Orchestrator merges and reports
```

### Communication Pattern

```
Backend → Frontend: "API contract: GET /api/products/search?q=&category=&minPrice=&maxPrice= returns {products: [], total: number, page: number}"
Frontend → Backend: "Need pagination in the response — offset and limit params"
Backend → Frontend: "Added. Updated contract: ...?offset=&limit=25"
Frontend → QA: "Search page ready for testing at /search"
QA → Frontend: "Filter sidebar doesn't clear when navigating away and back"
QA → Backend: "Search returns 500 when minPrice > maxPrice — needs validation"
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

### Why Subagents Here

Each stage is self-contained. The extractor doesn't need to talk to the transformer mid-extraction. The transformer doesn't need to ask the loader about target schema mid-transformation. Data flows strictly forward through files in `_workspace/`.

---

## Example 3: Content Platform

**Project:** Blog platform with AI-assisted writing (Next.js, MDX, OpenAI API)
**Pattern:** Producer-Reviewer with 2 cycles
**Execution Mode:** Agent Teams

### Agent Roster

| Agent | Role | Type | Model |
|-------|------|------|-------|
| `writer` | Content generation, structure, narrative | custom | opus |
| `editor` | Quality review, fact-checking, style consistency | custom | opus |
| `seo` | Search optimization, meta tags, keyword density | custom | default |

### Agent Definition: `editor.md`

```markdown
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

**Receives:**
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

## Team Communication Protocol

**Reports to:** orchestrator
**Receives from:** writer (drafts)
**Shares discoveries with:** seo (content structure findings)

**Mandatory rule:** When sending NEEDS_REVISION to writer, include:
1. Numbered list of specific issues
2. For each issue: location, problem, suggested fix
3. The original acceptance criteria that each issue violates
```

### Review Cycle Flow

```
Cycle 1:
  Writer produces draft → Editor reviews
  Editor: NEEDS_REVISION (3 MUST_FIX items)
  → Writer fixes all 3 → Editor re-reviews

Cycle 2:
  Editor: APPROVED (1 SUGGESTION remaining)
  → SEO agent optimizes meta tags, keywords
  → Orchestrator publishes

If after Cycle 2 still NEEDS_REVISION:
  → Orchestrator escalates to user with editor's notes
```

---

## Example 4: Code Review Team

**Project:** Large monorepo (TypeScript, 200+ files, multiple packages)
**Pattern:** Fan-out + Discussion
**Execution Mode:** Agent Teams

### Agent Roster

| Agent | Role | Type | Model |
|-------|------|------|-------|
| `security-reviewer` | OWASP top 10, auth patterns, input validation, secrets | custom | opus |
| `performance-reviewer` | Algorithms, database queries, caching, bundle size | custom | opus |
| `test-reviewer` | Test coverage, test quality, behavioral testing | custom | default |

### Why Agent Teams

Reviewers frequently discover issues that cross domains:
- Security reviewer finds an unvalidated input → performance reviewer should check if that input hits the database
- Performance reviewer finds an N+1 query → test reviewer should verify tests cover the optimized path
- Test reviewer finds untested error paths → security reviewer should check if those paths have security implications

With SendMessage, reviewers share discoveries in real-time:

```
security-reviewer → performance-reviewer: "DISCOVERY: User input at src/api/search.ts:45 is passed directly to SQL query. Check if this affects query performance too."
performance-reviewer → test-reviewer: "DISCOVERY: Refactored src/db/queries.ts to batch queries. Existing tests at tests/db/ need updating."
test-reviewer → security-reviewer: "DISCOVERY: No tests for auth middleware error paths. Are these security-sensitive?"
```

### Cross-Discovery Protocol

Every agent definition includes:

```markdown
## Cross-Discovery Protocol

When you find something outside your domain:
1. Continue your own review (don't switch domains)
2. SendMessage to the relevant reviewer: "[your-name] DISCOVERY: [finding]"
3. Include: file path, line number, what you noticed, why it matters for their domain
4. Do NOT attempt to fix cross-domain issues yourself
```

### Integration

The orchestrator collects all three review reports and produces a unified review:

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
**Execution Mode:** Agent Teams

### Agent Roster

| Agent | Role | Type | Model |
|-------|------|------|-------|
| `supervisor` | Task distribution, progress tracking, conflict resolution | custom | opus |
| `migrator-1` | Endpoint migration (worker 1) | custom | default |
| `migrator-2` | Endpoint migration (worker 2) | custom | default |
| `migrator-3` | Endpoint migration (worker 3) | custom | default |

### Supervisor Agent Definition (Key Sections)

```markdown
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
2. The other worker documents what they need added and sends via SendMessage
3. The assigned worker handles both changes
4. Never let two workers edit the same file simultaneously
```

### Worker Agent Definition (Shared)

All three migrators use the same agent definition:

```markdown
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

## Team Communication

**Reports to:** supervisor (via TaskUpdate)
**Receives from:** supervisor (task assignments)
**Shares with:** other migrators (shared patterns discovered)

**Example shared discovery:**
"DISCOVERY: Express middleware `requireAuth` maps to Fastify `preHandler` hook. I created a shared adapter at `src/middleware/fastify-auth.ts`. Use this instead of rewriting auth checks per endpoint."
```

### Supervisor Workflow

```
1. Supervisor reads all Express routes → 52 endpoints found
2. Groups by module:
   - auth (8 endpoints)
   - users (12 endpoints)
   - products (15 endpoints)
   - orders (10 endpoints)
   - admin (7 endpoints)
3. Shared dependencies: auth middleware, error handler, validation utils
4. Phase 1: Assigns shared deps to migrator-1 (others wait)
5. Phase 2: Distributes modules:
   - migrator-1: auth + admin (15 endpoints)
   - migrator-2: users + orders (22 endpoints)
   - migrator-3: products (15 endpoints)
6. Monitors progress via TaskList
7. Spot-checks migrator-2's work at endpoint 5 → finds missing schema → sends correction
8. All workers complete → Supervisor runs full test suite → reports result
```

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
