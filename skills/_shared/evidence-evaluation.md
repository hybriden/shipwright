# Evidence Evaluation Gate

Shared reference for skills that verify user-facing behavior (auto-e2e, auto-verify).

Before marking any check or scenario PASS, verify the evidence proves the feature *works* — not just that the system *responded*.

Ask three questions:

1. **Proof vs response?** A loaded page, a 200, an exit code 0 prove the system ran — not that the output is correct.
2. **Data vs container?** Did you verify the actual values (right items, right response body, right rows), or just that "something appeared"?
3. **Would it convince a skeptic** who didn't write the code? "A screenshot showing exactly 4 pages matching the expected names" convinces; "I took a screenshot" doesn't.

| Verdict | Meaning | Action |
|---|---|---|
| PROVEN | Correct behavior demonstrated with verified data | Mark PASS |
| SUPERFICIAL | Shows the system runs, not that it's correct | Add data-level assertions, re-verify |
| INSUFFICIENT | Demonstrates nothing meaningful | Redo with concrete assertions |
