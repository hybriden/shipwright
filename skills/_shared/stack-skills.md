# Stack Skills — On-Demand Consumption

Shared reference for skills that benefit from stack- or platform-specific expertise (auto-plan, auto-impl, auto-test, auto-review, auto-debug). Everything here is **fetched only when a project needs it, into an out-of-repo cache under `~/.claude/.shipwright/`, and never copied into the repo or the plugin**. Shipwright injects an index (name → description → path); you Read the one relevant `SKILL.md` when the task needs it.

## Sources

| Source | Fetched by | Loaded when | Index |
|---|---|---|---|
| dotnet-skills — managedcode/dotnet-skills (EF Core, ASP.NET Core, xUnit, …) | the official `dotnet-skills` CLI, project-matched | .NET markers (`*.csproj`, `*.sln`, `global.json`, `Directory.*.props`) | `[dotnet-skills]` |
| Skill packs — skills published by the platform's own maintainers (below) | the vercel-labs/skills CLI (`npx skills add`, run inside the cache) | the repo's signals for that pack (`hooks/skill-packs/packs.js`), `.shipwright.json` `skillPacks.include`, or `--pack <id>` | `[skill-packs]` |
| Skill library — vendor and community skills listed on skillselion.com | the same CLI, one approved skill at a time | only after the user picks them (below) | `[skill-packs]`, group `library` |

**Packs**

| Area | Pack ids |
|---|---|
| Web frameworks | `vercel` (React, composition, view transitions, web design), `nextjs`, `react-router`, `vite` (Vite, Vitest, Vue, Nuxt), `hono`, `astro` |
| Cloud and platforms | `cloudflare`, `aws`, `azure`, `aspire`, `firebase` |
| Data, auth, payments | `supabase`, `prisma`, `neon`, `clerk`, `stripe` |
| Mobile and tooling | `expo`, `oxc` (Oxlint/Oxfmt migration) |

- **JS stack coverage:** React, React Router, Next.js, Vite, and Hono have maintainer skills. Astro has none yet — its pack fetches nothing and points at the official Astro Docs MCP server. Axios has no skill from anyone, so there is nothing to import; the library search surfaces one if it appears.
- **Risk screen:** a maintainer's pack isn't automatically safe. At fetch time, skills the skillselion catalog's scanners rate HIGH or CRITICAL are removed before they reach the cache, and the session index lists them as withheld. If the catalog is unreachable, nothing is withheld and the pack's meta records that the screen didn't run.
- **Docs:** where a framework publishes docs for agents (`llms.txt`), the pack's index header links them.

## How the index reaches you

Always-on hooks inject `[dotnet-skills]` and `[skill-packs]` blocks into every session and subagent of a matching repo. They only read the cache — fetching happens in `run`'s Stack Skills phase or via the commands the blocks surface (`acquire`, `acquire --refresh`, `acquire --pack <id>`). A block saying *"not fetched yet"* or *"may be stale"* carries the command to run first. Large packs (AWS ~100 skills, Azure ~40) index only the skills the repo's signals point at; the block says where to Glob for the rest by name. In every session the block also carries the skill-library search command, so work outside `run` can use it too.

## Protocol

1. **Match, don't dump.** Read a skill only when the task touches what its description covers; ignore the rest.
2. **One at a time.** Load just the skills the current task needs.
3. **Guidance, not law.** The Code Laws and the task spec win on conflict.
4. **Never copy.** Reference the path; don't paste skill content into the repo, docs, or commits.
5. **Guidance for code, never a license to act on live accounts.** Skills that deploy, provision cloud resources, change IAM, or touch billing (`deploy-to-vercel`, `wrangler` deploys, `azure-deploy`, AWS provisioning) inform the code you write; run their account-changing steps only when the task explicitly asks for that action.
6. **Read before first use.** A skill runs with full agent permissions — skim its `SKILL.md` and any script it tells you to run before following it.

## Greenfield: the repo doesn't show the platform yet

If the task builds on a platform the repo has no signal for ("add a Cloudflare Worker", "store uploads in S3", "add Stripe checkout"), fetch its pack explicitly: `node "<plugin>/hooks/skill-packs/engine.js" acquire --project "<root>" --pack <id>`. The pack stays matched for that project from then on.

## Skill library — ask first

When the task builds something specific that no source above covers, offer skills from the skillselion.com catalog — **always ask the user before installing**:

1. **Search:** `node "<plugin>/hooks/skill-packs/library.js" search "<2-3 keywords>"`. It queries the catalog's public API (user-triggered, a few requests per run) and returns only candidates that pass the quality gate, official publishers first, then by installs.
2. **Ask once:** one `AskUserQuestion` (multiSelect) listing each candidate's name, publisher, official or community, installs, and audit status. No candidates, or no interactive user → skip silently.
3. **Install picks:** `node "<plugin>/hooks/skill-packs/engine.js" add "<id>" --project "<root>"` — fetched into the cache like a pack and indexed for this project only.

**Quality gate** (the catalog has no ratings; these are the signals it does expose):

| Reject | Keep |
|---|---|
| audit `fail` from any scanner, `riskLevel` HIGH or CRITICAL | official publisher with ≥1,000 installs (labeled *unaudited* when no scanner ran) |
| marked `duplicateOf` another listing, or repo unpushed for >180 days | community skill with ≥10,000 installs **and** ≥1,000 repo stars **and** at least one audit |
| not hosted on GitHub | — |

Official doesn't mean safe (scanners flag some vendor skills HIGH/CRITICAL) and audits can lag the repo — which is why the user decides and rule 6 applies.

## Who consumes it

| Skill | Uses matched stack skills for |
|---|---|
| auto-plan | decompose along the stack's idiomatic seams; note which skill each task should consult |
| auto-impl | per task: Read the matched skill before writing that stack's code |
| auto-test | the stack's test-framework guidance (e.g. `xunit`, `vitest`) |
| auto-review | check changed code against the matched skill's patterns and anti-patterns |
| auto-debug | consult the matched skill when a stack-specific bug is in scope |

## Opt-out

- .NET: `SHIPWRIGHT_DOTNET_SKILLS=off` or `.shipwright.json` `dotnetSkills.enabled: false`.
- Packs and library: `SHIPWRIGHT_SKILL_PACKS=off` or `skillPacks.enabled: false`; `skillPacks.exclude` drops packs or skill names; `skillPacks.library: false` turns off only the library offer.
- The whole phase: `skipPhases: ["stackSkills"]`.

See `auto-setup/shipwright-config.md` for every field.
