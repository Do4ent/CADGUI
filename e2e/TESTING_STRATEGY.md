# Browser and regression test ownership

QA branch owns e2e/ and CI test changes. Baseline: 18 browser tests, previous run 41397195731 had 14 passed and 4 failed due to a Playwright positional argument; fixed in commit 1b15b2e.

## Gates
1. npm test
2. npm run build (TypeScript + Vite)
3. Python pytest on e2e/test_ui.py and e2e/test_regression.py
4. Light/dark screenshots for dialogs once UI components are integrated
5. Keyboard and accessible-label checks for new forms
6. Data corruption and persistence tests for document changes
7. Ctrl/Shift selection and undo/redo tests

Never report tests as passing before a completed green CI run. Capture run ID, head SHA and exact failures.
