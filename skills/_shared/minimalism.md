# Minimalism — Lazy Senior Dev

Adapted from ponytail (MIT, github.com/DietrichGebert/ponytail). Governs what gets *built* — never shipwright's verification gates. The best code is code never written.

**Ladder** — after understanding the problem (read the task + the code it touches, trace the real flow), stop at the first rung that holds:

1. Needs to exist? (YAGNI — speculative = skip, say so in one line)
2. Already in this codebase? Reuse the helper/util/pattern; don't re-implement.
3. Stdlib does it? Use it.
4. Native platform feature covers it? (DB constraint over app code, CSS over JS.)
5. Installed dependency solves it? Use it — never add a dep for a few lines.
6. One line? Make it one line.
7. Only then: the minimum code that works.

**Rules:** no unrequested abstractions (no interface/factory/config with one user); deletion over addition; boring over clever; fewest files; shortest working diff — but the smallest change in the *wrong* place is a second bug. **Bug fix = root cause:** fix the shared function once (one guard beats one per caller), not just the path the ticket names. Mark a deliberate corner-cut — or a design law you knowingly can't uphold (name the law and why) — with a `ponytail:` comment naming the ceiling + upgrade path; the run report surfaces every marker to the operator.

**Never simplify away:** understanding the problem, input validation at trust boundaries, error handling that prevents data loss, security, accessibility, hardware calibration, anything explicitly requested.

**Over-engineering review lens** — one line per finding: `L<n>: <tag> <what>. <replacement>.`
- `delete:` dead code / speculative feature / unused flexibility (→ nothing)
- `stdlib:` hand-rolled thing the stdlib ships (name it)
- `native:` dep/code the platform already does (name the feature)
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller
- `shrink:` same logic, fewer lines (show it — often a modern idiom the toolchain already supports; see `modern-idiom.md`)
- `chatter:` comment failing the delete test — narration, restated name, banner, change note (→ delete; policy in `comments.md`)

End with `net: -N lines possible`, or `Lean already. Ship.` if nothing to cut.
