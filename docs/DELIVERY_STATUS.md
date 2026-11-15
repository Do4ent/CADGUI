# Delivery status — 2026-11-15

Baseline: `main` at `a5b112f`, including fusion ([PR #23](https://github.com/Do4ent/CADGUI/pull/23)), reference foundations (#27), accessible Ribbon dropdowns (#28), revision-bound selection (#25) and backup-generation recovery (#29). This is a bounded working CAD prototype with an Open CASCADE WASM exact-solid backend, not a complete mechanical CAD system. Earlier claims that no implementation was merged or no geometry kernel existed are obsolete.

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

## Latest merged foundations and evidence

- `c68bd40` ([PR #27](https://github.com/Do4ent/CADGUI/pull/27)): transient geometry-reference sessions with strict revision/mesh identity and diagnostics. This helper is not yet the viewport resolver and is not persistent topological naming. See [consumer contract](implementation/GEOMETRY_REFERENCES.md).
- `0c6449d` ([PR #28](https://github.com/Do4ent/CADGUI/pull/28)): keyboard-accessible Ribbon command dropdowns.
- `6690bbe` ([PR #25](https://github.com/Do4ent/CADGUI/pull/25)): exact-face selection guarded by document, BRep and rendered inspection identity; hidden retained sources remain inspectable as bodies. Earlier review failures were resolved before this merge; they are not open baseline blockers.
- `a5b112f` ([PR #29](https://github.com/Do4ent/CADGUI/pull/29)): validated retained backup generation for workspace recovery. Recovery from backup disables autosave and reports the need to export recovered documents, preserving original data.

The integrator reports 58 local suites and the production build passing on this baseline, with successful [CI run 43711777279](https://github.com/Do4ent/CADGUI/actions/runs/43711777279). That evidence applies to the baseline; later implementation heads require their own checks. This documentation update does not claim the newly assigned packages are complete. See the [parallel delivery plan](PARALLEL_DELIVERY_PLAN.md).

## Remaining product gaps

Persistent geometric references, broad feature editing/reordering/suppression, complete nonlinear sketch solving, real assembly occurrences/mates, associative drawing views from model topology, semantic GD&T/PMI, sheet-metal bend/unfold and production-scale performance remain separate work. Existing visual notes, exact geometry and source-linked features must not be described as absent.

Historical P0 package labels in the roadmap are acceptance history rather than a current whole-product completion tally. Use the [completion-score methodology](PROJECT_COMPLETION_SPEC.md) only with its declared denominator and evidence limits.

## Release gates

Every implementation PR needs module checks, TypeScript/Vite production build, relevant production-browser regressions and independent review on its actual head. Existing tests must retain their assertions. A failing or still-running required check blocks merge. Record commit SHA, command/result and CI run URL; passing an older head is insufficient. This documentation PR changes no runtime source and still receives its own applicable checks.
