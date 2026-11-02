# Bundled local OCR assets

These files are served by the application itself. Images and recognition results
are processed in browser Web Workers; recognition does not contact a third party.

| Files | Exact local package source | License |
| --- | --- | --- |
| `../tesseract.min.js`, `../worker.min.js` | `tesseract.js@7.0.0/dist/` | Apache-2.0; see `tesseract.js-Apache-2.0.md` and the adjacent bundled `.LICENSE.txt` notices |
| `../tesseract-core-lstm.wasm.js`, `../tesseract-core-lstm.wasm` | `tesseract.js-core@7.0.0/` | Apache-2.0; see `tesseract.js-core-Apache-2.0.txt` |
| `../lang/eng.traineddata.gz` | `@tesseract.js-data/eng@1.0.0/4.0.0_best_int/` | Package declares MIT; upstream Tesseract training data is distributed under Apache-2.0 |
| `../lang/rus.traineddata.gz` | `@tesseract.js-data/rus@1.0.0/4.0.0_best_int/` | Package declares MIT; upstream Tesseract training data is distributed under Apache-2.0 |

The language packages ship no standalone LICENSE file. Their original package
manifests are preserved here as `eng-package.json` and `rus-package.json`, including
the declared license, contributor attribution and source repository. See
`language-packages-MIT.txt` for the MIT terms and the Apache license files for the
upstream engine/training-data terms. Language package contributors: Balearica
and Jerome Wu. Training-data source: <https://github.com/naptha/tessdata>.

The `4.0.0_best_int` files are the quantized LSTM model variants supplied by those
packages; no model is downloaded from a CDN at runtime. A non-SIMD LSTM core is
selected explicitly for compatibility. The original WASM binary is retained
alongside the package's self-contained WASM JavaScript loader.

The loader/controller `../recognize-worker.js` is BendCore application code.
