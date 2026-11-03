# Drawing dimensions implementation status

The 126-entry, 16-group research specification is connected through explicit
runtime metadata. Registration is not a claim that all 126 capabilities are
implemented. Unavailable commands retain an actionable reason; no generic editor
or decorative mutation is accepted as a substitute for unsupported geometry.

## Scope and contracts

The first delivery targets driven dimensions of real two-dimensional drawing
geometry. Fourteen measurement kinds are defined: horizontal, vertical, aligned,
rotated, point-to-line, parallel lines, radius, diameter, two-line angle,
three-point angle, arc length, ordinate X/Y and chamfer. A kind in the contract
still requires its geometry, renderer and browser acceptance checks.

Driving constraints, true model topology, normative fit calculations, 3D PMI,
STEP AP242 and semantic DWG/DXF DIMENSION require separate backends and remain
unavailable. Paper coordinates must not be reported as true 3D measurements.
Manual datum/GD&T symbols do not establish a typed semantic tolerance backend.

The catalog exports `dimensionCommands`, `dimensionCommandGroups` and
`getDimensionCommand(id)`. It mirrors specification labels, descriptions, groups
and phases with stable DIM IDs. Unknown IDs return undefined. `action` names an
exact Workspace route; `kind` supplies the measurement type only where relevant.
`requiresSelection` is a minimum UI prerequisite, not geometric validation.

Workspace owns create/edit dialogs, group creation, style/format/tolerance
editing, source selection and repair, freeze/detach/restore, copy/delete/bulk
operations, inspection metadata, diagnostics, JSON and static export routing.
An editor must expose the specific requested parameter rather than report
success without performing it. A document style library is distinct from an
embedded dimension style; filtered selection is distinct from selecting all.

## Ownership

| Worker | Files / responsibility |
| --- | --- |
| Root integrator | Shared contracts, Workspace route, app wiring and dependencies |
| CAD workflows | Pure measurement/format/defaults engine; no scene mutation |
| Interaction | Dimension SVG primitives, bounds and source geometry rendering |
| UI/UX | Validated dimension editor and parameter fields |
| Documents | Dimension schema and backward-compatible persistence |
| QA | Actual dimension browser workflows and regression checks |
| Orchestrator | Catalog metadata, parity tests and this status document |

Each worker uses its own worktree and exclusive files. Shared contracts remain
root-owned. Confirmation validates the entire definition before history/autosave;
Cancel leaves the original entity, dirty state and source geometry unchanged.

## Verification status

Catalog parity tests check all 126 IDs, 16 groups, labels/descriptions/phases,
known actions and kinds, capability explanations, shared group identity and
unknown-ID rejection. These tests verify metadata, not route execution.

The integrated delivery has passed 23 local module/static/functional suites and
TypeScript/Vite production build. Browser and CI evidence is recorded in the
pull-request checks for the delivery commit; catalog tests alone are not browser
acceptance evidence.

## Delivered interaction and limits

- 126 stable IDs in 16 groups: 74 routed commands and 52 explicitly unavailable
  capabilities. A routed command is a real interaction, not a declaration that
  every detail of its broader research contract is complete.
- Create/edit fourteen 2D measurement kinds; entity anchors and manual points;
  actual dimension/extension lines, arrows, labels, masks and selectable bounds.
- Geometry editor for source lines, circles/ellipses and explicit circular arcs.
  Source changes rebuild both measurement and graphic layout. Dimension hit
  boxes do not cover and intercept unrelated source geometry.
- Shared-base, chain and ordinate groups preserve source identities and use one
  history transaction. Snapshot/resume/detach preserves measured geometry.
- Embedded and named styles, copy/reset/apply, alignment/spacing, filtered
  selection, inspection labels, manual label restoration and source diagnostics.
- Primary/alternate units, decimal precision, trailing zeros, rounding increment,
  signed tolerances, limits, basic frames and reference formatting. A tolerance
  value or text override never modifies the source geometry.
- Native JSON stores definitions, styles, references and snapshots. SVG/PDF are
  static representations. Static DXF emits text and line geometry; circular
  graphics are tessellated with a declared 0.01mm target and 2048-segment limit.
  It is not semantic DIMENSION/DWG/PMI interchange.

Remaining constraints are visible and deliberate: horizontal/vertical uses the
paper axes; point-line/parallel measurements use infinite support lines;
angular dimensions use the smaller 0–180° angle. Arbitrary reflex sectors,
finite-segment distance mode, model/view coordinate conversion, fractional and
architectural unit strings, leading-zero suppression and dashed dimension line
styles are not implemented. Numeric labels are plain/formatted text, not full
rich-text runs. Text metrics, label collisions and font availability probes are
approximate; font probing does not certify full Unicode coverage. Template
standard profiles do not imply ISO/ASME/GOST certification. Advanced disabled
routes explain their specific missing adapter or workflow.

## Bounded acceptance gates

- Real (0,0)→(3,4) geometry produces horizontal 3, vertical 4 and aligned 5;
  translated/rotated inputs obey the chosen context. Radius and diameter differ.
- Degenerate, missing, nonfinite or incompatible sources fail before mutation.
  Source changes rebuild both numeric label and graphic layout.
- Unit conversion, precision, rounding and zero policy preserve raw measurement.
  Signed tolerances/limits/basic/reference modes validate independently.
- Manual display override is visible; restore removes the override and resolves
  the current source. Freeze is a marked snapshot; detach retains explicit points.
- Chain, baseline and ordinate groups retain distinct reference mathematics.
  Group actions and bulk edits create one undo transaction.
- Editor opens the requested controls, validates inline and respects cancellation,
  focus return, both themes and global-shortcut suppression while editing.
- Reopen preserves definitions, source references, styles, tolerance and history
  boundaries between documents; invalid imports do not overwrite newer state.
- SVG/PDF and static DXF are snapshots, not semantic DIMENSION/PMI interchange.
- Run module checks, TypeScript/Vite build and real browser regressions on the
  actual integration head, then record CI evidence before merge.
