# Shipwright

Autonomous development pipeline for Claude Code. Give it a task, get production-grade code back — with planning, implementation, unit tests, E2E tests, code review, systematic debugging, and production readiness verification. Zero interaction required.

## Installation

```
/plugin marketplace add hybriden/shipwright
/plugin install shipwright@hybriden-shipwright
```

## Usage

Invoke the master orchestrator with any development task:

```
/shipwright:run
```

Then describe your task. The system handles everything autonomously:

1. **Branch Isolation** — Creates `shipwright/<task>` feature branch
2. **Setup** — Installs dependencies (skipped when already current), configures environment, verifies build — in parallel with architecture mapping
3. **Plan** — Scans codebase, detects tech stack, decomposes task into ordered steps
4. **Implement** — Dispatches fresh subagent per task with TDD enforcement
5. **Unit Test** — Verifies coverage of the changed code (80%+ line and branch), fills gaps
6. **Code Review** — Focused reviewers in parallel (spec compliance, fidelity, architecture, quality), spec fixes first
7. **E2E Test** — Browser testing (Playwright), API testing, or CLI testing on the reviewed code, depending on app type
8. **Production Readiness** — 11-gate verification including load testing, security, and error handling

A **Stack Skills** step (between Setup and Plan) fetches project-matched expert skills on demand — .NET, Cloudflare, Vercel, AWS, Oxc, plus user-approved picks from a skill library — see [Stack Skills](#stack-skills) below.

Any failure at any phase triggers **auto-debug** automatically — no manual intervention needed.

Progress updates throughout:
```
[shipwright] Phase 3/9: Implementing task 2/5 — AuthService
[shipwright] Phase 4/9: Testing (coverage: 62% -> 84%)
[shipwright] COMPLETE: All gates passed. Branch: shipwright/add-user-auth
```

## Pace

Shipwright spends verification where it can still change the outcome — gates never get skipped, only their depth and timing scale (`skills/_shared/pace.md`):

- **Evidence reuse** — every build/test/coverage result is recorded against its commit; nothing re-runs on an unchanged commit.
- **Size tiers** — the task is triaged Small/Medium/Large before mapping; depth scales with the tier.
- **Affected tests in loops** — implementation tasks, test-writers, debug fixes, and review fixes run the tests their change can reach; the full suite runs at phase boundaries.
- **Diff-aware gates** — coverage gates the changed lines; load tests and responsive/a11y sweeps run when the diff reaches the request path or changed UI.
- **Parallel review** — spec and quality reviewers run concurrently with the other review lenses; fixes are batched per round.
- **Debug fast path** — a compile/type/import error at a line the current step wrote gets a direct fix; everything else gets full root-cause analysis.

Set `"profile": "thorough"` in `.shipwright.json` to turn the trade-off levers off: full suite at every task gate, a map even for small tasks, load test on every web/API change, and the full debug process for every failure.

## Auto-Debug

The debugger is integrated into every pipeline phase and can also be used standalone on any project:

```
/shipwright:auto-debug
```

### How It Works

Auto-debug follows a rigorous process — no guessing, no shotgun fixes:

1. **Triage** — Classifies the error type, checks recent `git diff` to narrow scope, and cascade-analyzes multiple errors to find the root one
2. **Project Tool Discovery** — Scans for the project's own CLIs, validators, scripts, and build targets to use them for verification later
3. **Reproduce** — Runs the exact failing command, captures full output, confirms consistency
4. **Isolate** — Traces the stack to the originating file/function/line, uses log injection or git bisect when needed
5. **Root Cause** — Applies the Five Whys technique (minimum 3 levels deep) to find the actual cause, not the symptom
6. **Hypothesize** — States the hypothesis, predicts the outcome, and considers side effects before writing any fix
7. **Fix** — Applies the minimal change that addresses the root cause
8. **Prove** — Every fix must be proven through multiple verification layers (see below)
9. **Cleanup** — Removes all debug artifacts (injected logs, bisect state, temp files)

Under the default `lean` profile, a mechanical error — compile, type, import, syntax, or lint, at a line the current step changed — takes a one-attempt fast path: a real fix — never a cast or ignore pragma — then a re-run of the failing command and affected tests. Anything else, or a fast fix that doesn't hold, runs the full process.

### Fix Verification (Mandatory)

Every fix is proven through up to three layers:

| Layer | What | When |
|-------|------|------|
| Regression unit test | Must FAIL without fix, PASS with fix | Always |
| Project tool verification | Run the project's own CLI/validators on real input | When project has tools |
| Runtime verification | Playwright (web), HTTP requests (API), shell (CLI) | When app is runnable |
| Broader impact | Run tests for all consumers of changed code | When fix touches shared code |

### Advanced Techniques

Auto-debug includes specialized strategies for hard-to-diagnose issues:

- **Error pattern recognition** — Auto-classifies 17 error categories with fast-path strategies
- **Diff-based narrowing** — Cross-references `git diff` with stack traces to eliminate 80% of investigation
- **Git bisect** — Binary search through commits to find the exact regression-introducing change
- **Log injection** — Strategic `[DEBUG:auto-debug]` prefixed logging with mandatory cleanup
- **Cascade analysis** — When multiple errors exist, finds and fixes the root error first
- **Concurrency debugging** — Race conditions, flaky tests, shared state, missing `await`
- **Timeout/hang debugging** — Unresolved promises, infinite loops, blocked I/O, open handles
- **Dependency conflict resolution** — Peer dep mismatches, CJS/ESM conflicts, lock file drift
- **Environment fingerprinting** — Captures runtime versions, env vars, and OS info to diagnose cross-environment issues
- **Error message decoding** — Maps misleading error messages to their actual causes

## Configuration

Create `.shipwright.json` in your project root to customize behavior. All fields are optional:

```json
{
  "profile": "lean",
  "coverage": { "line": 80, "branch": 80 },
  "skipPhases": ["e2e"],
  "testCommand": "npm test",
  "coverageCommand": "npx vitest run --coverage",
  "startCommand": "npm start",
  "loadTest": { "users": 100, "duration": "60s", "p99": 500 },
  "e2eType": "auto",
  "branch": { "prefix": "shipwright", "autoMerge": false },
  "dotnetSkills": { "enabled": true, "installTool": true },
  "reactDoctor": { "enabled": true, "scope": "changed" }
}
```

See `skills/auto-setup/shipwright-config.md` for the full reference.

## Skills

Each skill is independently usable:

| Skill | Purpose |
|-------|---------|
| `shipwright:run` | Master orchestrator — full pipeline |
| `shipwright:auto-setup` | Environment and dependency setup |
| `shipwright:auto-plan` | Autonomous task planning |
| `shipwright:auto-impl` | Subagent-driven implementation |
| `shipwright:auto-test` | Unit and integration test coverage |
| `shipwright:auto-e2e` | End-to-end user testing |
| `shipwright:auto-review` | Multi-lens code review — focused reviewers in parallel, spec fixes first |
| `shipwright:auto-debug` | Systematic root cause analysis with proven fixes |
| `shipwright:production-readiness` | Final verification gate |
| `shipwright:harness` | Agent Team & Skill Architect — generates project-specific agent teams |
| `shipwright:auto-minimize` | Minimalism — build the leanest solution that works, hunt over-engineering |
| `shipwright:auto-eval` | Outer evaluation loop — score runs from their artifacts, feed weaknesses back into planning |

## Design Principles

Shipwright holds the code it writes and reviews to a coherent set of software-design principles. Each is defined **once** in `skills/_shared/` and applied automatically across planning, implementation, and review — no configuration, no opt-in.

| Principle | Defined in | Governs | In one line |
|-----------|-----------|---------|-------------|
| **Minimalism** (lazy senior dev) | `_shared/minimalism.md` | *amount* of code | The best code is code never written — reuse → stdlib → native → one line → only then write. Adapted from [ponytail](https://github.com/DietrichGebert/ponytail) (MIT). |
| **SOLID** | `_shared/solid.md` | *structure* | SRP/LSP always hold; OCP/ISP/DIP earn their abstraction only at a real seam or a second concrete case. |
| **DRY** | `_shared/dry-kiss.md` | *single source of truth* | One home per piece of knowledge — but never merge coincidental look-alikes (rule of three). |
| **KISS** | `_shared/dry-kiss.md` | *clarity* | The simplest solution that fully works; boring over clever, optimized for the next reader. |
| **Comments** | `_shared/comments.md` | *self-documentation* | Code explains itself through names and structure; a comment earns its place only by stating what code cannot — a non-obvious why, constraint, or footgun. Delete-test everything else. |
| **Modern idiom** | `_shared/modern-idiom.md` | *expression* | The least code a fluent reader of the language's current version would call idiomatic — current features over legacy patterns and hand-rolled versions, bounded by the project's toolchain version. |

**They're reconciled, not just stacked.** The principles pull in different directions, so each defers explicitly where they collide:

- **Abstraction is earned, never speculative.** SOLID, DRY, and minimalism share one test — extract an abstraction at a real I/O seam or on the second/third concrete case, not for a hypothetical future. A wrong abstraction costs more than a little duplication.
- **Clarity beats terseness.** When KISS (most obvious) and minimalism (least code) conflict, clarity wins — a cryptic one-liner fails KISS. The modern idiom usually dissolves the tension: today's language features say the same thing in less code *and* more clearly.
- **Safety is never cut.** Input validation at trust boundaries, data-loss handling, security, accessibility, and understanding the problem are never simplified away.
- **Deviations are declared, never hidden.** When a principle knowingly can't be upheld, the spot is marked with a `ponytail:` comment (which law, why, upgrade path) and the run report's **Principle Deviations** section surfaces every marker to the operator.

**Where they run:** threaded into `auto-plan` (design), the implementer subagent (build), and `auto-review` (verify — including a dedicated over-engineering lens). Invoke `shipwright:auto-minimize` to apply them on demand outside a full run.

**Always on:** installing the plugin registers a session hook (`hooks/`) that injects a distilled "Code Laws" reminder at the start of every session and subagent — so the principles apply to *all* coding, not only inside the pipeline. Opt out with `SHIPWRIGHT_CODE_LAWS=off`.

*Other `_shared/` references* are operational rather than design: architecture-map consumption, net-positive/anti-regression gate, the **iteration loop contract** (`_shared/loop.md` — the shared anatomy every auto-debug/impl/review/verify loop instantiates: State / Step / Gate / Progress+stall / Termination), evidence-evaluation gate, runtime probing by app type (`_shared/runtime-probing.md`), project-tool discovery (`_shared/project-tools.md`), model selection (`_shared/model-selection.md`), subagent context budget, and pipeline checkpoints.

## Self-Evaluation Loop

Every inner loop makes a single *run* correct. The **outer** loop (`shipwright:auto-eval`) makes the *pipeline* better over time. It runs Shipwright against a task suite, scores each run **from the evidence the pipeline already emits** — gate table, Pipeline Quality reflection, E2E evidence verdicts, plan retrospective — and feeds systematic, cross-run weaknesses back into `.shipwright-retrospective.md`, which `auto-plan` reads on the next run.

- **Score from artifacts, never re-derive.** Five dimensions (Outcome, Honesty, Evidence, Efficiency, Plan fidelity), 0–2 each; a dimension with no artifact scores 0 and flags a pipeline *observability gap*.
- **Only signal feeds back.** One run's stumble is noise; a weakness that recurs across ≥2 runs is a durable, actionable signal — nothing else is written back.
- **It is itself a `loop.md` loop** at the meta level (State = scorecard, Gate = the pipeline must stay net-positive across a change), and its **meta-gate** applies `net-positive-gate.md` to Shipwright itself: a change to the pipeline ships only if the suite aggregate rises with no dimension regressing.
- **Two modes:** `score` (cheap, default — grade completed runs) and `loop` (heavyweight — run the suite end-to-end; warns before launching N full pipelines). Zero-config defaults to scoring the latest run; tune via `.shipwright.json` `eval`.

## Stack Skills

Shipwright pulls in expert skills for the stack and platforms a project uses — **fetched on demand, never vendored**. Skill bodies stay in an out-of-repo cache (`~/.claude/.shipwright/`), written by each publisher's official tooling and refreshed from upstream; Shipwright injects only a compact index, and agents Read the one relevant `SKILL.md` when a task needs it. `shipwright:run` acquires them in its **Stack Skills** phase (between Setup and Plan). Protocol: `skills/_shared/stack-skills.md`.

| Source | Skills | Loaded when |
|---|---|---|
| [managedcode/dotnet-skills](https://github.com/managedcode/dotnet-skills) | EF Core, ASP.NET Core, xUnit, Aspire, DI, … (official `dotnet-skills` CLI) | .NET markers (`*.csproj`, `*.sln`, `global.json`, `Directory.*.props`) |
| [cloudflare/skills](https://github.com/cloudflare/skills) | Workers, Wrangler, Durable Objects, Agents SDK, Sandbox, … | `wrangler.*`, `@cloudflare/*`, `agents`, Cloudflare Terraform |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React/Next.js performance and composition, view transitions, web design guidelines, Vercel deploys | React/Next/Vue/Svelte/Astro/Angular deps, `vercel.json` |
| [aws/agent-toolkit-for-aws](https://github.com/aws/agent-toolkit-for-aws) | CDK, CloudFormation, serverless, SDK usage, DynamoDB, S3, IAM, … (~100 skills; only the matched ones are indexed) | `cdk.json`, SAM/Serverless configs, `@aws-sdk/*`, boto3, AWS Terraform |
| [oxc-project/oxc](https://github.com/oxc-project/oxc) | `migrate-oxlint`, `migrate-oxfmt` | ESLint or Prettier installed |

**How it works**

1. **Near-zero-cost gate.** Session/subagent hooks match sources with a bounded filesystem scan — no process spawns (~50 ms). Repos with no match get nothing indexed.
2. **Acquire.** The Stack Skills phase fetches the matched sources: the `dotnet-skills` CLI for .NET, and the [vercel-labs/skills](https://github.com/vercel-labs/skills) CLI (`npx skills add`, telemetry off) for the packs — run *inside* the cache, so nothing lands in your repo or `~/.claude/skills`. A task that targets a platform the repo doesn't show yet adds its pack with `--pack <id>`.
3. **Inject + consume.** `[dotnet-skills]` and `[skill-packs]` indexes list the matched skills; plan, implement, test, and review Read the relevant one on demand.

**Skill library — ask first.** When a task builds something no source covers (payments, auth, a database, a test framework, …), Shipwright searches the [skillselion.com](https://skillselion.com/skills) catalog and asks — once, before planning — whether to install the candidates that pass its quality gate: official publishers with ≥1k installs, or community skills with ≥10k installs, ≥1k stars, and a passing audit. Anything with a failed audit, HIGH/CRITICAL risk, a duplicate marker, or a repo unpushed for 180+ days is dropped.

**Requires** the .NET SDK (dotnet-skills) or Node/`npx` (packs, library). **Opt out** with `SHIPWRIGHT_DOTNET_SKILLS=off` / `SHIPWRIGHT_SKILL_PACKS=off`, `.shipwright.json` `dotnetSkills.enabled` / `skillPacks.enabled: false`, `skillPacks.library: false`, or `skipPhases: ["stackSkills"]`. See the [config reference](skills/auto-setup/shipwright-config.md).

## JS Toolchain (Oxlint + Oxfmt)

In JavaScript/TypeScript projects Shipwright prefers [Oxlint](https://oxc.rs/docs/guide/usage/linter) and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) to ESLint and Prettier for speed — **after checking compatibility with evidence**. `hooks/js/oxc-compat.js` runs the official migrators (`@oxlint/migrate --details`, `oxfmt --migrate=prettier`), runs Oxlint on the migrated config, and compares ESLint's findings and Prettier's output with Oxlint's and Oxfmt's on your codebase — leaving the project unchanged.

- **Verdicts:** COMPATIBLE (every rule migrates and no finding is missed / identical formatting), PARTIAL (lists skipped rules, missed findings, unsupported plugins, drift files), NEEDS_FLAT_CONFIG, plus ADOPTED / COEXISTING / GREENFIELD / NOT_APPLICABLE (Biome).
- **Policy:** new lint/format setups use Oxlint + Oxfmt; an existing ESLint/Prettier setup switches only when a task asks for it — otherwise the verdict goes into the run report's Recommendations. Migrations follow Oxc's own `migrate-oxlint` / `migrate-oxfmt` skills. Details: `skills/_shared/js-toolchain.md`.
- **Opt out** with `.shipwright.json` `oxc.enabled: false`; `oxc.parity: false` skips the ESLint/Prettier comparison on very large repos.

## React Health (verify gate)

In **React projects only**, `auto-review` runs [react-doctor](https://github.com/millionco/react-doctor) (Modified-MIT, by the Million.js team) as a **deterministic verify gate over the diff** — a different model than the .NET integration: not injected guidance, but a scanner whose concrete findings become review issues.

- **Diff-scoped & local-only.** Runs `npx react-doctor --json --no-score --no-telemetry --scope changed --base <branch>` — it judges only the change under review (not pre-existing debt) and **never phones home** (react-doctor calls a score/share API by default; Shipwright always disables it).
- **Evidence, not prose.** `error`-severity findings (missing effect cleanup, `<img>` without alt, direct state mutation, index-as-key, stale effect deps, setState-in-render, …) are routed to the implementer to fix, then re-scanned under the anti-regression gate. Warnings are fixed when clearly correct, noted otherwise.
- **No vendoring.** react-doctor is fetched transiently via `npx`; nothing is copied in. Canonical runner: `hooks/react/react-doctor.js`; protocol: `skills/_shared/react-doctor.md`.

**Requires** Node/`npx`. Its security coverage is thin (it won't catch every XSS), so it augments — not replaces — the other review stages. **Opt out** with `.shipwright.json` `reactDoctor.enabled: false`; tune `scope` / `blocking` / `categories` there too.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Playwright plugin (for web E2E testing): `playwright@claude-plugins-official`

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT
