---
name: auto-review
description: "Use when code needs review for spec compliance and quality. Triggers on: 'review this code', 'code review', 'check the implementation', 'does this match the spec', 'review for quality', 'is this production ready', 'spec compliance check', 'verify the code'. Also triggers on: 're-review', 'review again', 'check the fixes'. Focused parallel reviewers — spec compliance, behavioral fidelity, architecture, quality — with spec fixes first."
---

# Auto-Review

Multi-lens code review: spec compliance, behavioral fidelity, architecture boundaries, code quality, over-engineering. Each lens is a separate focused pass; the passes run in parallel, and issues loop back to the implementer in batched fix rounds.

**Core principle:** Spec compliance and code quality are orthogonal — separate focused passes catch what a combined review misses. Separate focus, not separate turns.

Part of the shipwright pipeline — do NOT invoke superpowers skills.

## Iron Law

```
SPEC FIXES BEFORE QUALITY FIXES. ALWAYS.
```

Wrong code that's clean is still wrong. Reviewers run in parallel; fixes don't — spec gaps are fixed first, and quality findings on code a spec fix rewrites are dropped and re-checked next round.

## When to Use

After auto-test; as run Phase 5 — before E2E, so E2E proves the reviewed code; whenever code needs verification against a spec.

## Process

Gather (plan, the user's original task, impl report, git diff base→HEAD) → review rounds (≤3) → Stage 4 plan feedback → verdict. Reviewers verify by reading code, never by trusting the impl report.

**One round:**

1. **Dispatch in parallel** (background Agent calls): the spec reviewer (Stage 1) and the quality reviewer (Stage 3).
2. **Meanwhile, run the inline lenses yourself:** Stage 2 fidelity, 2.5 architecture, 2.6 React health, 3.5 over-engineering.
3. **Merge** all findings — one finding per file:line + defect, at its highest severity.
4. **Fix in one batch:** a single implementer dispatch with every Critical/Important finding, spec findings first. When a spec finding is MISSING/WRONG behavior, drop quality and over-engineering findings on the code it rewrites — the next round re-checks them.
5. **Verify:** the gate's test set per `../_shared/pace.md` (affected tests under `lean`); the next round re-reviews **only the fix delta** (`git diff <pre-fix>..HEAD`) plus the findings it claimed to fix — fixes introduce new issues ~30% of the time. Reviewers treat that delta as unreviewed code; a "revert to the minimal fix" finding is resolved by reverting that round, not by repairing on top of it.

No Critical/Important findings left → done. Each round is a Shipwright iteration loop (`../_shared/loop.md`): 3 rounds is its **budget**, open findings its **progress metric**, APPROVED/NEEDS_ATTENTION its **termination** verdicts. If review changed the tree, run the full suite once at the end (ledger).

## Stage 1: Spec Compliance

Does the code do what was requested — nothing more, nothing less? The spec reviewer (`./spec-reviewer-prompt.md`) gets plan requirements, **the user's original task words**, and the impl report. Two layers:

- **Plan compliance:** missing requirements, extra/over-engineered features, misunderstandings.
- **Original-intent compliance:** did the plan itself drift from the user's words — miss requirements, add scope, or reinterpret meaning? A 100%-plan-compliant implementation can still miss what the user actually wanted.

Unresolved after 3 rounds → NEEDS_ATTENTION.

## Stage 2: Behavioral Fidelity

Does the code do what the tests *say* it does? Tests can pass while code is wrong — because the tests test the wrong thing, or both are wrong the same way. Scope: **top 5 functions by complexity** (branch count, or line count as proxy; scaled by tier — `../_shared/pace.md`); simple getters rarely have code/test disagreements. Per function: read the test's assertion, read the code, and trace one concrete input through both — are they testing the same thing? Specific checks:

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

**If `package.json` has a `react` dependency**, run the deterministic react-doctor gate over the diff per `../_shared/react-doctor.md` (local-only, `--scope changed --base <base>`). Treat `error`-severity findings as **Important** (or Critical for security/data-correctness rules) → add the exact `file:line` + rule to the round's fix batch; re-scan next round and hold the net-positive line. Fix clearly-correct warnings (`no-array-index-as-key`, `exhaustive-deps`, `no-direct-state-mutation`), note the rest. Skip silently for non-React projects, `reactDoctor.enabled: false`, or when react-doctor is unavailable (no npx/offline). Its coverage isn't exhaustive (thin on security) — your own Stage 1-3 checks still apply.

Output: react-doctor findings (with severities + resolution) or CLEAN/UNAVAILABLE.

## Stage 3: Code Quality

The quality reviewer (`./quality-reviewer-prompt.md`) gets the impl summary, git diff (base→HEAD), conventions, and map context. Checks: SOLID design (`../_shared/solid.md`) — SRP/LSP always, OCP/ISP/DIP only at real seams; DRY/KISS (`../_shared/dry-kiss.md`) — one home per piece of logic, simplest obvious solution; clear names + readability; OWASP top 10; error handling at all external boundaries; no TODO/FIXME/HACK in new code; production-appropriate logging; no hardcoded values that should be config; tests verify behavior; structure follows plan + conventions; no boundary violations; backward-compatible model changes; hot-spot changes have contract tests. Also check changed code against the patterns/anti-patterns of any matched stack skill (`[dotnet-skills]` / `[skill-packs]` — Read its `SKILL.md`; see `../_shared/stack-skills.md`) — treat clear violations as Important. Severity: **Critical** (security, data loss, broken — must fix) / **Important** (poor patterns, missing error handling, bad naming — should fix) / **Minor** (style — note), each tagged with a category (security, error-handling, logging, hygiene, design, tests) that production-readiness consumes. Critical or Important → the round's fix batch. Only Minor → approve with notes.

## Stage 3.5: Over-Engineering Lens

Hunt only complexity to delete — separate from correctness/security (Stages 1-3). Per finding, one line: `L<n>: <tag> <what>. <replacement>.` with tags **delete / stdlib / native / yagni / shrink**; end with `net: -N lines possible`, or `Lean already. Ship.` if nothing to cut. See `../_shared/minimalism.md`. Treat findings as Important — they join the round's fix batch, and the round's test gate must stay green. Never flag the required test/coverage as bloat.

## Stage 4: Plan Feedback

Surface issues that are *plan* problems, not implementation problems: multiple tasks editing the same files (wrong seams), criteria that couldn't be verified as written (vague), repeated NEEDS_CONTEXT (plan lacked info), over/under-engineering (wrong task scope). Doesn't block (the code is already fixed) — output as a "Plan Retrospective" so plan quality improves over time.

## Post-Review Fixes

A code change made after the verdict — an auto-debug fix during E2E or readiness — gets a round scoped to its delta before the pipeline moves on: the spec and quality reviewers with the Re-review Round inputs (the fix delta + the failure it fixed), plus the inline lenses on the delta. Findings loop like any round (≤3). Append the result to the review report; production-readiness Gate 4 checks it.

## Review Report

```markdown
## Code Review Report
### Spec Compliance — PASS/FAIL, rounds N/3, issues resolved / unresolved
### Behavioral Fidelity — CLEAN/CONCERNS_FOUND, discrepancies, resolved?
### Architecture Boundaries — CLEAN/VIOLATIONS_FOUND, new deps / model changes / hot spots / config
### React Health — CLEAN/ISSUES_FOUND/UNAVAILABLE (React only) — react-doctor errors/warnings, resolved?
### Code Quality — APPROVED/APPROVED_WITH_NOTES, rounds N/3, Critical/Important/Minor counts by category, strengths
### Over-Engineering — net: -N lines possible (or "Lean already"), findings applied?
### Plan Retrospective — decomposition, criteria, context sufficiency, suggestions
### Post-Review Fixes — per fix: commit, rounds, findings resolved (or None)
### Overall: APPROVED | APPROVED_WITH_NOTES | NEEDS_ATTENTION
```

## Dispatching Fix Subagents

Use auto-impl's `implementer-prompt.md`. Provide the round's whole batch (each issue with file:line, spec findings first), the original task context, the affected-test command, and the instruction to fix only those issues — nothing more. Fixes follow the implementer prompt's removal-first rule: a finding on a path the task doesn't strictly need is fixed by removing that path, not by hardening it.

## Integration

run Phase 5. Consumes git diff + impl report (auto-impl), testability + honesty + coverage (auto-test), the plan + original task (auto-plan), and the map (auto-map). In React projects, runs the deterministic react-doctor gate (`../_shared/react-doctor.md`). Produces the review report — fidelity, boundary, and categorized quality findings — for production-readiness, and the plan retrospective for auto-plan (next run) / `.shipwright-retrospective.md`. Invokes implementer subagents to fix issues.

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "Tests pass, so the code is correct" | Tests passing means tests pass. Check fidelity — do they test what they claim? |
| "Spec compliance passed, skip fidelity" | Compliance checks requirements exist; fidelity checks they work. Different. |
| "Close enough on spec" | Not compliant. Fix it or document why it can't be fixed. |
| "Skip re-review after fixes" | Fixes introduce new issues ~30% of the time. Re-review the fix delta every round. |
| Re-review the whole diff after a fix | Untouched code didn't change. Review the fix delta + the findings it addressed. |
| Combined spec + quality review | One reviewer juggling both misses what focused passes catch. Separate reviewers, in parallel. |
| Fix quality findings before spec gaps | Polishing code a spec fix will rewrite. Spec first. |
| One fix dispatch per finding or per stage | Batch the round's findings into one dispatch. |
| Accepting the implementer's self-assessment | Verify by reading the actual code. |
| Rubber-stamp first-pass approval, zero findings | Genuinely perfect (rare) or shallow review? Flag it for the integrity reflection. |
