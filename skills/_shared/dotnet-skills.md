# dotnet-skills — On-Demand Consumption

Shared reference for skills that can benefit from .NET-specific expertise (auto-plan, auto-impl, auto-test, auto-review, auto-debug). Applies **only in .NET projects**; invisible everywhere else.

Shipwright does **not** vendor any of this content. It uses the official `dotnet-skills` CLI (github.com/managedcode/dotnet-skills, MIT) to install project-matched skills into an out-of-repo cache, and injects only a compact **index** (name → description → path). You Read the one relevant `SKILL.md` on demand and apply it — never copy it into the repo.

## How the index reaches you

An always-on hook injects a `[dotnet-skills]` block into every .NET session and subagent (the acquisition itself runs in `run`'s .NET Skills phase or via the surfaced command — the hook only reads the cache). The block lists each cached skill:

```
[dotnet-skills] N project-matched skills available — …read the relevant one on demand (do NOT copy its content):
- entity-framework-core [Data] — Design, tune, or review EF Core data access… → <abs path>\SKILL.md
- xunit [Testing] — Write, run, or repair .NET tests that use xUnit… → <abs path>\SKILL.md
…
[dotnet-skills] refresh this list: node "<engine>" acquire --project "<cwd>"
```

If instead you see *"…available but not cached yet"*, the cache is empty — run the surfaced `acquire` command (or let `run`'s .NET Skills phase do it) before relying on the skills.

## Protocol

1. **Match, don't dump.** When your task touches an area a listed skill covers (its description says `USE FOR: …`), Read that skill's `SKILL.md` and follow its guidance for that part of the work. Ignore the rest.
2. **One at a time.** Read only the skill(s) the current task actually needs — the index exists so you don't load them all.
3. **Follow it as guidance, not law.** These skills encode idiomatic .NET patterns; shipwright's Code Laws and the task spec still win on conflict.
4. **Never copy.** Do not paste skill content into the repo, docs, or commits. Reference the path; the body stays in the cache and refreshes from upstream.
5. **Stale flag.** If the block says the list *"may be stale"*, prefer refreshing (the command is in the block) before acting on it.

## Who consumes it

| Skill | Uses matched dotnet-skills for |
|---|---|
| auto-plan | decompose along idiomatic .NET seams; note which skill each task should consult |
| auto-impl | per-task: Read the matched skill before writing EF/ASP.NET/DI/test code |
| auto-test | xunit / test-framework guidance when writing .NET tests |
| auto-review | check .NET code against the matched skill's patterns & anti-patterns |
| auto-debug | consult the matched skill when a .NET-specific bug is in scope |

## Opt-out

`SHIPWRIGHT_DOTNET_SKILLS=off` (env), or `.shipwright.json` `dotnetSkills.enabled: false`. See `auto-setup/shipwright-config.md` for the full `dotnetSkills` block.
