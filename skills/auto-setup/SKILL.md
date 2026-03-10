---
name: auto-setup
description: Use when a project needs dependency installation, environment configuration, or build setup before implementation or testing can begin
---

# Auto-Setup

Detect and execute environment setup: install dependencies, configure environment files, run database migrations, and verify the project builds and tests can run.

**Core principle:** A project that can't build can't be tested. A project that can't be tested can't be verified. Setup is the foundation.

<HARD-GATE>
This skill is part of the implementor pipeline. Do NOT invoke any superpowers orchestration skill. The implementor handles setup internally.
</HARD-GATE>

## Iron Law

```
NO IMPLEMENTATION UNTIL THE PROJECT BUILDS AND TESTS RUN
```

If the test suite can't execute (even if tests fail), setup is incomplete.

## When to Use

- After Phase 1 (Gather Context) in the `implementor:run` pipeline
- Before any implementation or testing begins
- When entering a new project for the first time

## Process

```dot
digraph auto_setup {
    rankdir=TB;
    "Detect package manager and language" [shape=box];
    "Install dependencies" [shape=box];
    "Configure environment" [shape=box];
    "Detect and run migrations" [shape=box];
    "Verify build" [shape=box];
    "Verify test suite runs" [shape=box];
    "Build works?" [shape=diamond];
    "Tests execute?" [shape=diamond];
    "Diagnose and fix" [shape=box];
    "Setup complete" [shape=doublecircle];

    "Detect package manager and language" -> "Install dependencies";
    "Install dependencies" -> "Configure environment";
    "Configure environment" -> "Detect and run migrations";
    "Detect and run migrations" -> "Verify build";
    "Verify build" -> "Build works?";
    "Build works?" -> "Verify test suite runs" [label="yes"];
    "Build works?" -> "Diagnose and fix" [label="no"];
    "Diagnose and fix" -> "Verify build";
    "Verify test suite runs" -> "Tests execute?";
    "Tests execute?" -> "Setup complete" [label="yes (pass or fail ok)"];
    "Tests execute?" -> "Diagnose and fix" [label="no (can't run at all)"];
}
```

### Phase 1: Dependency Installation

Detect and run the appropriate install command:

| Indicator | Package Manager | Install Command |
|-----------|----------------|-----------------|
| `package-lock.json` | npm | `npm ci` |
| `yarn.lock` | yarn | `yarn install --frozen-lockfile` |
| `pnpm-lock.yaml` | pnpm | `pnpm install --frozen-lockfile` |
| `bun.lockb` | bun | `bun install --frozen-lockfile` |
| `package.json` (no lock) | npm | `npm install` |
| `requirements.txt` | pip | `pip install -r requirements.txt` |
| `Pipfile.lock` | pipenv | `pipenv install` |
| `pyproject.toml` + `uv.lock` | uv | `uv sync` |
| `pyproject.toml` + `poetry.lock` | poetry | `poetry install` |
| `pyproject.toml` (no lock) | pip | `pip install -e .` |
| `go.mod` | go | `go mod download` |
| `Cargo.toml` | cargo | `cargo build` |
| `Gemfile.lock` | bundler | `bundle install` |
| `composer.lock` | composer | `composer install` |

**Priority:** If multiple indicators exist, use the most specific (lock file > manifest).

### Phase 2: Environment Configuration

1. Check for `.env.example`, `.env.template`, or `.env.sample`
2. If found and no `.env` exists, copy to `.env`
3. Check `.implementor.json` for custom environment setup commands
4. Look for `docker-compose.yml` — note required services but do NOT auto-start Docker (report as prerequisite)

### Phase 3: Database Migrations

Detect and run migrations if applicable:

| Framework | Detection | Migration Command |
|-----------|-----------|-------------------|
| Django | `manage.py` | `python manage.py migrate` |
| Rails | `db/migrate/` | `bundle exec rails db:migrate` |
| Laravel | `database/migrations/` | `php artisan migrate` |
| Prisma | `prisma/schema.prisma` | `npx prisma migrate dev` |
| Drizzle | `drizzle.config.*` | `npx drizzle-kit migrate` |
| Knex | `knexfile.*` | `npx knex migrate:latest` |
| Alembic | `alembic.ini` | `alembic upgrade head` |
| Flyway | `flyway.conf` | `flyway migrate` |

**Only run if a local database is detected** (SQLite file, or connection string pointing to localhost). Skip if database requires external service not running.

### Phase 4: Build Verification

Run the build command:

| Stack | Build Command |
|-------|---------------|
| Node.js (with build script) | `npm run build` |
| TypeScript (no build script) | `npx tsc --noEmit` |
| Go | `go build ./...` |
| Rust | `cargo build` |
| Python | `python -m py_compile [main files]` |

If no explicit build step, verify the entry point imports cleanly.

### Phase 5: Test Suite Verification

Run the test suite once to verify it executes:

```bash
[detected test command from Phase 1 context or .implementor.json]
```

**Success criteria:** The test runner starts and completes (tests may pass or fail — we just need the suite to execute). If the runner can't start (missing dependencies, import errors, config issues), setup is incomplete.

## Reading .implementor.json

If `.implementor.json` exists in the project root, read these fields:

- `setupCommand`: Custom setup command to run after dependency installation
- `testCommand`: Override for the test command
- `buildCommand`: Override for the build command
- `startCommand`: Override for the app start command
- `envFile`: Custom env file name (default: `.env`)

## Red Flags - STOP

| Thought | Reality |
|---------|---------|
| "Dependencies are probably installed" | Verify. Don't assume. Run the install. |
| "I'll skip the build check" | A project that doesn't build can't be tested. |
| "Tests fail, setup must be broken" | Failing tests are fine. Tests that can't RUN are not. |
| "Docker services are needed, I'll start them" | Never auto-start Docker. Report as prerequisite. |
| "I'll install globally" | Never install globally. Use project-local installs only. |
