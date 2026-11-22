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

- [PR #64](https://github.com/Do4ent/CADGUI/pull/64), branch `feat/planar-face-references`, worktree `/tmp/wt-planar-reference`, head `ceb41e9`. [Full PR CI](https://github.com/Do4ent/CADGUI/actions/runs/45039987435) was in progress.
- OCCT returns exact planar surface descriptors. Occurrence references use the source ID, exact snapshot SHA-256 and native face ordinal. Geometry changes mark a reference stale. This foundation has no native schema change and requires a later assembly command to consume the references.
- Kernel checks covered exact box and cylinder geometry, worker provenance and allocation cleanup. Independent review covered rotated face normals and cross-module reference resolution. The overall readiness estimate remains approximately 40%.

## Resume

Run `git fetch origin` and `git log -1 --oneline origin/main` to verify the starting commit. Check PR #64 on its current head. Merge after same-head CI and review. The next package uses these references in an assembly face picker and mate command. For every finished plan item report its name and the current rounded v1 product readiness, even if the maturity level is unchanged. Use the nested assembly and fixed mate browser tests as regression coverage.

The worktrees for this stage use `/tmp` because the workspace overlay ran out of space. Fresh installs can use `npm ci --cache /tmp/cadgui-npm-cache`. Restore a missing worktree from the remote branch using Git. Preserve uncommitted changes and inspect actual agent status when resuming.
