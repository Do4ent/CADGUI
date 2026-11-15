# Body common / subtraction runtime checkpoint

Branch: `feature/body-boolean-runtime`; worktree: `/workspace/wt-body-boolean-runtime`.
Base: `d2e93f7`. Includes PR36 foundation and PR37 controlled dialog.

## Completed core checkpoint

`238cfaeedfae1597e18598f634eb7ed8609ffcef` implements schema12 optional absent-preserving `bodyBooleans`, shared strict validation without model recursion, common/cut dependency nodes, ownership/deletion cascades, hook static operand guards, native strict positive-material intersection before subtraction, and fresh predecessor rebuild.

Gates passed: TypeScript build; native bodyBooleanRuntime 50 checks; existing graph adapter 69 checks; document persistence/regression suite including actual OCCT common/cut BREP, missing references, static guards, shared operands, atomic deletion/Undo. Existing panel/tree focused suites passed while UI is under integration. Documents independent review found no persistence blocker; output metadata labels corrected.

## In progress

SketchPanel create/edit/delete UI and shared dependency tree are implemented but not yet committed. QA is independently preparing `e2e/test_body_booleans.py`; final contract: buttons “Пересечь тела”, “Вычесть тела”, “Изменить булеву операцию”, “Удалить булеву операцию и зависимые тела”; rows `data-body-boolean-id`, operation `common|cut`. Source is `sketchModel.bodyBooleans`.

## Remaining gates / next actions

1. Add focused panel staging tests, recheck selection/edit/delete and generic dependency rendering; commit UI.
2. Rerun full npm test and production build; fix failures without disabling checks.
3. Run QA real-browser tests against production preview: actual 4mm³ common/cut, strict no-op rollback, fresh chains, persistence/reload, Undo/delete and stale tab guard. Preserve exact A−B direction and operands.
4. Add missing meaningful regressions identified by independent Documents/UI reviews.
5. Push branch and create a runtime PR, not merge. Existing foundation/UI PRs may be merged independently; root can rebase/cherry-pick integration commits after comparing main.

No persistent face/topology naming is introduced. Runtime uses fresh body BREP and whole-body references only. Source/input/result commit remains atomic; native rejection does not alter history or dirty state.

## UI checkpoint

`fae2dca` wires real controlled common/subtraction create/edit/delete into SketchPanel, shared dependency rows, cycle-safe operands, atomic source/native commit and branch-aware retained-input visibility. Focused panel/tree suites and TypeScript build passed. QA browser commits picked through `39c44c1` (new file only).

Current gates: full `npm test` and `npm run build` running on the integrated branch. QA will run production preview on port4182 after build. Remaining: actual browser failures/fixes, final full checks if code changes, PR creation and independent review. Last completed native and persistence checkpoint remains `238cfae`.

## Final integration gate checkpoint

Runtime commits rebased cleanly onto merged foundations/UI at `origin/main` `3635e58`:
- Core/native/schema/history: `3f5db80` (previously `238cfae`).
- UI: `8daa72d` (previously `fae2dca`).
- QA browser file: through `ca36af8` (previously `39c44c1`).

Completed gates: full `npm test` passed 63 suites; production build passed; independent QA ran all 8 real production-browser cases on port4182, all passed (169.22 seconds). Independent Documents review passed actual schema12 BREP/history tests and found no blocker. Native runtime follow-up now passes 55 checks including STEP and default operation names; derived-target labels distinguish body booleans from static bodies.

Final rebase/follow-up requires one final full test/build run before runtime PR. The original foundation and dialog PRs are merged separately; this branch now contains only runtime integration changes. No merge authorization is exercised by this agent.

## Runtime PR ready for review

PR: https://github.com/Do4ent/CADGUI/pull/39 (not merged).
Final implementation head before this documentation update: `a152b2a30477c42955689bbab645a60ca99c1632`.

Final rebased-head gates completed: `npm test` PASS63 suites; `npm run build` PASS. The native body runtime suite passed55 checks including STEP. Independent QA's production suite passed8/8 cases; final rebuilt-dist analytic smoke is delegated to QA. Independent Documents review found no blockers. CI review and merge remain the root Orchestrator's responsibility; this agent does not merge.

Next bounded work after approval: optional Ribbon/search entry points, broader body-boolean native compound/large-scale acceptance expansion, and separately planned feature-history operations. Current CAD workflow is available through SketchPanel and is fully source/native linked.
