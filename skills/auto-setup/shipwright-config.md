# .shipwright.json Configuration Reference

All implementor skills check for `.shipwright.json` in the project root. Every field is optional — sensible defaults apply when absent.

## Full Schema

```json
{
  "profile": "lean",
  "coverage": {
    "line": 80,
    "branch": 80,
    "function": 90
  },
  "skipPhases": [],
  "testCommand": "npm test",
  "coverageCommand": "npx vitest run --coverage",
  "buildCommand": "npm run build",
  "startCommand": "npm start",
  "setupCommand": "npm run db:seed",
  "envFile": ".env",
  "loadTest": {
    "enabled": true,
    "users": 100,
    "duration": "60s",
    "p99": 500,
    "errorRate": 0.01
  },
  "refactorForTestability": false,
  "e2eType": "auto",
  "branch": {
    "prefix": "implementor",
    "autoMerge": false
  },
  "delivery": {
    "pr": true,
    "ciFixRounds": 3,
    "ciTimeoutMinutes": 60
  },
  "queue": {
    "label": "shipwright",
    "maxIssues": 1,
    "incidents": true
  },
  "dotnetSkills": {
    "enabled": true,
    "installTool": true,
    "bundled": true,
    "refreshDays": 7,
    "only": [],
    "exclude": []
  },
  "skillPacks": {
    "enabled": true,
    "include": [],
    "exclude": [],
    "library": true,
    "refreshDays": 7,
    "cliVersion": "latest"
  },
  "oxc": {
    "enabled": true,
    "parity": true,
    "oxlintVersion": "latest",
    "oxfmtVersion": "latest"
  },
  "reactDoctor": {
    "enabled": true,
    "scope": "changed",
    "blocking": "error",
    "categories": [],
    "version": "latest",
    "maxWarnings": 40
  }
}
```

## Field Reference

### Profile

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `profile` | string | `"lean"` | `"lean"`: size-tiered depth, affected tests at in-loop gates, diff-triggered load test + E2E sweeps, auto-debug fast path for mechanical errors. `"thorough"`: turns those four off. Evidence reuse, changed-code coverage, and parallel review apply to both. See `_shared/pace.md` |

### Coverage

In a pipeline run, targets gate the changed lines, not the project total.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `coverage.line` | number | 80 | Minimum line coverage % |
| `coverage.branch` | number | 80 | Minimum branch coverage % |
| `coverage.function` | number | 90 | Minimum function coverage % |

### Commands

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `testCommand` | string | auto-detect | Command to run tests |
| `coverageCommand` | string | auto-detect | Command to run tests with coverage |
| `buildCommand` | string | auto-detect | Command to build the project |
| `startCommand` | string | auto-detect | Command to start the app (for E2E) |
| `setupCommand` | string | none | Extra setup command after dependency install |
| `envFile` | string | `.env` | Environment file name |

### Phases

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `skipPhases` | string[] | [] | Phases to skip: `"e2e"`, `"loadTest"`, `"setup"`, `"stackSkills"` (`"dotnetSkills"` still accepted), `"deliver"` |

Only these phases can be skipped. Plan, implement, test, review, and production-readiness cannot be skipped.

### Load Testing

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `loadTest.enabled` | boolean | true (for servers) | Whether to run load tests |
| `loadTest.users` | number | 100 | Virtual users |
| `loadTest.duration` | string | `"60s"` | Test duration |
| `loadTest.p99` | number | 500 | Max p99 latency in ms |
| `loadTest.errorRate` | number | 0.01 | Max error rate (0-1) |

### Testing

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `refactorForTestability` | boolean | false | Allow auto-test to refactor production code for testability (visibility changes, extract pure functions, add mocking libs) |

### E2E

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `e2eType` | string | `"auto"` | Force app type: `"web"`, `"api"`, `"cli"`, `"library"`, `"auto"` |

### Branch

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `branch.prefix` | string | `"implementor"` | Feature branch prefix |
| `branch.autoMerge` | boolean | false | Merge on success — with delivery, only after CI is green (`gh pr merge --squash`); without it, a local merge instead of the merge/keep/discard offer |

### Delivery

Push the branch, open a PR carrying the implementation report, watch CI, and fix CI failures (`skills/auto-deliver`). Needs `gh` authenticated and a GitHub `origin`; without them delivery is skipped and the run completes locally.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `delivery.pr` | boolean | true | Push and open a PR at the end of a run (draft when readiness is PARTIAL) |
| `delivery.ciFixRounds` | number | 3 | CI failure → fix → re-watch rounds before reporting CI_RED |
| `delivery.ciTimeoutMinutes` | number | 60 | Stop watching checks still pending after this long and report them |

### Queue

`shipwright:run --queue` drains GitHub issues instead of taking a typed task (`skills/run` Queue Mode). Needs `gh` authenticated, a GitHub `origin`, and delivery on.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `queue.label` | string | `"shipwright"` | Issues with this label are the queue — taken only when someone with write access applied it |
| `queue.maxIssues` | number | 1 | Issues run per invocation; repeat with `/loop` or `/schedule` |
| `queue.incidents` | boolean | true | File red CI on the default branch as `shipwright:incident` issues, run first |

### .NET Skills

Dynamic use of managedcode/dotnet-skills in .NET projects (ignored in non-.NET projects) — one of the stack-skills sources (`_shared/stack-skills.md`). Env `SHIPWRIGHT_DOTNET_SKILLS=off` disables it regardless of these.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dotnetSkills.enabled` | boolean | true | Master switch for .NET skills |
| `dotnetSkills.installTool` | boolean | true | Allow `dotnet tool install --global dotnet-skills` when the CLI is missing |
| `dotnetSkills.bundled` | boolean | true | Use the CLI's offline catalog (false = fetch the latest catalog; needs network) |
| `dotnetSkills.refreshDays` | number | 7 | Injected index older than this is flagged stale |
| `dotnetSkills.only` | string[] | [] | If non-empty, restrict the injected index to these skill ids/names |
| `dotnetSkills.exclude` | string[] | [] | Drop these skill ids/names from the injected index |

### Skill Packs & Library

Skills published by each platform's maintainers, fetched with the vercel-labs/skills CLI into an out-of-repo cache when a project needs them and screened by catalog risk, plus user-approved picks from the skillselion.com catalog. See `_shared/stack-skills.md` for the pack list. Env `SHIPWRIGHT_SKILL_PACKS=off` disables both regardless of these.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `skillPacks.enabled` | boolean | true | Master switch for packs and the library |
| `skillPacks.include` | string[] | [] | Pack ids to load even without repo signals: `cloudflare`, `vercel`, `nextjs`, `react-router`, `vite`, `astro`, `hono`, `aws`, `azure`, `aspire`, `supabase`, `prisma`, `neon`, `firebase`, `clerk`, `stripe`, `expo`, `oxc` |
| `skillPacks.exclude` | string[] | [] | Pack ids or skill names never to load or index |
| `skillPacks.library` | boolean | true | Offer gated skill-library candidates (always asks the user before installing) |
| `skillPacks.refreshDays` | number | 7 | `acquire` re-fetches packs and library skills older than this |
| `skillPacks.cliVersion` | string | `"latest"` | vercel-labs/skills CLI version run via npx (pin for reproducibility) |

### Oxc (Oxlint/Oxfmt check)

Compatibility check before preferring Oxlint/Oxfmt to ESLint/Prettier in JS/TS projects. See `_shared/js-toolchain.md`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `oxc.enabled` | boolean | true | Master switch for the check and the Oxlint/Oxfmt preference |
| `oxc.parity` | boolean | true | Also run ESLint/Prettier and compare findings/output with Oxlint/Oxfmt (turn off on very large repos) |
| `oxc.oxlintVersion` | string | `"latest"` | oxlint + @oxlint/migrate version run via npx |
| `oxc.oxfmtVersion` | string | `"latest"` | oxfmt version run via npx |

### React Doctor

Deterministic react-doctor verify gate in React projects (ignored elsewhere). Runs local-only (never phones home). See `_shared/react-doctor.md`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `reactDoctor.enabled` | boolean | true | Master switch for the React verify gate |
| `reactDoctor.scope` | string | `"changed"` | `"changed"` (diff vs base) or `"full"` (whole project) |
| `reactDoctor.base` | string | auto | Git ref for changed-scope; omit to auto-detect |
| `reactDoctor.blocking` | string | `"error"` | Severity that trips non-zero exit: `"error"`, `"warning"`, `"none"` |
| `reactDoctor.categories` | string[] | [] | Limit to these categories (e.g. `["Bugs","Accessibility"]`); [] = all |
| `reactDoctor.version` | string | `"latest"` | react-doctor version to run via npx (pin for reproducibility) |
| `reactDoctor.maxWarnings` | number | 40 | Cap warnings in the rendered block (errors are never capped) |

## Which Skills Read Config

| Skill | Fields Used |
|-------|------------|
| `auto-setup` | `setupCommand`, `buildCommand`, `testCommand`, `envFile`, `oxc.*` (via the check) |
| `auto-test` | `testCommand`, `coverageCommand`, `coverage.*`, `refactorForTestability` |
| `auto-e2e` | `startCommand`, `e2eType`, `skipPhases`, `profile` |
| `auto-review` | `reactDoctor.*` (React projects) |
| `production-readiness` | `coverage.*`, `loadTest.*`, `skipPhases`, `profile` |
| `auto-deliver` | `delivery.*`, `branch.autoMerge`, `skipPhases` |
| `auto-map`, `auto-impl`, `auto-debug` | `profile` (passed by run) |
| `run` | `profile`, `skipPhases`, `branch.*`, `queue.*`, `dotnetSkills.*`, `skillPacks.*`, all (passes to sub-skills) |
| dotnet-skills hook + engine | `dotnetSkills.*` |
| skill-packs hook, engine, library | `skillPacks.*` |
| oxc-compat check | `oxc.*` |
| react-doctor runner | `reactDoctor.*` |
