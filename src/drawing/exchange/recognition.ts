export type DrawingOcrLanguage = 'eng'|'rus'|'eng+rus';
export type DrawingOcrResult = {text:string;confidence:number;warnings:string[]};
export const MAX_OCR_FILE_BYTES = 20 * 1024 * 1024;
const rasterTypes = new Set(['image/png','image/jpeg','image/webp','image/bmp','image/x-ms-bmp','image/gif']);
const abortError = () => new DOMException('Распознавание отменено', 'AbortError');

/** OCR stays in same-origin workers. No image upload, CDN or persistent OCR cache. */
export async function recognizeDrawingImage(file:File, language:DrawingOcrLanguage, onProgress?:(n:number)=>void, signal?:AbortSignal):Promise<DrawingOcrResult> {
  if (signal?.aborted) throw abortError();
  if (typeof File === 'undefined' || !(file instanceof File)) throw new Error('Выберите растровый файл для распознавания');
  if (!rasterTypes.has(file.type.toLowerCase())) throw new Error('OCR поддерживает PNG, JPEG, WebP, BMP и GIF. PDF и SVG не являются растровым вводом');
  if (!file.size) throw new Error('Файл изображения пуст');
  if (file.size > MAX_OCR_FILE_BYTES) throw new Error('Изображение превышает 20 МиБ');
  if (!['eng','rus','eng+rus'].includes(language)) throw new Error('Выберите английский, русский или оба языка');
  if (typeof Worker === 'undefined') throw new Error('Для локального OCR браузер должен поддерживать Web Workers');
  const base = (import.meta as ImportMeta & {env?:{BASE_URL?:string}}).env?.BASE_URL ?? '/';
  const workerUrl = new URL(`${base.replace(/\/?$/, '/')}ocr/recognize-worker.js`, document.baseURI);
  onProgress?.(0);
  return new Promise<DrawingOcrResult>((resolve,reject) => {
    // The controller owns Tesseract's child worker. Terminating the controller also
    // terminates that descendant while createWorker is still initializing models.
    const controller = new Worker(workerUrl, {name:'bendcore-local-ocr'});
    let finished = false;
    let progress = 0;
    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
      controller.onmessage = null;
      controller.onerror = null;
      controller.onmessageerror = null;
      controller.terminate();
    };
    const fail = (error:unknown) => {
      if (finished) return;
      finished = true; cleanup();
      reject(error instanceof Error || error instanceof DOMException ? error : new Error(String(error)));
    };
    const abort = () => fail(abortError());
    controller.onerror = event => {event.preventDefault(); fail(new Error(`Ошибка локального OCR: ${event.message || 'не удалось загрузить обработчик'}`));};
    controller.onmessageerror = () => fail(new Error('Не удалось получить результат распознавания'));
    controller.onmessage = event => {
      if (finished) return;
      const message = event.data as {type?:string;progress?:number;text?:unknown;confidence?:unknown;error?:string};
      if (message.type === 'progress') {
        if (typeof message.progress !== 'number' || !Number.isFinite(message.progress)) return;
        progress = Math.max(progress, Math.min(1, Math.max(0, message.progress)));
        try {onProgress?.(progress);} catch (error) {fail(error);}
      } else if (message.type === 'error') fail(new Error(message.error || 'Ошибка распознавания изображения'));
      else if (message.type === 'result') {
        if (typeof message.text !== 'string' || typeof message.confidence !== 'number' || !Number.isFinite(message.confidence)) {
          fail(new Error('OCR вернул некорректный результат')); return;
        }
        const confidence = Math.max(0,Math.min(100,message.confidence));
        const warnings = ['Результат автоматического распознавания требует проверки перед импортом.'];
        if (!message.text.trim()) warnings.push('Текст не найден: проверьте область, контраст, разрешение и язык изображения.');
        if (confidence < 75) warnings.push(`Низкая уверенность распознавания: ${Math.round(confidence)}%. Проверьте все символы.`);
        if (file.type.toLowerCase() === 'image/gif') warnings.push('Для GIF распознаётся только первый кадр.');
        try {onProgress?.(1);} catch (error) {fail(error); return;}
        finished = true; cleanup();
        resolve({text:message.text, confidence, warnings});
      }
    };
    signal?.addEventListener('abort',abort,{once:true});
    if (signal?.aborted) {abort(); return;}
    try {controller.postMessage({type:'recognize',file,language});} catch (error) {fail(error);}
  });
}
