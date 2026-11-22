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

- [PR #60](https://github.com/Do4ent/CADGUI/pull/60), branch `feat/cross-parent-fixed-mates`, worktree `/tmp/wt-cross-fixed-mates`, head `41475d5`. [CI](https://github.com/Do4ent/CADGUI/actions/runs/45027156645) was in progress.
- Cross-parent mates store the leader-relative rigid transform and solve the follower in world coordinates. Detach or leader removal converts that solved pose to the follower’s own parent frame. Native schema v19 adds cross-parent endpoints.
- The focused document suite passed schema v18 compatibility, boundary detach and prune, and atomic rejection. Independent checks passed 128 rotated chains with parent motion and cycle rejection.

## Resume

Run `git fetch origin` and `git log -1 --oneline origin/main` to verify the starting commit. Check PR #60 at its current head and merge after passing same-head CI and review. Use the nested assembly and fixed mate browser tests as regression coverage.

The worktrees for this stage use `/tmp` because the workspace overlay ran out of space. Fresh installs can use `npm ci --cache /tmp/cadgui-npm-cache`. Restore a missing worktree from the remote branch using Git. Preserve uncommitted changes and inspect actual agent status when resuming.
