# Delivery status — 2026-11-14

Baseline: `main` at `fe50e11` (completion-score documentation), following parametric fusion merge `dd844be` ([PR #23](https://github.com/Do4ent/CADGUI/pull/23)). This is a bounded working CAD prototype with an Open CASCADE WASM exact-solid backend, not a complete mechanical CAD system. Earlier claims that no implementation was merged or no geometry kernel existed are obsolete.

## Delivered capabilities on the baseline

| Area | Bounded behavior | Scope reference |
| --- | --- | --- |
| Documents and UI | Native versioned JSON, migration, tabs, dirty guards, recovery feedback, per-document session history, shared dialogs, Ribbon and themes | [Roadmap](IMPLEMENTATION_ROADMAP.md) |
| Drawing | Real text workflows, driven 2D dimensions, source editing and static exports | [Text](DRAWING_TEXT_IMPLEMENTATION.md), [dimensions](DRAWING_DIMENSION_IMPLEMENTATION.md) |
| Model annotations | World/component-bound visual 3D notes and leaders, native persistence | [3D notes](MODEL_ANNOTATION_IMPLEMENTATION.md) |
| Exact geometry | Real OCCT solids, BRep, meshes, geometric properties, bounded STEP geometry interchange | [Exact kernel](EXACT_KERNEL_IMPLEMENTATION.md) |
| Sketches | Linear/nonlinear bounded constraints, polyline/circular/mixed contours and source-linked inner contours | [Sketches](SKETCH_IMPLEMENTATION.md), [curves](CURVED_SKETCH_IMPLEMENTATION.md), [mixed contours](MIXED_SKETCH_IMPLEMENTATION.md), [holes](SKETCH_HOLES_IMPLEMENTATION.md) |
| Linked operations | Extrusion, signed local-axis revolution, finite cuts and two-operand fusion; atomic rebuild, ownership and cascade handling | [Revolution](SKETCH_REVOLUTION_IMPLEMENTATION.md), [cuts](SKETCH_CUT_IMPLEMENTATION.md), [fusion](PARAMETRIC_FUSION_IMPLEMENTATION.md) |

Merge ancestry establishes delivered code, not that every historical roadmap acceptance item is complete. Research catalogs remain requirements, not lists of implemented commands. Current native schema is v11. Undo history is per session; it is not restored across browser reload. STEP geometry is not semantic PMI or a full assembly/product-data interchange.

## Current acceptance work

[PR #25](https://github.com/Do4ent/CADGUI/pull/25) protects transient exact-face selection with document/BRep/rendered-mesh identity. It does not implement persistent topological naming. At this status snapshot it remains under review; do not describe its unmerged behavior as part of the baseline.

Independent local selection/render module checks passed during review. The first full browser attempt stopped at 10 passed / 1 failed: inspecting a retained hidden cut target showed the selected result's volume instead of the source's volume. A hidden-body selection correction is being integrated and must be checked on a rebuilt production app, followed by a complete rerun. Pending-body selection also requires document isolation. These observations are scoped to that review attempt, not final PR status.

No successful final-head CI run is asserted here. PR checks and the exact tested SHA are authoritative. See the [parallel delivery plan](PARALLEL_DELIVERY_PLAN.md) for independent next packages and integration gates.

## Remaining product gaps

Persistent geometric references, broad feature editing/reordering/suppression, complete nonlinear sketch solving, real assembly occurrences/mates, associative drawing views from model topology, semantic GD&T/PMI, sheet-metal bend/unfold and production-scale performance remain separate work. Existing visual notes, exact geometry and source-linked features must not be described as absent.

Historical P0 package labels in the roadmap are acceptance history rather than a current whole-product completion tally. Use the completion-score methodology in PR #24 only with its declared denominator and evidence limits, if that document is present on the reviewed branch.

## Release gates

Every implementation PR needs module checks, TypeScript/Vite production build, relevant production-browser regressions and independent review on its actual head. Existing tests must retain their assertions. A failing or still-running required check blocks merge. Record commit SHA, command/result and CI run URL; passing an older head is insufficient. This documentation PR changes no runtime source and still receives its own applicable checks.
