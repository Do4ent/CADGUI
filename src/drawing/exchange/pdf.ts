import {jsPDF} from 'jspdf';
import {svg2pdf} from 'svg2pdf.js';

const FONT_FAMILY = 'DejaVu Sans';
const FONT_FILES = [
  ['DejaVuSans.ttf', 'normal'], ['DejaVuSans-Bold.ttf', 'bold'],
  ['DejaVuSans-Oblique.ttf', 'italic'], ['DejaVuSans-BoldOblique.ttf', 'bolditalic'],
] as const;
let fontBytes: Promise<ArrayBuffer[]> | undefined;
async function loadFonts(): Promise<ArrayBuffer[]> {
  if (!fontBytes) fontBytes = Promise.all(FONT_FILES.map(async ([filename]) => {
    const response = await fetch(new URL(`fonts/${filename}`, document.baseURI));
    if (!response.ok) throw new Error(`Не удалось загрузить шрифт PDF: ${filename}`);
    return response.arrayBuffer();
  })).catch(error => {fontBytes = undefined; throw error;});
  return fontBytes;
}
function base64(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}
/** SVG viewBox coordinates are paper millimetres in DrawingSheet. */
function pageSize(svg: SVGSVGElement): [number, number] {
  const box = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!box || box.length !== 4 || box.some(n => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0) throw new Error('PDF: некорректный размер листа SVG');
  // jsPDF limits page dimensions to 14400 points (~5080mm).
  if (box[2] > 5080 || box[3] > 5080) throw new Error('PDF: размер листа превышает 5080 мм');
  return [box[2], box[3]];
}
/** Active-sheet vector PDF with embedded Unicode text; never rasterizes the sheet. */
export async function exportDrawingPdf(svg: SVGSVGElement): Promise<{blob: Blob; warnings: string[]}> {
  const [width, height] = pageSize(svg);
  const bytes = await loadFonts();
  const pdf = new jsPDF({unit: 'mm', format: [width, height], orientation: width >= height ? 'landscape' : 'portrait', putOnlyUsedFonts: true, compress: true});
  FONT_FILES.forEach(([filename, style], index) => {
    pdf.addFileToVFS(filename, base64(bytes[index]));
    pdf.addFont(filename, FONT_FAMILY, style);
  });
  pdf.setFont(FONT_FAMILY, 'normal');
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-drawing-ui],[data-drawing-printable="false"]').forEach(element=>element.remove());
  const warnings = new Set<string>();
  const texts = Array.from(clone.querySelectorAll<SVGTextElement | SVGTSpanElement>('text,tspan'));
  for (const text of texts) {
    const requested = text.style.fontFamily || text.getAttribute('font-family') || svg.getAttribute('font-family') || '';
    if (!requested || requested.replace(/["']/g, '').trim().toLowerCase() !== FONT_FAMILY.toLowerCase()) warnings.add('Шрифты PDF заменены на встроенный DejaVu Sans; переносы и метрики могут отличаться от листа.');
    text.setAttribute('font-family', FONT_FAMILY);
    text.style.fontFamily = FONT_FAMILY;
  }
  // Embed actual font coverage diagnostics; do not claim arbitrary Unicode coverage.
  const {parse} = await import('opentype.js');
  const font = parse(bytes[0]);
  const missing = [...new Set(Array.from(clone.textContent || '').filter(char => !/\s/.test(char) && font.charToGlyphIndex(char) === 0))];
  if (missing.length) warnings.add(`Шрифт PDF не содержит символы: ${missing.slice(0, 20).join(' ')}${missing.length > 20 ? ' …' : ''}`);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  // All paths, masks, frames, leaders, tables and text remain in the SVG conversion.
  await svg2pdf(clone, pdf, {x: 0, y: 0, width, height});
  warnings.add('Экспорт активного листа SVG: проверьте переносы, маски и сложные эффекты в PDF. Соответствие CAD/ГОСТ не сертифицировано.');
  return {blob: pdf.output('blob'), warnings: [...warnings]};
}
