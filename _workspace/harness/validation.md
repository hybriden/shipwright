# Harness Validation Report — Implementor Pipeline Skills

**Date:** 2026-04-06
**Scope:** 10 pipeline skills (excludes `run` orchestrator and `harness` itself)
**Type:** Audit only — no generation, no fixes

---

## Structural Checks

| Skill | Frontmatter | Summary | Iron Law | HARD-GATE | Process/Graph | Red Flags | Anti-Patterns | Integration | Lines | Budget |
|-------|-------------|---------|----------|-----------|---------------|-----------|---------------|-------------|-------|--------|
| auto-map | PASS | PASS | PASS | PASS | PASS (dot + 6 phases) | PASS (7) | PASS | PASS (detailed table) | 586 | OVER (~86 over) |
| auto-setup | PASS | PASS | PASS | PASS | PASS (dot + 7 phases) | PASS (8) | **FAIL** — missing | **FAIL** — missing | 207 | OK |
| auto-plan | PASS | PASS | PASS | PASS | PASS (dot + 5 phases) | PASS (9) | PASS | **FAIL** — informal | 289 | OK |
| auto-impl | PASS | PASS | PASS (2 laws) | PASS | PASS (dot) | PASS (9) | **FAIL** — missing | **FAIL** — missing | 289 | OK |
| auto-test | PASS | PASS | PASS | PASS | PASS (dot + 8 phases) | PASS (8) | PASS | **FAIL** — missing | 302 | OK |
| auto-e2e | PASS | PASS | PASS | PASS | PASS (app-type dot + phases) | PASS (9) | PASS | **FAIL** — missing | 266 | OK |
| auto-review | PASS | PASS | PASS | PASS | PASS (dot + 4 stages) | PASS (7) | **FAIL** — missing | **FAIL** — missing | 276 | OK |
| production-readiness | PASS | PASS | PASS | PASS | PASS (gate relevance table + 11 gates) | PASS (10) | **FAIL** — missing | **FAIL** — missing | 315 | OK |
| auto-debug | PASS | PASS | PASS | PASS | PASS (complex dot) | PASS (13) | PASS | PASS (detailed table) | ~969 | OVER (~469 over) |
| auto-verify | PASS | PASS | PASS | PASS | PASS (dot + iteration loop) | PASS (14) | PASS | PASS | ~873 | OVER (~373 over) |

### Summary: 10/10 pass core structure (frontmatter, Iron Law, HARD-GATE, process, Red Flags). 5/10 missing Anti-Patterns section. 6/10 missing formal Integration section. 3/10 over 500-line budget.

---

## Trigger Description Analysis

| Skill | Description | Aggressive? | Domain Terms | Follow-up Keywords | Verdict |
|-------|-------------|-------------|-------------|-------------------|---------|
| auto-map | "Use when a codebase needs a compact architecture map..." | No | No | No | **WEAK** — pipeline-only phrasing, won't trigger standalone |
| auto-setup | "Use when a project needs dependency installation..." | No | No | No | **WEAK** — pipeline-only |
| auto-plan | "Use when a development task needs to be decomposed..." | No | No | No | **WEAK** — "plan this task" wouldn't reliably trigger |
| auto-impl | "Use when an implementation plan exists..." | No | No | No | **WEAK** — very narrow prerequisite |
| auto-test | "Use when implementation is complete and test coverage..." | No | No | No | **WEAK** — pipeline-only |
| auto-e2e | "Use when implementation and unit tests are complete..." | No | No | No | **WEAK** — pipeline-only |
| auto-review | "Use when implementation and testing are complete..." | No | No | No | **WEAK** — pipeline-only |
| production-readiness | "Use when all implementation, testing, and review phases..." | No | No | No | **WEAK** — pipeline-only |
| auto-debug | "Use when encountering test failures, build errors, runtime errors, or unexpected behavior..." | **Moderate** | Error types listed | No | **OK** — covers multiple trigger scenarios |
| auto-verify | "Use when code changes need iterative verification against a real running system..." | **Moderate** | "running system", "deploy-verify" | No | **OK** — descriptive |

### Summary: 8/10 skills have **pipeline-only** descriptions that won't trigger for standalone use. None include follow-up keywords ("re-run", "try again"). Only auto-debug and auto-verify have moderately aggressive descriptions.

**Note:** This may be intentional — these skills are designed to be invoked by the `run` orchestrator, not standalone. But the README says "Each skill is independently usable," which contradicts pipeline-only descriptions.

---

## Integration Analysis

### Cross-Skill Reference Map

| Skill | Invokes | Invoked By | Data Consumed | Data Produced |
|-------|---------|-----------|---------------|---------------|
| auto-map | — | run (Phase 1.25) | Project context | Architecture map (`docs/architecture-map.md`) |
| auto-setup | — | run (Phase 1.5) | .implementor.json | Environment fingerprint |
| auto-plan | — | run (Phase 2) | Architecture map, retrospectives | Plan file (`docs/plans/*.md`) |
| auto-impl | auto-debug (on failure) | run (Phase 3) | Plan, architecture map lens | Implementation, inter-task log |
| auto-test | — | run (Phase 4) | Implementation, architecture map | Coverage data, honesty check results |
| auto-e2e | — | run (Phase 5) | Task description, config | E2E evidence, verdicts |
| auto-review | — | run (Phase 6) | Git diff, plan, architecture map | Review report, plan retrospective |
| production-readiness | — | run (Phase 7) | All prior phase outputs | Gate verdicts, final report |
| auto-debug | — | auto-impl (on failure), any phase | Error context, architecture map | Fix details, regression tests |
| auto-verify | implementor:run (for fixes) | run (standalone) | Architecture map, verification context | Runbook, verification verdict |

### Data Flow Integrity

| Signal | Producer | Consumer | Connected? |
|--------|----------|----------|------------|
| Architecture map | auto-map | auto-plan, auto-impl, auto-debug, auto-verify, auto-review, auto-test | **PASS** — all 6 consumers documented |
| Environment fingerprint | auto-setup | auto-debug | **PASS** — debug references it |
| Plan file | auto-plan | auto-impl | **PASS** |
| Inter-task learning log | auto-impl | auto-impl (next task) | **PASS** |
| Honesty check results | auto-test | auto-review, production-readiness | **PASS** |
| E2E evidence verdicts | auto-e2e | production-readiness | **PASS** |
| Behavioral fidelity findings | auto-review | production-readiness | **PASS** |
| Plan retrospective | auto-review | auto-plan (next run) | **PASS** |
| Codebase learnings | auto-verify | architecture map (feedback) | **PASS** |

### Missing Integration Connections (potential gaps)

1. **auto-setup → auto-plan**: Setup's "task-aware pre-flight check" findings should inform planning (e.g., "Redis not installed, tasks requiring Redis need adjustment"). The run orchestrator's signal propagation table mentions this, but auto-setup itself doesn't document it as an output.

2. **auto-test → auto-debug**: When auto-test finds failing tests, it should invoke auto-debug. The skill says "Dispatch fix subagent" but doesn't explicitly reference auto-debug.

3. **auto-e2e → auto-debug**: Same gap — when E2E scenarios fail, auto-e2e doesn't explicitly reference auto-debug for investigation.

---

## Content Quality Assessment

### Consistency

| Aspect | Consistent? | Notes |
|--------|------------|-------|
| HARD-GATE format | **PASS** | All 10 use the same `<HARD-GATE>` tag |
| Iron Law format | **PASS** | All use code blocks with ALL CAPS |
| Dot graph format | **PASS** | All complex flows use consistent graphviz syntax |
| Red Flags table format | **PASS** | All use "Thought / Reality" columns |
| Subagent prompt templates | **PARTIAL** | auto-debug and auto-verify have full dispatch templates; auto-impl references implementer-prompt.md; others lack dispatch examples |

### Depth vs Complexity

| Skill | Complexity | Depth Match? |
|-------|-----------|-------------|
| auto-map | High (6 phases, data models, test classification) | **EXCELLENT** — matches v2.0 architecture-aware vision |
| auto-setup | Low-medium | **ADEQUATE** — covers all ecosystems |
| auto-plan | Medium (5 phases + architecture integration) | **EXCELLENT** — atomic change groups, build order awareness |
| auto-impl | High (subagent dispatch, checkpoints, cascading breakage) | **EXCELLENT** — most sophisticated subagent orchestration |
| auto-test | Medium-high (8 phases, honesty check, contract tests) | **EXCELLENT** — contract test gap analysis is a standout |
| auto-e2e | Medium (app-type detection, evidence evaluation) | **GOOD** — adversarial scenarios and evidence gate are strong |
| auto-review | Medium-high (4 stages including fidelity + architecture) | **EXCELLENT** — behavioral fidelity check is unique |
| production-readiness | Medium (11 gates with relevance scoring) | **GOOD** — Gate 11 (Definition of Done) is the standout |
| auto-debug | Very high (anti-circle, net-positive gate, impact analysis) | **EXCELLENT** — most thorough debugging methodology |
| auto-verify | Very high (iteration loop, anti-regression, codebase learnings) | **EXCELLENT** — runbook pattern is uniquely valuable |

---

## Harness Health Score

| Dimension | Score (1-5) | Rationale |
|-----------|------------|-----------|
| **Coverage** | 5 | Full development lifecycle covered: setup → map → plan → implement → test → e2e → review → verify → production-readiness. Debug at every phase. |
| **Efficiency** | 4 | Skills are well-scoped with minimal overlap. Minor redundancy between auto-test's contract tests and auto-review's architecture boundary check. |
| **Quality** | 5 | Exceptional depth. Iron Laws, HARD-GATEs, and Red Flags tables provide strong guardrails. Evidence-based completion throughout. |
| **Resilience** | 5 | Anti-circle detection (auto-debug), net-positive gates (auto-impl, auto-debug), anti-regression gates (auto-verify), checkpoint system (auto-impl). Best-in-class failure handling. |
| **Ergonomics** | 3 | CLAUDE.md and README document all skills. But trigger descriptions are pipeline-only (won't fire standalone). 6/10 skills lack formal Integration sections, making it harder to understand connections without reading the orchestrator. |

**Overall: 4.4/5** — Exceptional pipeline quality. The main weakness is ergonomics: trigger descriptions and missing Integration/Anti-Patterns sections.

---

## Findings Summary

### CRITICAL (0)
None.

### IMPORTANT (3)

1. **6/10 skills missing formal Integration section** — auto-setup, auto-plan, auto-impl, auto-test, auto-e2e, auto-review, production-readiness. Without these, the only way to understand how skills connect is reading the `run` orchestrator. Each skill should declare what it invokes, what invokes it, and what data flows in/out.

2. **5/10 skills missing Anti-Patterns section** — auto-setup, auto-impl, auto-review, production-readiness. Anti-Patterns catch failure modes that Red Flags don't cover (Red Flags = "stop thinking this"; Anti-Patterns = "stop doing this").

3. **8/10 trigger descriptions are pipeline-only** — If these skills are meant to be independently usable (README says they are), descriptions need trigger phrases for standalone invocation. E.g., auto-plan should trigger on "plan this task", "decompose this", "break this into steps".

### MINOR (3)

4. **3 skills exceed 500-line budget** — auto-map (586), auto-debug (~969), auto-verify (~873). The content justifies the length, but Progressive Disclosure principles suggest moving advanced techniques (concurrency debugging, timeout debugging, CMS-specific strategies) to `references/` files.

5. **auto-test → auto-debug gap** — auto-test says "Dispatch fix subagent" when tests fail but doesn't explicitly reference auto-debug. Should say "invoke implementor:auto-debug" for consistency.

6. **auto-e2e → auto-debug gap** — Same pattern. When scenarios fail, should reference auto-debug explicitly.

---

## Verdict: READY (with minor improvement opportunities)

The implementor pipeline is production-grade. All 10 skills have the core structural elements, strong Iron Laws, and deep domain expertise. The v2.0/2.1 additions (architecture mapping, anti-regression gates, contract tests, checkpoints) are well-integrated across the pipeline.

The improvement opportunities (Integration sections, Anti-Patterns, trigger descriptions, Progressive Disclosure) would polish the harness but don't block functionality — the `run` orchestrator handles all the wiring that individual skills don't document.
