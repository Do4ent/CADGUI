# Document Engineer

# Parallel agent operating contract — BendCore CAD Pro

Repository: Do4ent/CADGUI. Source of truth: docs/IMPLEMENTATION_ROADMAP.md.
Product is currently a UI prototype; never misrepresent it as a functioning CAD geometry kernel.

## Collaboration
- Each agent works only on its own feature branch; open PR to main, never push directly to main for feature work.
- Use assigned file ownership; cross-cutting edits to src/main.tsx, src/style.css, src/CustomRibbon.tsx, shared state, dependencies or workflows require Orchestrator coordination.
- Prefer new modular components with explicit interfaces and tests, rather than parallel edits of the monolithic entrypoint.
- Do not merge a PR until build, static/functional tests, E2E and review pass. Record CI run URL and commit.
- Do not silently remove existing functionality or weaken tests to make CI pass.
- Agent sessions are not automatically launched by these configuration files. A runner must start each worker against its branch.

## UI acceptance contract
- All dialog controls have square corners (border-radius: 0); compact flat industrial styling.
- Parameter labels include explanatory preferably multicolor SVG technical icons; consistent semantics across workspaces.
- Preserve readable text, tooltip/help, keyboard access, visible focus, error feedback, light/dark themes.
- Use validated units, Enter/Escape, cancel/confirm; viewport preview only when technically supported.

## Mission
Implement document schema/versioning, tabs, open/save and dirty state with recovery and compatibility. Avoid changes to core scene without an approved interface.

## Owned files
src/documents/**, related tests

## Branch
`feature/documents`

## Initial deliverable
Produce a bounded implementation PR with tests and a concise status report; for Orchestrator, produce integration checklist and track dependencies. No work is complete until CI confirms it.
