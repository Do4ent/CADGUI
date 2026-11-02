# BendCore CAD Pro

React + TypeScript + Three.js CAD interface prototype, **without a geometric CAD kernel**.

Active implementation PRs add square-corner parameter dialogs with technical SVG icons, validated primitive creation, synchronized tree/viewport multiselection and versioned document tabs with dirty-state protection. These changes are under review and have not merged into `main`. See [delivery status](docs/DELIVERY_STATUS.md) for commits, CI results and remaining acceptance work.

Primitive meshes are demonstrations. Pipe wall thickness is validated but not persisted/rendered; exact geometry and previews are unavailable. Viewport box selection, validated edit/transform forms and theme visual snapshots remain outstanding.

## Run and check

Use Node.js 22 and Python 3.12, matching CI. On branches with the committed lockfile:

```bash
npm ci
npm test
npm run build
npm run dev
```

For browser tests, install Chromium and start the production preview:

```bash
python -m pip install -r e2e/requirements.txt
python -m playwright install --with-deps chromium
npm run build
npm run preview -- --port 4173 --strictPort
```

In another terminal:

```bash
BENDCORE_URL=http://127.0.0.1:4173 python -m pytest e2e/ -v
```

`CHROMIUM_PATH` selects an existing Chromium executable. Run the full `e2e/` directory to include new suites. `npm test` covers static, functional and module checks; it does not replace browser tests.

Verified baseline: [`920fe95`, CI 41439426314](https://github.com/Do4ent/CADGUI/actions/runs/41439426314). Later results are recorded separately in the delivery status. Required checks must pass on the applicable head before integration.
