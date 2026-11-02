import React from 'react';
export type CadIconName='select'|'box'|'cylinder'|'pipe'|'duplicate'|'hide'|'isolate'|'showall'|'delete'|'sketch'|'extrude'|'revolve'|'hole'|'fillet'|'chamfer'|'pattern'|'mirror'|'shell'|'loft'|'sweep'|'mate'|'measure'|'dimension'|'section'|'sheet'|'weld'|'surface'|'draft'|'axis';
type Props={name:CadIconName;size?:number};
/** Original, CAD-specific 24x24 SVG glyphs; consistent 1.5px technical drawing strokes. */
export function CadIcon({name,size=24}:Props){const p:Record<CadIconName,React.ReactNode>={
select:<><path d="M4 3 4 19 9 14 13 21 16 19 12 12 19 11Z"/></>,
box:<><path d="m4 7 8-4 8 4v10l-8 4-8-4zM4 7l8 5 8-5M12 12v9"/><path d="m7 6 8 5" stroke="#52a9e9"/></>,
cylinder:<><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 4 14 4 14 0V6M5 18c0 4 14 4 14 0"/><path d="M5 6c0 4 14 4 14 0" stroke="#52a9e9"/></>,
pipe:<><path d="M4 18V9a5 5 0 0 1 5-5h6M9 18V9h6"/><ellipse cx="17" cy="4" rx="3" ry="2"/><path d="M4 18c0 4 5 4 5 0M4 18c0-2 5-2 5 0" stroke="#d69a53"/></>,
duplicate:<><path d="M8 7h12v13H8zM4 16V4h12"/><path d="m11 13 3 3 4-5" stroke="#4caf89"/></>,
hide:<><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6ZM9 12a3 3 0 0 0 6 0M3 21 21 3"/></>,
isolate:<><path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"/><path d="m9 10 3-2 3 2v4l-3 2-3-2z" stroke="#52a9e9"/></>,
showall:<><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3" stroke="#52a9e9"/></>,
delete:<><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7"/></>,
sketch:<><path d="M3 20h18V4H3z" strokeDasharray="2 2"/><circle cx="8" cy="14" r="3" stroke="#52a9e9"/><path d="m12 17 6-9M15 8h4v4"/></>,
extrude:<><path d="m3 14 7-4 7 4-7 4zM3 14V8l7-4 7 4v6M10 10V4M17 8l4-3M17 14l4-3"/><path d="m18 18 3-3-3-3M21 15h-7" stroke="#52a9e9"/></>,
revolve:<><path d="M12 4v16" strokeDasharray="2 2"/><path d="M12 7h5v10h-5M5 7a9 9 0 0 1 14-2M19 5l-1-4M19 5l-4-1" stroke="#52a9e9"/></>,
hole:<><path d="m3 8 9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9"/><ellipse cx="12" cy="8" rx="3" ry="1.5" stroke="#52a9e9"/></>,
fillet:<><path d="M4 20V4h16M4 20h16"/><path d="M4 13a9 9 0 0 0 9-9" stroke="#52a9e9" strokeWidth="2.5"/></>,
chamfer:<><path d="M4 20V4h16M4 20h16"/><path d="M4 12 12 4" stroke="#52a9e9" strokeWidth="2.5"/></>,
pattern:<><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/><path d="M12 6h2M6 12v2M18 12v2" stroke="#52a9e9"/></>,
mirror:<><path d="M12 2v20" strokeDasharray="2 2" stroke="#52a9e9"/><path d="m9 6-6 4v8l6-4zM15 6l6 4v8l-6-4z"/></>,
shell:<><path d="m3 8 9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9"/><path d="m7 9 5-3 5 3-5 3z" stroke="#52a9e9"/></>,
loft:<><ellipse cx="12" cy="5" rx="4" ry="2"/><ellipse cx="12" cy="19" rx="9" ry="3"/><path d="M8 5 3 19M16 5l5 14" stroke="#52a9e9"/></>,
sweep:<><path d="M4 20C4 4 19 19 19 4" stroke="#52a9e9" strokeWidth="2.5"/><ellipse cx="4" cy="20" rx="3" ry="2"/><ellipse cx="19" cy="4" rx="3" ry="2"/></>,
mate:<><path d="M2 5h8v14H2zM14 5h8v14h-8z"/><path d="m9 12 3-3 3 3M12 9v8" stroke="#52a9e9"/></>,
measure:<><path d="m4 17 13-13 4 4L8 21zM8 13l3 3M11 10l2 2M14 7l3 3"/></>,
dimension:<><path d="M4 5v14M20 5v14M4 12h16M4 12l4-3M4 12l4 3M20 12l-4-3M20 12l-4 3" stroke="#52a9e9"/></>,
section:<><path d="m3 8 9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9"/><path d="m3 8 9 5 0 9-9-5zM4 11l7 7M4 15l4 4" stroke="#52a9e9"/></>,
sheet:<><path d="M4 3h16v18H4zM7 6h10M7 9h10M7 12h4M13 13l4 4M13 17l4-4"/></>,
weld:<><path d="M3 18h18M12 18V6M7 13l5 5 5-5"/><path d="m9 5 3-3 3 3M12 2v9" stroke="#d69a53"/></>,
surface:<><path d="M2 16Q7 3 12 12T22 8M2 20Q7 7 12 16T22 12M2 12Q7-1 12 8T22 4" stroke="#52a9e9"/></>,
draft:<><path d="m3 20 9-17 9 17zM12 3v17M7 13h10"/><path d="M7 17h10" stroke="#52a9e9"/></>,
axis:<><path d="M4 20 12 12 20 20M12 12V2M12 12 22 9"/><path d="M12 12V2" stroke="#55bb77"/><path d="M12 12 22 9" stroke="#52a9e9"/></>
};return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name]}</svg>}
