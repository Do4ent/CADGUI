# Autonomous delivery checkpoint

Updated 2026-11-21. Inspect actual git, PR and CI state before resuming; interrupted agents may have uncommitted work.

## Verified merged baseline

Main at this snapshot is `7fd08cd4e6b84a21171a0f8b21d49c4a94afa4a5`.

- PRs #25–#33 delivered canonical runtime geometry references, shared Ribbon dialogs and backup workspace recovery.
- PR #34 connected recovery resume to the editor; production checks verify source archives, both themes and real quota failure/retry.
- PRs #35–#37 delivered body-boolean foundations. PR #39 delivered source-linked whole-body common/A−B, schema12, actual OCCT, fresh atomic DAG rebuild, ownership, visibility/cascade and history. See [runtime checkpoint](implementation/BODY_BOOLEAN_CHECKPOINT.md).
- PR #41 merged as `7fd08cd`: Ribbon/search routes require two exact bodies and use document-scoped requests. Both head-`3c44947` CI runs passed; production route acceptance passed 2/2 in 35.94 seconds.
- PRs #38 and #40 merged documentation corrections. Catalogs and standalone foundations do not establish whole-product completeness.

## Unified history under review

- PR #42 is open at `3ace83c`: pure unified history model for all supported operation/source kinds, static bodies and direct/transitive dependencies. Explicit exact-model inspection diagnoses missing BREP results; source-only inspection remains supported.
- PR #43 is open at `db9f853`, based on the history-model branch. It adds the accessible read-only tree and dependency inspector.
- PR #44 is open on GitHub at `b22b16e`; the local integration worktree `/workspace/wt-history-integration`, branch `integration/feature-history`, has the later commit `9890cd0`. It includes foundations and panel selection integration. Suppression, chronological feature reordering and persistent topological naming are outside this package.
- Earlier integration evidence reports 66 module suites and production build PASS, plus two production theme cases passed in 43.88 seconds on `b22b16e`. The browser regression was prepared as `87b9740`; later QA work exists in `/workspace/wt-history-qa`. The previous `/tmp/history-qa-e2e.log` is absent in the restored environment, so verify retained commits and rerun the final artifact rather than treating that temporary log as available evidence.
- Both #44 head-`b22b16e` CI runs passed: [43777696092](https://github.com/Do4ent/CADGUI/actions/runs/43777696092) and [43777700075](https://github.com/Do4ent/CADGUI/actions/runs/43777700075). They do not verify the later local `9890cd0`. No history integration merge is asserted.
- Review found that blanket `onClickCapture` in `efb8d7e` could reactivate unrelated sketch actions after an inert panel click. Root's `f8ea528` replaces it with explicit legacy-selection clearing and document-context reset. QA reports rebuilt production browser 2/2 PASS in both themes (60.08 seconds), including static/fusion action isolation and legacy-row clearing. Browser test provenance is `87b9740`, `5411c5d`, `7560501` in `/workspace/wt-history-qa`; their integration mapping is recorded below. Final module/build/CI and independent fix review remain required.
- Those three browser commits are now included locally as `185d407`, `c000f67` and `45f0122`. Root's `9890cd0` resets history inspection context after a successful feature commit. A later read-only review still found retained legacy operation IDs after sketch/ring creation; root must resolve the final selection contract before claiming completion.
- Additional browser regressions are prepared in `/workspace/wt-history-final-acceptance`: `0ec99ae` covers inert panel clicks; `9ac765f` covers creating a sketch after static-body history selection. Syntax/diff checks passed; the latest rebuilt production run is pending. Do not transfer earlier browser results to these new tests or fixes.

## Active ownership

Root alone owns SketchPanel integration and applies specialist commits. History Model owns only the model/tests; UI owns its standalone tree/assets. Their current integration reviews are read-only. QA owns only the new history E2E file and acceptance. Delivery documentation owns only this checkpoint. Avoid shared-source/shared-dist concurrent edits and preserve unrelated dirty worktrees.

The resumed parallel stage has six specialist roles: final history review, browser acceptance, pure suppression planner, standalone suppression controls, persistence design review, and checkpoint documentation. Root remains the sole product integration editor. Agent liveness must be checked in the active session; a saved assignment is not proof that a worker is still running.

## Planned leaf-suppression package

The next proposed function is suppression of terminal body operations with no saved consumers. Definitions and stable output IDs remain reserved; active BREP is removed, and resume requires an actual atomic OCCT rebuild. Metadata must be retained so resume preserves name, color and visibility. This is a proposed contract, not an implemented feature or a merged schema change.

Ownership for the next bounded stage: root alone edits SketchPanel integration; CAD owns only a new pure suppression planner; UI owns only new suppression controls; QA owns only new E2E coverage; Documents reviews persistence read-only. Freeze the planner/control interfaces before integration, and preserve existing worktrees.

## Next actions

1. Review the root `9890cd0` context fix and any follow-up, inspect actual PR #44 head/checks and QA browser commits. Cover retained operation IDs after sketch/ring creation, missing results, static/fusion versus sketch action context, inert clicks, legacy selection synchronization, dirty state, reload and Undo on the final head.
2. Include the browser regression in the integration PR, then verify module/build/browser and CI for that updated head.
3. Integrate in dependency order only after required checks and independent review pass; avoid duplicating cherry-picked foundations when retargeting stacked PRs.
4. Update delivery records from actual merged state. The read-only DAG view must not imply chronological editing or suppression.
5. Agree the next bounded history feature's dependency, persistence and geometry contract before implementation.

The agent cannot schedule its own restart after a usage-limit reset. A new session must inspect this checkpoint and live repository state. Completion percentages require their declared denominator and verified functional coverage.
