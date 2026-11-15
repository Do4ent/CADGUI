# Parallel delivery plan — 2026-11-15

Baseline: `main` at `a5b112f`. Packages below are assigned parallel work, not completed deliveries. Each agent uses an isolated branch/worktree; root alone integrates shared files. No package may merge on failing required checks.

| Package / owner | Bounded outcome | Exclusive ownership / integration boundary | Required acceptance |
| --- | --- | --- | --- |
| UI/UX — Ribbon accessibility continuation | Extend keyboard/focus behavior from the merged accessible dropdown baseline | Owns `CustomRibbon.tsx` and assigned new UI components; no selection/main/recovery edits | Preserve real commands, disabled states and keyboard/focus behavior; targeted light/dark browser regression |
| Documents — recovery continuation | Strengthen validated backup recovery and error handling from PR #29 | Owns assigned editor recovery modules/tests; coordinate common hook contracts with root | Last-good data retained, no silent replacement, backup autosave protection, v11 clean/dirty and multi-tab compatibility |
| CAD workflows — resolver integration design | Read-only design review of how existing reference sessions become viewport consumers | No implementation edits until the contract and downstream owners are agreed | Document/session lifetime, captured inspection provenance, A→B→A invalidation, worker-reset handling and no persistent-naming claim |
| Interaction — resolver/selection integration | Adopt agreed reference behavior while preserving revision-bound selection | Owns kernel selection/layer and `main.tsx` integration for this stage; root and other agents must coordinate before editing those files | Real face pick/rebuild, duplicate face hashes, stale mesh/document rejection, hidden-body inspection, unaffected style/body behavior |
| QA — new browser regressions | Validate newly assigned flows against rebuilt production artifacts | Owns new E2E files only; no existing assertion weakening or shared implementation edits | New targeted regressions plus complete required suite and exact-head CI evidence; report genuine failures |
| Orchestrator — delivery documentation | Update existing PR #26 against the merged baseline | Only `docs/DELIVERY_STATUS.md` and this file | Link/path checks, diff checks, local tests/build and PR update; no unsupported completion claims |

## Integration order and ownership

PR #25 and recovery/Ribbon/reference foundations are now merged. The next selection integration gate is agreement on the resolver consumer contract, followed by Interaction implementation and QA browser acceptance. UI and recovery continuation can proceed independently. The reference foundation must not be described as already integrated into the viewport.

Shared ownership for this stage is explicit: Interaction owns `src/main.tsx` and kernel selection/layer integration; UI owns `CustomRibbon.tsx`; Documents owns assigned editor recovery files. Root coordinates public types, dependency/workflow changes and any ownership transfer. CAD design review is read-only until assigned implementation. No other agent may concurrently edit those owners' files.
Freeze public helper contracts before consumer integration. Root reviews specialist commits, applies compatible changes in dependency order and runs affected checks after each stage. A feature needing another unmerged branch must explicitly name that dependency and revalidate after rebasing. Keep small source packages separate from broad refactors; formatting noise is review cost, not acceptance evidence.

## Common transaction and reference rules

Source definitions own derived BRep. Dependent rebuilds stage all changes before one history commit and reject cancellation, errors or stale document revisions. Recovery preserves a last-good snapshot; structural validity does not prove source/cache correspondence. Face identifiers remain revision-local. A revision-selection guard prevents false identity and does not promise to recover the same face after topology changes.

## Evidence and publication

Each owner reports branch, commit, files, actual checks and unresolved limitations. Module tests establish helper behavior; production browser tests establish interaction; CI establishes the tested delivery head. None substitutes for the others. Record the real failure before fixing it and retain meaningful assertions. Do not claim agent launch, PR publication, successful CI or merge until confirmed.

Before review: run affected suites and production build. Before merge: required full regressions, independent review and same-head CI must pass. CI failure, stale-head evidence or an unresolved data-loss/selection blocker keeps a PR unmerged. Documentation-only status changes do not approve implementation merges.
