# Architecture Map Consumption

Shared reference for skills that consume `docs/architecture-map.md` (auto-plan, auto-impl, auto-test, auto-review, auto-debug, auto-verify, production-readiness).

**If the map exists, read it before broad investigation.** It replaces blind grepping with dependency-guided navigation.

| Map section | Use it to |
|---|---|
| Module inventory | Locate code by responsibility; find where a symptom or task belongs |
| Dependency graph | Trace **backward** — root cause and blast radius are usually upstream, not at the failing module |
| Hot spots | Flag high-blast-radius modules → extra care, deeper verification, stronger model |
| Interface contracts | Know expected behavior at boundaries; detect contract violations |
| Data models | Consumer count = change risk. Persisted + serialized + >3 consumers = danger to change |
| Patterns | Follow established error-handling / data-access / naming conventions |

**Dependency-guided tracing:** from the symptom module, walk the dependency chain backward; at each hop check whether the interface contract is being violated. The root cause is where the contract breaks — faster and more reliable than grep in large codebases.

**If no map exists:** fall back to manual Glob/Grep scanning.
