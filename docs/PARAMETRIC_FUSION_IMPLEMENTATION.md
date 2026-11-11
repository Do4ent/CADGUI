# Parametric fusion — bounded implementation package

## Scope and source contract

This package makes a two-body OCCT fuse operation source-linked. Each feature retains two exact operand bodies and owns a separate stable output body. Operands may be independent exact bodies or outputs of supported extrusions, revolutions, cuts or other fusions. References identify bodies, not mesh positions or display names.

The optional fusion collection is added with native document schema v11. Each feature carries its stable feature ID, output body ID and two operand body references. The exact shared type is the implementation contract; migration must preserve field absence and clean/dirty fingerprint meaning for older documents. Operand IDs must differ, outputs must not reference themselves, and feature/output ownership must remain unique across supported operations.

Fusion means a real OCCT union, not grouping meshes. Disjoint operands may produce a compound containing multiple solids; this is a valid union and must not be presented as a guaranteed single connected solid. The existing exact-body solid-count and geometry validation limits apply. Geometrically coincident operands with different IDs may also be valid inputs.

## Generalized dependency graph

Cuts and fusions share a dependency planner: cuts consume one body, fusions consume two. Independent exact bodies and rebuilt extrusion/revolution bodies provide roots. Stable topological ordering must consider both fusion operands and reject cycles or missing references before any kernel executor call. Serialized array order cannot substitute for dependency order.

Rebuild uses fresh candidate BRep for every upstream result. Source edits rebuild downstream cuts and fusions into detached candidates before one atomic document/history commit. A failure, cancellation or newer document revision preserves the original sources, links, bodies and appearance. Existing output IDs, names, colors and visibility survive successful rebuilding; face identifiers remain revision-local.

Generic BRep replacement of owned outputs or consumed operand bodies remains guarded. Deleting a source or operation cascades through dependent cuts and fusions, while retaining unrelated bodies and sketch definitions. Both incoming references must participate in ownership, cascade and missing-reference diagnostics.

## Interaction and visibility

Creation selects two retained operands and produces a separate output. Operand hiding and output creation belong to the same successful transaction; the user can show retained sources again. Editing operands hides newly consumed bodies and reveals released bodies only when no remaining feature consumes them. Ordinary rebuilds must preserve deliberate user visibility and output styling.

The UI must expose create/edit/delete behavior, actual source/output identities and inline validation. Candidate edits, invalid selection and cancellation must not mutate the document. The dependency tree must represent both incoming operand links, including branches shared with cuts, without relying on UUID-heavy display labels.

## Persistence and exclusions

Native import rebuilds source-linked geometry before accepting stored BRep as current. Browser recovery keeps the last-good saved snapshot until a successful rebuild; structural validity alone does not certify source/cache equivalence. Undo/Redo restores links, source state, output bodies and visibility together.

The existing standalone boolean intersection and subtraction commands remain independent snapshots; this package does not silently convert them into dependent features. It does not add general feature reordering, suppression, persistent topological naming, arbitrary boolean expressions, automatic healing or assembly relationships. A limited cut/fusion DAG is not a complete parametric CAD history system.

## Acceptance checklist — implementation complete, final acceptance in progress

The bounded implementation covers real OCCT overlapping-box union volume, disjoint compound solids, edits to either operand, mixed extrusion/cut/fusion chains, cycles and missing references, ownership/cascade behavior on both branches, metadata and branch-aware visibility, atomic rollback, cancellation/stale guards, one-step Undo, v10/v11 clean/dirty migration and native roundtrip. Module, build and focused production-browser gates pass on the delivery branch; the complete browser regression and same-head CI remain mandatory before merge.

Documentation and catalog presence do not establish acceptance. Record commit-specific module, native-kernel, browser and CI evidence before merge.
