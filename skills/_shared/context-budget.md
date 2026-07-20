# Subagent Context Budget

Shared reference for skills that assemble context for subagents (auto-map lens generation, auto-impl dispatch).

| Context | Priority | Max lines | Include when |
|---|---|---|---|
| Task description | 1 | unlimited | always |
| Task lens (from arch map) | 2 | 150 | map exists |
| Inter-task learning log | 3 | 50 | during impl |
| Previous task interfaces | 4 | 30 | tasks depend |
| Full architecture map | 5 | 400 | architecture/judgment tasks only |

**Total excluding task description: max 600 lines.** Over budget → compress the lens or omit the full map. Always pass the **lens, not the full map**, to individual implementer subagents — their context is precious.
