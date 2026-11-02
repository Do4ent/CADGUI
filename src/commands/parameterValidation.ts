export type NumericParameter={name:string;value:number;unit:'mm'|'deg';min?:number;max?:number};
export function validateNumericParameter(parameter:NumericParameter):string|null {
 const {name,value,min,max}=parameter;
 if(!Number.isFinite(value)) return name+': value must be finite';
 if(min!==undefined&&value<min) return name+': below minimum '+min;
 if(max!==undefined&&value>max) return name+': above maximum '+max;
 return null;
}
export type CommandDraft={kind:'box'|'cylinder'|'pipe';parameters:NumericParameter[]};
export function validateCommandDraft(draft:CommandDraft):string[] {
 if(!['box','cylinder','pipe'].includes(draft.kind)) return ['Unsupported command'];
 if(!draft.parameters.length) return ['Missing parameters'];
 const names=new Set<string>();
 const errors:string[]=[];
 for(const p of draft.parameters){
  if(names.has(p.name)) errors.push('Duplicate parameter: '+p.name);
  names.add(p.name);
  const error=validateNumericParameter(p);
  if(error) errors.push(error);
 }
 return errors;
}
