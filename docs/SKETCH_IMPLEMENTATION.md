# Linear-constrained sketches and linked solid extrusion

## Bounded implementation

This stage adds an ordered 2D polyline sketch model in millimetres, an SVG editor and Open CASCADE extrusion of a single closed polygon. A rectangle is a convenience template, not the constraint solver. Points have stable IDs; consecutive points define edges, and the closed flag adds the last-to-first edge. The model is not an arbitrary disconnected segment graph.

The linear solver supports horizontal, vertical, coincident, fixed-point and signed X/Y distance constraints. It computes independent equation rank, remaining degrees of freedom, redundant scalar equations and residuals, and distinguishes inconsistent, under-constrained and fully constrained results. A fixed point and coincidence each contribute two scalar equations. Fully constrained does not imply a valid extrusion profile. Point movement adds a temporary fixed-point constraint and solves the remaining system; incompatible movement is rejected.

The SVG editor exposes point selection, pointer dragging, an optional 1 mm grid, coordinate fields, point insertion/removal, profile closure and constraint creation/edit/removal. Editing operates on a draft. Confirmation validates the accepted sketch and rebuilds dependent geometry; cancellation leaves document content unchanged. Numeric validation and browser acceptance must be checked on the final integration head.

## Planes and exact geometry

Sketch planes are XY, XZ and YZ with a world-space origin. Their positive normals are respectively +Z, −Y and +X; signed extrusion depth follows that normal. Sketch coordinates are mapped to world millimetres once. Legacy display components retain their separate representation.

The extrusion backend builds actual OCCT edges, a wire, a planar face and a prism. It does not substitute a display box for a polygon. Open, degenerate, repeated-point or self-intersecting profiles fail before successful body creation. The first stage supports one polygon without holes; circles, arcs, splines, tangent/angle constraints and other nonlinear solving are outside this delivery.

## Dependency lifecycle and history

`sketchModel` contains version 1 millimetre sketches and extrusion links `{id, sketchId, bodyId, depth}`. Each linked body has one extrusion owner. Rebuild computes detached results for every linked extrusion before the document hook commits the sketch model and exact model together. Any rebuild failure leaves both original models unchanged. Existing body IDs, names, colors and visibility survive rebuilding.

The scene history snapshot includes legacy components, 3D notes, exact bodies and sketch definitions. One successful confirmation creates one undo step. Drawing history remains separate. Draft/async guards capture document identity and the full document revision; cancellation, tab changes or newer edits prevent an old result from committing.

Deleting a sketch removes its linked extrusion bodies in the same transaction. Deleting an exact body prunes its extrusion link while retaining the sketch. Direct replacement of a linked body's BRep is rejected; sketch rebuilding is the update route. Boolean results remain independent snapshots, not downstream features in a general dependency graph. Face IDs remain body-revision-local and must not be treated as persistent topology references across rebuilding.

## Persistence and source truth

Native document schema v5 adds `sketchModel`. Versions 1–4 migrate to an empty collection while retaining earlier content. Workspace saved fingerprints append the empty sketch model without marking prior unsaved edits clean. Validation checks supported versions/units, finite bounded values, unique IDs, constraint references, consistent equations and extrusion/body references.

Sketch definitions and depth are the source for linked extrusion geometry; stored BRep is derived geometry. Structural schema/reference validation alone cannot establish that an imported BRep corresponds to its sketch. Native import/recovery and export policies must preserve that distinction: inspect exact geometry, rebuild linked geometry before accepting it as current, or explicitly report a stale snapshot. Do not discard a recoverable original body before a rebuild succeeds.

Current bounded limits are 20 sketches, 32 points and 128 constraints per sketch, and 50 extrusion links; coordinates and depth have a ±1,000,000 mm bound, with nonzero extrusion depth of at least 0.00001 mm in magnitude. These are application limits, not claims about kernel precision or manufacturing tolerances.

## Verification gates

Module suites cover solver rank/DOF, consistency and redundancy, immutable validation, profile checks, plane transforms, schema migration, linked-body protection, history and stale writes. Real-kernel checks must verify polygon volume and bounds, signed extrusion in all planes, BRep validity and complete failure rollback. Browser checks must exercise actual SVG dragging, constraint conflicts, linked recompute, undo/redo, native roundtrip and document isolation.

At this documentation commit the final application integration and browser/CI checks are pending. Test files and module implementations are present; their presence does not establish that the final delivery passed. Record final test/build/browser evidence on the integration commit before merge.

This stage does not provide a nonlinear sketch solver, face-attached sketches, projection of model edges, holes/multiple contour regions, revolve/sweep/loft, general feature suppression/reordering, persistent topological naming or assembly constraints.
