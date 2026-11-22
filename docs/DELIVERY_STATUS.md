# Delivery status — 2026-11-22

Baseline `d241cee` on `main` includes exact-body occurrences and fixed assembly mates. BendCore is a working CAD prototype with an Open CASCADE WASM exact-solid backend.

## Delivered capabilities on the baseline

| Area | Bounded behavior | Scope reference |
| --- | --- | --- |
| Documents and UI | Native versioned JSON, migration, tabs, dirty guards, recovery feedback, per-document session history, shared dialogs, Ribbon and themes | [Roadmap](IMPLEMENTATION_ROADMAP.md) |
| Drawing | Real text workflows, driven 2D dimensions, source editing and static exports | [Text](DRAWING_TEXT_IMPLEMENTATION.md), [dimensions](DRAWING_DIMENSION_IMPLEMENTATION.md) |
| Model annotations | World/component-bound visual 3D notes and leaders, native persistence | [3D notes](MODEL_ANNOTATION_IMPLEMENTATION.md) |
| Exact geometry | Real OCCT solids, BRep, meshes, geometric properties, bounded STEP geometry interchange | [Exact kernel](EXACT_KERNEL_IMPLEMENTATION.md) |
| Sketches | Linear/nonlinear bounded constraints, polyline/circular/mixed contours and source-linked inner contours | [Sketches](SKETCH_IMPLEMENTATION.md), [curves](CURVED_SKETCH_IMPLEMENTATION.md), [mixed contours](MIXED_SKETCH_IMPLEMENTATION.md), [holes](SKETCH_HOLES_IMPLEMENTATION.md) |
| Linked operations | Extrusion, signed local-axis revolution, finite cuts and two-operand fusion; atomic rebuild, ownership and cascade handling | [Revolution](SKETCH_REVOLUTION_IMPLEMENTATION.md), [cuts](SKETCH_CUT_IMPLEMENTATION.md), [fusion](PARAMETRIC_FUSION_IMPLEMENTATION.md) |
| Modeling history | Unified history, suppression and restoration of dependent branches, adjacent independent sibling operations can be reordered | [History update](https://github.com/Do4ent/CADGUI/pull/52), [reorder](https://github.com/Do4ent/CADGUI/pull/53) |
| Assembly | Same-document exact-body occurrences with independent placement, fixed mates with cycle validation and native persistence | [Occurrences](https://github.com/Do4ent/CADGUI/pull/54), [mate solver](https://github.com/Do4ent/CADGUI/pull/55), [mate workspace](https://github.com/Do4ent/CADGUI/pull/56) |

Native document schema is v16. Undo history lasts for the current session. STEP interchange covers geometry.

## Verification

See the [fixed-mate PR checks](https://github.com/Do4ent/CADGUI/pull/56/checks) and the [main CI run for the baseline](https://github.com/Do4ent/CADGUI/actions/runs/45005148769). Each later head requires its own verification.

## Remaining product gaps

Nested assembly occurrences, additional mate types, persistent topological naming, broader feature editing and sketch solving, associative drawing views, semantic GD&T/PMI, sheet-metal bend/unfold and production-scale performance remain open at this baseline.

Historical P0 package labels in the roadmap are acceptance history rather than a current whole-product completion tally. Use the [completion-score methodology](PROJECT_COMPLETION_SPEC.md) only with its declared denominator and evidence limits.

## Release gates

Every implementation PR needs module checks, TypeScript/Vite production build, relevant production-browser regressions and independent review on its actual head. Existing tests must retain their assertions. A failing or still-running required check blocks merge. Record commit SHA, command/result and CI run URL; passing an older head is insufficient. Documentation changes receive their own applicable checks.
