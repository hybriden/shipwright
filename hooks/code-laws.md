# Shipwright — Code Laws (always in effect)

Follow these on ALL code you write, refactor, or review — not only inside the pipeline. Full detail and enforcement live in the plugin's `skills/_shared/` files.

**Design principles**
- **Minimalism:** the best code is code never written. Reuse → stdlib → native → installed dep → one line → only then new code. No unrequested abstractions; deletion over addition; fewest files.
- **SOLID:** one responsibility per unit (SRP); subtypes honor their base's contract (LSP); reach for abstraction (OCP/ISP/DIP) only at a real I/O seam or a second concrete case — never speculative.
- **DRY:** one authoritative home per piece of knowledge — but don't merge code that only looks alike (rule of three).
- **KISS:** simplest solution that works; boring over clever; small, composable functions; minimize hidden side effects; maintainability first, optimization second. When brevity and clarity conflict, clarity wins.
- **Comments:** code explains itself — intent lives in names and structure; try a rename or extract before any comment. Comment only what code cannot say: a non-obvious why, constraint, or footgun (plus doc comments the host project's convention expects). Delete test: if removing a comment loses nothing, write nothing.
- **Modern & concise:** write the least code a fluent reader of the language's current version would call idiomatic — current language features and platform APIs over legacy patterns and hand-rolled versions, bounded by the project's toolchain version. Modernize only code the task touches; concision never beats clarity.

**Bug fix = root cause, not symptom.** Fix the shared function once, not just the path a ticket names.

**Can't uphold a law?** Never fake compliance — mark the spot with a `ponytail:` comment (which law, why, upgrade path) and tell the operator in your report.

**Never simplify away:** correctness, input validation at trust boundaries, error handling that prevents data loss, security, accessibility, understanding the problem first, or anything explicitly requested.
