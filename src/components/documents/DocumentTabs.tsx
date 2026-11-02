import './documents.css';
export type DocumentTab={id:string;name:string;dirty:boolean};
export function DocumentTabs({tabs,activeId,onActivate,onClose}:{tabs:DocumentTab[];activeId:string;onActivate:(id:string)=>void;onClose:(id:string)=>void}){
 return <div className="document-tabs" role="tablist" aria-label="Документы">
  {tabs.map(tab=><div key={tab.id} className="document-tab">
   <button type="button" role="tab" tabIndex={activeId===tab.id?0:-1} onKeyDown={event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const index=tabs.findIndex(t=>t.id===tab.id);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    onActivate(tabs[next].id);const controls=event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]');controls?.[next]?.focus();
   }} aria-selected={activeId===tab.id} onClick={()=>onActivate(tab.id)}>{tab.name}{tab.dirty?' •':''}</button>
   <button type="button" aria-label={'Закрыть документ '+tab.name} title="Закрыть документ" onClick={()=>onClose(tab.id)}>×</button>
  </div>)}
 </div>;
}
