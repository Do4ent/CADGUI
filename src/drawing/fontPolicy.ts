import type {DrawingDocument} from './types';

/** Resolve explicit document substitution policy without rewriting source styles/runs. */
export function resolveFontFamily(document:Pick<DrawingDocument,'properties'>, requestedFamily:string):string {
  function validate(family:unknown):asserts family is string {
    if(typeof family!=='string'||!family.trim()||!/^[\p{L}\p{N} _.,-]{1,120}$/u.test(family))throw new Error('Недопустимое имя семейства шрифта');
  }
  validate(requestedFamily);
  const visited=new Set<string>();
  let family=requestedFamily;
  while(Object.prototype.hasOwnProperty.call(document.properties,'fontFallback:'+family)){
    if(visited.has(family))throw new Error('Цикл подстановки шрифтов');
    visited.add(family);
    const target:unknown=document.properties['fontFallback:'+family];
    validate(target);
    family=target;
  }
  return family;
}
