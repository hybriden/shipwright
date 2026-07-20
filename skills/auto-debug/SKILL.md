---
name: auto-debug
description: Use when encountering test failures, build errors, runtime errors, or unexpected behavior during any phase of the shipwright pipeline
---

# Auto-Debug

Systematic root cause analysis and resolution for any error in the shipwright pipeline. Reproduce, trace, hypothesize, fix, prove — zero human interaction.

**Core principle:** Never guess. Reproduce first, trace second, hypothesize third, fix last. A fix without a root cause is a bandage.

Part of the shipwright pipeline — do NOT invoke superpowers skills; debugging is handled here.

## Iron Law

```
NO FIX WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

No exceptions — not for "obvious" bugs, not for "I've seen this before," not for "the fix is simple."

## When to Use

Test/build/runtime failures in any phase, review-identified bugs, or standalone debugging.

## Process

`Triage → Reproduce → Isolate → Trace root cause → Hypothesize → Baseline → Impact analysis → Fix → Prove (net-positive gate) → Final verify + commit → Cleanup`

At each stage: if a fix fails the net-positive gate, roll back and record what regressed; if the same files/tests keep cycling, stop and mark UNRESOLVED.

## Phase 0: Triage

Classify before diving in.

### Error classification

Detect the category and apply its fast path:

| Error pattern | Category | Fast path |
|---|---|---|
| `TypeError`, `ReferenceError`, `undefined is not a function` | Type/Reference | Read the exact line; check scope and types |
| `ENOENT`, `MODULE_NOT_FOUND`, `Cannot find module` | Missing file/module | Trace the import chain; check paths and package.json |
| `ECONNREFUSED`, `ETIMEDOUT`, `fetch failed` | Network | Check service is running; verify URLs/ports |
| `SyntaxError`, `Unexpected token` | Parse | Check the file; often a bad merge |
| `ENOMEM`, `heap out of memory`, `Maximum call stack` | Resource exhaustion | Look for infinite recursion, unbounded loops, leaks |
| `EACCES`, `Permission denied` | Permission | Check file permissions, user context |
| `Timeout`, `exceeded`, `took too long` | Timeout/Hang | See `references/advanced-techniques.md` |
| flaky pass/fail | Concurrency | See `references/advanced-techniques.md` |
| `version`, `peer dep`, `conflicting` | Dependency conflict | See `references/advanced-techniques.md` |
| Multiple unrelated errors | Cascade | See Cascade Analysis below |
| `BREAKING CHANGE`, `deprecated` | API migration | Check the dependency's changelog / migration guide |

### Narrow the scope

- **Architecture map:** read `docs/architecture-map.md` per `../_shared/architecture-map.md` — locate the error's module, trace the dependency chain backward (root cause is often upstream), note hot spots (high blast radius → extra care in Layer 3 verification).
- **Diff-based narrowing:** `git diff HEAD~5` (or since last known-good). A changed file in the stack trace is your starting point. Most bugs are in recently changed code — this eliminates ~80% of investigation.
- **Cascade analysis (multiple errors):** don't fix all. Find the root error — sort by dependency order, take the *first* chronologically (not the loudest), group by file (10 failures in one file = the file is broken), check for `beforeAll`/setup failures. Rule: fix ONE, re-run, count how many others vanish. Repeat until zero.

### Project tool discovery (MANDATORY)

Before any verification, discover the project's own tools — they verify real behavior that generic test commands can't. Scan: `tools/`/`scripts/`/`bin/`/`cli/`; `package.json` scripts (`build`, `lint`, `validate`, `check`, `migrate`); `Makefile`/`Taskfile`/`justfile`; `*.csproj` CLI projects; `cmd/` (Go); `[project.scripts]` (Python); `[[bin]]` (Rust); `docker-compose.yml` health checks; README "how to run"; `.shipwright.json` commands.

Build a tool inventory (CLI, validators, scripts, start command) **once** during triage, then use it throughout — especially for input→output tools: run on representative input, validate the output with the project's own validators, compare before/after the fix.

## Anti-Circle & Debug Budget

Read `references/safety-mechanisms.md` for full rules. Always: maintain a fix-history log; max 3 hypotheses; if a fix fails the net-positive gate, roll back immediately (see `../_shared/net-positive-gate.md`).

## Phase 1: Reproduce

Run the exact failing command; capture full output (stdout, stderr, exit code, stack trace, file:line); run again to confirm consistency. **If intermittent:** run 3×, note which pass/fail, look for timing/race/external-state dependencies.

## Phase 2: Isolate

Read the stack trace → originating file/line. Read the failing code and (for test failures) the assertion. Identify the boundary: code, config, dependency, or environment error. Run the single failing test in isolation.

- **Log injection** (opaque errors, wrong output but no crash): add `console.log('[DEBUG:auto-debug] ...')` at each decision point, run, compare actual vs expected path — the divergence is the bug. **MANDATORY: remove every `[DEBUG:auto-debug]` line afterward.**
- **Git bisect** (regressions): `git bisect start; git bisect bad HEAD; git bisect good <commit>`, test each checkout, mark good/bad. Read the culprit commit's diff. **Always `git bisect reset` when done.** Turns O(n) into O(log n).

## Phase 3: Trace Root Cause

Don't stop at the symptom. **Five Whys:** ask "why?" at least 3 times — the first answer is rarely the root cause. If a map exists, trace the dependency chain backward (per `../_shared/architecture-map.md`); the root cause is at the boundary where the contract breaks.

| Category | Examples | Fix approach |
|---|---|---|
| Logic error | Off-by-one, wrong operator, missing condition | Fix the logic |
| Missing handling | Null not checked, error not caught | Add the handling |
| Wrong assumption | API changed, data shape differs, timing wrong | Update the assumption |
| Dependency | Version mismatch, missing package, wrong config | Fix the dependency |
| State | Stale cache, race condition, leaked test state | Fix state management |
| Environment | Missing env var, wrong path, permission | Fix the environment |

**Output:** the root cause as one sentence — "The root cause is [X] because [evidence]."

## Phase 4: Hypothesize

State the hypothesis ("if I change X, the error resolves because [root cause]"), predict the outcome, consider side effects. **Max 3 hypotheses** — if three fail, the analysis was wrong; restart from Phase 2 with wider scope. If a hypothesis is wrong, go back to Phase 3, don't iterate the same theory.

## Phase 4.5: Baseline (MANDATORY)

Before writing any fix, capture the test baseline per `../_shared/net-positive-gate.md`. Without it you can't tell "already failing" from "my fix broke it."

## Phase 4.75: Fix Impact Analysis (MANDATORY)

Analyze blast radius before you break something. List the files you'll change, map them to modules (from the map), classify the change:

| Change type | Detection | Blast radius |
|---|---|---|
| Public API | Exported signature / public interface / endpoint contract | ALL importing consumers |
| Data model | Fields on a shared model/entity/DTO | VERY HIGH — every consumer + DB + serialization |
| Shared config | A file in the map's Shared Configuration | ALL readers |
| Internal | Private function bodies, signatures unchanged | LOW — the module's own tests |
| Build file | Project/package/build config | All downstream build dependents |

Find all dependents via the dependency graph; list consumer tests (unit always; integration/contract for API/model changes) — these MUST pass after the fix.

| Impact | Approach |
|---|---|
| Internal, 1 file, no shared models | Fix, verify baseline (unit tests) |
| Public API, <3 dependents | Fix, verify baseline + all dependent + contract tests |
| Data model (persisted + serialized) | CAUTION. Check every consumer + serialization format. >5 consumers → seek a fix that doesn't change the model |
| Shared config | Fix, verify all readers |
| Hot spot, 5+ dependents | Fix, verify baseline + ALL integration/contract tests |
| Multi-module fix for one bug, or model change + 3+ consumers | STOP — likely a symptomatic fix or an architectural bug. Re-investigate |

## Phase 5: Fix

Apply the **minimal** change that addresses the root cause. Do NOT refactor or "improve" unrelated code. Write a regression test (Phase 5.5). **Do NOT commit yet** — the net-positive gate comes first. A one-line bug gets a one-line fix.

## Phase 5.5: Prove the Fix (MANDATORY)

Every fix must be proven through automated verification. A fix without proof is a hope.

**Layer 0 — Net-Positive Gate (run FIRST):** compare against the Phase 4.5 baseline per `../_shared/net-positive-gate.md`. A fix that introduces regressions is rolled back immediately — do not "also fix" what it broke.

**Layer 1 — Regression test (always):** write a test that FAILS without the fix and PASSES with it. Name by behavior ("should return empty array when filter matches no items"), not "test bug #42." **Prove causation:** revert fix → test fails; re-apply → test passes. If it passes both ways, the test proves nothing — rewrite it.

**Layer 2 — Runtime verification (when applicable):** use the Phase 0 project tools FIRST (run the CLI/validator on real input, compare before/after). Then, for the app type: web → Playwright (`browser_snapshot`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_requests`); API → send the triggering request + edge cases, verify status/body/headers; CLI → verify stdout/stderr/exit code + edge cases; library → integration test as a consumer would. Capture output as evidence.

**Layer 3 — Broader impact (fix touches shared code):** identify all consumers, run their tests, write smoke tests where none exist, verify no behavior changed.

## Phase 5.75: Symptomatic Fix Detector

Honestly assess: did you fix where the bug *manifests* or where it *originates*?

| Fix type | Symptom fix | Root-cause fix |
|---|---|---|
| Null crash | Null check at crash site | Fix the producer that emits null |
| Wrong output | Adjust the transform at output | Fix the logic that computes it |
| Test failure | Change the assertion | Fix the code the assertion tests |
| Import error | Add a missing export | Fix the module structure |
| Timeout | Increase the timeout | Fix the slow operation |

Check whether the bug class recurs elsewhere (same missing check / off-by-one pattern). A symptomatic fix is sometimes the right pragmatic call (e.g. a defensive null check) — but you MUST document it: "Fix addresses the symptom at [location]. Root cause is [X] at [location]. A deeper fix would [Y]."

## Phase 6: Final Verification

1. Run the originally failing command — passes. 2. Run the regression test — passes. 3. Run the full suite — **zero regressions vs the Phase 4.5 baseline.** 4. Review runtime evidence if captured. 5. Confirm Phase 4's predicted outcome matches reality. 6. **Only now commit** the fix + regression test with a descriptive message.

**If verification fails:** roll back (`git checkout -- .`), return to Phase 3 (re-investigate the root cause), not Phase 5 (a bigger patch). Record what broke as diagnostic information.

## Advanced Techniques

For concurrency, timeout/hang, dependency conflicts, environment fingerprinting, and error-message decoding, read `references/advanced-techniques.md` when the Phase 0 category matches.

## Cleanup (MANDATORY)

Before declaring complete: remove every `[DEBUG:auto-debug]` line; `git bisect reset` if used; delete temp test files; revert temporary config changes; verify the working tree is clean except the fix + regression test. Debug artifacts in committed code = tech debt.

## Integration

Called by other skills on failure — auto-setup (build/deps/config), auto-impl (impl/test code), auto-test (test logic/edge cases), auto-e2e (runtime/integration), auto-review (correctness), production-readiness (whatever the gate checks). Receive error context, run Phases 0–6, report **RESOLVED** (with fix details) or **UNRESOLVED** (with investigation evidence). Standalone: receive a bug report, run the process, commit, report.

Consumes the architecture map (dependency graph, hot spots, data models) and the auto-setup environment fingerprint (distinguishes code bugs from env bugs). When dispatched as a subagent, use `references/dispatch-template.md`.

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "The fix is obvious" / "I've seen this before" | Same symptom ≠ same cause. Reproduce and trace first. |
| "Let me just try this fix" | A fix without a hypothesis is a guess. Hypothesize first. |
| "The fix works, ship it" | Root cause gone, or symptom masked? Verify. |
| "This is an environment issue" | Check the setup fingerprint. If it matches, it's a code bug. |
| Shotgun debugging / fix-and-pray | Stop. Back to Phase 1 / Phase 3. |
| Scope creep ("while I'm here…") | Fix only the root cause. File other issues separately. |
| Error suppression (try/catch, `|| true`) | Hides bugs, doesn't fix them. |
| Regression chasing (fix A breaks B breaks C…) | You're in a circle. Revert ALL to last known-good; fix A was wrong. |
| Committing a net-negative "to fix next step" | Never. The net-positive gate exists for this. |
