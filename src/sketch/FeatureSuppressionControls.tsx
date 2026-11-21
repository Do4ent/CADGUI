import {useEffect,useId,useState} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import {TechnicalIcon} from '../components/icons/TechnicalIcon';
import './feature-suppression-controls.css';

export interface FeatureSuppressionControlsProps {
 eligible:boolean;
 reason?:string;
 suppressed:boolean;
 busy?:boolean;
 error?:string;
 featureId?:string;
 featureName?:string;
 branchSize?:number;
 onSuppress:()=>void;
 onResume:()=>void;
}

/** Caller owns dependency eligibility and the atomic native rebuild transaction. */
export function FeatureSuppressionControls({eligible,reason,suppressed,busy=false,error,featureId,featureName,branchSize=1,onSuppress,onResume}:FeatureSuppressionControlsProps){
 const id=useId(),[confirmation,setConfirmation]=useState<{featureId?:string;suppressed:boolean}|null>(null);
 useEffect(()=>setConfirmation(null),[featureId,suppressed]);
 const current=confirmation!==null&&confirmation.featureId===featureId&&confirmation.suppressed===suppressed;
 const unavailable=!eligible||busy;
 const explanation=reason||(!eligible?'Выберите конечную операцию без зависимых потребителей.':undefined);
 const confirm=()=>{if(!current||unavailable)return;setConfirmation(null);if(suppressed)onResume();else onSuppress();};
 return <section className="feature-suppression-controls" aria-label="Подавление операции">
  <p className="feature-suppression-state"><span aria-hidden="true"><TechnicalIcon kind="profile" size={18}/></span>{featureName||'Операция'}: {suppressed?'Подавлена':'Активна'}</p>
  <button type="button" disabled={unavailable} aria-describedby={explanation?`${id}-reason`:undefined} onClick={()=>{if(!unavailable)setConfirmation({featureId,suppressed});}}><span aria-hidden="true"><TechnicalIcon kind={suppressed?'direction':'preview'} size={18}/></span>{suppressed?'Возобновить операцию':'Подавить операцию'}</button>
  {explanation&&<p id={`${id}-reason`}>{explanation}</p>}
  {busy&&<p role="status">Перестроение модели…</p>}
  {error&&<p role="alert">{error}</p>}
  {current&&<Dialog open title={suppressed?'Возобновление операции':'Подавление операции'} confirmLabel={suppressed?'Возобновить':'Подавить'} confirmDisabled={unavailable} onConfirm={confirm} onCancel={()=>setConfirmation(null)}>
   <p><span aria-hidden="true"><TechnicalIcon kind="profile" size={18}/></span> {featureName||'Выбранная операция'}</p>
   {branchSize>1&&<p>{suppressed?'Будет возобновлена вся ветвь.':'Будет подавлена вся зависимая ветвь.'} Операций: {branchSize}.</p>}
   <p>{suppressed?'Результат будет заново построен по сохранённым параметрам. Если перестроение не удастся, операция останется подавленной.':'Результирующее тело будет исключено из активной модели. Определение операции, параметры, имя и цвет сохранятся для возобновления.'}</p>
   {explanation&&<p>{explanation}</p>}
  </Dialog>}
 </section>;
}
