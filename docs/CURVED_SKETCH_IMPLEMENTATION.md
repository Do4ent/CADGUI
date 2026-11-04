# Circular sketches and nonlinear constraints — bounded stage

## Scope and representation

This stage extends the existing ordered-polyline sketch contract with optional circular geometry. A circle references exactly two existing points, center and rim. An arc references exactly three, center, start and end, with an explicit counterclockwise flag. An absent geometry field retains the earlier polyline meaning. These are separate profile modes; arbitrary mixed line/arc contours, multiple loops and holes are outside this delivery.

A circle is closed. A closed arc means a sector: center-to-start radial edge, the circular arc and end-to-center radial edge. An open arc is editable curve geometry and cannot be extruded as a solid profile. Coincident start/end directions do not implicitly mean a full circle; use the circle mode. Radius, sweep, references and endpoint geometry require validation before extrusion.

The native document version advances to v6. Earlier v5 polyline definitions retain the absence of the optional geometry field; migration must not introduce new circular behavior or mark previously clean documents dirty. IDs refer to points, not array positions. Mode conversion must state which geometry and constraints are reset rather than silently reinterpret incompatible constraints.

## Equations and degrees of freedom

The nonlinear extension adds positive point-to-point distance and equality of two segment lengths. Circular arcs additionally require equal center-to-start and center-to-end radii. This implicit equation belongs in solving, residual checking and rank accounting; moving an endpoint onto a circle after solving is not a substitute.

Circle geometry has four scalar point coordinates. Fixing the center removes two degrees of freedom, and fixing its radius removes one. The rim direction remains one intentional degree of freedom unless another constraint fixes orientation. A circular shape being visually determined does not make every defining point fully constrained. Presets may fix that orientation explicitly. Arc defining-point freedoms similarly depend on the actual independent equations.

Numerical solving is local to an initial configuration. A solver result must report residuals, rank and remaining degrees of freedom at the solution, and reject invalid/nonfinite geometry before commit. Iteration failure does not prove mathematical inconsistency. Singular configurations can make a local Jacobian rank misleading; no global uniqueness, complete nonlinear constraint coverage or exact symbolic solution is claimed. Distance equations need consistent scaling and zero-length handling. Existing linear-only sketches retain their earlier linear solver path.

## Exact extrusion and dependency lifecycle

The OCCT backend constructs actual circular geometry for disks and sectors, followed by signed extrusion; it does not approximate the source circle with a polygon before creating the solid. Display tessellation remains approximate. Local plane normals remain XY +Z, XZ −Y and YZ +X. Counterclockwise direction is defined in local sketch coordinates, and signed depth follows that plane normal.

The sketch definition is the source of linked BRep geometry. Radius, endpoints, direction, plane or depth changes rebuild all linked extrusion bodies into a detached candidate. The source and every rebuilt body commit as one scene-history transaction only after validation. Failure, cancellation or a newer document revision must leave the existing document unchanged. Body metadata and IDs survive rebuilding; face IDs remain revision-local.

Native import rebuilds linked source geometry before accepting it as current, then validates exact bodies. Browser recovery retains the last saved BRep snapshot; structural reference validation alone does not certify that arbitrary edited storage matches the source. Preserve a recoverable last-good snapshot until rebuilding succeeds. This stage does not add a general feature dependency graph or persistent topological naming.

## Verification status and gates

The root integrator reports 312 real OCCT analytic checks passing for the backend at this stage, including all sketch planes, positive/negative depth, clockwise/counterclockwise quarter, half and major sectors, BRep handling and arena cleanup. This is backend evidence, not acceptance of the pending nonlinear solver, UI or final integrated document lifecycle.

Final solver implementation and end-to-end verification remain pending at this documentation commit. Required checks include radius/length edits that move actual points, independent rank and redundancy, arc equal-radius residuals, fixed-orientation versus free-angle DOF, incompatible and nonconvergent cases, old linear regressions, v5/v6 native roundtrip, atomic multi-body rebuild, cancel/undo/redo, stale callbacks and production-worker browser execution. Record final module/build/browser/CI results on the delivery commit before merge.

Not included: tangent, angular, concentric or general geometric constraint families; splines/ellipses; mixed-contour regions; arbitrary trimmed model-edge projection; holes; nonlinear global solution enumeration; revolutions, sweeps or lofts.
