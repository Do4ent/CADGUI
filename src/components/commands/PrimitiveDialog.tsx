import {useState} from 'react';
import {Dialog, ParameterField, validateNumber} from '../dialog';
import {createCommandDraft, validateCommandDraft, type CommandDraft, type CommandKind} from '../../commands/parameterValidation';

const labels:Record<string,string>={width:'Ширина',height:'Высота',depth:'Глубина',radius:'Радиус',outerRadius:'Внешний радиус',innerRadius:'Внутренний радиус'};
const titles:Record<CommandKind,string>={box:'Добавить блок',cylinder:'Добавить цилиндр',pipe:'Добавить трубу'};
/** Only a confirmed validated draft crosses the scene mutation boundary. */
export function PrimitiveDialog({kind,onConfirm,onCancel}:{kind:CommandKind;onConfirm:(draft:CommandDraft)=>void;onCancel:()=>void}){
 const [draft]=useState(()=>createCommandDraft(kind));
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(draft.parameters.map(p=>[p.name,String(p.value)])));
 const parsed:CommandDraft={kind,parameters:draft.parameters.map(p=>({...p,value:values[p.name].trim()===''?NaN:Number(values[p.name])}))};
 const fieldErrors=Object.fromEntries(draft.parameters.map(p=>[p.name,validateNumber(values[p.name],{min:0,exclusiveMin:true})]));
 const errors=validateCommandDraft(parsed);const invalid=errors.length>0||Object.values(fieldErrors).some(Boolean);
 return <Dialog open title={titles[kind]} onCancel={onCancel} onConfirm={()=>{if(!invalid)onConfirm(parsed)}} confirmDisabled={invalid}>
  <p>Параметры демонстрационного примитива. Точное CAD-ядро и предпросмотр не поддерживаются.</p>
  {kind==='pipe'&&<p>Труба отображается сплошным цилиндром; толщина стенки проверяется, но не сохраняется и не отображается.</p>}
  {draft.parameters.map(p=><ParameterField key={p.name} label={labels[p.name]} icon="length" value={values[p.name]} onChange={value=>setValues(v=>({...v,[p.name]:value}))} unit="мм" error={fieldErrors[p.name]} help="Положительный размер демонстрационной геометрии" />)}
  {kind==='pipe'&&Number(values.innerRadius)>=Number(values.outerRadius)&&<p role="alert">Внутренний радиус должен быть меньше внешнего.</p>}
 </Dialog>;
}
