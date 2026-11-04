# Third-party geometry components

The exact geometry adapter uses `occt-wasm` **5.15.0**, pinned in package-lock.json.

- TypeScript wrapper/build tooling: MIT OR Apache-2.0; this distribution includes the upstream MIT notice in `public/licenses/occt-wasm-LICENSE-MIT`.
- Compiled Open CASCADE WebAssembly: LGPL-2.1-only as identified by the package's upstream README. The LGPL text is distributed in `public/licenses/OCCT-LGPL-2.1.txt`.
- Corresponding wrapper and build sources: https://github.com/andymai/occt-wasm/tree/bce9299aa7e7bd85f9e6c0e6aeae30f655d98ef6 (npm 5.15.0 gitHead).
- The build's OCCT submodule points to https://github.com/Open-Cascade-SAS/OCCT/tree/c7f60ffe85f28c67358d1771454044f0521f2fdd (OCCT 8.0.1 lineage).
- Build instructions and upstream component notes are preserved in `public/licenses/occt-wasm-README.md`.

The generated JavaScript glue and WASM are emitted as separate, replaceable assets. They are loaded lazily by the application's dedicated worker. The application does not embed the WASM binary into its own JavaScript source. Rebuilding or replacing the dependency/asset can substitute a compatible kernel build without changing persisted application geometry into display meshes.

Existing dependencies retain their respective licenses; see their distributed package notices.
