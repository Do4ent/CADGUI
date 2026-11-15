# Autonomous delivery checkpoint

Updated 2026-11-15. Resume by inspecting actual branches and CI; do not assume running agents survived a usage limit.

## Verified baseline

- Main `d2e93f7`: PRs #25–#33 integrated, including canonical runtime geometry references, Ribbon shared dialogs, and recovery foundation.
- PR #34 connects RecoveryBanner to the editor. Local 60 suites/build and original-head CI passed. Actual production recovery tests passed 3/3, including both themes and real storage quota exhaustion.
- Those browser tests were added to #34 as `0ef9d7b`; both head checks passed and #34 is now merged.
- PR #35: bounded body boolean integration plan, documentation only; merged after green CI.
- PR #36 `ff22653`: detached body boolean validator, DAG adapter and removal plan; 69 focused checks, 61 suites/build passed; merged after green CI. No runtime/schema integration claim.
- PR #37 `b9c64ad`: standalone common/cut dialog; 61 suites/build and isolated light/dark browser checks passed; merged after green CI. No root integration claim.
- Current merged main at this snapshot: `3635e58`. PR #39 is open and unmerged at `8c5afba`, worktree `/workspace/wt-body-boolean-runtime`, branch `feature/body-boolean-runtime`. It implements source-linked whole-body common/A−B, schema12, actual OCCT operations, atomic fresh DAG rebuild, ownership, visibility/cascade and history through SketchPanel. The older foundation-only `dd24e92` is not its current head.
- PR #39 reports 63 module suites/build passing, 55 native analytic/STEP/metadata/rollback checks, independent production acceptance 8/8, rebuilt analytic smoke 2/2 and review regressions 2/2. These are local/review results; required final-head CI remains pending. No merge is asserted.
- Runtime details and remaining gates are in [the PR #39 checkpoint](https://github.com/Do4ent/CADGUI/blob/8c5afbaa4678391c45ccace91db9d828db2575e6/docs/implementation/BODY_BOOLEAN_CHECKPOINT.md). The commit-pinned link is intentional because the document is not yet part of merged main.

## Active work and ownership

CAD Workflows has delivered the PR #39 implementation for review. Root reviews the complete package and required checks before any merge. Documents' read-only persistence/history review and QA's new body-boolean production acceptance have reported their results; keep their evidence scoped to the tested head.

The next UI routing package is assigned to UI as sole editor of `src/main.tsx`, `src/CommandRegistry.ts`, `src/CustomRibbon.tsx` and command/request props for this stage. It connects Ribbon/search entry points to real common/A−B workflows. Those entry points are not claimed by PR #39, whose current entry points are SketchPanel controls. Coordinate any shared-file ownership transfer before another agent edits those files; do not overlap the routing work with core integration edits.

Preserve every existing dirty worktree; never reset another agent's files. Continue local module/native/browser review independently where ownership permits.

## Next actions

1. Inspect PR #39's actual head and CI; review source-linked common/A−B, schema12 and local/native/browser evidence. Merge only after required same-head CI and independent review succeed.
2. Keep PR #38 (this checkpoint) separate and unmerged until its updated-head checks pass. A green check on its previous head does not verify this edit.
3. Let UI implement the isolated Ribbon/search routing package with document-aware request acknowledgement, disabled-state handling and stale/busy/cancel guards; do not claim those entry points are already delivered.
4. Validate routing against real SketchPanel execution, selection transitions and both boolean operators, then run module/build/production browser checks and its own same-head CI.
5. After any merge, update checkpoints from actual main/PR state rather than promoting pending work based on a plan or old local result.

The agent cannot schedule its own restart after a usage-limit reset. A new active session must read this checkpoint, inspect git/PR/CI state and resume unfinished work. Percent completion must not increase for standalone foundations alone.
