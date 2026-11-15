export type RibbonGroup={id:string;name:string;commands:string[]};
export type RibbonWorkspace={name:string;groups:RibbonGroup[];favorites:string[];compact:boolean;hidden:string[]};
export type RibbonStore={active:string;workspaces:RibbonWorkspace[]};
const canonical=(name:string)=>name.trim().normalize('NFC').toLocaleLowerCase('ru');
export function ribbonNameError(name:string,others:readonly string[]=[]):string|undefined{
 if(!name.trim())return 'Введите название.';
 if(name.trim().length>80)return 'Название должно содержать не более 80 символов.';
 if(/[\u0000-\u001f\u007f]/.test(name))return 'Название не должно содержать управляющие символы.';
 if(others.some(other=>canonical(other)===canonical(name)))return 'Такое название уже существует.';
}
export function ribbonDraftErrors(store:RibbonStore):string[]{
 const errors:string[]=[];
 if(!store.workspaces.length||!store.workspaces.some(w=>w.name===store.active))errors.push('Выберите существующее рабочее пространство.');
 store.workspaces.forEach((workspace,index)=>{
  const error=ribbonNameError(workspace.name,store.workspaces.filter((_,i)=>i!==index).map(w=>w.name));if(error)errors.push(`Рабочее пространство «${workspace.name}»: ${error}`);
  workspace.groups.forEach((group,i)=>{const groupError=ribbonNameError(group.name,workspace.groups.filter((_,j)=>j!==i).map(g=>g.name));if(groupError)errors.push(`Группа «${group.name}»: ${groupError}`);});
 });return [...new Set(errors)];
}
export function normalizedRibbonDraft(store:RibbonStore):RibbonStore{
 const errors=ribbonDraftErrors(store);if(errors.length)throw Error(errors.join(' '));
 const copy=structuredClone(store),active=copy.workspaces.find(w=>w.name===copy.active)!;copy.workspaces.forEach(w=>{w.name=w.name.trim();w.groups.forEach(g=>g.name=g.name.trim());});copy.active=active.name;return copy;
}
