# Autonomous delivery checkpoint

Updated 2026-11-22. Verify branches, commits, and CI before resuming.

## Verified baseline

- Main `d241cee` includes exact-body occurrences and fixed mates through [PR #56](https://github.com/Do4ent/CADGUI/pull/56). It passed 70 local check suites, the production build, and [main CI](https://github.com/Do4ent/CADGUI/actions/runs/45005148769).
- [PR #57](https://github.com/Do4ent/CADGUI/pull/57) records the shipped assembly and modeling-history workflows. Check the [documentation CI run](https://github.com/Do4ent/CADGUI/actions/runs/45005710735) for its merge gate.

## Nested subassemblies

- [PR #58](https://github.com/Do4ent/CADGUI/pull/58), branch `feat/nested-subassemblies`, worktree `/tmp/wt-nested`, was opened at `b6b8575`. Its [CI run](https://github.com/Do4ent/CADGUI/actions/runs/45006236429) was in progress at this checkpoint.
- The stage adds named groups, local transforms and occurrence paths in native schema v17. Reparenting preserves the world transform. Fixed mates apply to root occurrences. The viewport uses world transforms and the local values are retained in the document.
- Independent review checked cyclic and missing parents, identifier collisions, migration, history, viewport wiring and 1,000 rotated reparenting scenarios. Production browser acceptance passed the nested fixture and existing assembly occurrence and fixed-mate tests.

## Resume

Run `git fetch origin` and `gh pr view 58 --json state,headRefOid,mergeStateStatus,statusCheckRollup` to identify the current head. Review any changes since `b6b8575`. Run `npm test`, `npm run build` and the assembly and document browser tests against the production preview. Merge after same-head CI and independent review succeed. If a check fails, inspect the failing assertion and reproduce it on the exact head.

The worktrees for this stage use `/tmp` because the workspace overlay ran out of space. Fresh installs can use `npm ci --cache /tmp/cadgui-npm-cache`. Restore a missing worktree from the remote branch using Git. Preserve uncommitted changes and inspect actual agent status when resuming.
