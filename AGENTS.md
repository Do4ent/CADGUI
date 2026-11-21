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
3. Run independent deliverables in parallel when the environment supports it. Use one worker for a local change, usually two or three for independent core/UI/test work, and add a specialist reviewer for kernel, persistence or migration risks. Count the integrator in this budget. Do not fill slots without distinct deliverables or claim agents are running unless actually started.
4. Create small PRs against main. Integrate only after review and successful CI.
5. Preserve existing behavior, storage compatibility and keyboard shortcuts.
6. Run focused checks in specialist branches. On the integration PR, run npm test, npm run build and the applicable Playwright acceptance checks. Require successful full PR CI before merge. Report the SHA, commands, failures and CI URLs.
7. Do not disable tests or type checking to mask failures.
8. No fabricated CAD geometry functionality: distinguish UI preview from precise kernel operations.

## Model and context budget

- Announce the function before starting each new task. Give workers the base SHA, expected deliverable, owned paths, relevant instructions, interface and acceptance commands. Inherit the conversation only when its history is needed.
- When model selection is authorized, prefer a fast model for bounded edits and targeted tests. Reserve deeper reasoning for geometry invariants, atomic updates, migrations and hard failures. Use Git and GitHub CLI for routine status checks.
- Agree on shared interfaces before parallel implementation. Use a single integration build for browser acceptance. Start failure analysis with the first failing assertion and a focused reproduction.
- Before pausing, record branch, SHA, PR, evidence tied to that SHA, unfinished work and the command to resume in [the delivery checkpoint](docs/AUTONOMOUS_CHECKPOINT.md). Verify it against Git and CI when resuming.
- Full CI runs on pull requests, pushes to main and manual dispatch. For a branch without a PR, run focused checks locally or dispatch CI explicitly.

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
