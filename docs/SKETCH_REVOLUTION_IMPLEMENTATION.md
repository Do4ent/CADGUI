# Source-linked sketch revolution — bounded stage

## Feature contract

Optional `sketchModel.revolutions` contains up to 50 entries `{id, sketchId, bodyId, axis, offset, angle}`. Each revolution owns a stable separate exact-body output and references a closed sketch region. Feature and output IDs share the uniqueness and ownership rules of extrusions and cuts. A revolution output may become a target of a downstream cut; revolutions rebuild before topologically ordered cuts.

The axis belongs to the sketch's local plane. Axis `u` is the line v=offset directed along +U; axis `v` is u=offset directed along +V. The world origin and plane basis are applied exactly once. The angle is signed degrees with absolute value from 0.0001 through 360; direction follows the right-hand rule about the chosen world-space axis. The sketch normal is not the revolution axis. Arbitrary 3D axes, helical motion and automatic axis selection are outside scope.

## Source-region restrictions

Supported regions retain existing circle, polyline, closed-sector, connected mixed line/arc and inner-contour semantics. The entire outer boundary must remain on one side of the axis. Validation must inspect actual finite curved extrema as well as vertices; endpoint checks alone cannot exclude a curved edge crossing the axis.

Axis-aligned straight boundary portions and permitted arc endpoint contact support cases such as cylinders, cones and sphere-like profiles. Interior circular-curve tangency to the axis is deliberately excluded, including a full circle tangent to the axis. Thus a native kernel accepting a horn torus does not imply that this application enables that case. Cross-axis and self-intersecting revolved regions are outside this bounded stage. Strict inner-contour containment continues to apply.

## Exact geometry and dependencies

The backend constructs an actual OCCT face, including supported inner wires, and revolves it around the mapped axis. Display tessellation is derived from the resulting BRep. Full turns, positive/negative partial turns and valid endpoint poles require exact-kernel checks; mesh seams do not establish a geometry failure by themselves.

Sketch, axis, offset and angle edits rebuild detached candidate bodies and all dependent cuts before one atomic scene-history commit. Existing body IDs, names, colors and visibility persist. Failure, cancellation or a newer document revision leaves source definitions and every original BRep unchanged. Independent boolean snapshots do not become live dependencies.

Deleting a revolution removes its owned output and dependent cut descendants, while retaining unrelated bodies and source sketches. Deleting a source sketch cascades through its owned extrusions, revolutions and downstream cuts. Generic direct BRep replacement of owned outputs or targets consumed by cuts remains guarded. Body-revision-local face selections are invalidated on rebuilt geometry.

## Persistence and verification

Document schema v10 supports the optional revolution collection. Earlier v9 documents preserve absent fields and clean/dirty fingerprint meaning. Native import rebuilds linked source geometry before accepting cached BRep as current; browser recovery retains the last-good stored body until successful rebuilding. A valid BRep snapshot alone does not establish that it matches a revolution definition.

At this documentation commit implementation and final verification are pending. The root integrator's preliminary native experiment demonstrated valid positive volumes for signed quarter/full turns and a torus with major radius 3 and minor radius 1, whose expected volume is 6π². This is feasibility evidence, not final application acceptance.

Required checks include analytic cylinder/cone/sphere/torus or corresponding bounded profiles; signed partial-turn bounds; all sketch planes and both axis directions; offset world origins; curve extrema, allowed endpoint contact and excluded interior tangency; regions with holes; downstream cut recompute; ownership/cascade protection; failure rollback, cancel/undo/redo and stale revisions; v9/v10 native roundtrip; and production worker/browser/CI verification on the final delivery head.
