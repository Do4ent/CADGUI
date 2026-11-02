# BendCore CAD Pro — staged implementation roadmap

Status: started 2026-11-02. Scope: UI prototype, not a CAD geometry kernel.

## Approved UI design contract
- Sharp square corners throughout: border-radius: 0 for dialogs, controls, dropdowns and buttons.
- Compact, flat industrial appearance, 1px separators, consistent spacing; light and dark themes.
- Each parameter label has a meaningful, preferably multicolor SVG technical icon (16–20px), with a text label and accessible explanation. Use the same symbol for the same parameter across workspaces.
- Use a small semantic palette: geometry blue, angular operations orange, materials green, coordinate axes violet, preview cyan, errors red; combine 2–4 colors where helpful. Never rely on color alone.
- Standard dialogs: descriptive title, validated units and inputs, inline errors, Enter/Escape behavior, OK/Cancel and optional Apply. Non-modal panels for commands requiring viewport selection. Preview only where technically supported.
- The approved extrusion mockup is a visual reference, not proof of geometry functionality.

## Work packages and acceptance criteria

### P0-01 — CI baseline and regression stabilization [IN PROGRESS]
- Repair failing browser tests and rerun CI.
- Exit: npm test, TypeScript/Vite build and browser tests pass on the same commit.

### P0-02 — Shared dialog and technical icon system [NEXT]
- Add reusable typed dialog, parameter field, icon mapping and form validation components.
- Apply square corners and consistent design tokens without disrupting existing docking/ribbon.
- Exit: accessible keyboard behavior, unit tests and visual snapshots in both themes.

### P0-03 — Document lifecycle
- New/open/save/export document, multiple document tabs, dirty-state warnings, explicit JSON schema versioning and migration.
- Exit: reopening preserves content; cancel protects unsaved changes; invalid files report errors.

### P0-04 — Selection and visibility
- Ctrl/Shift multi-select, 3D/tree synchronization, box selection, isolate/show/hide on sets.
- Exit: deterministic selection and undoable visibility operations, including E2E tests.

### P0-05 — Parameterized command workflows
- Convert demo commands to validated forms (create/edit box, cylinder, pipe; delete, duplicate and transforms).
- Preview and confirm/cancel semantics; don't claim exact CAD geometry beyond prototype capability.
- Exit: no command silently mutates a model before confirmation; undo/redo works.

### P1-06 — Feature history and property editing
- Operation history, editable properties, dependency awareness, reliable undo/redo.
- Exit: state persists and remains consistent across reload and editing.

### P1-07 — Workspaces
- Sketch UI, assembly relations UI, drawing layouts/annotations UI, sheet metal and tube workflow scaffolds.
- Exit: every enabled command has a working interaction or is clearly marked unavailable.

### P1-08 — Usability and scale
- Customizable Ribbon, feedback/status, error recovery, keyboard navigation, large-tree rendering.
- Exit: accessibility checks and representative large-model performance budgets.

### Continuous — Quality gates
- Static tests, functional tests, browser E2E, theme/visual snapshots, invalid-data cases and CI artifacts.
- Update README and documentation after each completed package.

## Delivery rules
1. Implement one bounded feature set per commit/PR.
2. Run automated checks; record exact CI run and result.
3. Do not mark an item complete before verification.
4. Keep user data backward compatible; avoid silent destructive migrations.
