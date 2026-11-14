# BREP revision references foundation

`src/kernel/references.ts` provides a runtime reference session. This is an independent foundation; viewport selection and document serialization are not changed by this package. It does not implement persistent topology naming, edge references, or geometric matching.

## Consumer contract

1. Create one `GeometryReferenceSession(documentId)` for each open-document lifetime. Do not reuse it when closing/reopening or replacing a document, even if the stored ID is identical.
2. Call `sync(exactModel)` after every committed exact-model change, including deletion, undo and redo. Body revisions compare the complete BREP text; appearance-only edits preserve identity. A → B → A does not restore the previous revision. IDs deleted then recreated receive new revisions.
3. Capture the input BREP when dispatching inspection. Call `bindInspection(bodyId, capturedBrep, result)` only for trusted kernel inspection results. A late response for an obsolete BREP returns false. Consumers must not mutate kernel results. Group ranges are copied and checked for complete, nonoverlapping index coverage.
4. Call `captureFace(bodyId, triangleIndex)` on the currently bound displayed mesh, then `resolve(reference)` before highlighting or offering an operation. A face reference contains a result-identity mesh token and group ordinal, so coincident OCCT face hashes cannot select multiple visual groups. The returned range is measured in triangle indices, not triangles.
5. On worker reset or tessellation policy changes, call `invalidateInspections()`. Rebind fresh inspections. Shared viewport consumers should share the same session and cached result objects; rebinding the same trusted result preserves its token.
6. Resolve again on confirmation. Clear a face selection when resolution is stale/broken, or explicitly downgrade to body selection. Hidden bodies make face references unavailable. Source deletion is broken; changed BREP/session/mesh is stale. Invalid reference schemas throw rather than returning a misleading success.

The caller owns atomic document commits, async document/revision guards, and cancellation. A failed or cancelled rebuild which commits no BREP must not call `sync` with its draft. The API cannot infer an inspection's true input provenance from mesh geometry: `capturedBrep` must come from the request, never the current body fetched after completion.

## Scope and limits

References and session/mesh tokens are transient and must not be persisted as durable CAD constraints. Reloading a document requires a new selection. Tokens identify the exact displayed result, not a face that survived rebuilding. Body IDs remain document-owned; no native WASM handles escape the kernel. Kernel-backed operations still need an explicit method to resolve the selected visual face to current native topology; this module does not authorize that mapping by face hash.

`references.test.cjs` uses actual OCCT boxes/cylinders and face groups to verify source revisions, undo-like A/B/A transitions, deletion/recreation, appearance changes, stale inspection rejection, mesh replacement/reset, duplicate face hashes, malformed ranges, and strict reference validation. Existing rendering and persistence paths remain unintegrated until a separate reviewed change adopts this API.
