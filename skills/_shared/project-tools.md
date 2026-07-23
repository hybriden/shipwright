# Project Tool Discovery

Shared reference for skills that verify real behavior through a project's own tooling: **auto-debug** (Phase 0, mandatory) and **auto-verify** (Phase 0 context). A project's own CLIs, validators, and scripts verify behavior that generic test commands can't — find them first, use them throughout.

## Scan these locations (build the inventory once, reuse throughout)

- `tools/` · `scripts/` · `bin/` · `cli/`
- `package.json` scripts (`build`, `lint`, `validate`, `check`, `migrate`)
- `Makefile` · `Taskfile` · `justfile`
- `*.csproj` CLI projects; `cmd/` (Go); `[project.scripts]` (Python); `[[bin]]` (Rust)
- `docker-compose.yml` health checks
- README "how to run" / usage sections
- `.shipwright.json` commands

## Use them

Record a tool inventory — CLI entry points, validators, scripts, start command — **once**. For input→output tools especially: run on representative input, validate the output with the project's **own** validators, and compare before/after a change. This catches format and semantic errors a green unit suite misses.
