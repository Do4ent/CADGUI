# Source-linked finite sketch cuts — bounded stage

## Model and feature graph

Optional `sketchModel.cuts` contains up to 50 entries `{id, sketchId, bodyId, targetBodyId, depth}`. Each feature owns a separate stable output body; the target remains an independent stored body. Targets may be static exact bodies, linked extrusion bodies or outputs of earlier cuts. Feature and output identities must be unique across linked operations, and output IDs cannot collide with static bodies.

The dependency relation is a directed acyclic graph. Validation rejects missing targets, self-targeting, cycles and conflicting ownership before kernel work. Rebuild order follows dependencies rather than trusting array order, with stable ordering for independent features. Extrusions rebuild first; a cut must use the newly rebuilt target BRep rather than the previous stored output.

This is a bounded dependency graph for sketch extrusions and cuts. Independent boolean results remain snapshots. General feature reordering, suppression, rollback editing and dependencies through arbitrary boolean operations are outside the delivery.

## Exact geometric behavior

A closed source region creates a finite OCCT prism in the sketch plane with its signed depth. The backend subtracts that actual prism from the target using OCCT, rather than altering a display mesh. Millimetre coordinates, world origin offsets and XY +Z / XZ −Y / YZ +X normals retain existing semantics.

Regions may include supported inner contours. Those inner contours are holes in the cutting tool, so material inside them remains unless removed by another part of the operation. Blind and through cuts are finite prisms positioned by the source plane/origin and depth; there is no automatic through-all or up-to-face extent mode.

A cut must remove positive material while leaving a valid nonempty solid result. Nonintersecting tools, surface-only contact, no-removal outcomes and complete target removal are rejected before document mutation. Volume comparisons need tolerances appropriate to numerical scale and kernel precision; they are not a manufacturing tolerance certificate. A cut may split a target into multiple solids, retained in the existing compound-body representation within its supported 1–100-solid limit.

## Transactions and visibility

Creating a cut adds its output and hides its retained target in the same scene transaction. The user may show the target again. Rebuilding preserves existing output ID, name, color and visibility rather than repeatedly resetting appearance. Source-profile edits rebuild all dependent outputs, including downstream cuts, into detached candidates. Failure, cancellation or a newer document revision commits neither source nor partial geometry.

Generic direct BRep replacement is rejected for owned cut outputs and static targets consumed by cuts; changing dependent geometry requires the atomic rebuild route. Native import rebuilds linked features in dependency order before accepting stored BRep as current. Last-good browser recovery snapshots remain recoverable until a successful rebuild.

Removing a cut cascades to descendant cut outputs. Source or target deletion also prunes dependent features and outputs using the dependency graph, while retaining unrelated bodies and sketch definitions. The target is revealed only if it still exists and no remaining cut consumes it. Shared-target branches therefore do not reveal a consumed target prematurely. Hole-source deletion may change a tool region; if any resulting cut fails, the entire deletion/rebuild is rejected.

Undo/Redo must restore sources, graph links, target/output visibility and every affected BRep together in one scene-history step. Face IDs remain body-revision-local and selection is cleared when rebuilding changes topology.

## Native schema and verification

Document schema v9 supports the optional cuts field. Earlier v8 documents retain field absence and previous clean/dirty fingerprint meaning; migration does not add hidden cut behavior. Structural validation checks graph and ownership, but stored valid BRep alone does not establish correspondence with source features.

At this documentation commit implementation and final integrated tests are pending. Required acceptance includes analytic blind/through cut volumes and bounds, signed depths in all planes, regions with holes, no-op/contact/full-removal failures, split-solid results, reversed feature-array order, cycle/missing-target rejection, multi-level source recompute, shared-target deletion, failure rollback, metadata/visibility persistence, stale callbacks, v8/v9 roundtrip and production worker/browser/CI verification on the final delivery head.
