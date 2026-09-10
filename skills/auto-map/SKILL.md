---
name: auto-map
description: "Use when a codebase needs a compact architecture map before planning, implementation, or debugging. Triggers on: 'map the codebase', 'architecture map', 'map this project', 'understand the codebase', 'codebase overview', 'module map', 'dependency graph', 'what modules exist', 'how is this structured'. Also triggers on: 'refresh the map', 'update the map', 'map is stale', 're-map'. Use standalone to explore unfamiliar codebases or before any task that needs structural understanding."
---

# Auto-Map

Generate a compact, structured architecture map that fits in any subagent's context window — module boundaries, interfaces, dependencies, data models, patterns, hot spots. Everything a subagent needs to understand how the codebase fits together without reading every file.

**Core principle:** A subagent that understands the architecture makes better decisions than one that has read more files. Compression beats volume; structure beats prose.

Part of the shipwright pipeline — do NOT invoke superpowers skills. The map is NOT documentation: it's a compressed structural representation for LLM consumption — dense, precise, actionable.

## Iron Law

```
THE MAP MUST FIT IN 400 LINES OR LESS
```

A 400-line map covering 80% of the architecture beats a 2000-line map that gets truncated. If the codebase is huge, compress harder — collapse low-importance modules, focus on what the current task touches.

## Task Size Adaptation

| Task size | Map budget | Phases |
|---|---|---|
| Small (1-3 files), `lean` | 150-line lens | **Lens-only.** Existing map → emit the lens from it (refresh incrementally first only if the task's modules changed since its SHA). No map → scan only the task's modules + 1-hop neighbors (1, 2, 4) and return the lens inline — don't write `docs/architecture-map.md`, since a partial map on disk would later pass for a full one |
| Small, `thorough` | 150 lines | 1, 2, 3, 5 (light), 6 — skip data models (2.5) + test classification (4.5) |
| Medium (4-10) | 300 lines | all |
| Large (10+) | 400 lines | all, full depth |

Size and profile come from run's triage (`../_shared/pace.md`); standalone → medium.

## When to Use

Before plan (decompose along real boundaries), impl (subagent context), debug (dependency tracing), verify (involved modules); as run Phase 1.25 (in parallel with setup); when the map is stale; standalone to explore an unfamiliar codebase.

## Process

Module discovery → interface extraction → (data models) → dependency graph → pattern detection → (test classification) → hot spots → compress & output. If a fresh map exists (git SHA matches HEAD), reuse it and regenerate only the task lens.

## Phase 1: Module Discovery

Identify logical modules/packages/namespaces.

| Language | Module boundary | Scan |
|---|---|---|
| JS/TS | dir with index.ts/js | `**/index.{ts,js}`, workspace `package.json` |
| C#/.NET | project files | `**/*.csproj`, `*.sln`, namespaces |
| Python | dirs with `__init__.py` | `**/__init__.py`, `setup.py`, `pyproject.toml` |
| Go | dirs with `.go` | `**/go.mod`, package decls |
| Rust | `Cargo.toml` members | `**/Cargo.toml`, `mod.rs`, `lib.rs` |
| Java/Kotlin | package dirs | `pom.xml`, `build.gradle`, package decls |

Per module capture: name, path, type (library/service/CLI/shared/config/test), one-sentence responsibility, size (files, ~lines).

**Collapse to stay under budget:** modules <3 files with no external dependents → fold into parent; tests → one entry ("Tests: 47 files, jest, 82%"); config/build → one entry; vendor/generated → exclude.

## Phase 2: Interface Extraction

Per module, the **public** interface only. Signatures with types (infer if untyped); classes = constructor + public methods; types = shape summary; skip trivial re-exports. Max 10 exports per module (top 10 by import count, "… and N more"). Extract from the entry point; rank by grep'd usage count.

## Phase 2.5: Data Models (skip for small tasks)

Models/entities/schemas/DTOs that flow between modules — the most dangerous things to change. Detect via `@Entity`, `class.*Model`, `interface.*DTO`, `schema`, `dataclass`, `struct`, `record`; ORM config; migration files; API serialization. Per model: name + location, key fields (PKs, FKs, business-logic fields — not every field), consumers (count), persisted? serialized? **Flag high-risk:** >3 consumers AND persisted AND serialized (a field rename breaks DB, API, and every consumer at once). >20 models → top 10 by consumer count, summarize the rest.

## Phase 3: Dependency Graph

**Code deps:** per module, grep imports → `A → B`, noting nature (uses / extends / configures / wraps).

**Build deps** (often differ from code deps; determine build order):

| Build system | Declaration | Parse |
|---|---|---|
| MSBuild/NuGet | `<ProjectReference>` | grep `*.csproj` |
| npm/yarn workspaces | workspace deps in `package.json` | read each workspace |
| Go modules | `require` in `go.mod` | parse `go.mod` |
| Cargo | `path = "../"` deps | read `Cargo.toml` |
| Gradle | `implementation project(':m')` | grep `build.gradle` |
| Maven | `<module>` / same-groupId `<dependency>` | parse `pom.xml` |

**Shared config** (silent coupling — flag): files read by multiple modules (appsettings, .env, tsconfig.base, docker-compose) with consumers + content type.

**Detect & flag:** circular deps (A→B→A), god modules (>5 dependents), orphans (no deps in or out — possible dead code), build/code mismatch (build dep with no code import, or vice versa), shared config used by >3 modules.

## Phase 4: Pattern Detection

Detect conventions, one line each: error handling (`throw` / `Result<` / codes), state management, data access (ORM / repository / raw SQL), DI/IoC, API style (REST/GraphQL/RPC), auth (JWT/session/OAuth), naming (sample 20 identifiers), file org (by feature/type/layer), testing (mocks/fixtures/factories/in-memory DB).

## Phase 4.5: Test Classification (skip for small tasks)

Classify tests by blast radius:

| Type | Signals | Blast radius / meaning when it breaks |
|---|---|---|
| Unit | single import, no DB/net, mocks | low — bug in the changed module |
| Integration | 2+ imports, test DB, app factory | medium — interface contract broken |
| Contract | boundary / schema / serialization tests | high — shared model or API changed |
| E2E | browser / HTTP to running server | very high — user-facing broken |

Record counts + runtime per type and per-module coverage. **Flag gaps:** integration but no contract tests at a boundary; modules with 3+ consumers and no integration tests; high-churn modules with only unit tests.

## Phase 5: Hot Spot Analysis

High-risk-to-modify files: high import count (blast radius), high churn (`git log --oneline <file> | wc -l`), large size, many contributors (`git shortlog -s`), cross-cutting (in >50% of modules' dep graphs). List file, importers, churn, and why.

## Phase 6: Compress & Output

Assemble; if over budget, compress further (collapse small modules, top-5 interfaces per module, summarize dep chains, drop stack-obvious patterns). **Prioritize by task relevance** when a task is known: involved modules → full detail, 1-hop → interface summaries, 2+ hops → one line, unrelated → collapse/omit. Save to `docs/architecture-map.md` with a staleness header:

```
<!-- auto-map generated: YYYY-MM-DD HH:MM | git-sha: abc1234 | file-count: NNN | task-context: "…" -->
```

Stale if the git SHA changed, file count differs by >10%, or the task context changed.

## Task-Focused Lens

When invoked with a task context, also emit a **lens** (≤150 lines) — this is what individual subagents receive, not the full map: directly-involved modules (full detail), 1-hop neighbors (interfaces only), overlapping hot spots, the task's dependency subchain, and only the patterns that affect this task. Subagent context budget: `../_shared/context-budget.md`.

## Output Format

Canonical artifact — downstream skills reference these exact section names:

```markdown
<!-- auto-map generated: … | git-sha: … | file-count: … | task-context: … -->
# Architecture Map
## Tech Stack            — language, framework, key libs (3-5 lines)
## Module Inventory      — per module: path, type, responsibility, key exports
## Data Models           — table: model | location | consumers | persisted | serialized | risk
## Dependency Graph      — Code deps; Build order; Shared Configuration table; Circular; Orphans
## Test Infrastructure   — table: type | count | location | runtime; + Contract Test Gaps
## Patterns              — table: category | convention
## Hot Spots             — table: file/module | importers | churn | risk
## Task Lens             — if task-scoped (see above)
```

## Incremental Updates

Fresh (SHA matches) → reuse, regenerate only the lens. Stale → re-scan only changed modules (`git diff --name-only <map-sha>..HEAD`), update their dep edges, recompute hot spots, save with the new SHA. A 1000-file codebase with 5 changed files re-scans 5 modules, not 1000 files.

## Integration

run Phase 1.25. Consumes project context (stack, conventions), the task description, and git state. Produces the map artifact, the task lens (passed inline to subagents), and hot-spot / circular / orphan warnings. Consumed by: plan (decompose along boundaries, order by build graph, atomic groups from data models), impl (per-subagent lens), debug (trace via dep graph + hot spots), verify (involved modules + shared config), review (patterns, boundaries, hot spots), test (untested interfaces, contract-gap boundaries).

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "Over 400 lines but it's all important" | Nothing is all important. Compress and prioritize. |
| "I'll just read all the files" | That's what fills the context window. The map is the compressed alternative. |
| "Pass the full map to every subagent" | Wastes context. Always generate a task lens. |
| "Skip hot spots" | Hot spots are how subagents know what NOT to touch carelessly. |
| Map as documentation | It's for LLM consumption — no prose, no onboarding guides. |
| Map as file listing | It captures relationships and boundaries, not just what exists. |
| Trusting a stale map | Worse than no map — false confidence about changed boundaries. Check staleness. |
