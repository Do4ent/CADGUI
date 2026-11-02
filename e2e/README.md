# Playwright browser acceptance tests

Prerequisites: Python 3.10+, pytest, playwright, Chromium; Node.js and installed npm dependencies.

Terminal 1: `npm install && npm run dev -- --port 5173`

Terminal 2: `python -m pytest e2e/test_ui.py -v`

Override URL with `BENDCORE_URL` and browser executable with `CHROMIUM_PATH`.

Coverage: environment switching (Alt+1..4), context property panel, persisted environment, Ribbon keyboard focus, model tree keyboard selection and properties focus, command search. These are *browser tests supplied for execution*, not verified as passing in this environment.

Current environment: npm registry DNS unavailable (`EAI_AGAIN`); without dependencies, Vite cannot start. Browser attempt returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` for localhost:5173. Existing `npm test` succeeds (448 checks) but is not a browser test. The browser suite may expose additional issues when run in a normal environment.
