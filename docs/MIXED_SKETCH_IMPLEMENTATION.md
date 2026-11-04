# Mixed line/arc sketches — bounded implementation stage

## Contract and boundaries

This stage extends sketch geometry with an ordered list of line and circular-arc segments. Each segment has a stable ID and refers to existing point IDs. Lines have start/end references; arcs additionally have a center and counterclockwise flag. Segment order defines a connected contour: each end must match the next start, with final-to-first closure for a closed contour. Arc centers are auxiliary points rather than contour vertices.

The delivery targets a single connected contour without holes. It does not provide disconnected wires, nested regions, arbitrary segment graphs, splines, ellipses, automatic trimming or general profile-region detection. Existing polyline, circle and standalone-arc modes retain their separate semantics; a closed standalone arc still means a radial-closed sector. A mixed arc contributes only its curved edge, with no implicit radial closure.

Local coordinates and dimensions remain millimetres. Plane normals remain XY +Z, XZ −Y and YZ +X. Arc counterclockwise direction is measured in local sketch coordinates. Display paths are previews of the accepted geometry; exact solid creation uses actual OCCT line and circular-arc edges.

## Constraints and solving

Each mixed arc adds an implicit equal-radius equation for center-to-start and center-to-end. These equations participate in the actual residual/Jacobian and numerical rank; they are not repaired by independently projecting display points after solving.

The angle constraint specifies the directed rotation from vector A→B to C→D, in degrees from −180 through +180. Residual evaluation must handle angular wrapping and reject zero-length defining vectors. Tangency uses a center, common endpoint and the other line endpoint: the radius is perpendicular to the line at that common endpoint. Its references must match an actual adjacent line/arc pair in the contour; perpendicular arbitrary point vectors do not establish contour tangency. This contract covers line-to-arc tangency, not arbitrary curve-to-curve tangency.

The nonlinear solver is local and numerical. DOF and redundancy reflect independent Jacobian rank at the solution, not constraint-count arithmetic or proof of global uniqueness. Failure to converge is reported as a rejected result and does not prove mathematical inconsistency. Singular configurations, multiple branches and angle wrap boundaries require explicit tests. Prior linear-only sketches keep their linear path.

## Capsule acceptance example

The capsule template uses centers (0,0) and (L,0), bottom endpoints (0,−R)/(L,−R) and top endpoints (L,R)/(0,R). Its ordered contour is bottom line, right counterclockwise semicircle, top line and left counterclockwise semicircle. Width is the center-to-center X distance L; radius is R. For L>0 and R>0, the analytic area is 2RL + πR², bounds are [−R,−R] to [L+R,R], and extrusion volume is area times absolute depth.

Template constraints fix the left center, horizontal center/bottom/top relationships, center spacing and radius, and four line/arc endpoint tangencies. Each arc contributes its implicit radial equality. A template is a convenient construction, not a substitute for generic segment/reference validation and nonlinear solving.

## Topology, persistence and transactions

Validation must reject missing/duplicate IDs, disconnected or incorrectly ordered segments, zero-length edges, degenerate arcs, and self-intersection or overlap. Intersection tests must consider actual finite line segments and circular sweeps, including tangencies and coincident overlap. Adjacent segments may share their intended endpoint, but adjacency alone must not exempt an overlapping interval or an additional crossing.

Sketch source definitions remain authoritative for linked extrusion bodies. Changes rebuild all linked bodies into detached results before one atomic source/BRep history commit. Errors, cancellation and stale document revisions leave existing bodies and sketches unchanged. Body metadata persists; face IDs remain revision-local. Independent boolean results remain snapshots rather than downstream feature dependencies.

The native document schema must explicitly support the new geometry and constraint variants while preserving earlier fields and absent-geometry polyline semantics. Unknown variants remain errors. Existing saved/dirty fingerprints must preserve their meaning during migration. Native imports rebuild linked source before treating the derived BRep as current; browser recovery preserves the last-good stored snapshot until a successful rebuild.

## Verification status

This document records the frozen contracts and acceptance requirements while implementation is in progress. It does not claim final core, renderer, backend, browser or CI success. Required checks include generic ordered contours, invalid tangency references, wrapped angles, implicit-radii rank/residuals, analytic line/arc intersections, capsule area/bounds/volume in all planes and both depth signs, old-format roundtrip, atomic multi-body rollback, undo/redo and stale writes. Record results on the final delivery commit before merge.
