# RT-782 lab evidence: support session from the tenant directory, normal and suspended tenant (rt9 lab, 2026-10-23)

Evidence-only branch, never merged. Console `origin/main` `1cafbe9` (same-origin build) on http://localhost:4782; lab api `rt9-api:79537b34` (contains RT-414 `0283ab3f`; PIN `24196757`).

- `captures/782-01-directory.jpg`: directory; `782-02`/`782-04`: drawer; `782-03`/`782-05`: read-only bar after 201 (normal / suspended).
- `data/`: lab DB before/after, the flag, suspend and revert outputs, sessions and audit rows.
- `tools/`: the http proxy (single Origin rewrite) and the lab-change scripts with their reverts.
- `RUN-NOTES.md`: the combined-run log.
