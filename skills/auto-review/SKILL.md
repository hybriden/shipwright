---
name: auto-review
description: "Use when code needs review for spec compliance and quality. Triggers on: 'review this code', 'code review', 'check the implementation', 'does this match the spec', 'review for quality', 'is this production ready', 'spec compliance check', 'verify the code'. Also triggers on: 're-review', 'review again', 'check the fixes'. Two-stage review: spec compliance first, then code quality."
---

# Auto-Review

Multi-stage code review: spec compliance → behavioral fidelity → architecture boundaries → code quality. Issues loop back to the implementer for fixes.

**Core principle:** Spec compliance and code quality are orthogonal — checking them separately catches what a combined review misses.

Part of the shipwright pipeline — do NOT invoke superpowers skills.

## Iron Law

```
SPEC COMPLIANCE BEFORE CODE QUALITY. ALWAYS.
```

Wrong code that's clean is still wrong.

## When to Use

After auto-test + auto-e2e; as run Phase 6; whenever code needs verification against a spec.

## Process

Gather (plan, impl report, git diff) → Stage 1 spec compliance (≤3 cycles) → Stage 2 behavioral fidelity → Stage 2.5 architecture boundaries → Stage 2.6 React health (React projects) → Stage 3 quality (≤3 cycles) → Stage 3.5 over-engineering lens → Stage 4 plan feedback → verdict. Reviewers verify by reading code, never by trusting the impl report. After any fix, re-dispatch the reviewer — fixes introduce new issues ~30% of the time.

## Stage 1: Spec Compliance

Does the code do what was requested — nothing more, nothing less? Dispatch the spec reviewer (`./spec-reviewer-prompt.md`) with plan requirements, **the user's original task words**, and the impl report. Two layers:

- **Plan compliance:** missing requirements, extra/over-engineered features, misunderstandings.
- **Original-intent compliance:** did the plan itself drift from the user's words — miss requirements, add scope, or reinterpret meaning? A 100%-plan-compliant implementation can still miss what the user actually wanted.

Issues → dispatch implementer to fix the specific gaps → re-review. Max 3 cycles; unresolved → NEEDS_ATTENTION.

## Stage 2: Behavioral Fidelity

Does the code do what the tests *say* it does? Tests can pass while code is wrong — because the tests test the wrong thing, or both are wrong the same way. Scope: **top 5 functions by complexity** (branch count, or line count as proxy); simple getters rarely have code/test disagreements. Per function: read the test's assertion, read the code, are they testing the same thing? Specific checks:

- **Default-value masking** — returns a plausible default where it should error (happy-path tests miss this).
- **Silent truncation/coercion** — e.g. `parseInt("12abc")` → 12: no error, wrong behavior.
- **Error-path reality** — coverage says errors are covered, but does the test assert the *right* error, or catch *any* exception?
- **Boundary agreement** — spec "max 100" but code `<= 100` and test `< 100` = a bug the test confirms.

Output: fidelity concerns (treated as CRITICAL) or CLEAN.

## Stage 2.5: Architecture Boundaries

**If a map exists** (per `../_shared/architecture-map.md`), check the git diff for:

1. **New wrong-direction cross-boundary deps** — new imports where module A didn't previously depend on B; especially downstream→upstream, or new circular deps.
2. **Atomic data-model changes** — a changed shared model has ALL consumers updated in the same change set; serialization is backward-compatible or all points updated.
3. **Hot-spot depth** — hot-spot changes get deep review: read every changed function, check every consumer of the changed interface, verify contract tests exist (flag if not).
4. **Safe shared-config changes** — additive (new keys) safe; renamed/removed keys break consumers.

Output: architectural concerns (CRITICAL — this is the cascading-breakage cause) or CLEAN.

## Stage 2.6: React Health (React projects only)

**If `package.json` has a `react` dependency**, run the deterministic react-doctor gate over the diff per `../_shared/react-doctor.md` (local-only, `--scope changed --base <base>`). Treat `error`-severity findings as **Important** (or Critical for security/data-correctness rules) → dispatch the implementer to fix the exact `file:line` + rule, then re-scan and hold the net-positive line. Fix clearly-correct warnings (`no-array-index-as-key`, `exhaustive-deps`, `no-direct-state-mutation`), note the rest. Skip silently for non-React projects, `reactDoctor.enabled: false`, or when react-doctor is unavailable (no npx/offline). Its coverage isn't exhaustive (thin on security) — your own Stage 1-3 checks still apply.

Output: react-doctor findings (with severities + resolution) or CLEAN/UNAVAILABLE.

## Stage 3: Code Quality

Only after Stages 1, 2, and 2.5 pass. Dispatch the quality reviewer (`./quality-reviewer-prompt.md`) with the impl summary, git diff (base→HEAD), conventions, fidelity findings, and map context. Checks: SOLID design (`../_shared/solid.md`) — SRP/LSP always, OCP/ISP/DIP only at real seams; DRY/KISS (`../_shared/dry-kiss.md`) — one home per piece of logic, simplest obvious solution; clear names + readability; OWASP top 10; error handling at all external boundaries; no TODO/FIXME/HACK in new code; production-appropriate logging; no hardcoded values that should be config; tests verify behavior; structure follows plan + conventions; no boundary violations; backward-compatible model changes; hot-spot changes have contract tests. In .NET projects, also check changed .NET code against the patterns/anti-patterns of any matched `[dotnet-skills]` skill (Read its `SKILL.md`; see `../_shared/dotnet-skills.md`) — treat clear violations as Important. Severity: **Critical** (security, data loss, broken — must fix) / **Important** (poor patterns, missing error handling, bad naming — should fix) / **Minor** (style — note). Critical or Important → implementer fixes → re-review (max 3 cycles). Only Minor → approve with notes.

## Stage 3.5: Over-Engineering Lens

Hunt only complexity to delete — separate from correctness/security (Stages 1-3). Per finding, one line: `L<n>: <tag> <what>. <replacement>.` with tags **delete / stdlib / native / yagni / shrink**; end with `net: -N lines possible`, or `Lean already. Ship.` if nothing to cut. See `../_shared/minimalism.md`. Treat findings as Important — dispatch the implementer to delete/shrink, then re-verify tests still pass. Never flag the required test/coverage as bloat.

## Stage 4: Plan Feedback

Surface issues that are *plan* problems, not implementation problems: multiple tasks editing the same files (wrong seams), criteria that couldn't be verified as written (vague), repeated NEEDS_CONTEXT (plan lacked info), over/under-engineering (wrong task scope). Doesn't block (the code is already fixed) — output as a "Plan Retrospective" so plan quality improves over time.

## Review Report

```markdown
## Code Review Report
### Spec Compliance — PASS/FAIL, cycles N/3, issues resolved / unresolved
### Behavioral Fidelity — CLEAN/CONCERNS_FOUND, discrepancies, resolved?
### Architecture Boundaries — CLEAN/VIOLATIONS_FOUND, new deps / model changes / hot spots / config
### React Health — CLEAN/ISSUES_FOUND/UNAVAILABLE (React only) — react-doctor errors/warnings, resolved?
### Code Quality — APPROVED/APPROVED_WITH_NOTES, cycles N/3, Critical/Important/Minor counts, strengths
### Over-Engineering — net: -N lines possible (or "Lean already"), findings applied?
### Plan Retrospective — decomposition, criteria, context sufficiency, suggestions
### Overall: APPROVED | APPROVED_WITH_NOTES | NEEDS_ATTENTION
```

## Dispatching Fix Subagents

Use auto-impl's `implementer-prompt.md`. Provide the specific issues (with file:line), the original task context, and the instruction to fix only those issues — nothing more.

## Integration

run Phase 6. Consumes git diff + impl report (auto-impl), testability + honesty + coverage (auto-test), the plan + original task (auto-plan), the map (auto-map), and E2E evidence (auto-e2e). In React projects, runs the deterministic react-doctor gate (`../_shared/react-doctor.md`). Produces the review report + fidelity + boundary findings for production-readiness, and the plan retrospective for auto-plan (next run) / `.shipwright-retrospective.md`. Invokes implementer subagents to fix issues.

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "Tests pass, so the code is correct" | Tests passing means tests pass. Check fidelity — do they test what they claim? |
| "Spec compliance passed, skip fidelity" | Compliance checks requirements exist; fidelity checks they work. Different. |
| "Close enough on spec" | Not compliant. Fix it or document why it can't be fixed. |
| "Skip re-review after fixes" | Fixes introduce new issues ~30% of the time. Always re-review. |
| Combined spec + quality review | Misses what separate passes catch. Spec first, then quality. |
| Accepting the implementer's self-assessment | Verify by reading the actual code. |
| Rubber-stamp first-pass approval, zero findings | Genuinely perfect (rare) or shallow review? Flag it for the integrity reflection. |
