# Codex instructions — BendCore CAD Pro

## Project
Repository: Do4ent/CADGUI. This is a React/TypeScript/Three.js/Vite CAD UI prototype, not a complete geometric CAD kernel.

## Sources of truth
- docs/IMPLEMENTATION_ROADMAP.md — priorities and acceptance criteria
- agents/orchestrator.md — coordination and integration
- agents/ui-ux.md — dialog and technical SVG icon design
- agents/documents.md — document lifecycle
- agents/interaction.md — selection and viewport/tree interaction
- agents/cad-workflows.md — parameterized command workflows
- agents/qa.md — testing and CI quality gates

## Execution
1. Read the roadmap and the relevant specialist instruction before changing code.
2. Work in an isolated branch or worktree per independent task; avoid concurrent edits to src/main.tsx, src/style.css or other shared files.
3. Delegate independent work to separate Codex workers only if the execution environment supports it. Do not claim agents are running unless actually started.
4. Create small PRs against main. Integrate only after review and successful CI.
5. Preserve existing behavior, storage compatibility and keyboard shortcuts.
6. Run npm test and npm run build; run Playwright browser tests when the environment permits. Report commands, failures and CI run URLs accurately.
7. Do not disable tests or type checking to mask failures.
8. No fabricated CAD geometry functionality: distinguish UI preview from precise kernel operations.

## Approved design
- Industrial, compact and flat.
- Square corners on dialogs, buttons, fields, dropdowns and switches: border-radius: 0.
- Each parameter label has a meaningful preferably multicolor 16–20px SVG technical icon, consistent across the application.
- Light and dark themes; readable labels, accessible focus, inline validation, units and tooltips.
- Enter/Escape, OK/Cancel/Apply when applicable; preview only where supported.

## Initial task order
1. Establish green CI baseline, fixing actual regressions.
2. Integrate reusable dialogs and multicolor technical icons.
3. Implement document lifecycle, multi-selection and validated CAD command workflows as independent modules.
4. Add browser regression coverage and merge in dependency order.

## Existing branches / draft PRs
- feature/dialog-system — PR #1
- feature/documents — PR #2
- feature/selection — PR #3
- feature/cad-workflows — PR #4
- quality/regression — PR #5
- coordination/orchestrator — coordination branch

Do not merge the draft PRs without verifying their code and test coverage.
