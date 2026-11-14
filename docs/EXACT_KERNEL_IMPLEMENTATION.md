# Exact geometry foundation — Open CASCADE

This release adds a bounded exact-solid workflow alongside the legacy prototype scene. It uses pinned `occt-wasm` 5.15.0 (OCCT WebAssembly); see [third-party notices](../THIRD_PARTY_NOTICES.md).

## Working workflows

The **Точная геометрия** panel creates boxes and Z-axis cylinders from numeric dimensions and origin coordinates in millimeters. It performs union, subtraction and intersection on two existing bodies. Results become new bodies; operands remain available. STEP import/export and body inspection use the same worker-backed adapter.

Volume (mm³), area (mm²), bounds (mm), centroid and topology counts are computed from BREP by OCCT. Rendering uses OCCT tessellation and edge samples. Tessellation is a derived display representation, never the source for volume or STEP export. There is no mass value without material density.

STEP imports retain geometric placement and disconnected solids as one compound record. Free surfaces/curves, empty intersections, invalid solids and oversized input are rejected. This initial geometry-only adapter does not preserve assembly trees, part colors, names, PMI or original authoring features. Export writes the selected body as AP214 in mm. The backend tests also verify importing inch-unit STEP with conversion to mm exactly once.

Face picking/highlighting uses OCCT face groups within the current serialized body. Those identifiers are revision/session-local; persistent references across editing/rebuilding and sketch/feature history are future work. Legacy model notes keep their current world/component anchors and do not acquire face references automatically.

Exact face selection is therefore transient and revision-bound. The UI accepts a face only for the originating document, body BREP and exact inspection result; it also verifies that the face group exists in that mesh. A body rebuild or a new inspection generation removes the face selection rather than transferring a coincident numeric hash to different geometry. A surviving rebuilt body may remain selected without a face. This prevents false identity but is not persistent topological naming and is not serialized in the native document.

## Documents and transactions

Schema v4 adds `exactModel` with kernel/version, explicit mm units and native text BREP bodies. Versions 1–3 migrate to an empty exact collection. Legacy components retain their original conditional scene coordinates; they are not silently converted into exact geometry or reinterpreted as mm.

Exact bodies share model Undo/Redo with legacy components and visual notes. Drawing history remains independent. Dirty markers, local recovery and native save/open include BREP. Pure document validation checks the exact schema and serialization limits; actual geometry validity is checked in the worker. Explicit native JSON imports inspect every BREP before opening a tab. Invalid input or an unsuccessful operation does not change the source document/history.

The worker serializes OCCT operations and releases every request's arena handles on success or failure. A timeout or worker crash terminates it and rejects pending requests; the next operation starts a fresh worker. UI transactions retain the originating document/state and discard cancelled or stale replies. At most eight inspected geometries are cached; multiple viewports share inspections rather than repeating OCCT work.

## Loading and limits

The kernel is loaded lazily in a module Worker. The generated glue and ~21 MB WASM are emitted as separate application-local assets at the configured Vite base; no CDN is required. A modern browser supporting the WASM features used by this build is required. Initialization errors are visible and retryable.

Initial limits: 100 body records, 10 million characters per BREP/STEP input, 25 million characters of native BREP per document, 200,000 display triangles per operation, coordinates within ±1,000,000 mm and positive primitive dimensions from 0.00001 to 1,000,000 mm. Face/edge editing, automatic healing, arbitrary model measurements, IGES and a constraint solver are not part of this release.

## Verification

Tests execute the actual OCCT WASM rather than replacing it with formulas. Cases cover analytic box/cylinder/bored-cylinder volumes, all three boolean operations, disconnected solids, mesh/index groups, native BREP, mm/inch STEP round trips, malformed input and arena cleanup. Browser tests exercise real worker loading, create/inspect/save/reload, mixed history, compound STEP exchange, failed asset loading/retry and rejected imports. Existing drawing and annotation regression suites remain enabled.
