# Comments — Code Explains Itself

Shared reference for build and review (implementer prompt, auto-review, auto-minimize, production-readiness). Companion to `minimalism.md` (comments are lines — write the fewest that work) and `dry-kiss.md` (a comment that duplicates the code is knowledge with two homes, and only the code gets maintained).

**Default: none.** Express intent through names and structure. When a comment feels needed, first try a rename or an extraction — if the code can say it, make the code say it and write nothing.

**A comment earns its place only by stating what the code cannot:**
- the *why* behind a non-obvious choice — a workaround (with the issue link), a spec/business rule, a measured perf-critical shape
- a constraint or invariant the code can't show ("must run before X acquires the lock", "vendor API returns 200 on failure")
- a footgun warning for the next editor (ordering, units, silent behavior)
- required markers: `ponytail:` corner-cuts (see `minimalism.md`), license headers, and doc comments where the host project's convention expects them (established docstring/XML-doc/JSDoc style on public API surface) — match the project's convention, don't invent one

**Noise — write none of it, and delete it in code you touch:**
- narration: what the next line(s) do ("loop over users", "increment counter")
- restating the name: `// gets the user` above `getUser()`; doc comments that only rephrase the signature
- section banners, change history ("added X", "refactored Y"), notes about the diff to the reviewer ("this now handles…")
- commented-out code (git remembers), TODO/FIXME without a tracked task

**The delete test:** remove the comment; if no information is lost, it was noise. Apply it to every comment you write and every comment your diff touches.

**Review check** — one line per finding: `<file>:L<n>: comment-noise "<quote>". Delete.` (or `Delete; rename <x> → <y>.` when the intent needs a home in code). Never flag a comment that passes the delete test, and never flag doc comments that follow the project's existing convention.
