# Model Selection

Shared reference for skills that choose a model tier for a task or a generated agent: **auto-impl** (per task) and **harness** (per generated agent).

**Principle:** start with the least capable model that fits; escalate only for a **capability** gap, never an **information** gap — missing context is fixed by providing context, not a bigger model. Never downgrade once escalated within a unit of work.

| Tier | Use for |
|---|---|
| `haiku` | mechanical / format-bound / 1-2 files with a complete spec |
| `sonnet` / default | standard implementation, review, multi-file integration |
| `opus` | design judgment, architecture, broad-codebase reasoning, complex domain rules |

**Escalate on failure, not on uncertainty:** a logic/quality failure → step up one tier and retry (changing something, per `loop.md`'s escalation ladder); a context gap → provide the missing context and retry at the same tier.
