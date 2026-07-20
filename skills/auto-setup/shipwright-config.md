# .shipwright.json Configuration Reference

All implementor skills check for `.shipwright.json` in the project root. Every field is optional — sensible defaults apply when absent.

## Full Schema

```json
{
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
  "dotnetSkills": {
    "enabled": true,
    "installTool": true,
    "bundled": true,
    "refreshDays": 7,
    "only": [],
    "exclude": []
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

### Coverage

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
| `skipPhases` | string[] | [] | Phases to skip: `"e2e"`, `"loadTest"`, `"setup"`, `"dotnetSkills"` |

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
| `branch.autoMerge` | boolean | false | Auto-merge on success (vs offer choice) |

### .NET Skills

Dynamic use of managedcode/dotnet-skills in .NET projects (ignored in non-.NET projects). Env `SHIPWRIGHT_DOTNET_SKILLS=off` disables the whole feature regardless of these.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dotnetSkills.enabled` | boolean | true | Master switch for the .NET Skills feature |
| `dotnetSkills.installTool` | boolean | true | Allow `dotnet tool install --global dotnet-skills` when the CLI is missing |
| `dotnetSkills.bundled` | boolean | true | Use the CLI's offline catalog (false = fetch the latest catalog; needs network) |
| `dotnetSkills.refreshDays` | number | 7 | Injected index older than this is flagged stale |
| `dotnetSkills.only` | string[] | [] | If non-empty, restrict the injected index to these skill ids/names |
| `dotnetSkills.exclude` | string[] | [] | Drop these skill ids/names from the injected index |

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
| `auto-setup` | `setupCommand`, `buildCommand`, `testCommand`, `envFile` |
| `auto-test` | `testCommand`, `coverageCommand`, `coverage.*`, `refactorForTestability` |
| `auto-e2e` | `startCommand`, `e2eType`, `skipPhases` |
| `auto-review` | `reactDoctor.*` (React projects) |
| `production-readiness` | `coverage.*`, `loadTest.*`, `skipPhases` |
| `run` | `skipPhases`, `branch.*`, `dotnetSkills.*`, all (passes to sub-skills) |
| dotnet-skills hook + engine | `dotnetSkills.*` |
| react-doctor runner | `reactDoctor.*` |
