# Source-linked body common / subtraction: independent core

## Delivered foundation

`src/sketch/bodyBooleanModel.ts` validates detached drafts of up to 50 features:

```ts
type BodyBooleanFeature = {
  id: string; bodyId: string;
  aBodyId: string; bBodyId: string;
  operation: 'common' | 'cut';
};
```

`cut` means A minus B; `common` is the solid intersection. IDs must be nonempty safe strings; inputs and output must be distinct. Unknown fields, unsupported operations, duplicate draft feature/output IDs and sparse arrays are rejected. Validation clones inputs.

`diagnoseBodyBooleanGraph(existing, features, availableBodyIds)` combines the proposed features with current extrusion/revolution roots and dependent sketch cuts/fusions. It checks global feature/output uniqueness, static input existence and cross-kind cycles. Derived outputs need not exist in the cache yet. Invalid graphs return an empty order and explicit diagnostics; valid graphs return detached tagged nodes in rebuild order. Existing cut/fusion order takes precedence when several nodes are ready.

The adapter reuses `orderedSketchBodyFeatures` by representing the new nodes' two-input dependency shape as fusion nodes internally, then mapping them back to `kind: 'body-boolean'`. This temporary shadow is never returned or validated as a persisted source model and must never be sent to a native fusion executor. No second topological sorting implementation is introduced.

`planBodyBooleanRemoval(existing, features, removedBodyIds)` returns a detached `{state, features, removedBodyIds}` plan, cascading through both operands and all three dependent kinds. It retains unrelated source sketches, the other operands and absent legacy optional fields. It does not remove exact bodies, alter visibility, or publish a document update. It validates structural dependencies but intentionally requires no static-body existence list for deletion planning.

## Explicit boundaries

This foundation does not extend `SketchModelState`, the native document schema, runtime rebuild, backend, UI or storage. Its `features` collection is an external draft; it is not currently persisted. Tests cover validators, the real existing graph adapter and removal plans, without claiming native geometry execution.

The adapter imports and validates the current `SketchModelState`. A future extended model validator must not call this adapter recursively on itself: the current validator rejects new persisted fields, and a reverse import would create a validation cycle. Integrate the dependency logic in the central graph layer once, or explicitly project a validated legacy-shaped state for a detached draft.

The available-body list identifies existence, not ownership. A future document integration must separately prevent a newly created feature from claiming an unrelated independent body's output ID, while allowing valid previously owned cached results. Existing native-document/source revision guards remain required.

## Next integration package

- Add one optional native collection under an agreed storage name, keeping absence unchanged on legacy migration; advance schema version and preserve saved/dirty fingerprints.
- Extend central ownership, dependency ordering, cascade helpers and atomic source/result commit once. Rebuild both operation kinds using fresh predecessor BREP, never cached derived outputs.
- Existing `KernelRequest` boolean `common` / `cut` already executes real OCCT. Add a strict workflow policy for subtraction: reject no-material intersection using actual positive-solid `common` volume, rather than subtracting two large nearly equal volumes. Reject complete removal and empty/face-only common. Permit validated positive-volume compound results within kernel limits.
- Retain operands. Define explicit branch-aware visibility and deletion reveal behavior, stable output IDs/metadata, asynchronous revision guards and cancel/no-op semantics.
- Add native analytic volume/STEP tests, mixed graph source-edit rebuild and second-operation rollback tests, schema migration/undo tests, then browser interaction tests. None of these runtime capabilities is claimed delivered by this foundation.
