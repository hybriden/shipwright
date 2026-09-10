---
name: auto-e2e
description: "Use when user-facing behavior needs end-to-end verification through browser, API, or CLI testing. Triggers on: 'e2e test', 'end-to-end test', 'test in the browser', 'test the UI', 'test the API endpoints', 'test the CLI', 'playwright test', 'verify user flows', 'does it work for users', 'browser testing'. Also triggers on: 're-run e2e', 'e2e failed', 'test the user experience'. Use after unit tests or standalone for any app."
---

# Auto-E2E

Verify the complete user experience end-to-end. Detect app type (web / API / CLI) and test the full user journey with evidence capture.

**Core principle:** Unit tests prove components work; E2E proves the system works for users. Both required.

Part of the shipwright pipeline — do NOT invoke superpowers skills. (Distinct from auto-verify: E2E proves features work in isolation, one pass, before/at delivery; auto-verify iterates against a real deployed system.)

## Iron Law

```
NO COMPLETION CLAIM WITHOUT USER-FACING VERIFICATION
```

If a user can interact with it, test it the way a user would — screenshots, response bodies, exit codes. Evidence, not assumptions.

## When to Use

After auto-review; as run Phase 6 — on the final, reviewed code; standalone for any app.

## App Type Detection

- **Web:** index.html, React/Vue/Svelte/Angular, Express/Fastify/Next with views, vite/webpack config → Playwright MCP
- **API:** routes without views, OpenAPI spec, REST/GraphQL endpoints → HTTP testing
- **CLI:** bin/, commander/yargs/argparse/clap, shebangs → shell testing
- **Library:** only exports, no entry point → skip E2E (with justification)

Both web + API → test both. `.shipwright.json` `e2eType` overrides detection; `skipPhases: e2e` skips the skill.

## Phase 1: App Analysis

Read `.shipwright.json` (`e2eType`, `startCommand`); detect app type; find the start command + entry URL/port/command; read the task description to know what flows exist.

## Phase 2: Scenario Generation

Derive scenarios from the task + acceptance criteria + plan tasks + the routes/pages/commands the diff touches — count by size tier, breadth per Diff-Aware Gates (`../_shared/pace.md`). Per scenario: name, steps (ordered user interactions), expected outcome, evidence to capture, and whether its page/component/endpoint changed in the diff (`thorough`: mark every scenario changed).

## Phase 2.5: Scenario Validation

Before executing, validate:
- **Adversarial coverage** — ≥1 adversarial + 1 failure-mode scenario per feature (real users don't follow prescribed flows).
- **Behavioral depth** — each scenario exercises the specific implemented behavior, not just "a page loads"; every acceptance criterion → ≥1 scenario.
- **Stateful journeys** — ≥1 multi-step create → verify → edit → verify → delete → verify for stateful features.
- **Grounded expected results** — document how you know the correct result (criteria, seed data, computation, contract docs); if unknown, at least test consistency/reasonableness.

Adversarial patterns:

| Category | Web | API | CLI |
|---|---|---|---|
| Double-submit | click submit twice | POST twice | run twice on same input |
| Invalid input | script tags, 10MB text, empty required | null body, wrong content-type, oversized | negative numbers, empty, special chars |
| Interrupted | navigate away mid-form | cancel mid-stream | Ctrl+C during processing |
| Authorization | admin pages without auth | protected endpoint without token | privileged command as unprivileged |

## Phase 3: Execution

Probe by app type per `../_shared/runtime-probing.md` (the base tools + assertions for web/API/CLI). Add this E2E-specific breadth on top of the base matrix:

- **Web:** cover navigation, forms (submit/validation/success), error states (404/500/network); on changed scenarios, also responsiveness (375px, 768px) and a11y (ARIA names, labels, focus/keyboard via snapshots). A defect a sweep finds fails the scenario, and its fix lands with a red test per `../_shared/ui-tests.md` — the screenshot is the finding, the test is the guard.
- **API:** valid (200/201) + invalid (400 + useful message) + auth (401/403) + edge cases (empty/missing/oversized); assert response schemas; on changed endpoints, also headers (CORS, content-type).
- **CLI:** valid args (exit 0), invalid (helpful error + exit ≠0), no args (usage), `--help`, edge cases (empty/long/special), output format.

## Phase 4: Evidence Collection

Web: screenshots at key states + console errors + network failures. API: full response bodies for failures, status codes, response times. CLI: stdout, stderr, exit codes. Store in the report with inline references.

## Phase 5: Evidence Evaluation

Before marking any scenario PASS, apply the evidence-evaluation gate (`../_shared/evidence-evaluation.md`) — verify correct DATA, not just that the system responded. A feature-behavior scenario lacking proof of correct output → add verification steps before proceeding.

## Phase 6: Results

Report each scenario with pass/fail/untested + evidence + verdict. Any critical scenario fails → E2E phase failed. A scenario you couldn't drive against the running app (missing credential, service, tool, or access) is UNTESTED with that reason — never a guessed pass (`../_shared/evidence-evaluation.md`).

## Starting the App

Run the start command in background; poll a health endpoint/port until ready (30s timeout → auto-debug with the startup error); stop the app after tests. Web apps needing a build → build then start.

## Integration

run Phase 6, on the reviewed code. Consumes the task's acceptance criteria (auto-plan), unit results (auto-test — focus E2E on integration paths, not re-testing unit logic), the diff scope (auto-review's final diff), and the start command + app type (auto-setup). Produces scenario results + evidence verdicts (PROVEN/SUPERFICIAL/INSUFFICIENT/UNTESTED) for production-readiness (Gate 3). Invokes auto-debug on startup failure or scenario crashes; after a fix, re-run the failed scenario plus every scenario that exercises the files the fix changed, and run auto-review's Post-Review Fixes round on it before readiness. See `./e2e-tester-prompt.md`.

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "The page loaded, so it works" | Loading ≠ working. Verify the output. |
| "200 OK means correct" | 200 means the server didn't crash. Check the body. |
| "Screenshots are overkill" | They prove rendering, not correctness. Verify content. |
| "One happy path is enough" | Users don't only follow happy paths. Test errors + failure modes. |
| "Unit tests already cover this" | Units cover components; E2E covers user journeys. Different. |
| Duplicate unit coverage as E2E | Test journeys, not re-test unit logic. |
| Sweep every page for responsiveness/a11y on a one-page change (`lean`) | Sweep what the diff changed; the untouched pages were verified when they changed. |

## Prompt Template

See `./e2e-tester-prompt.md`.
