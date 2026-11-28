# Autonomous delivery checkpoint

Updated 2026-11-22. Verify branches, commits, and CI before resuming.

## Verified baseline

- Main `d241cee` includes exact-body occurrences and fixed mates through [PR #56](https://github.com/Do4ent/CADGUI/pull/56). It passed 70 local check suites, the production build, and [main CI](https://github.com/Do4ent/CADGUI/actions/runs/45005148769).
- [PR #57](https://github.com/Do4ent/CADGUI/pull/57) records the shipped assembly and modeling-history workflows. Merged as `3491fdc` after [successful CI](https://github.com/Do4ent/CADGUI/actions/runs/45005710735).

## Nested subassemblies

- [PR #58](https://github.com/Do4ent/CADGUI/pull/58), branch `feat/nested-subassemblies`, worktree `/tmp/wt-nested`, passed [full PR CI](https://github.com/Do4ent/CADGUI/actions/runs/45006236429) at `b6b8575` and merged as `2708f8e`.
- The stage adds named groups, local transforms and occurrence paths in native schema v17. Reparenting preserves the world transform. Fixed mates apply to root occurrences. The viewport uses world transforms and the local values are retained in the document.
- Independent review checked cyclic and missing parents, identifier collisions, migration, history, viewport wiring and 1,000 rotated reparenting scenarios. The PR passed 70 local suites, the production build and 11 focused Chromium tests.

## Fixed mates inside subassemblies

- [PR #59](https://github.com/Do4ent/CADGUI/pull/59), branch `feat/nested-fixed-mates`, worktree `/tmp/wt-nested-fixed-mates`, head `1b03800`. It passed [full CI](https://github.com/Do4ent/CADGUI/actions/runs/45008262772) and merged as `7503e7e`.
- The mate solver supports same-parent occurrences. Relative transforms remain local to the shared parent and move with the whole subassembly. Native schema v18 distinguishes documents with nested mates.
- The production build, 70 local suites and 12 focused Chromium tests passed. Independent checks exercised 128 rotated nested chains, no-jump attachment, source removal and invalid cross-parent endpoints.

## Fixed mates across subassemblies

- [PR #60](https://github.com/Do4ent/CADGUI/pull/60), branch `feat/cross-parent-fixed-mates`, worktree `/tmp/wt-cross-fixed-mates`, head `41475d5`. It passed [full CI](https://github.com/Do4ent/CADGUI/actions/runs/45027156645) and merged as `1d6804c`.
- Cross-parent mates store the leader-relative rigid transform and solve the follower in world coordinates. Detach or leader removal converts that solved pose to the follower’s own parent frame. Native schema v19 adds cross-parent endpoints.
- All 70 local suites, the production build and 13 focused Chromium tests passed. The document suite covered schema v18 compatibility, boundary detach and prune, and atomic rejection. Independent checks passed 128 rotated chains with parent motion and cycle rejection.

## Distance mates and product completion

- [PR #61](https://github.com/Do4ent/CADGUI/pull/61) at `eeac1ef` updates the v1 product completion ledger. The same nine packages and weights yield 41.25%, published as approximately 40% (35–45%). It passed [same-head CI](https://github.com/Do4ent/CADGUI/actions/runs/45030354838) and merged as `e86ee40`.
- [PR #62](https://github.com/Do4ent/CADGUI/pull/62), branch `feat/distance-mate`, worktree `/tmp/wt-distance-mate`, head `28ac6f3`. It passed [full CI](https://github.com/Do4ent/CADGUI/actions/runs/45030357398) and merged as `58e130c`.
- The new mate drives distance between occurrence origins along the captured bearing and maintains relative orientation. It supports edit, detach, Undo and schema v20 persistence. The assembly maturity tier remains 50% while broader geometric mates and BOM are pending.
- 70 local suites, the production build, 14 focused Chromium tests, 128 independent mixed distance/fixed chains, and all 224 PR browser tests passed.

## Angular mates

- [PR #63](https://github.com/Do4ent/CADGUI/pull/63), branch `feat/angular-mate`, worktree `/tmp/wt-angle-mate`, head `80bac51`. It passed [full PR CI](https://github.com/Do4ent/CADGUI/actions/runs/45037427069) and merged as `0b25f93`.
- Set a signed heading within ±180° about the leader’s local +Z using the projected follower +X. Heading changes retain the captured tilt and roll and the leader-local offset. Singular projections are rejected. Native schema v21 preserves the mate.
- Focused solver and document tests and 128 independent cross-parent angular/distance chains passed. The production build, all 70 local suites and 15 focused Chromium tests passed. The overall readiness estimate remains 41.25%, published as about 40%.

## Snapshot-bound planar face references

- [PR #64](https://github.com/Do4ent/CADGUI/pull/64), branch `feat/planar-face-references`, worktree `/tmp/wt-planar-reference`, head `ceb41e9`. It passed [full PR CI](https://github.com/Do4ent/CADGUI/actions/runs/45039987435) and merged as `5ab73b4`.
- OCCT returns exact planar surface descriptors. Occurrence references use the source ID, exact snapshot SHA-256 and native face ordinal. Geometry changes mark a reference stale. This foundation has no native schema change and requires a later assembly command to consume the references.
- Kernel checks covered exact box and cylinder geometry, worker provenance and allocation cleanup. Independent review covered rotated face normals and cross-module reference resolution. All 71 local suites, the production build and 13 focused Chromium tests passed. The overall readiness estimate remains approximately 40%.

## Exact planar coincidence mates

- [PR #65](https://github.com/Do4ent/CADGUI/pull/65), branch `feat/planar-coincidence-mates`, worktree `/tmp/wt-planar-mate`, head `c387600`. It passed [full PR CI](https://github.com/Do4ent/CADGUI/actions/runs/45059965110) and merged as `570dacf`.
- Exact OCCT face catalogs drive opposite-normal, zero-gap alignment. The solver keeps the in-plane translation of the follower origin and uses the shortest rotation. Schema v22 persists refs and a solved relative pose. Explicit native import verifies the stored face ordinals and pose against OCCT. Workspace recovery checks BRep identity and structure synchronously.
- 128 local rotation samples plus parallel/antiparallel limits passed. Independent review passed 8,192 varied orientations. All 72 local suites, the production build and 16 focused Chromium tests passed. Overall readiness remains approximately 40%.

## Viewport planar face picking

- [PR #66](https://github.com/Do4ent/CADGUI/pull/66), branch `feat/viewport-plane-picking`, worktree `/tmp/wt-viewport-plane-picking`, head `2529eb0`. It passed [full PR CI](https://github.com/Do4ent/CADGUI/actions/runs/45062735152) and merged as `36002b1`.
- The mate dialog enters an explicit picking mode. Same-snapshot OCCT native face ordinals are mapped onto rendered mesh ranges, rejecting ambiguous hashes, curved faces and stale occurrence identities. Exact catalog selection is available. Native schema is unchanged.
- Kernel checks passed 1,097 assertions, including creation and inspect paths, planar versus curved geometry and collision rejection. The production build, all 72 local suites, and six focused Chromium tests passed. Overall readiness remains approximately 40%.

## Planar mate draft face highlighting

- [PR #67](https://github.com/Do4ent/CADGUI/pull/67), branch `feat/planar-face-highlights`, worktree `/tmp/wt-planar-highlight`, head `fd9ef3c`. It passed [full PR CI](https://github.com/Do4ent/CADGUI/actions/runs/45182982085) and merged as `6496c3a`.
- The leader and follower faces are distinguished in blue and orange while configuring a planar mate. Exact native face ranges are bound to each occurrence and BRep snapshot, follow viewport clipping, and do not receive raycast hits. Stored documents are unchanged.
- Exact range unit checks passed. The full 72-suite local test run, production build, and seven focused Chromium tests passed. Overall readiness remains approximately 40%.

## Assembly bill of materials

- [PR #68](https://github.com/Do4ent/CADGUI/pull/68) passed [full CI](https://github.com/Do4ent/CADGUI/actions/runs/45186686319) at `4ffc690` and merged as `fb857ff`.
- The assembly workspace aggregates occurrences by source body ID, shows counts per nested placement, and exports CSV. Core and browser tests cover nesting, identical names, CSV quoting, deletion, and Undo. Product readiness remains approximately 40% under the v1 maturity rubric.

## Assembly BOM on a drawing sheet

- [PR #69](https://github.com/Do4ent/CADGUI/pull/69), branch `feat/assembly-bom-drawing`, worktree `/tmp/wt-bom-drawing`, head `6cce638`. [Full PR CI](https://github.com/Do4ent/CADGUI/actions/runs/46122218488) was in progress.
- The drawing command inserts an editable snapshot on the active sheet. It uses the drawing table schema and history, preserves grouped quantities and placements, distinguishes duplicate names, and warns when the table exceeds the sheet.
- All 74 local suites and the production build passed on 637f4ba, identical product code to the final test-only head. Four focused Chromium tests passed with the final E2E scenario. Product readiness remains approximately 40%.

## Resume

Run `git fetch origin` and `git log -1 --oneline origin/main` to verify the starting commit. Inspect PR #69 at its latest head. Merge only after full CI and review. For every finished plan item report its name and the current rounded v1 product readiness, even if the maturity level is unchanged. Use the nested assembly and fixed mate browser tests as regression coverage.

The worktrees for this stage use `/tmp` because the workspace overlay ran out of space. Fresh installs can use `npm ci --cache /tmp/cadgui-npm-cache`. Restore a missing worktree from the remote branch using Git. Preserve uncommitted changes and inspect actual agent status when resuming.
