# BendCore CAD Pro v2.7 — UI regression and persistence hardening

React + TypeScript + Three.js user-interface prototype, **without a CAD geometry kernel**.

## Changes
- Added `tests/functional-check.cjs`: executes the actual UI settings loader in an isolated VM, exercises environment/layout/section persistence and command enablement combinations, and checks key Ribbon/tree/properties/docking integration contracts.
- Rejected unknown persisted work-environment names.
- Strengthened validation of persisted docking layout, including floating-panel coordinates and sizes.
- Guarded writes to shortcut and docking preferences against unavailable/quota-limited localStorage.
- Filtered malformed shortcut mappings from persisted storage.

## Run
```bash
npm install
npm test
npm run build
npm run dev
```

## Test results in the packaging environment
- `npm test`: **PASS** — 111 existing static assertions plus 337 state-functional and UI-contract assertions.
- 5 TS/TSX files passed syntax transpilation.
- Dependency installation did not complete in this environment (timed out); **full type-check, Vite build, and real browser E2E interactions remain unverified**.

## Test coverage caveat
These are real state-level tests for the persisted settings loader and command registry, plus structural integration checks for Ribbon, tree, property panels and DockManager. They are **not** browser E2E tests: no mouse/keyboard event simulation against a running React application, screenshots, accessibility audit, or viewport drag/drop tests were run. For genuine browser E2E coverage, install dependencies and add Playwright tests with a local dev server.
