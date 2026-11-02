export type SelectionState = {selectedIds:string[]; anchorId:string|null};
export const emptySelection:SelectionState={selectedIds:[],anchorId:null};
export function selectItem(state:SelectionState,id:string,orderedIds:readonly string[],mode:'replace'|'toggle'|'range'='replace'):SelectionState {
 if(!orderedIds.includes(id)) return state;
 if(mode==='replace') return {selectedIds:[id],anchorId:id};
 if(mode==='toggle') return {selectedIds:state.selectedIds.includes(id)?state.selectedIds.filter(x=>x!==id):[...state.selectedIds,id],anchorId:id};
 const start=orderedIds.indexOf(state.anchorId||id),end=orderedIds.indexOf(id);
 const range=orderedIds.slice(Math.min(start,end),Math.max(start,end)+1);
 return {selectedIds:range,anchorId:state.anchorId||id};
}
export function pruneSelection(state:SelectionState,validIds:readonly string[]):SelectionState {
 return {selectedIds:state.selectedIds.filter(id=>validIds.includes(id)),anchorId:state.anchorId&&validIds.includes(state.anchorId)?state.anchorId:null};
}
