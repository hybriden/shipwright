# UI Test Levels

Shared reference for every test written for UI code: the implementer (TDD, review fixes included), auto-test's test-writers, and auto-debug's Layer 1 regression test. A UI defect found by an E2E sweep or a reviewer — a screenshot, a snapshot, a read of the markup — is a finding, not a guard: its fix lands with a committed test that fails without it. Choose the level per defect.

| Defect | Test | Assert on | Avoid |
|---|---|---|---|
| Missing semantics — tabs, dialog, menu, form labels | component or browser test | role, accessible name, and state (`getByRole('tab', { selected: true })`); keyboard behavior from the WAI-ARIA APG pattern | CSS or test-id selectors; markup snapshots |
| Repeated controls without context — a row's "Edit" button | component or browser test | the full name: `getByRole('button', { name: 'Edit Acme AS' })` | counting buttons |
| Meaning carried only by color — won/lost, ok/error | component or browser test | a non-color cue per state: distinct visible text or accessible name | computed colors |
| Layout at a viewport — overlap, overflow, clipping | real browser at the failing viewport | geometry: `boundingBox()` intersection, `scrollWidth <= clientWidth` | pixel screenshot baselines — font rendering differs between OSes, so they break on CI |
| Formatted text — currency, numbers, dates | unit test on the formatter | the exact string as a literal; `Intl` inserts no-break spaces (`nb-NO`: U+00A0; `fr-FR` groups with U+202F) | expected values built with the same `Intl` call |
| Color contrast | axe in a real browser on the changed pages (`@axe-core/playwright`, rule `color-contrast`) | zero violations | hand-written per-element tests; jsdom, which can't compute contrast |

- **Red for the right reason:** the test fails on its assertion ("expected 1 tablist, received 0"), not on a locator timeout, setup error, or missing fixture. Revert the fix → red; re-apply → green.
- **Query by role and accessible name,** then visible text, then test ids — never DOM structure. Role queries match what assistive tech sees and survive a restructure, so the same tests guard the refactors that follow.
- **axe complements the rows above, never replaces them:** it passes buttons that share one name across rows and can't tell that plain buttons should be tabs.
- **Runner:** the project's existing component and browser runners. Add `@playwright/test` only when a layout or contrast defect needs a real browser and the project has none.

Subagent prompts can't resolve `_shared/`, so the orchestrator pastes this file into the UI Test Levels section of `auto-impl/implementer-prompt.md`, `auto-test/test-writer-prompt.md`, and `auto-debug/references/dispatch-template.md`.
