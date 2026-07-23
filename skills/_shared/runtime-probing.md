# Runtime Probing by App Type

Shared reference for skills that exercise a running system through the same interface a user would: **auto-e2e** (scenarios), **auto-verify** (iterations), **auto-debug** (Layer 2 fix proof). Detect the app type, then probe with the matching tools and assert on the **result**, not that the system merely ran. Always pair with `evidence-evaluation.md` — prove correct DATA, not a response.

| App type | Tools | Probe sequence | Assert on |
|---|---|---|---|
| **Web** | Playwright MCP | navigate → snapshot (elements exist) → interact (click / fill_form / type) → snapshot (state changed) → screenshot → console_messages → network_requests | rendered values correct; zero JS errors; calls 2xx |
| **API** | curl / HTTP | send valid + invalid + edge-case requests | status code **and** body values (parse, e.g. `jq`); useful error messages; auth 401/403; headers/schema |
| **CLI** | shell | run with valid / invalid / no args | exit code **and** stdout/stderr content; validate output with the project's own tools (`project-tools.md`) |
| **DB** | queries | query after the operation | counts; relationships (no orphans); specific values (not just not-null); absence of what shouldn't exist |
| **Library** | integration test | exercise as a consumer would | behavior at the public surface (no separate runtime) |

Web + API app → probe both. Multi-page/stateful flows must prove state **persists across navigation**, not just within one page.

**Caveat — dispatch templates inline a condensed copy.** `auto-debug/references/dispatch-template.md` and `auto-verify/references/dispatch-template.md` embed a short version of this matrix on purpose: they are prompt text sent to subagents that can't resolve `../_shared/`. Keep those in sync with this file.

**Deeper, domain-specific probing** (CMS, file formats, DB state, multi-service): `auto-verify/references/verification-strategies.md`.
