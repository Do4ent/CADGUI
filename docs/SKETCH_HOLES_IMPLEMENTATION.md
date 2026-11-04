# Sketch regions with inner contours — bounded stage

## Source contract

An optional `holes` array links an outer sketch to up to eight other closed sketch IDs. All contours use the same XY/XZ/YZ plane and must be coplanar in world coordinates. In-plane origins may differ: each inner contour is mapped into the outer sketch's local coordinates before geometric validation and kernel construction. The normal-coordinate offset must satisfy the implementation's coplanarity tolerance.

References must exist and cannot repeat, refer to the outer sketch itself, form a cycle or introduce an inner sketch that itself owns holes. Multiple independent outer sketches may reference the same hole sketch. This delivery supports one outer boundary with one level of disjoint inner boundaries; nested islands, general region graphs and automatic region discovery are outside scope.

Polyline, circle, standalone closed-arc sector and connected mixed line/arc profiles can supply boundaries. A standalone sector includes its radial closure; an arc inside a mixed wire contributes only the curved edge. Open profiles do not define solid regions. Native document schema v8 adds this optional field while preserving absent `holes` fields and existing clean/dirty fingerprints in earlier documents.

## Region validation

Each inner boundary must lie strictly inside the outer boundary. Outer/inner contact, hole/hole contact, overlap, crossing, coincident intervals and nested holes are rejected. This must use finite lines, circular arcs and circles rather than display tessellation or only endpoint/centroid tests. In particular, an edge can leave a concave outer contour even when both endpoints are inside.

Containment and intersection checks must handle line/line, line/arc, arc/arc and full-circle cases, including tangent contact and sweep endpoints. Coordinate transformations apply origin offsets once, in the appropriate local plane axes. Numerical tolerances must remain physical-distance tolerances or explicitly account for the scale of algebraic discriminants; they are not manufacturing certification.

## Exact geometry and dependent edits

The kernel constructs actual OCCT wires, a face with inner wires and an extrusion. A perforated solid is not a visual mask or a hole drawn over a filled mesh. Kernel orientation handling does not waive source containment validation. Signed depth follows XY +Z, XZ −Y and YZ +X normals, as in existing sketch extrusion.

An inner-sketch edit affects every owner that references it. Rebuild produces all linked bodies in detached state and commits sketches, references and BRep together in one scene-history transaction. Any invalid region, kernel failure, cancellation or stale document revision leaves the original source and bodies unchanged. Body metadata persists; topology selection remains revision-local.

Deleting an inner profile prunes its references from all owners and fills the affected holes by rebuilding those owners atomically. Deleting an outer sketch removes its own linked bodies while preserving independently stored inner sketches and any other owners. Undo must restore definitions, references and all affected bodies together. A link-only update must never leave stale BRep that still contains a removed hole.

## Persistence, recovery and verification

Linked BRep remains derived from sketch definitions. Native imports rebuild linked source geometry before accepting it as current; browser recovery preserves last-good stored BRep until successful rebuilding. Structural schema validation checks references but cannot by itself prove that a cached BRep matches its source.

At this documentation commit implementation and final integration verification are pending. The root integrator's preliminary native experiment established a valid OCCT face/extrusion for outer radius 5, inner radius 2 and depth 3, with expected volume 63π, for both tested inner-wire orientations. This is an adapter feasibility check, not final feature acceptance.

Required delivery checks include analytic area/volume and bounds for all planes and both depth signs; in-plane origin offsets; circle/wire/mixed combinations; concave containment; tangent, nested and overlapping holes; invalid references/cycles; shared-inner edits; inner deletion/fill and undo; atomic multi-body failure; v7/v8 native roundtrip and dirty migration; stale callbacks; and production worker/browser/CI checks on the final commit. No broad nested-region or arbitrary-contour capability is claimed.
