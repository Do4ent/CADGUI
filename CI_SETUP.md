# GitHub Actions: build and real Playwright tests

This workflow runs on GitHub-hosted Ubuntu, not the restricted ChatGPT container.

1. Create an empty GitHub repository.
2. Extract this ZIP and commit **the contents of the `bendcore-cad-pro-v29` directory** at the repository root (including hidden `.github`).
3. Push to GitHub.
4. Open **Actions → BendCore UI build and browser tests**.
5. Review each step and download the `bendcore-ui-test-results` artifact if a test fails.

The workflow installs npm dependencies, runs existing checks, compiles TypeScript and Vite, installs Chromium with Playwright, serves the built app, and runs browser tests.

**Important:** This workflow is provided but has not been run here. Tests may expose actual defects; no claim of passing CI is made. The existing Python tests can also require adjustments after first run. For deterministic dependency installs, generate and commit `package-lock.json` after the first successful npm install.
