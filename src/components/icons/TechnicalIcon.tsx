import React from 'react';

export type TechnicalIconKind = 'length' | 'angle' | 'thickness' | 'profile' | 'material' | 'direction' | 'preview';
const colors = {blue:'#2378e8',orange:'#f59e0b',green:'#18a66a',red:'#e54b4b',purple:'#8b5cf6'};
export function TechnicalIcon({kind,size=20,title}:{kind:TechnicalIconKind;size?:number;title?:string}) {
 const c=colors;
 const artwork:Record<TechnicalIconKind,React.ReactNode>={
  length:<><path d="M3 4h14M3 16h14" stroke={c.blue}/><path d="M10 5v10M7 8l3-3 3 3M7 12l3 3 3-3" stroke={c.red}/></>,
  angle:<><path d="M3 16h14L7 5" stroke={c.blue}/><path d="M10 16a7 7 0 0 0-2-5" stroke={c.orange}/></>,
  thickness:<><path d="M8 3v14M12 3v14" stroke={c.blue}/><path d="M2 10h5m-3-3 3 3-3 3M18 10h-5m3-3-3 3 3 3" stroke={c.red}/></>,
  profile:<><path d="M4 4h12v12H4z" stroke={c.blue}/><circle cx="4" cy="4" r="2" fill={c.orange}/><circle cx="16" cy="16" r="2" fill={c.green}/></>,
  material:<><path d="m3 8 7-4 7 4-7 4z" fill={c.blue}/><path d="m3 12 7 4 7-4" stroke={c.orange}/><path d="m3 15 7 4 7-4" stroke={c.green}/></>,
  direction:<><path d="M3 5h9v10H3z" stroke={c.blue}/><path d="M11 10h7m-3-3 3 3-3 3" stroke={c.red}/></>,
  preview:<><path d="M2 10q8-10 16 0-8 10-16 0z" stroke={c.blue}/><circle cx="10" cy="10" r="3" fill={c.green}/></>
 };
 return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" role="img" aria-label={title||kind}>{artwork[kind]}</svg>;
}
