# QA Agent Guide

Patterns for integrating QA agents into harness-generated teams. Based on real-world boundary-mismatch bugs. Reference this when generating QA-focused agents in Phase 3.

## The Core Problem: Boundary Mismatches

QA doesn't fail at testing individual components. It fails at **boundaries** — where two components are individually correct but their interface contract is broken.

A function that returns `{projects: []}` is correct. A consumer that calls `.filter()` on the result is correct. But if the consumer expects an array and gets an object with an `projects` key, the system crashes.

**This is the #1 source of bugs that pass unit tests but fail in production.** Unit tests mock boundaries. QA agents must test across boundaries.

## Seven Real-World Boundary Bugs

These patterns recur across every project type. QA agents must check for all of them.

### Bug 1: Container vs Content Mismatch

**Pattern:** API returns `{data: [...]}`, consumer expects `[...]`

```javascript
// API returns:
{ projects: [{ id: 1, name: "Foo" }] }

// Consumer code:
const projects = await fetchProjects();
projects.filter(p => p.active); // TypeError: projects.filter is not a function
```

**QA check:** For every API call, read BOTH the API response shape AND the consumer's usage. Do they agree on the wrapper structure?

### Bug 2: URL Prefix Mismatch

**Pattern:** Routes are defined with a prefix, but links don't include it.

```javascript
// Router:
app.use('/dashboard', dashboardRoutes);

// Navigation component:
<Link href="/settings">Settings</Link>  // Should be "/dashboard/settings"
```

**QA check:** For every navigation link, trace it to the route definition. Does the link include all prefix segments?

### Bug 3: Field Name Mismatch

**Pattern:** Producer uses `camelCase`, consumer expects `snake_case` (or vice versa).

```javascript
// API response:
{ thumbnailUrl: "https://..." }

// Component:
<img src={item.thumbnail_url} />  // undefined — wrong field name
```

**QA check:** For every data field used in the UI, find the exact field name in the API response. Character-for-character match.

### Bug 4: Missing Integration Code

**Pattern:** Both the API endpoint and the UI component exist, but the glue code (hook, service call, event handler) was never written.

```javascript
// API exists:
PUT /api/settings/theme

// UI exists:
<ThemeSelector onSelect={handleThemeChange} />

// But handleThemeChange is:
const handleThemeChange = (theme) => {
  setLocalTheme(theme);  // Sets local state only
  // Never calls the API to persist the selection
};
```

**QA check:** For every user action that should persist data, trace the full path: UI event → handler → API call → database. If any link in the chain is missing, it's a bug.

### Bug 5: State Transition Gap

**Pattern:** The happy path works, but transitioning between states has missing code.

```javascript
// States: idle → loading → generating → complete
// The transition from "generating" to "complete" checks:
if (status === "complete") {
  showResults();
}

// But the API returns status: "finished", not "complete"
// So the UI stays in "generating" forever
```

**QA check:** For every state machine, enumerate all transitions. For each transition, verify the trigger condition matches the actual data that arrives.

### Bug 6: Sync vs Async Response Mismatch

**Pattern:** API sometimes returns immediately, sometimes returns a job ID for polling.

```javascript
// API might return:
{ status: "complete", result: {...} }  // Sync response
// OR:
{ status: "processing", jobId: "abc" }  // Async response

// Consumer only handles sync:
const result = await generate();
displayResult(result.data);  // result.data is undefined for async response
```

**QA check:** For every API call, check if the API has multiple response modes. Does the consumer handle all of them?

### Bug 7: Wrong Path in Navigation After Action

**Pattern:** After a create/update/delete action, the redirect URL is wrong.

```javascript
// After creating a project:
router.push(`/project/${newProject.id}`);
// But the actual route is:
// /dashboard/projects/:id
// So this 404s
```

**QA check:** For every redirect after a mutation (create, update, delete), verify the target URL matches an actual route definition.

## QA Agent Design Principles

### Principle 1: Read Both Sides Simultaneously

The #1 rule for QA agents. Never verify one side of a boundary in isolation.

**Bad QA:** "Does the API return data? ✅ Does the UI render? ✅" (Both pass individually, but the interface is broken.)

**Good QA:** "Does the API return `{projects: [...]}` AND does the UI destructure it as `{projects}` (not just receive it as an array)? Let me check both files."

**Implementation:** The QA agent's checklist should always have paired checks:
```markdown
## Check: Project List API Integration

### Producer (API side)
- File: `src/api/projects.ts`
- Response shape: `{ projects: Project[], total: number }`
- Status codes: 200 (success), 401 (unauthorized), 500 (error)

### Consumer (UI side)
- File: `src/components/ProjectList.tsx`
- Expected shape: destructures `{ projects }` from response ← MATCH ✅
- Handles 401: redirects to login ← VERIFIED ✅
- Handles 500: shows error message ← NOT HANDLED ❌
```

### Principle 2: Use `general-purpose` Type, Not `Explore`

QA agents need to **run verification scripts**, not just read code. A QA agent that can only read files can verify structure but not behavior.

```markdown
# QA Agent definition
# Type: general-purpose (NOT Explore)

## Verification Tools

The QA agent can and should:
- Run the test suite (`npm test`, `pytest`, etc.)
- Start the dev server and hit endpoints (`curl`, `fetch`)
- Run database queries to verify persistence
- Execute CLI commands to verify output
- Use Playwright MCP for browser-based verification
```

### Principle 3: Run QA Incrementally

Don't save all QA for the end. Run boundary checks after each module is integrated.

**Bad workflow:**
```
Build Module A → Build Module B → Build Module C → QA everything
```
By the time QA runs, there are 6 boundaries to check and bugs are hard to trace.

**Good workflow:**
```
Build Module A → QA A's external boundaries
Build Module B → QA B's boundaries + A↔B integration
Build Module C → QA C's boundaries + B↔C + A↔C integration
```
Each QA pass only checks new boundaries. Bugs are caught at the point of introduction.

### Principle 4: Cross-Comparison, Not Existence

QA checklists should verify **agreement between components**, not just that components exist.

**Existence check (weak):**
- [ ] API endpoint exists ✅
- [ ] UI component exists ✅
- [ ] Database table exists ✅

**Cross-comparison check (strong):**
- [ ] API response field names match UI's expected field names ✅/❌
- [ ] API error codes match UI's error handling cases ✅/❌
- [ ] Database column types match API's TypeScript types ✅/❌

### Principle 5: Enumerate, Don't Sample

For boundary checks, enumerate ALL boundaries. Don't sample.

If the system has 5 API endpoints and 8 UI components, there are potentially 40 boundaries (though most won't be connected). Map the actual connections and check every one.

**Implementation:** The QA agent should produce a **boundary map**:
```markdown
## Boundary Map

| Producer | Consumer | Field/Contract | Status |
|----------|----------|---------------|--------|
| GET /api/projects | ProjectList.tsx | `{projects: Project[]}` | ✅ Match |
| POST /api/projects | CreateProjectForm.tsx | Request: `{name, description}` | ✅ Match |
| POST /api/projects | CreateProjectForm.tsx | Response: `{id, name}` | ❌ UI expects `{project: {id, name}}` |
| GET /api/projects/:id | ProjectDetail.tsx | `{project: Project}` | ✅ Match |
```

## QA Agent Definition Template

```markdown
# QA Agent

You verify that components integrate correctly by checking boundary contracts
between producers and consumers. You do not test components in isolation —
you test the spaces between them.

## Core Role

Find boundary mismatches: field name disagreements, response shape mismatches,
missing integration code, wrong URL paths, and state transition gaps. Your job
is to catch the bugs that unit tests miss.

## Work Principles

1. ALWAYS read both sides of every boundary simultaneously. Never verify one side alone.
2. Produce a boundary map before checking anything. Enumerate, don't sample.
3. Use general-purpose type — you need to run verification scripts, not just read code.
4. Check incrementally after each integration, not just at the end.
5. Cross-compare, don't existence-check. Agreement matters, not presence.

## Boundary Check Protocol

For every producer-consumer pair:

1. Read the producer's output (API response, function return, event payload)
2. Read the consumer's expected input (destructuring, type annotation, usage)
3. Compare field-by-field:
   - Names match? (camelCase vs snake_case, abbreviations, typos)
   - Types match? (string vs number, array vs object, null handling)
   - Wrapper structure matches? ({data: [...]} vs [...])
   - All fields consumed are produced? (no undefined access)
   - All error cases handled? (status codes, exceptions, edge values)

## The Seven Checks

For every boundary, verify these patterns from the bug catalog:

| # | Pattern | Check |
|---|---------|-------|
| 1 | Container vs Content | Response wrapper matches consumer's destructuring |
| 2 | URL Prefix | All links include route prefixes |
| 3 | Field Name | Every consumed field exists in the producer's output |
| 4 | Missing Integration | Every UI action traces to an API call that traces to persistence |
| 5 | State Transition | Every state change trigger matches the actual incoming data |
| 6 | Sync vs Async | Consumer handles all response modes the API can return |
| 7 | Post-Action Navigation | Every redirect after mutation targets a valid route |

## Output Protocol

Produces a boundary verification report:

\`\`\`markdown
# Boundary Verification Report

## Boundary Map
[Full table of all producer-consumer pairs]

## Findings

### CRITICAL (will crash in production)
- [Finding with file paths, line numbers, and exact mismatch]

### WARNING (degraded experience)
- [Finding with details]

### INFO (potential future issue)
- [Finding with details]

## Verdict: [PASS | ISSUES_FOUND]
\`\`\`

## Error Handling

| Error | Action |
|-------|--------|
| Can't determine response shape | Read the actual API code, not just types. Run the endpoint if possible. |
| Producer code is generated/dynamic | Trace the generation logic. Find the template or builder. |
| Consumer uses a wrapper library | Read the wrapper's source to understand the transformation. |
| Multiple consumers for one producer | Check ALL consumers. Each may destructure differently. |
```

## Integrating QA into the Harness

### When to Add a QA Agent

Add a QA agent to the harness when:
- The project has 3+ integration boundaries (API↔UI, service↔service, etc.)
- The project spans multiple languages or frameworks (frontend + backend)
- Data flows through transformations (API → hook → component → display)
- The project has historically had integration bugs

### When NOT to Add a QA Agent

- Pure library projects (no integration boundaries)
- Single-file scripts
- Projects where all testing is unit-level and boundaries are mocked (though this is itself a risk)

### QA Agent Placement in Workflows

**In a Pipeline pattern:** QA runs after each stage that introduces a boundary
```
Implement Backend → QA Backend Boundaries → Implement Frontend → QA Full Stack
```

**In a Fan-out pattern:** QA runs after fan-in (when parallel work merges)
```
[Agent A] → ┐
[Agent B] → ├→ [Integration] → [QA on integration boundaries]
[Agent C] → ┘
```

**In a Producer-Reviewer pattern:** QA is a specialized reviewer
```
Implement → [QA Boundary Review] → [Code Quality Review] → Done
```

### QA + shipwright:run Integration

When the harness includes a QA agent and the project also uses `shipwright:run`:
- QA boundary checks complement (not replace) auto-test's unit tests
- QA runs between auto-impl and auto-test (catch boundary bugs before writing unit tests that mask them)
- QA findings feed into auto-review as additional review criteria
