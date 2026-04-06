# Specialized Verification Strategies

Domain-specific verification patterns for auto-verify. Load this reference when the system under test matches one of these categories.

## CMS / Content Management Systems

The most common auto-verify target. Content imports, page trees, media libraries.

**Verification sequence:**
1. Import the package (via API endpoint, admin UI, or CLI)
2. Navigate to the admin/editor UI with Playwright
3. Verify page tree structure (correct pages, correct hierarchy, no extras)
4. Verify content properties (open a page, check field values)
5. Verify media/assets (images render, files downloadable)
6. Query the database for counts and relationships
7. Check for import warnings/errors in logs or UI

**Playwright MCP sequence for CMS verification:**

```
1. browser_navigate → admin login page
2. browser_snapshot → verify login form exists
3. browser_fill_form / browser_click → authenticate
4. browser_navigate → content editor / page tree
5. browser_snapshot → capture page tree structure
   → VERIFY: correct pages listed, correct hierarchy, no unexpected items
6. browser_click → select a specific page
7. browser_snapshot → capture page properties panel
   → VERIFY: field values match expected data
8. browser_take_screenshot → capture visual evidence
9. browser_console_messages → check for JS errors
```

**Database verification for CMS:**

```sql
-- Verify content count by type
SELECT ct.Name, COUNT(*) as Count
FROM tblContent c JOIN tblContentType ct ON c.fkContentTypeID = ct.pkID
GROUP BY ct.Name ORDER BY COUNT(*) DESC

-- Verify no orphan references
SELECT COUNT(*) FROM tblContentProperty p
WHERE p.ContentLink IS NOT NULL
AND p.ContentLink NOT IN (SELECT ContentGUID FROM tblContent)

-- Verify media has binary data
SELECT ct.Name, COUNT(*) as Total,
  SUM(CASE WHEN blob.fkContentID IS NOT NULL THEN 1 ELSE 0 END) as WithBlob
FROM tblContent c
JOIN tblContentType ct ON c.fkContentTypeID = ct.pkID
LEFT JOIN tblContentProperty blob ON c.pkID = blob.fkContentID
  AND blob.fkPropertyDefinitionID = (SELECT pkID FROM tblPropertyDefinition WHERE Name = 'Blob')
WHERE ct.Name IN ('ImageFile', 'GenericMedia', 'VideoFile')
GROUP BY ct.Name
```

## File Format and Package Verification

For tools that produce structured output (ZIP, XML, JSON, binary formats):

1. **Structural validation** — Use project-specific validators or schema tools
2. **Content inspection** — Parse and inspect key fields, counts, relationships
3. **Cross-reference validation** — Verify internal references resolve (e.g., all GUIDs in a content file have matching entries in an ID map)
4. **Comparison testing** — Compare output against a known-good reference file
5. **Round-trip testing** — If the format can be re-imported, import it and verify the result

## Database State Verification

For changes that affect data persistence:

1. **Count verification** — Expected number of records per table/type
2. **Relationship verification** — Foreign keys resolve, no orphan records
3. **Value verification** — Specific fields have expected values (not just "not null")
4. **Constraint verification** — Unique constraints hold, required fields populated
5. **Absence verification** — Records that should NOT exist are absent

## Multi-Service Integration

For changes that span multiple services or systems:

1. **Service health** — All services started and responding
2. **Data flow** — Data propagates from source to destination correctly
3. **Error propagation** — Errors in one service surface correctly in dependent services
4. **Timing** — Async operations complete within expected timeframes
5. **Idempotency** — Re-running the operation produces the same result

## Architecture-Guided Root Cause Tracing

When verification reveals an issue, use the architecture map's dependency graph to trace the root cause systematically instead of grep-based guessing:

### Trace Algorithm

1. **Identify the symptom module** — which module does the failure manifest in?
2. **Check the interface contract** — is the symptom module receiving incorrect input from its dependencies?
3. **Walk backward through the dependency chain:**
   ```
   Symptom in ModuleC ← receives data from ModuleB ← receives data from ModuleA
   ```
4. **At each hop, verify the interface contract:**
   - What does the upstream module promise to provide?
   - What does it actually provide? (log it, inspect it, query it)
   - If the contract is violated here, this is the root cause location
5. **Check hot spots** — if the dependency chain passes through a hot spot module, that module is a likely culprit (many dependents = many opportunities for subtle breakage)

### Example

```
Symptom: Page tree shows 7 pages instead of 4
  ↓ Manifest in: CMS UI (frontend rendering)
  ↓ Data from: Content API endpoint
  ↓ Data from: ContentRepository.GetPageTree()
  ↓ Data from: ImportService.Import() ← ROOT CAUSE: import filter not excluding template pages
```

**This replaces blind grepping.** Instead of searching the entire codebase for "page" or "tree", you follow the dependency chain from symptom to source. In a large codebase, this reduces investigation from 20 files to 4-5.

### Recording the Trace

Document the dependency-chain trace in the runbook for each issue:

```markdown
### Issue: [description]
**Symptom module:** [module name from map]
**Dependency trace:**
  [ModuleA] → [ModuleB] → [ModuleC (symptom)]
**Contract violation at:** [ModuleA] — [what it should provide vs what it actually provides]
**Root cause:** [one sentence]
**Fix location:** [exact file:line in the root cause module]
```

This trace is passed to `shipwright:run` when delegating the fix, so the fix subagent starts with the answer, not the question.
