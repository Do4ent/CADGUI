# Body boolean integration — parallel package gates

Status snapshot: 2026-11-15. Baseline `main` is `d2e93f7`. This document coordinates delivery; it does not declare the proposed body-boolean runtime, schema or UI integration complete. CAD's separate `BODY_BOOLEAN_PLAN` and shared contracts remain owned by their assigned authors.

## Merged foundations and pending work

| Delivery | Baseline evidence | Actual boundary |
| --- | --- | --- |
| [PR #30](https://github.com/Do4ent/CADGUI/pull/30) | `080919f` | Browser regressions for backup recovery, dirty tabs and paused autosave |
| [PR #31](https://github.com/Do4ent/CADGUI/pull/31) | `e585e6c` | Archived recovery-resume transaction and reusable banner; helper/component delivery alone did not wire the final editor flow |
| [PR #32](https://github.com/Do4ent/CADGUI/pull/32) | `05d2fd0` | Cancellable shared dialogs for Ribbon customization |
| [PR #33](https://github.com/Do4ent/CADGUI/pull/33) | `d2e93f7` | Runtime selection bound to canonical transient geometry-reference sessions |
| [PR #34](https://github.com/Do4ent/CADGUI/pull/34) | Open draft, head `25ff3c8` at this snapshot | Editor recovery-banner/resume wiring; checks and browser acceptance remain required before merge |

Merge ancestry confirms baseline content, not success of a later integration head. PR #34's state is a dated snapshot; consult its current checks before claiming completion. Reference sessions prevent false revision identity; they do not provide persistent topological naming or stable face references across rebuilding.

## Proposed bounded body operations

The package extends source-linked operations with two retained-body inputs and a separate stable output for intersection (`common`) and subtraction (`cut`, A minus B). These differ from a sketch-region cut and from existing standalone snapshot booleans. Existing linked fusion remains its own operation. Inputs and outputs use body IDs, never display names or mesh hashes.

The initial core helper contract is `{id, bodyId, aBodyId, bBodyId, operation: 'common' | 'cut'}`, with at most 50 proposed entries. The pure helper validates detached proposals, diagnoses dependencies and plans removal; it is not by itself a native schema extension or executable feature. Documents proposes migration helpers separately. Root must freeze the final persisted contract and version before integration; do not label a proposed schema as already supported.

Cuts, fusions and body booleans require one stable topological rebuild order. Both operands participate in cycle detection, missing-input checks, ownership and cascade deletion. Feature/output IDs cannot conflict with extrusions, revolutions or existing boolean features. Missing static inputs fail preflight before any worker call. Every operation reads fresh candidate BRep from preceding results, not a stored stale output.

The backend must execute actual OCCT operations and validate nonempty, valid solid/compound results within existing limits. Empty intersection, complete subtraction and kernel failure need explicit feedback with no partial mutation. Define no-material-removal subtraction policy before release; do not silently treat a nonintersecting tool as a successful material-removing feature. Disconnected valid results may be compounds, not necessarily one connected solid.

## Exclusive ownership

| Owner | Assigned deliverable | Integration restrictions |
| --- | --- | --- |
| CAD workflows | New pure validator, generalized DAG diagnostics and removal plan with tests; its separate design plan | No edits to shared runtime types, kernel executor, editor hook or Orchestrator's document |
| UI/UX | New standalone controlled body-boolean dialog, styling and component tests | No `SketchPanel.tsx`, `main.tsx` or schema edits without root's explicit ownership transfer |
| Documents | Schema proposal and migration helpers/tests | Proposal is separate from active schema; shared hook/type integration requires root coordination |
| Interaction | Read-only integration design for selection, reference sessions and dependency presentation | No shared source edits at this design stage |
| Root integrator | Freeze shared contract, connect persistence/backend/rebuild/dialog/commands and transaction boundaries | Single editor for shared files during integration; request ownership transfer before parallel mutation |
| QA | Assigned new production-browser regressions and evidence | No weakening existing assertions or competing implementation edits |
| Orchestrator | Only this integration document on its own branch/worktree | No edits to CAD's plan, runtime source or other agents' documents |

Independent modules can advance in parallel. Root first reviews/finalizes their contracts, then integrates schema and core planning, then native rebuild and transaction guards, then UI/selection consumers, then production-browser acceptance. PR #34 recovery wiring is independent; a shared `main.tsx` change must be rebased and reconciled by root rather than edited concurrently.

## Transaction, visibility and reference gates

All source, feature-link, output BRep and visibility changes stage in detached candidates and commit in one scene-history step. Cancel, worker errors or stale document/revision/session reject the candidate. Undo/Redo restores the complete graph and outputs. Delete either operand or an operation output cascades through all dependent operation kinds while retaining unrelated bodies and source sketches.

Creation/retargeting visibility needs an explicit operand policy per operation. Released operands are revealed only when no remaining operation consumes them; ordinary rebuilds preserve user styling and visibility. Resolve references again before commands commit. Use captured inspection provenance and document/session lifetime guards; never infer a native topology identity from a face hash. Native import must rebuild source-linked geometry before accepting caches as current, while recovery preserves last-good data.

## Acceptance checklist — pending

- Strict proposal/schema validation, legacy field absence and clean/dirty migration; current files roundtrip without losing earlier operations.
- Stable mixed dependency order through sketch cuts, fusion and both new body operations; cycles through either input and missing targets rejected before execution.
- Actual OCCT analytic intersection/subtraction volumes, empty/full-removal failure, disjoint compounds where valid, and signed operand-order semantics.
- Fresh results after editing either source, complete downstream rebuild, immutable inputs, one-step undo and no partial output on a later failure.
- Cascade deletion from either operand, shared-branch consumption and visibility, metadata persistence and ownership overwrite guards.
- Dialog invalid/disabled/busy/stale/error feedback, cancel/focus behavior, duplicate names, distinct IDs, real commands and selection isolation.
- Production worker/browser regressions on the final integration head; module suites, build, independent review and required CI on that same head.

Record exact commit, command/result and CI URL before merge. Passing helper tests or creating a dialog does not complete runtime delivery. This docs-only PR does not approve an implementation merge; no merge occurs while required checks fail or remain pending.
