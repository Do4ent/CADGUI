import {parse} from 'opentype.js';
import {serializeDrawingSvg} from './vector';
/** Exports a detached SVG copy. The editable drawing document is never changed. */
export async function drawingSvgToOutlines(svg:SVGSVGElement,bytes:ArrayBuffer):Promise<{text:string;warnings:string[]}>{
 const font=parse(bytes);const clone=new DOMParser().parseFromString(serializeDrawingSvg(svg),'image/svg+xml').documentElement;
 const originals=Array.from(svg.querySelectorAll<SVGTextElement>('text')).filter(element=>!element.closest('[data-drawing-ui],[data-drawing-printable="false"]'));
 const copies=Array.from(clone.querySelectorAll('text'));if(copies.length!==originals.length)throw new Error('Не удалось сопоставить текст SVG для преобразования');
 const warnings=['Текст копии преобразован в контуры: поиск и живые поля в экспортированной копии недоступны.','Использован выбранный шрифт. При отличии исходного шрифта форма глифов изменяется; проверьте результат.'];
 for(let index=0;index<originals.length;index++){
  const source=originals[index],target=copies[index],content=source.textContent??'';
  if(source.querySelector('textPath'))throw new Error('Контуры текста по дуге пока недоступны: сохраните редактируемый SVG');
  if(/[\u0590-\u0fff\u200c\u200d]/u.test(content))throw new Error('Для контуров сложных письменностей нужен проверенный shaping-адаптер; редактируемый SVG сохраняет нативную вёрстку');
  const group=clone.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');for(const attribute of ['transform','opacity','clip-path'])if(target.hasAttribute(attribute))group.setAttribute(attribute,target.getAttribute(attribute)!);
  const textNodes:Text[]=[];const walker=document.createTreeWalker(source,NodeFilter.SHOW_TEXT);while(walker.nextNode())textNodes.push(walker.currentNode as Text);
  let address=0;
  for(const node of textNodes){const parent=node.parentElement!;const style=getComputedStyle(parent);const size=parseFloat(style.fontSize)||3.5;
   for(const character of Array.from(node.data)){
    if(!font.charToGlyphIndex(character)&&!/^\s$/u.test(character))throw new Error(`Шрифт не содержит символ «${character}»`);
    const point=source.getStartPositionOfChar(Math.min(address,Math.max(0,source.getNumberOfChars()-1)));const rotation=source.getRotationOfChar(Math.min(address,Math.max(0,source.getNumberOfChars()-1)));
    const path=font.getPath(character,point.x,point.y,size);const element=clone.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');element.setAttribute('d',path.toPathData(4));element.setAttribute('fill',style.fill||'#20252b');if(rotation)element.setAttribute('transform',`rotate(${rotation} ${point.x} ${point.y})`);group.appendChild(element);address+=character.length;
   }
  }
  target.replaceWith(group);
 }
 return {text:new XMLSerializer().serializeToString(clone),warnings};
}
