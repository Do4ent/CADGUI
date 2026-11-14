# Parallel delivery plan — 2026-11-14

Baseline: `main` at `fe50e11`. Packages below are assigned parallel work, not completed deliveries. Each agent uses an isolated branch/worktree; root alone integrates shared files. No package may merge on failing required checks.

| Package / owner | Bounded outcome | Exclusive ownership / integration boundary | Required acceptance |
| --- | --- | --- | --- |
| UI/UX — Ribbon accessibility | Keyboard operation, semantic state and focus behavior for existing real commands | New/accessibility modules and assigned Ribbon changes only; coordinate `CustomRibbon.tsx` through root before touching it | Arrow/Home/End navigation where applicable, focus visibility/return, disabled commands respected, accessible names, light/dark browser coverage |
| Documents — recovery | Preserve last-good data, report storage/import failures and protect newer document revisions | Assigned document/recovery modules and tests; root coordinates shared hook/schema changes | Invalid/future data retained safely, storage failure feedback, no silent replacement, schema-v11 compatibility, clean/dirty preservation, recovery and multi-tab regressions |
| CAD workflows — history/reference foundations | Diagnose supported dependency links and define safe revision-local reference behavior | New pure CAD helpers/tests; root integrates common contracts and history mutations | Stable dependency order, ownership validation, missing/cyclic diagnostics, no partial source/BRep writes; no persistent-naming claim without implementation |
| Interaction — exact selection | Verify viewport face/body selection across BRep changes and delayed inspection | Selection/renderer tests and isolated helpers; shared `main.tsx` integration by root | Same-body rebuild cannot transfer old face ID; late events rejected, document isolation, hidden source remains inspectable, unaffected body/style behavior retained |
| QA — PR #25 acceptance | Localize failures and verify actual production browser behavior | Regression files, evidence and assigned QA scripts; no implementation assertion weakening | Reproduce hidden-source failure, validate correction after rebuild, real face-pick/rebuild regression, full E2E and exact-head CI status |
| Orchestrator — delivery documentation | Accurate status, package contracts and evidence gates | Only `docs/DELIVERY_STATUS.md` and this file | Link/path checks, `git diff --check`, review; no unsupported completion or CI-success claims |

## Integration order and ownership

PR #25 acceptance is the first gate because later geometry-reference work depends on safe transient selection. UI and recovery work can continue independently while that gate is open. CAD helper proposals may proceed in isolation, but common types, document schema, `src/main.tsx`, dependencies and workflows have one root editor. Package ownership does not authorize competing edits of a shared file.

Freeze public helper contracts before consumer integration. Root reviews specialist commits, applies compatible changes in dependency order and runs affected checks after each stage. A feature needing another unmerged branch must explicitly name that dependency and revalidate after rebasing. Keep small source packages separate from broad refactors; formatting noise is review cost, not acceptance evidence.

## Common transaction and reference rules

Source definitions own derived BRep. Dependent rebuilds stage all changes before one history commit and reject cancellation, errors or stale document revisions. Recovery preserves a last-good snapshot; structural validity does not prove source/cache correspondence. Face identifiers remain revision-local. A revision-selection guard prevents false identity and does not promise to recover the same face after topology changes.

## Evidence and publication

Each owner reports branch, commit, files, actual checks and unresolved limitations. Module tests establish helper behavior; production browser tests establish interaction; CI establishes the tested delivery head. None substitutes for the others. Record the real failure before fixing it and retain meaningful assertions. Do not claim agent launch, PR publication, successful CI or merge until confirmed.

Before review: run affected suites and production build. Before merge: required full regressions, independent review and same-head CI must pass. CI failure, stale-head evidence or an unresolved data-loss/selection blocker keeps a PR unmerged. Documentation-only status changes do not approve implementation merges.
