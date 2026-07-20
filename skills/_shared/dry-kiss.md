# DRY & KISS — Design Principles

Shared reference for design/build/review (auto-plan, implementer prompt, auto-review). Complements `solid.md` (structure) and `minimalism.md` (amount): DRY is about a single source of truth, KISS about comprehensibility.

**DRY — Don't Repeat Yourself.** Every piece of *knowledge/logic* has one authoritative home. Duplicated business rules, magic numbers, and validation drift out of sync and become bugs — centralize them (config, constants, schema: one source, always).
- **Not coincidental duplication.** Two snippets that look alike but change for *different reasons* are not a DRY violation — merging them couples unrelated things. Rule of three: extract on the third real repetition of the *same* knowledge, not the second look-alike. A wrong abstraction costs more than duplication — prefer a little copy-paste over the wrong shared function. (Same seam / second-case test as `solid.md`.)

**KISS — Keep It Simple.** The simplest solution that fully works, optimized for the next reader.
- Boring over clever — clever is what someone debugs at 3am. Prefer obvious control flow, standard idioms, and clear names over compression.
- Fewer moving parts: no needless indirection, no config for a value that never changes, no framework where a function does.
- Small, composable functions — each does one thing and returns a value; compose them instead of nesting deeply.
- Minimize hidden side effects and implicit behavior — prefer pure functions and explicit inputs/outputs; make mutation and I/O obvious, not buried in a getter or a deep call.
- Maintainability first, optimization second — no premature optimization; reach for it only when a measurement (profiler, load test) proves it's needed.
- Simple ≠ fewest characters. A dense one-liner that hides intent fails KISS. **Minimalism governs *amount*, KISS governs *clarity* — when they conflict, clarity wins.**

**Never dedup or simplify away:** correctness, the safety carve-outs in `minimalism.md`, or clarity itself.

**Review check** — one line per finding: `<file>:L<n>: <DRY|KISS> <what>. <fix>.` Flag real duplicated knowledge or needless complexity; never flag look-alike code that changes for different reasons.
