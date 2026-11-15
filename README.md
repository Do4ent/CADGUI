# BendCore CAD Pro

React + TypeScript + Three.js mechanical CAD prototype with a bounded Open CASCADE WASM exact-solid backend.

Merged workflows include exact primitives and boolean snapshots, STEP geometry exchange, constrained sketches, source-linked extrusion/revolution/cuts/fusion, drawing text/tables/dimensions, visual 3D notes, document tabs and recovery. Shared parameter dialogs, keyboard-accessible Ribbon menus and a cancellable Ribbon editor are available. See [delivery status](docs/DELIVERY_STATUS.md), [parallel delivery plan](docs/PARALLEL_DELIVERY_PLAN.md) and [completion specification](docs/PROJECT_COMPLETION_SPEC.md) for scope and acceptance limits.

Legacy display components remain separate from exact OCCT bodies. Legacy pipe wall thickness is validated but not persisted/rendered. Exact geometry uses the dedicated modeling panels; demo Ribbon commands are labelled. Assembly mates, surface modeling, sheet-metal unfolding, general feature suppression/reordering and persistent topological naming remain outstanding. Drawing dimensions use supported 2D sources; 3D notes do not provide semantic PMI.

Workspace recovery retains a validated backup generation. After backup recovery, autosave pauses; the recovery banner can explicitly resume it after archiving the original records. Native JSON retains source definitions and BREP; STEP transfers static geometry with documented losses.

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

The original CI baseline was [`920fe95`, CI 41439426314](https://github.com/Do4ent/CADGUI/actions/runs/41439426314). Later verification is recorded per delivery; passing an older commit does not verify a newer head. Required checks must pass before integration.
