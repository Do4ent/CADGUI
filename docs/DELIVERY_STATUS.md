# Delivery status — 2026-11-02

No implementation changes have merged into `main`. This remains a UI prototype without a geometric CAD kernel. Only P0-01 is marked verified complete.

## Verified evidence

| Stage | Commit | Successful CI | Browser result reported by integrator |
| --- | --- | --- | --- |
| CI baseline | `920fe95` | [41439426314](https://github.com/Do4ent/CADGUI/actions/runs/41439426314) | Baseline workflow includes browser checks |
| [PR #6: parameter dialogs](https://github.com/Do4ent/CADGUI/pull/6) | `a223f59` | [41440701762](https://github.com/Do4ent/CADGUI/actions/runs/41440701762) | 23 E2E passed |
| [PR #7: selection integration](https://github.com/Do4ent/CADGUI/pull/7) | `9113d1b` | [41440744406](https://github.com/Do4ent/CADGUI/actions/runs/41440744406) | 26 E2E passed |

Results apply only to the listed heads. Later changes need their own checks. Original specialist PRs #1–#5 have been advanced by the integrator with continuation work. Their original foundation review remains in [INTEGRATION_GATES.md](INTEGRATION_GATES.md).

## Document stage local verification

Branch `integration/document-lifecycle` implements versioned document import/export, legacy migration, multiple tabs, per-tab session history/selection, dirty close/navigation protection and recovery feedback. Active document names appear throughout the editor.

Local verification passed: six npm test suites, the TypeScript/Vite production build and 32 browser E2E tests at `7561c03`. The subsequent command-search focus correction at `a92969b` passed npm test/build and its focused Escape/no-mutation/focus browser regression. See [PR #8](https://github.com/Do4ent/CADGUI/pull/8) for the current head and CI result; local results do not substitute for CI on that head.

Dependency stack: **PR #6 → PR #7 → PR #8**, all targeting `main`. Review cumulative commits and integrate in dependency order after applicable checks and review succeed. No merges have occurred.

## Outstanding acceptance criteria

- P0-02: light/dark visual snapshots and complete dialog accessibility/visual review.
- P0-03: current-head CI and review gate on PR #8. Browser tests verify cancellation protects dirty contents and invalid imports preserve the current document. Undo/selection persist between tabs during the session; persistence across reload is not claimed.
- P0-04: viewport drag-box hit testing and browser gesture coverage. Set-selection helpers alone do not complete this feature.
- P0-05: validated edit/transform forms and full command coverage. Pipe thickness is validated but not persisted/rendered. Exact CAD geometry and previews remain unsupported.
- P1 packages remain planned; these deliveries do not establish dependency-aware feature history, full workspaces or large-model performance budgets.

Run `npm test`, `npm run build` and `python -m pytest e2e/ -v` on the same implementation head. Record failures and keep `main` unchanged until required checks and review pass.
