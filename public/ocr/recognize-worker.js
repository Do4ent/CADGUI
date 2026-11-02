/* BendCore local OCR controller; Tesseract.js and data notices: ./licenses/README.md. */
/* global Tesseract */
let started = false;
self.onmessage = async event => {
  if (started || event.data?.type !== 'recognize') return;
  started = true;
  let worker;
  try {
    importScripts(new URL('tesseract.min.js', self.location.href).href);
    const assets = new URL('./', self.location.href);
    worker = await Tesseract.createWorker(event.data.language, 1, {
      workerPath: new URL('worker.min.js', assets).href,
      // Explicit non-SIMD LSTM core runs on every supported WebAssembly browser.
      corePath: new URL('tesseract-core-lstm.wasm.js', assets).href,
      langPath: new URL('lang/', assets).href,
      workerBlobURL: false,
      gzip: true,
      cacheMethod: 'none',
      logger: message => {
        if (typeof message.progress !== 'number') return;
        const progress = message.status === 'recognizing text' ? .2 + .8 * message.progress : .2 * message.progress;
        self.postMessage({type:'progress',progress});
      },
      // Initialization errors can happen before createWorker exposes its handle.
      // The caller terminates this entire worker tree on this error message.
      errorHandler: error => self.postMessage({type:'error',error:String(error)})
    });
    const {data} = await worker.recognize(event.data.file, {}, {text:true});
    // Release the native engine before publishing successful output.
    await worker.terminate();
    worker = undefined;
    self.postMessage({type:'result',text:data.text,confidence:data.confidence});
  } catch (error) {
    self.postMessage({type:'error',error:error instanceof Error ? error.message : String(error)});
  } finally {
    if (worker) await worker.terminate();
    self.close();
  }
};
