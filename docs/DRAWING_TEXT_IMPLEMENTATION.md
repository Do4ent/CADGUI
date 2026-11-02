# Drawing text implementation status

This delivery connects the drawing-text specification to a separate drawing
subsystem. The research catalog remains a statement of intended behavior, not
proof that every command has passed acceptance. No exact CAD kernel or standards
certification is implied.

## Ownership and integration

| Worker | Exclusive files | Integration boundary |
| --- | --- | --- |
| Orchestrator | `src/drawing/toolkitCatalog.ts`, this document | Stable IDs, groups and metadata; review coverage |
| CAD workflows | drawing model, operations, layout and diagnostics | Validate each exact TXT ID; no generic mutation fallback |
| UI/UX | TextEditor, TextInspector, drawing CSS | Explicit drafts, units, square corners, keyboard and themes |
| Interaction | DrawingSheet | Paper coordinates, hit testing, selection and placement |
| Documents | drawing schema and persistence hook | Validate before autosave; preserve legacy scene documents |
| QA | drawing browser regressions | Test real behavior and rejection paths |
| Root integrator | types, DrawingWorkspace, exchange, app wiring, dependencies | Shared contracts and serial integration |

Workers use separate worktrees. `src/drawing/types.ts` is owned by the root
integrator and must not be edited concurrently. The drawing entities are distinct
from the existing 3D scene Item objects.

## Catalog contract

`drawingCommands` contains all 102 stable TXT IDs and 12 groups from
`DRAWING_TEXT_TOOLKIT.json`. Each entry records label, description, phase,
selection requirement, input editor hint and a technical icon kind.
`drawingCommandGroups` groups those same entries; `getDrawingCommand(id)` returns
undefined for unknown IDs. Registration does not execute or enable a command.

The input kind is a hint for rendering an editor, not a validation schema.
Selection availability and input validity must be checked again by the operation
handler. The handler must route exact TXT IDs and report unsupported behavior;
changing an unrelated property and returning success is not an implementation.

Adapter-dependent commands carry a `capability` and explanatory `capabilityNote`.
The integrator resolves actual runtime availability: configured OCR with language
assets and user-supplied licensed fonts can enable recognition and outlines.
Missing adapters must retain source data and display an explicit reason rather
than simulate success. `unavailableReason` marks SHX/PDF recognition, for which
no matching backend exists. Restricted DXF support does not establish native DWG
support; that requires a separate SDK. Browser print or SVG text export does not
establish searchable, font-embedded PDF fidelity.

## Verification at catalog delivery

- Catalog metadata created for 102 IDs / 12 groups. This is metadata coverage,
  not 102 verified implementations.
- TypeScript check, all six npm suites and the production build passed locally.
- Executed catalog checks passed for all exact IDs, source label/phase parity,
  group membership and unknown-ID rejection.
- Drawing operations, renderer, persistence integration and browser acceptance
  remain pending review at this update.
- No new implementation CI result or complete feature claim is recorded here.

## Acceptance review before delivery

- Every enabled command performs its documented operation with validated input.
  Cancel leaves history, selection and persisted document unchanged.
- New drawing schema preserves rich runs, fields, paragraph structure, styles,
  leaders, sheet identity and stable references across reopen.
- Fields resolve actual source data; missing model properties and broken links
  remain visible rather than producing invented measurements.
- Dimensions, tolerances and manufacturing symbols retain semantic data and are
  not announced as geometric CAD calculations without a real model backend.
- SVG layout and editing agree on paper units, anchors, wrapping and rotation.
  Unsupported shaping/font metrics and missing glyphs must be reported.
- Find/replace preserves live fields; selection and document scope are honored.
- Import rejects malformed/nonfinite data before mutation; export describes any
  lost formatting, fields, text searchability or unsupported adapters.
- Each confirmed action creates one undo step; undo/redo, dirty guards, keyboard
  focus and both themes are checked in the integrated browser application.
- Run all module/static checks, TypeScript/Vite build and drawing/browser suites
  on the actual delivery head; record CI URLs without borrowing old-head success.
