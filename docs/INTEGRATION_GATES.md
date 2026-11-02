# BendCore integration review — 2026-11-02

Scope: the application is a React/Three.js UI prototype. Confirmation forms and
mesh previews do not provide exact CAD kernel operations.

## Ownership and delivery order

| Work package | Exclusive implementation ownership | Integration dependency |
| --- | --- | --- |
| QA / CI | `e2e/**`, QA-specific tests, `.github/workflows/**` | Establish the baseline first |
| Dialogs | `src/components/dialog/**`, `src/components/icons/**`, `src/styles/dialogs.css`, colocated tests | Baseline, then root UI integration |
| Documents | `src/documents/**`, colocated tests | Stable item validation contract, then shared dialog integration |
| Interaction | `src/selection/**`, colocated tests | One selection state for tree and viewport |
| CAD workflows | `src/commands/**`, colocated tests | Shared dialogs and a single undoable commit boundary |
| Orchestrator | `docs/**`, integration review | Record evidence without declaring unverified work complete |
| Root integrator | `src/main.tsx`, `src/style.css`, `src/CustomRibbon.tsx`, shared dependencies and test-runner wiring | Coordinate all shared-file edits serially |

Each independent implementation uses its own branch/worktree. Specialists must
request shared-file changes through the integrator. New tests should use unique
names so multiple workers do not edit the same runner. Module PRs target `main`;
integration must account for dependencies that have not yet merged.

## Review of existing draft PRs

The following observations concern the original heads fetched on 2026-11-02.
All five are open drafts and contain one-file foundations, not finished roadmap
packages. None includes tests for its newly introduced behavior.

| PR | Head | Existing successful CI run | Remaining implementation/review |
| --- | --- | --- | --- |
| [#1](https://github.com/Do4ent/CADGUI/pull/1) | `2fac244` | [41399125393](https://github.com/Do4ent/CADGUI/actions/runs/41399125393) | Icons only; build reusable dialogs/fields, keyboard and focus behavior, inline errors, theme coverage |
| [#2](https://github.com/Do4ent/CADGUI/pull/2) | `ac7b7eb` | [41399130066](https://github.com/Do4ent/CADGUI/actions/runs/41399130066) | `unknown[]` items require validation before scene use; add migration, tabs, dirty-state guards and persistence tests |
| [#3](https://github.com/Do4ent/CADGUI/pull/3) | `c5eb456` | [41399134248](https://github.com/Do4ent/CADGUI/actions/runs/41399134248) | Stale range anchor gives index `-1`; add deterministic fallback, set visibility and actual tree/viewport integration |
| [#4](https://github.com/Do4ent/CADGUI/pull/4) | `e693f4b` | [41399138185](https://github.com/Do4ent/CADGUI/actions/runs/41399138185) | Validation accepts incomplete command parameters; require per-kind dimensions/constraints, draft confirmation and undoable commit |
| [#5](https://github.com/Do4ent/CADGUI/pull/5) | `83f94ab` | [41399142947](https://github.com/Do4ent/CADGUI/actions/runs/41399142947) | Checklist only; execute baseline and implement behavior coverage |

Existing CI success does not establish the unimplemented acceptance criteria.
Recheck the latest PR head after every push; never reuse old run success as proof
for changed code.

## Integration contracts

- Preserve existing item fields: `id`, `name`, `kind`, `pos`, `size`, `color`,
  `visible`, `group`; `kind` also supports legacy `shaft` and `gear` items.
- Read legacy `bendcore-items` data without silently destroying it. Validate
  imported coordinates and sizes as finite triples before rendering. Unsupported
  document versions must produce an explicit error.
- Keep document identity distinct from item identity. Switching tabs must retain
  each document's content, selection and undo history consistently. Dirty close
  cancellation must leave content and active document intact.
- Tree and viewport dispatch selection intent into the same reducer. Deleted
  items cannot remain selected. Visibility on sets commits one undo step.
- CAD drafts must not mutate scene state; cancel is side-effect free. Confirm
  validates all required fields and commits one undo step. Repeated confirm must
  not duplicate a completed operation.
- Dialog fields retain visible text labels and unit labels. Enter submits only
  valid input; Escape cancels; focus returns to the invoker. Modal keyboard
  handling must not also trigger global delete/duplicate shortcuts.

## Release checklist for each implementation head

- [ ] Review diff and ownership; check storage and shortcut compatibility.
- [ ] Run `npm test` and all new module tests.
- [ ] Run `npm run build` (TypeScript and Vite).
- [ ] Run `python -m pytest e2e/test_ui.py e2e/test_regression.py` against the build.
- [ ] For dialogs, inspect light/dark screenshots and keyboard/accessibility cases.
- [ ] Record exact commit, commands, results and completed CI run URL in the PR.
- [ ] Integrate only after review and successful checks on the applicable head.

This checklist is intentionally unchecked: it records required gates, not a claim
that the new implementation has passed them. No roadmap item is marked complete
by this review document.
