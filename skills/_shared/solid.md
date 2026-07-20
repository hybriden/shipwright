# SOLID — Design Principles

Shared reference for the design/build/review steps (auto-plan, implementer prompt, auto-review). Shapes code being written or changed. **Balanced by `minimalism.md`:** apply SOLID to the code in front of you — never add a speculative abstraction to satisfy it. Rule of three: extract the abstraction when a *second* concrete case is real, not before.

| Principle | Rule | Smell → fix |
|---|---|---|
| **S** Single Responsibility | One reason to change per unit | Mixed concerns (data + I/O + formatting in one unit) → split by responsibility |
| **O** Open/Closed | Extend behavior without editing working code | New case means editing a growing if/switch in many places → dispatch/polymorphism/strategy (once a 2nd case exists) |
| **L** Liskov Substitution | A subtype must work anywhere its base does | Subclass throws/no-ops/narrows a base method, or callers type-check to branch → fix the hierarchy or use composition |
| **I** Interface Segregation | Depend only on methods you use | Implementers forced to stub methods they don't need; fat interfaces → split into focused ones |
| **D** Dependency Inversion | Depend on abstractions at real seams | High-level logic hard-wired to a concrete I/O dependency, untestable without it → inject it behind a small interface |

**Apply pragmatically:**
- **SRP and LSP always hold** — a unit doing two jobs, or a subtype that breaks its base's contract, is a bug regardless of size. Split a large monolithic module by feature/domain into single-responsibility units — this refines minimalism's "fewest files": the fewest files that each stay one-responsibility, never one giant file.
- **OCP, ISP, DIP earn their abstraction** only at a real seam or a second concrete case. One implementation needs no interface (the YAGNI line). DIP pays off wherever code crosses an I/O boundary (network, DB, clock, filesystem, external service) you'll want to test or mock.
- If applying a principle *adds* code with no second case and no test/seam benefit, that's over-engineering — stop.

**Review check** — one line per finding: `<file>:L<n>: <SRP|OCP|LSP|ISP|DIP> <violation>. <fix>.` Flag only violations that hurt correctness, testability, or a change already being made; never demand abstractions for hypothetical futures.
