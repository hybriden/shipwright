# Implementor Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Claude Code plugin that autonomously plans, implements, tests (unit + E2E + load), reviews, and verifies any development task to production-grade quality.

**Architecture:** A plugin with 7 skills forming a linear pipeline. The master orchestrator (`run`) invokes each sub-skill in sequence. Each sub-skill is independently usable. Subagent prompts are in supporting `.md` files within each skill directory.

**Tech Stack:** Claude Code plugin system (SKILL.md files with YAML frontmatter), Playwright MCP for E2E testing, k6/artillery for load testing.

---

### Task 1: Plugin Scaffolding

**Files:**
- Create: `plugin.json`
- Create: `CLAUDE.md`

**Step 1: Create plugin.json**

```json
{
  "name": "implementor",
  "description": "Autonomous development pipeline: plan, implement, test, review, and verify any task to production-grade quality",
  "version": "1.0.0",
  "author": {
    "name": "hybriden"
  },
  "repository": "https://github.com/hybriden/implementor",
  "license": "MIT",
  "keywords": ["autonomous", "pipeline", "testing", "review", "production-grade", "planning", "implementation"]
}
```

**Step 2: Create CLAUDE.md**

```markdown
# Implementor

This is a Claude Code plugin providing autonomous development pipeline skills.

## Plugin Structure

- `skills/run/` - Master orchestrator (entry point)
- `skills/auto-plan/` - Autonomous task planning
- `skills/auto-impl/` - Subagent-driven implementation
- `skills/auto-test/` - Unit and integration testing
- `skills/auto-e2e/` - Browser/CLI/API E2E testing via Playwright
- `skills/auto-review/` - Two-stage code review (spec + quality)
- `skills/production-readiness/` - Final verification gate

## Usage

Invoke `implementor:run` with a task description. The system handles everything autonomously.

## Philosophy

Zero human interaction during execution. Evidence-based completion only.
```

**Step 3: Commit**

```bash
git add plugin.json CLAUDE.md
git commit -m "feat: scaffold implementor plugin with manifest and docs"
```

---

### Task 2: Auto-Plan Skill

**Files:**
- Create: `skills/auto-plan/SKILL.md`

**Step 1: Create the auto-plan skill**

This skill reads the target codebase, identifies tech stack, patterns, and test infrastructure, then decomposes the task into ordered implementation steps. Each step includes exact file paths, acceptance criteria, and test strategy.

Key sections:
- Frontmatter: `name: auto-plan`, description focused on triggering conditions
- Overview: Autonomous planning without human input
- Process: Codebase analysis -> tech stack detection -> task decomposition -> plan output
- Plan output format: Matches writing-plans task structure (files, steps, commands, expected output)
- Adaptation rules: How to scale plan granularity to task complexity
- Iron Law: NO IMPLEMENTATION WITHOUT A PLAN FIRST
- Red Flags table for rationalization prevention

The plan output format must include for each task:
- Files to create/modify with exact paths
- Step-by-step implementation with code
- Test strategy with exact test commands
- Acceptance criteria
- Commit message

**Step 2: Commit**

```bash
git add skills/auto-plan/SKILL.md
git commit -m "feat: add auto-plan skill for autonomous task planning"
```

---

### Task 3: Auto-Impl Skill and Implementer Prompt

**Files:**
- Create: `skills/auto-impl/SKILL.md`
- Create: `skills/auto-impl/implementer-prompt.md`

**Step 1: Create the auto-impl skill**

Adapts the subagent-driven-development pattern for zero-interaction execution:
- Frontmatter: `name: auto-impl`, triggering conditions only
- Process: Read plan -> dispatch fresh subagent per task -> handle status (DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED)
- Key difference from superpowers: BLOCKED tasks get auto-re-planned instead of human escalation
- Model selection guidance (cheap for mechanical, capable for integration/architecture)
- Task tracking via TaskCreate/TaskUpdate
- Red Flags: never skip self-review, never dispatch parallel implementers, never proceed with BLOCKED status unresolved

**Step 2: Create the implementer prompt template**

Adapted from superpowers implementer-prompt.md but enhanced:
- Same structure: task description, context, questions protocol, job steps, self-review, report format
- Added: TDD enforcement (write test first, watch fail, implement, watch pass)
- Added: Coverage awareness (report coverage numbers)
- Added: Security checklist (OWASP top 10 awareness)
- Same status codes: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT

**Step 3: Commit**

```bash
git add skills/auto-impl/SKILL.md skills/auto-impl/implementer-prompt.md
git commit -m "feat: add auto-impl skill with subagent-driven implementation"
```

---

### Task 4: Auto-Test Skill and Test Writer Prompt

**Files:**
- Create: `skills/auto-test/SKILL.md`
- Create: `skills/auto-test/test-writer-prompt.md`

**Step 1: Create the auto-test skill**

Enforces comprehensive testing alongside implementation:
- Frontmatter: `name: auto-test`, triggering conditions
- Iron Law: NO CODE WITHOUT TESTS. NO GREEN BAR WITHOUT RED BAR FIRST.
- Coverage targets: 80% line + branch (configurable via plan)
- Test categories: unit, integration, edge cases, error paths, boundary conditions
- Process: Analyze implementation -> identify untested paths -> write missing tests -> run suite -> verify coverage
- Framework detection: auto-detect test framework from project (jest, pytest, vitest, go test, etc.)
- Anti-patterns: testing implementation details, mocking everything, testing trivial getters

**Step 2: Create the test writer prompt template**

Subagent prompt for writing comprehensive tests:
- Task: analyze specific files, identify untested code paths
- Write tests following project conventions
- Run tests and report results with coverage
- Status: DONE (with coverage numbers) | NEEDS_CONTEXT | BLOCKED

**Step 3: Commit**

```bash
git add skills/auto-test/SKILL.md skills/auto-test/test-writer-prompt.md
git commit -m "feat: add auto-test skill for comprehensive unit and integration testing"
```

---

### Task 5: Auto-E2E Skill and E2E Tester Prompt

**Files:**
- Create: `skills/auto-e2e/SKILL.md`
- Create: `skills/auto-e2e/e2e-tester-prompt.md`

**Step 1: Create the auto-e2e skill**

Browser-based and API-based end-to-end testing:
- Frontmatter: `name: auto-e2e`, triggering conditions
- Iron Law: NO COMPLETION CLAIM WITHOUT USER-FACING VERIFICATION
- App type detection: web app -> Playwright MCP, API -> HTTP client, CLI -> shell execution
- Test scenario generation: derive from original task description + acceptance criteria
- For web apps: navigation, form submission, error states, responsiveness, accessibility basics
- For APIs: endpoint testing, auth flows, error responses, rate limiting
- For CLIs: command execution, flag parsing, error output, exit codes
- Evidence capture: screenshots at key points, response payloads, console output
- Process: detect app type -> generate scenarios -> execute tests -> capture evidence -> report

**Step 2: Create the e2e tester prompt template**

Subagent prompt for E2E testing:
- Receive: app type, start command, test scenarios
- For web: use Playwright MCP tools (navigate, click, fill_form, snapshot, screenshot)
- For API: use curl/httpie or language-specific HTTP client
- For CLI: use Bash tool
- Capture evidence at every significant step
- Report: scenarios tested, pass/fail, evidence paths, issues found

**Step 3: Commit**

```bash
git add skills/auto-e2e/SKILL.md skills/auto-e2e/e2e-tester-prompt.md
git commit -m "feat: add auto-e2e skill for end-to-end user testing"
```

---

### Task 6: Auto-Review Skill and Reviewer Prompts

**Files:**
- Create: `skills/auto-review/SKILL.md`
- Create: `skills/auto-review/spec-reviewer-prompt.md`
- Create: `skills/auto-review/quality-reviewer-prompt.md`

**Step 1: Create the auto-review skill**

Two-stage review adapted for autonomous execution:
- Frontmatter: `name: auto-review`, triggering conditions
- Iron Law: SPEC COMPLIANCE BEFORE CODE QUALITY. ALWAYS.
- Stage 1: Spec compliance (does code match plan?)
- Stage 2: Code quality (clean, secure, maintainable?)
- Max 3 review cycles per stage before hard stop
- Issues loop back to implementer subagent
- If implementer can't fix after 3 cycles, flag in final report
- Process flowchart showing the two-stage loop

**Step 2: Create spec reviewer prompt**

Adapted from superpowers spec-reviewer-prompt.md:
- Same structure: verify against spec, don't trust report, read actual code
- Check for: missing requirements, extra work, misunderstandings
- Report: compliant or issues with file:line references

**Step 3: Create quality reviewer prompt**

Adapted from superpowers code-quality-reviewer-prompt.md:
- Check: single responsibility, testability, file structure, OWASP security
- Check: error handling at boundaries, logging, no TODO/FIXME/HACK
- Report: Strengths, Issues (Critical/Important/Minor), Assessment

**Step 4: Commit**

```bash
git add skills/auto-review/SKILL.md skills/auto-review/spec-reviewer-prompt.md skills/auto-review/quality-reviewer-prompt.md
git commit -m "feat: add auto-review skill with two-stage review process"
```

---

### Task 7: Production Readiness Skill

**Files:**
- Create: `skills/production-readiness/SKILL.md`

**Step 1: Create the production-readiness skill**

Final gate before declaring completion:
- Frontmatter: `name: production-readiness`, triggering conditions
- Iron Law: NO COMPLETION CLAIM WITHOUT ALL GATES PASSING
- Gates checklist (all must pass):
  - All unit tests pass
  - Coverage meets threshold (80% default)
  - All E2E tests pass
  - Code review approved (both stages)
  - No security vulnerabilities
  - Error handling at all external boundaries
  - Load test passes (if applicable)
  - No TODO/FIXME/HACK in new code
  - Appropriate logging
  - Graceful degradation verified
- Load testing section:
  - Detection: web service/API -> run load test, library/CLI -> skip
  - Tools: k6 preferred (auto-install if needed), artillery as fallback
  - Default config: 100 virtual users, 60s duration, ramp-up 10s
  - Pass criteria: p99 < 500ms, error rate < 1%, no memory leaks
  - Configurable via plan
- Report generation: structured markdown with all evidence
- Red Flags table

**Step 2: Commit**

```bash
git add skills/production-readiness/SKILL.md
git commit -m "feat: add production-readiness skill with load testing and DoD gate"
```

---

### Task 8: Master Orchestrator Skill (run)

**Files:**
- Create: `skills/run/SKILL.md`

**Step 1: Create the run skill**

The entry point that chains everything:
- Frontmatter: `name: run`, description: "Use when given a development task to implement autonomously with full testing and verification"
- Iron Law: EVERY PHASE MUST COMPLETE BEFORE THE NEXT BEGINS. NO SHORTCUTS.
- Process (linear, rigid):
  1. **Gather**: Read codebase, understand context, detect tech stack
  2. **Plan**: Invoke auto-plan to create implementation plan
  3. **Implement**: Invoke auto-impl to execute plan via subagents
  4. **Test**: Invoke auto-test to verify coverage
  5. **E2E Test**: Invoke auto-e2e for user-facing verification
  6. **Review**: Invoke auto-review for two-stage code review
  7. **Verify**: Invoke production-readiness for final gate
  8. **Report**: Generate completion report with all evidence
- Error handling: if any phase fails, attempt recovery once, then report failure with details
- Task tracking: create TaskCreate entries for each phase, update as they complete
- Zero interaction: never ask user for input, make all decisions autonomously
- Report format: structured markdown with changes, test results, coverage, review status, load test results, evidence

**Step 2: Commit**

```bash
git add skills/run/SKILL.md
git commit -m "feat: add run skill as master orchestrator for full autonomous pipeline"
```

---

### Task 9: Integration Verification

**Step 1: Verify plugin structure**

```bash
find . -name "*.md" -path "*/skills/*" | sort
```

Expected:
```
./skills/auto-e2e/SKILL.md
./skills/auto-e2e/e2e-tester-prompt.md
./skills/auto-impl/SKILL.md
./skills/auto-impl/implementer-prompt.md
./skills/auto-plan/SKILL.md
./skills/auto-review/SKILL.md
./skills/auto-review/quality-reviewer-prompt.md
./skills/auto-review/spec-reviewer-prompt.md
./skills/auto-test/SKILL.md
./skills/auto-test/test-writer-prompt.md
./skills/production-readiness/SKILL.md
./skills/run/SKILL.md
```

**Step 2: Verify all skills have valid frontmatter**

Check each SKILL.md has:
- `---` delimiters
- `name:` field with letters/numbers/hyphens only
- `description:` field starting with "Use when"
- Total frontmatter under 1024 characters

**Step 3: Verify cross-references**

Check that all `./filename.md` references in skills point to existing files.

**Step 4: Verify skill independence**

Each skill should be invocable independently without requiring the orchestrator.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete implementor plugin v1.0.0"
```
