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

## Integrated implementation and limits

The root integration now mounts a separate SVG drawing sheet with the 102-entry,
12-group toolbox, explicit parameter editors, selection/placement and validated
schema-2 document persistence. Drawing history and selection are isolated per
CAD document. This is implementation coverage, not 102 completed acceptance gates.

| Capability | Actual integrated route | Limits |
| --- | --- | --- |
| Text, style, paragraph and placement operations | Exact TXT-ID operation dispatcher, detached drafts, SVG renderer | Font metrics, wrapping and layout checks remain approximate |
| Fields, title blocks, technical requirements and templates | Structured references, fields, tables and saved templates | Missing source data is reported; no invented measurements |
| Engineering symbols | Manual semantic annotations and geometry-linked drawing data | No normative certification or exact geometric CAD kernel |
| SVG | Real SVG serialization retaining text | Consumer font availability affects appearance |
| PDF | jsPDF export adapter | Verify extracted text and font behavior independently; not inferred from browser preview |
| DXF | Restricted TEXT/MTEXT/LINE writer/parser | Partial interchange with loss warnings; native DWG unavailable without an SDK |
| Font outlines | opentype.js adapter using a user-supplied TTF/OTF | Requires usable licensed font; output copy loses text semantics |
| OCR and review | Tesseract.js with local language assets and image/result review | Recognition errors require user review; source image is session-only |
| Spelling | nspell with local ru/en dictionaries | Engineering vocabulary needs user dictionary; no external text upload |
| Font substitution | Explicit persisted font mapping, renderer resolution and browser probes | Availability detection is heuristic; full Unicode glyph coverage and embedding rights are not certified |
| Vertical and RTL text | Native SVG/browser text shaping route | Approximate wrapping; complex-script/export fidelity still requires acceptance checks |

Two entire command routes are explicitly blocked with an explanation: TXT-050
needs absent hole/thread/bend topology, and TXT-091 needs an SHX-to-PDF-geometry
matching engine. TXT-089 exposes actual DXF interchange while explaining the DWG
limitation. OCR and outline export are runtime adapter operations, not permanent
catalog placeholders. TXT-099/TXT-101 describe the implemented editor history and
keyboard contract rather than inventing a document mutation for help commands.

Other partial behavior must remain visible: technical-requirement pagination is
by item count rather than automatic physical page fitting; drawing geometry and
manufacturing notes do not imply model topology; unsupported spline leaders,
SHX font fidelity, glyph coverage and complex layout must not be advertised as
complete. Command registration cannot hide these limits.

## Verification status

- Catalog checks passed for 102 exact IDs / 12 groups, source label/phase parity,
  group membership and unknown-ID rejection.
- The root integrator reports twelve npm suites and the TypeScript/Vite build
  passing during integration. This does not establish browser acceptance.
- Browser E2E is being executed and reviewed; this update does **not** claim a
  completed drawing E2E run or successful current-head CI.
- Local review found and root fixed stale callbacks overwriting another tab or
  newer drawing state. Regression execution remains part of the browser gate.
- Record final command coverage, latest head and CI URL only after those checks
  complete. Do not mark all 102 catalog capabilities verified from route counts.

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
