import type {AssemblyBomRow} from '../documents/assemblyBom';
import {layoutText} from './layout';
import {activeDrawingSheet, createTextEntity, textParagraphs} from './model';
import type {DrawingDocument, DrawingEntity} from './types';

export function createAssemblyBomTable(
  document: DrawingDocument, rows: readonly AssemblyBomRow[],
): {entity: DrawingEntity; exceedsSheet: boolean} {
  if (!rows.length) throw Error('В сборке пока нет вхождений.');
  const sheet = activeDrawingSheet(document);
  const entity = createTextEntity('table', '', document.styles[0].id);
  const horizontalMargin = Math.min(10, sheet.width / 10);
  const verticalMargin = Math.min(10, sheet.height / 10);
  Object.assign(entity, {
    name:'Спецификация сборки',
    x:horizontalMargin, y:verticalMargin,
    width:Math.max(96,sheet.width-horizontalMargin*2),
    overrides:{height:3.5,scaleMode:'paper',anchor:'top-left',writingMode:'horizontal',visible:true,printable:true},
  });
  const locations = (row: AssemblyBomRow) => row.placements.map(({path,quantity}) =>
    (path.length ? path.join(' / ') : 'Корень сборки') + ' × ' + quantity).join('\n');
  const nameCounts = new Map<string,number>();
  for (const {name} of rows) nameCounts.set(name,(nameCounts.get(name)??0)+1);
  const part = (row: AssemblyBomRow) => [
    row.name,
    ...(nameCounts.get(row.name)!>1 ? [row.sourceBodyId] : []),
    ...(row.available ? [] : ['Исходное тело недоступно']),
  ].join('\n');
  entity.rows = [
    ['Деталь','Количество','Размещение'],
    ...rows.map(row => [
      part(row),
      String(row.quantity),locations(row),
    ]),
  ].map(row => row.map(textParagraphs));
  // Native tables assign the same height to all rows. Use the tallest wrapped cell.
  const cellWidth = entity.width / 3 - 2;
  let rowHeight = 8;
  let tooWide = false;
  for (const row of entity.rows) {
    for (const paragraphs of row) {
      const layout = layoutText({...entity,paragraphs,width:cellWidth,height:0},document);
      rowHeight = Math.max(rowHeight,Math.ceil(layout.height + 1));
      tooWide ||= layout.overflow;
    }
  }
  entity.height = rowHeight * entity.rows.length;
  return {entity,exceedsSheet:tooWide || entity.x+entity.width>sheet.width || entity.y+entity.height>sheet.height};
}
