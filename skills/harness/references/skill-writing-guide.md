# Skill Writing Guide

Best practices for writing high-quality Claude Code skills. Reference this in Phase 4 when generating skills for the harness.

## The Description Problem

Claude only sees a skill's **name** and **description** when deciding whether to load it. The full SKILL.md body is only loaded after the trigger decision is made. This means:

**If your description doesn't trigger, your skill is dead.**

### Writing Effective Descriptions

**Bad description:**
```yaml
description: "Runs the project pipeline"
```
Claude might not connect "build the feature" or "implement this" to "runs the project pipeline."

**Good description:**
```yaml
description: "Use when given a development task to build, implement, create, or modify features. Triggers on: 'build', 'implement', 'create', 'add feature', 'make it work', 'develop', 'code this', 'write code for'. Also triggers on follow-ups: 'try again', 're-run', 'fix it', 'update', 'modify', 'change'."
```

### Description Checklist

- [ ] Lists the primary use case in plain language
- [ ] Includes 5+ trigger verb variants (build, create, implement, make, develop, etc.)
- [ ] Includes domain-specific terms the user might say
- [ ] Includes follow-up phrases (re-run, try again, update, fix)
- [ ] Under 200 words (descriptions that are too long get truncated or ignored)
- [ ] Does NOT include instructions (those go in the SKILL.md body)

### The Pushy Description Principle

Skill descriptions should be **aggressively inclusive**. It's better to trigger too often (the skill can decline in its body) than to never trigger (the skill is invisible).

Think of the description as a bouncer at a door:
- Too strict → nobody gets in → skill is useless
- Too lenient → some wrong people get in → skill redirects them → minor cost
- Just right → every relevant request triggers → skill works

**Err on the side of lenient.**

## Skill Structure

Every well-crafted skill follows this structure:

```markdown
---
name: [skill-name]
description: "[aggressive trigger description]"
---

# [Skill Name]

[One paragraph: what this skill does and why it exists]

## Iron Law

\`\`\`
[ONE UNBREAKABLE RULE IN CAPS]
\`\`\`

[1-2 sentences explaining why this rule exists]

## When to Use

- [Condition 1]
- [Condition 2]
- [Condition 3]

## When NOT to Use

- [Condition — redirect to correct skill]
- [Condition — redirect to correct skill]

## Process

[Detailed workflow — dot graph for complex flows, numbered steps for simple ones]

## [Phase/Step Details]

[Detailed instructions for each phase]

## Anti-Patterns

[What NOT to do, with explanations]

## Red Flags — STOP

| Thought | Reality |
|---------|---------|
| "[Bad thought]" | [Why it's wrong and what to do instead] |

## Integration

[How this skill connects to other skills and agents]
```

### Frontmatter Fields

`name` and `description` are the only required fields (the description is the trigger — see above). Modern Claude Code skills support more, all optional — use them when they earn their place:

| Field | Use |
|---|---|
| `when_to_use` | A second natural-language trigger hint, complementing `description` |
| `user-invocable` | Expose as a `/name` slash command |
| `disable-model-invocation` | Only fire when explicitly invoked, never auto-triggered |
| `argument-hint` / `arguments` | Declare arguments for slash-command use |
| `allowed-tools` / `disallowed-tools` | Constrain the tools available while the skill runs |
| `model` / `effort` | Pin a model tier (`../../_shared/model-selection.md`) / reasoning effort |
| `context: fork` | Run the skill in a forked context so it doesn't pollute the main thread |
| `agent` | Run the skill in a specific subagent type |
| `hooks` | Wire lifecycle hooks (e.g. `SkillInvoked`) |

Don't set fields speculatively — add one only when it earns its place (minimalism).

### Structural Rules

1. **Iron Law comes early.** It's the first thing Claude reads after the summary. It sets the tone for everything that follows.

2. **"When to Use" precedes "When NOT to Use."** Positive matching first, then exclusions. This prevents skills from being overly defensive.

3. **Process section is the core.** This is where the actual work instructions live. Make it detailed, specific, and actionable.

4. **Red Flags table is mandatory.** Every skill has common failure modes. Listing them as a table of "wrong thoughts → correct reality" is the most effective format for preventing mistakes.

5. **Integration section is mandatory.** Skills don't exist in isolation. Every skill must declare what it invokes, what invokes it, and how data flows.

## Progressive Disclosure

Context window is a shared resource. A skill that loads 2000 lines of instructions on every trigger wastes tokens on every conversation.

### Three Tiers

**Tier 1: Metadata** (always loaded)
- Name + description
- ~100 words max in description
- Cost: loaded for every conversation, even when skill isn't used

**Tier 2: SKILL.md body** (loaded on trigger)
- The main instructions
- Target: <500 lines
- Cost: loaded when the skill triggers

**Tier 3: References** (loaded on demand)
- `references/*.md` files
- No line limit
- Cost: loaded only when the skill explicitly reads them

### Applying Progressive Disclosure

**In the SKILL.md body:**
- Include the process overview and key instructions
- Reference external files for detailed guides, templates, and examples
- Use: "Read `references/template.md` for the full template" instead of inlining 200 lines

**In reference files:**
- Put domain-specific knowledge, detailed templates, worked examples
- Organize by topic (one file per topic)
- Include a brief description at the top so the skill knows whether to load it

**Example:**
```markdown
## Phase 3: Agent Definition

Generate agent definitions following the structure in `references/agent-template.md`.

Key rules (always apply):
1. Every agent gets an error handling section
2. Model must be specified explicitly
3. Communication protocol is mandatory for team mode

For the full template with all sections and examples, read `references/agent-template.md`.
```

The key rules are in the SKILL.md (always available). The full template is in a reference (loaded only when Phase 3 runs).

## Writing Style

### Command Tone

Use imperative verbs. Direct instructions. No hedging.

- **Bad:** "You might want to consider reading the existing tests"
- **Good:** "Read the existing tests before writing new ones"
- **Bad:** "It would be helpful to check the API contract"
- **Good:** "Check the API contract. Verify request and response shapes match."

### Why-First Principle

Every rule needs a reason. Without reasons, Claude follows rules mechanically and can't adapt to edge cases.

- **Bad:** "Always use TypeScript strict mode"
- **Good:** "Use TypeScript strict mode because it catches null reference errors at compile time that would otherwise crash at runtime"

- **Bad:** "Never use `any` type"
- **Good:** "Never use `any` type because it disables type checking for everything downstream, hiding bugs until production"

The "because" clause lets Claude judge edge cases. If there's a legitimate reason to deviate, the reason helps Claude decide whether the deviation is justified.

### Specificity

Abstract instructions produce abstract results. Be concrete.

- **Bad:** "Handle errors appropriately"
- **Good:** "Catch errors at API boundaries. Return `{error: string, code: number}` with HTTP status matching the code. Log the full error with stack trace. Never expose internal error details to the client."

- **Bad:** "Follow existing patterns"
- **Good:** "Read 3 existing files in the same directory. Match their import style, naming convention, and file structure."

### Context Conservation

Every sentence in a skill costs tokens. Justify each one.

**Test:** For each instruction, ask: "If I removed this line, would Claude's output be worse?" If the answer is "probably not," remove it.

**Common token wasters:**
- Motivational language ("This is a critical step that ensures quality")
- Redundant phrasing ("Make sure to always remember to check")
- Obvious instructions ("Read the file before editing it" — Claude already does this)
- Generic advice ("Write clean, maintainable code" — already the default)

**Keep:** Domain-specific knowledge, non-obvious rules, edge cases, error handling instructions, concrete examples.

## Script Bundling

If your skill generates the same helper script in 3 out of 3 test runs, bundle it.

### When to Bundle

- The same bash/python/node script is generated every time the skill runs
- The script is stable (same logic, same structure, maybe different parameters)
- The script is non-trivial (>10 lines)

### How to Bundle

1. Save the script to `references/scripts/[name].sh` (or `.py`, `.js`)
2. In the SKILL.md, reference it: "Run the validation script at `references/scripts/validate.sh`"
3. Parameterize what varies: `validate.sh $PROJECT_ROOT $COVERAGE_TARGET`

### When NOT to Bundle

- The script varies significantly between runs (different logic, not just different parameters)
- The script is trivial (<10 lines)
- The script depends on runtime state that can't be parameterized

## Skill Testing

Before shipping a skill, validate it. See `references/skill-testing-guide.md` for the full methodology.

### Quick Validation Checklist

1. **Trigger test:** Read the description. Would Claude trigger this for 5 realistic user messages?
2. **Structure test:** Does the SKILL.md have all required sections? (Iron Law, Process, Red Flags, Integration)
3. **Specificity test:** Are instructions concrete enough to execute without guessing?
4. **Token test:** Is the SKILL.md under 500 lines? Are references properly externalized?
5. **Integration test:** Does the Integration section correctly list all connections?

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Description too vague | Add trigger phrases, domain terms, follow-up keywords |
| SKILL.md too long (>500 lines) | Move details to references/ files |
| Instructions too abstract | Replace with concrete steps, exact commands, specific formats |
| No error handling instructions | Add error table: "If X happens, do Y" |
| Missing Red Flags table | Add the 5-10 most common failure modes |
| Skill doesn't declare integration | Add Integration section with invokes/invoked-by/data-flow |
| Rules without reasons | Add "because [reason]" to every rule |
| Overlapping triggers with other skills | Add "When NOT to use" section with redirects |
