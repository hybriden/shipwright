---
name: auto-test
description: "Use when test coverage needs verification, gap analysis, or additional test writing. Triggers on: 'test this', 'check coverage', 'write tests', 'add tests', 'test coverage', 'coverage gaps', 'improve test coverage', 'are there enough tests', 'missing tests', 'test the implementation'. Also triggers on: 'recheck coverage', 'run tests again', 'coverage still low'. Use after implementation or standalone on any codebase."
---

# Auto-Test

Analyze implementation for coverage gaps and write comprehensive tests to meet targets — unit, integration, edge cases, error paths, boundaries, and module-boundary contracts.

**Core principle:** Tests are the proof code works. No proof, no confidence; no confidence, no production.

Part of the shipwright pipeline — do NOT invoke superpowers skills.

## Iron Law

```
NO CODE WITHOUT TESTS. NO GREEN BAR WITHOUT RED BAR FIRST.
```

Every line exercised by ≥1 test; every test red before it was green.

## When to Use

After auto-impl; as run Phase 4; standalone to verify or improve coverage.

## Process

Detect framework → baseline coverage → testability audit → (refactor if opt-in) → contract-boundary analysis → gap analysis → write tests → honesty check → verify (≤3 iterations). In a pipeline run the scope is **changed code**, and recorded results are reused, not re-run (`../_shared/pace.md`).

## Phase 1: Framework Detection

| Config | Framework | Coverage command |
|---|---|---|
| jest.config.* / package.json[jest] | Jest | `npx jest --coverage` |
| vitest.config.* | Vitest | `npx vitest run --coverage` |
| pytest.ini / pyproject[pytest] | Pytest | `pytest --cov --cov-report=term-missing` |
| go.mod | Go test | `go test -coverprofile=coverage.out ./...` |
| Cargo.toml | Cargo | `cargo tarpaulin` |
| .rspec | RSpec | `bundle exec rspec` |
| *.csproj / *.sln (xunit/nunit/mstest) | dotnet test | `dotnet test --collect:"XPlat Code Coverage"` |

None detected → set up the language's standard framework. When a stack-skills index lists a test skill (e.g. `xunit`), Read its `SKILL.md` before writing tests — per `../_shared/stack-skills.md`.

## Phase 2: Baseline Coverage

Reuse auto-impl's phase-end coverage run while HEAD is unchanged (evidence ledger); otherwise run the full suite with coverage. Capture the uncovered lines/branches **in changed code** — the gated scope — plus project line/branch totals (reported, not gated).

## Phase 3: Testability Audit

For each file whose changed code is below target, read the source and ask: are the critical paths testable with available tools (mocking, DI, visibility)? Is core logic hidden in private/static methods? Too many injected deps to mock? Tight coupling (direct `new`, static external calls)? Global state/singletons? Verdict per file: **TESTABLE** / **PARTIALLY_TESTABLE** (blocker + proposed change) / **UNTESTABLE**.

Opportunistically: if the code replicates an external contract (API client, protocol, data format) you can positively identify, find its authoritative docs/spec and flag divergences as potential bugs. Don't guess.

## Phase 4: Refactor for Testability (opt-in — `refactorForTestability: true`)

Otherwise skip and report untestable code in the output. Authorized: visibility changes (private → internal, with `InternalsVisibleTo` etc.); extract pure functions; add the ecosystem's standard mocking library; break static coupling via injectable abstractions; wire constructor DI. Constraints: preserve behavior (run the suite after each change), don't change public signatures, don't refactor already-testable code, commit refactors separately from test additions.

## Phase 4.5: Module Boundary Contract Analysis

**If a map exists** (per `../_shared/architecture-map.md`), for each dependency-graph boundary involving changed code: identify the contract (signatures, data-model shapes, request/response formats, event payloads, error types); check whether contract tests exist (tests importing BOTH modules, serialization round-trips, schema validation, the map's contract-test count); flag missing ones. Prioritize: boundaries with changed code (at risk now) > data models with >3 consumers > hot-spot modules > boundaries with no tests at all. These are the highest-priority tests — they catch cross-module breakage unit tests miss.

## Phase 5: Gap Analysis

Per file whose changed code is below target: read it, list the uncovered changed paths (untested functions/branches, error paths, edge cases — empty/null/overflow/boundary, integration points). Skip paths marked UNTESTABLE (if Phase 4 was skipped). Include contract-conformance gaps (Phase 3) and contract-test gaps (Phase 4.5, highest priority).

## Phase 6: Test Writing

Dispatch test-writer subagents (`./test-writer-prompt.md`) per gap cluster; each runs only its own new tests, and Phase 8 measures coverage for all of them in one run. Cover: happy path; edge cases (empty, single, max, unicode, special chars); error paths (invalid input, failures, timeouts); boundaries (off-by-one, min/max, empty/full); integration; contract conformance (assert documented behavior, not current impl); and module-boundary contracts (serialization round-trips; feed module A's output to module B's input; error-contract agreement — tests importing BOTH modules). For UI code (components, pages, styles), pick each test's level per `../_shared/ui-tests.md` and paste it into the test-writer prompt.

## Phase 7: Test Honesty Check (single pass)

Per test file, a quick cognitive check — NOT a rewrite loop:

1. Does it call production code, or assert against a value the test constructed to mirror the logic?
2. Would it fail if you mentally flipped a conditional / changed a return value?
3. Shape or behavior? (Shape tests — types, key existence — count only as contract tests.)
4. Does it only read the implementation's source? A test whose evidence is opening, grepping, or snapshotting source code for strings, names, or shapes proves nothing about behavior → DISHONEST. Reading a file is fine when that file is the product's output (generated code, a serialized protocol, persisted state, an intentional snapshot).

Verdict: **HONEST** / **SHAPE_ONLY** (contract only) / **DISHONEST**. Many DISHONEST → note for auto-review (its behavioral-fidelity check does the deeper analysis with code + tests together) and proceed.

## Phase 8: Coverage Verification

Re-run the full suite with coverage — one run per iteration, covering every test-writer's output together. Target met → done. Else repeat Phases 5-7 for remaining gaps. **Max 3 iterations**; if still short, report the specific uncovered paths, distinguishing: untestable code (from the audit) / insufficient test writing / dropped dishonest tests.

## Coverage Targets

Line 80% (`coverage.line`), branch 80% (`coverage.branch`), function 90% (`coverage.function`) — applied to changed code in a pipeline run. Overrides plus `testCommand`/`coverageCommand` in `.shipwright.json`.

## Integration

run Phase 4. Consumes impl code, the inter-task log, and the phase-end coverage run (auto-impl), and the map (auto-map). Produces coverage data, the testability audit, honesty verdicts, and the contract-gap report for auto-review and production-readiness (Gate 2). Invokes auto-debug when new tests expose implementation bugs. See `./test-writer-prompt.md`.

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "80% is good enough" | Check the missing 20% — often it's error handling, the most important part. |
| "Just the happy path" | Happy paths rarely fail in production; error paths do. |
| "The test passes, so it works" | A test that can't fail isn't a test. Would it catch a real bug? |
| "I'll construct the expected output" | If you built both input and expected output, you tested your own logic. |
| "This code can't be tested" | Audit first — it usually can, after a refactor. |
| Mock everything / test private methods / trivial getters | Test real behavior at the public surface. |
| Count shape-only tests toward behavioral coverage | They're contract tests only. |
| Ship a passing test that wouldn't catch a bug | Zero tests > misleading tests. Drop it. |
