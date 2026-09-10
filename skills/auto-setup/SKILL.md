---
name: auto-setup
description: "Use when a project needs dependency installation, environment configuration, or build setup. Triggers on: 'set up the project', 'install dependencies', 'configure environment', 'set up env', 'project won't build', 'can't run tests', 'npm install', 'pip install', 'setup', 'bootstrap', 'initialize project'. Also triggers on: 'reinstall', 're-setup', 'fix the build', 'fix dependencies'. Use before any implementation or testing begins."
---

# Auto-Setup

Detect and execute environment setup: install dependencies, configure environment files, run database migrations, and verify the project builds and tests can run.

**Core principle:** A project that can't build can't be tested; a project that can't be tested can't be verified. Setup is the foundation.

Part of the shipwright pipeline — do NOT invoke superpowers skills. Leaf skill (invokes nothing).

## Iron Law

```
NO IMPLEMENTATION UNTIL THE PROJECT BUILDS AND TESTS RUN
```

If the test suite can't execute (even if tests fail), setup is incomplete.

## When to Use

run Phase 1.5; before any implementation or testing; when entering a new project.

## Phase 1: Dependency Installation

Most specific indicator wins (lock file > manifest):

| Indicator | Command |
|---|---|
| package-lock.json | `npm ci` |
| yarn.lock | `yarn install --frozen-lockfile` |
| pnpm-lock.yaml | `pnpm install --frozen-lockfile` |
| bun.lockb | `bun install --frozen-lockfile` |
| package.json (no lock) | `npm install` |
| requirements.txt | `pip install -r requirements.txt` |
| Pipfile.lock | `pipenv install` |
| pyproject.toml + uv.lock | `uv sync` |
| pyproject.toml + poetry.lock | `poetry install` |
| pyproject.toml (no lock) | `pip install -e .` |
| go.mod | `go mod download` |
| Cargo.toml | `cargo build` |
| Gemfile.lock | `bundle install` |
| composer.lock | `composer install` |

**Skip when current:** if the dependency directory exists, is newer than the lockfile, and the installed check passes (`npm ls --depth=0` / `pip check` / `go mod verify` / `bundle check`), don't reinstall — `npm ci` and its peers wipe and rebuild, usually setup's slowest step.

## Phase 2: Environment Configuration

Copy `.env.example` / `.env.template` / `.env.sample` → `.env` if none exists. Check `.shipwright.json` for custom setup commands. Note `docker-compose.yml` services as prerequisites — do NOT auto-start Docker.

## Phase 3: Database Migrations

Only if a local DB is detected (SQLite file, or a localhost connection string); skip if it needs an external service that isn't running.

| Framework | Detect | Command |
|---|---|---|
| Django | manage.py | `python manage.py migrate` |
| Rails | db/migrate/ | `rails db:migrate` |
| Laravel | database/migrations/ | `php artisan migrate` |
| Prisma | prisma/schema.prisma | `npx prisma migrate dev` |
| Drizzle | drizzle.config.* | `npx drizzle-kit migrate` |
| Knex | knexfile.* | `npx knex migrate:latest` |
| Alembic | alembic.ini | `alembic upgrade head` |
| Flyway | flyway.conf | `flyway migrate` |

## Phase 4: Build Verification

Node (build script) `npm run build`; TS (no script) `npx tsc --noEmit`; Go `go build ./...`; Rust `cargo build`; Python `python -m py_compile [main files]`. No build step → verify the entry point imports cleanly. Record the result in the evidence ledger (`../_shared/pace.md`).

## Phase 5: Test Suite Verification

Run the test command once, capturing per-test results and duration — the pipeline's first ledger entry: task 1's baseline and the fast-suite check (`../_shared/pace.md`). Success = the runner starts and completes (tests may pass or fail). If it can't start (missing deps, import errors, config), setup is incomplete → diagnose and fix, then re-verify.

## Phase 6: Task-Aware Pre-Flight (skip if no task description)

Verify readiness for the *specific* task, not just a generic build. From the task/plan, confirm what it needs is present: new external APIs → keys/env vars; DB changes → migration tools + DB access; file processing (PDF/image/CSV) → native deps (wkhtmltopdf, sharp, Pillow, imagemagick); email → SMTP/test mail; browser automation → Playwright browsers; framework features → version supports them. Also: do the imports the plan will use exist in installed packages? Output a verdict per requirement (READY / MISSING + action). MISSING → install now; if it needs system packages that can't be auto-installed, report as a prerequisite.

**JS/TS lint & format:** when ESLint or Prettier is installed, run the Oxc compatibility check once dependencies are in (the `[oxc]` line of the `[skill-packs]` block has the command; policy in `../_shared/js-toolchain.md`) and record the verdict (→ plan, readiness). It leaves the project unchanged.

## Phase 7: Environment Fingerprint

Capture for downstream debugging: runtime versions, package-manager versions, OS, and key non-secret env vars (NODE_ENV, CI). Store it in the setup report — auto-debug uses it to distinguish code bugs from env bugs ("worked in setup, fails now" = code, not setup).

## .shipwright.json

Reads: `setupCommand`, `testCommand`, `buildCommand`, `startCommand`, `envFile`.

## Integration

run Phase 1.5, in parallel with auto-map; leaf skill. Produces the env fingerprint (→ debug), pre-flight findings (→ plan), detected test/build/start commands (→ impl), and the first ledger entries — build + suite results with duration (→ impl, test, debug), and the Oxc verdict for JS/TS (→ plan, readiness). The pipeline aborts if setup fails (build broken or tests can't execute).

## Red Flags & Anti-Patterns — STOP

| Thought / behavior | Reality |
|---|---|
| "Dependencies are probably installed" | Verify with the installed-vs-lockfile check; install on any mismatch. |
| "Tests fail, setup must be broken" | Failing tests are fine; tests that can't RUN are not. |
| "Docker services are needed, I'll start them" | Never auto-start Docker. Report as a prerequisite. |
| "The task needs no special deps" | Read the task — image processing needs native libs, PDF needs renderers. Check. |
| Global installs (`npm i -g`, `pip --user`) | Project-local only; don't pollute the system. |
| Setup writes code or workarounds | Setup installs + verifies; it reports missing features, it doesn't implement them. |
| Installing dev tools/linters "just in case" | Install what the task needs, nothing more. |
