# Source-linked body common / subtraction

## Delivered runtime contract

Native schema12 optionally persists `sketchModel.bodyBooleans` (maximum 50):

```ts
type BodyBooleanFeature = {
  id: string; bodyId: string;
  aBodyId: string; bBodyId: string;
  operation: 'common' | 'cut';
};
```

`common` is solid intersection; `cut` is directed A minus B. Inputs are retained exact bodies, including imported/static bodies or outputs of extrusion, revolution, sketch cut, fusion or another body boolean. Input/output IDs are distinct; feature/output ownership is globally unique. Missing static inputs and all cross-kind cycles fail before native execution. Existing optional-field absence and saved/dirty fingerprints survive schema11 migration.

The shared dependency sorter rebuilds fresh predecessor BREP before dependents. Output IDs, custom names, colors and visibility remain stable. New output names identify intersection/subtraction. Shared history commits source plus every rebuilt output in one operation. Failed, cancelled or stale computations commit neither; undo/redo restores paired native/source snapshots. Input visibility and deletion reveal respect sibling consumers; deleting either operand or a source feature cascades through all dependent kinds.

## Native policy

The new strict `body-boolean` backend request invokes actual OCCT `common` / `cut`. Subtraction requires positive valid solid material in the actual intersection; it does not infer change by subtracting nearly equal large volumes. Disjoint/touch-only subtraction, empty or face-only common, and complete material removal are rejected. Positive-volume compound results remain within the existing 1–100-solid limit. The older generic `boolean` request retains its existing behavior.

SketchPanel exposes create/edit/delete controls and the controlled BodyBooleanDialog. A−B operands are explicitly ordered. Self/descendant outputs are excluded from retarget choices. Exact body selection uses the existing revision-bound runtime; this feature does not introduce persistent face naming.

## Reusable validation and planning

`bodyBooleanValidation.ts` holds the pure strict draft validator used by the native model. `bodyBooleanModel.ts` remains a detached diagnostic/removal adapter for additional drafts. It reuses the central graph instead of a second topological sorter; no shadow feature is executed as fusion.

`diagnoseBodyBooleanGraph(existing, additionalFeatures, availableBodyIds)` returns detached tagged rebuild nodes or explicit diagnostics. Proposed derived outputs need not exist yet; this is a planning API, not native document reference validation. `validateSketchReferences` requires all persisted owned outputs and inputs in the committed exact model. The document hook separately prevents a new output from claiming an unrelated independent body's ID.

`planBodyBooleanRemoval` returns a detached source/draft/output-ID removal plan without changing exact bodies or visibility. It preserves unrelated sketches/operands and legacy optional absence. Native model validation imports only the pure validator, avoiding recursion through the external adapter.

## Validation gates

The implementation checkpoint records current SHAs and final gates. Regression coverage includes analytic real-OCCT common/subtraction, strict no-op/full-removal rejection, fresh dependency outputs, STEP, atomic failures, actual native persistence and unified undo, legacy clean/dirty migrations, cross-kind cycle-safe staging and retained-operand visibility. Production browser tests cover real UI execution, editing, deletion, rollback, reload and stale-tab isolation.

## Scope limits

This is whole-body solid feature history. Surface/face boolean results, empty result features, face-driven operations, persistent topology naming, arbitrary feature reordering and suppression are not provided. All standard coordinate, BREP-size and native mesh complexity limits remain enforced. Inputs are retained; no destructive boolean replacement is implied.
