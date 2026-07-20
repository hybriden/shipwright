# Shipwright — Code Laws (always in effect)

Follow these on ALL code you write, refactor, or review — not only inside the pipeline. Full detail and enforcement live in the plugin's `skills/_shared/` files.

**Design principles**
- **Minimalism:** the best code is code never written. Reuse → stdlib → native → installed dep → one line → only then new code. No unrequested abstractions; deletion over addition; fewest files.
- **SOLID:** one responsibility per unit (SRP); subtypes honor their base's contract (LSP); reach for abstraction (OCP/ISP/DIP) only at a real I/O seam or a second concrete case — never speculative.
- **DRY:** one authoritative home per piece of knowledge — but don't merge code that only looks alike (rule of three).
- **KISS:** simplest solution that works; boring over clever; small, composable functions; minimize hidden side effects; maintainability first, optimization second. When brevity and clarity conflict, clarity wins.

**Bug fix = root cause, not symptom.** Fix the shared function once, not just the path a ticket names.

**Never simplify away:** correctness, input validation at trust boundaries, error handling that prevents data loss, security, accessibility, understanding the problem first, or anything explicitly requested.
