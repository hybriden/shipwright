# Pipeline & Task Checkpoints

Shared reference for shipwright:run (per phase) and auto-impl (per task). Git tags mark known-good states for rollback and resume.

**Create** after each phase/task passes its gate:
```
git tag "shipwright/<label>" -m "<summary>"
```
run uses `shipwright/phase-N-<name>`; auto-impl uses `shipwright/checkpoint-task-N`.

**Rollback** when a later step fails and can't be recovered:
```
git reset --hard <last-good-tag>
```
This preserves all completed work and drops only the failing step's changes.

**Resume** after interruption (context limit, timeout, crash): `git tag -l "shipwright/*"` → identify the last completed step → continue from the next one. Re-read the plan (`docs/plans/`) and map (`docs/architecture-map.md`) to restore context.

**Localize** a regression first caught by a phase-end full suite (under `pace.md`'s `lean` profile, in-loop gates run affected tests and can miss one): `git bisect start HEAD shipwright/phase-2-plan` → `git bisect run <failing-test command>` → note the first bad commit → `git bisect reset`. The inter-task learning log maps that commit to its task.

**Cleanup** after the pipeline finishes (success or failure) — checkpoints are internal bookkeeping, don't leave them behind:
```
git tag -l "shipwright/phase-*" "shipwright/checkpoint-*" | xargs git tag -d
```
