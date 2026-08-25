# Modern Idiom — Least Code, Current Style

Shared reference for build and review (implementer prompt, auto-review, auto-minimize). Companion to `minimalism.md` (what gets built) and `dry-kiss.md` (clarity): this governs *how expressions are written*. The modern idiom usually delivers both goals at once — today's language features say the same thing in less code *and* more clearly.

**Rule: write the least code a fluent reader of the language's current version would call idiomatic.** For any construct, prefer the current standard over the legacy pattern or a hand-rolled version:
- optional chaining / null-coalescing over nested null checks
- destructuring, spread, records/data classes over field-copying boilerplate
- async/await over callback or `.then` chains
- pattern matching / switch expressions over if-else ladders
- comprehensions / LINQ / streams / iterator helpers over manual accumulator loops — where they stay readable
- the platform's current APIs over deprecated ones (`fetch` over `XMLHttpRequest`, `pathlib` over `os.path`, `java.time` over `Date`)

**Bounds:**
- **Toolchain sets the ceiling:** use the newest feature the project's configured language/runtime version supports — read it (tsconfig `target`, `.csproj` `TargetFramework`/`LangVersion`, pyproject `requires-python`, package.json `engines`) before reaching for it; never force a version bump for style.
- **Clarity still wins:** a dense one-liner that hides intent fails KISS (`dry-kiss.md`) — concision that costs the next reader is a loss, not a win.
- **Diff discipline:** new code is written modern; existing code is modernized only where the task already touches it — no drive-by restyling (`minimalism.md`: shortest working diff).

**Review check** — one line per finding: `<file>:L<n>: legacy <pattern> → <modern replacement> (-N lines).` Flag hand-rolled versions of current stdlib/language features in new code; never flag modern code as "unfamiliar", and never flag legacy style the toolchain version forces.
