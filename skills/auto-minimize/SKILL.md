---
name: auto-minimize
description: "Use to build or review code for minimalism — the laziest solution that actually works. Triggers on: 'simplify', 'minimize', 'over-engineered', 'over-engineering', 'what can we delete', 'reduce dependencies', 'too much code', 'yagni', 'lazy mode', 'shortest solution', 'is this bloated', 'trim this down'. Two modes: build (apply the decision ladder) and review (hunt complexity to delete). Do NOT use for non-coding requests."
---

# Auto-Minimize

The lazy-senior-dev counterweight to the pipeline's rigor: build the minimum that actually works, and hunt existing code for what to delete. Governs *what gets built*, never what gets verified — shipwright's test/coverage/security gates still apply in full.

The ladder, safety carve-outs, and review tags live in `../_shared/minimalism.md`. This skill invokes them in one of two modes:

- **Build** (writing/refactoring): apply the decision ladder — needs to exist? → already here? → stdlib? → native? → installed dep? → one line? → only then new code. No unrequested abstractions; deletion over addition; fewest files; shortest diff *once you understand the problem*. Never simplify away the carve-outs. Output code first, then at most `skipped: [X], add when [Y].`
- **Review** ("what can we delete", "is this over-engineered"): review the diff/codebase for complexity only (correctness/security/perf are a separate pass). One line per finding with tags delete/stdlib/native/yagni/shrink, ending in `net: -N lines possible` or `Lean already. Ship.` Lists fixes; applies them only if asked.

## Integration

Standalone and directly invocable. The same ladder is already threaded into auto-plan (minimal decomposition), the implementer prompt (build the minimum), and auto-review (Stage 3.5 over-engineering lens), so a full run applies it automatically — invoke this skill for on-demand minimization outside a run. Adapted from ponytail (MIT).
