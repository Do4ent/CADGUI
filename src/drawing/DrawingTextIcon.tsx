export type DrawingTextIconKind = 'text'|'font'|'height'|'paragraph'|'position'|'rotation'|'anchor'|'frame'|'symbol'|'layer'|'field'|'leader'|'print'|'color';
/** Small technical symbols supplement labels; they never replace accessible text. */
export function DrawingTextIcon({kind = 'text'}: {kind?: DrawingTextIconKind}) {
  const blue = '#2378e8', orange = '#e99020', green = '#18a66a', violet = '#8b5cf6';
  const paths: Record<DrawingTextIconKind, React.ReactNode> = {
    text: <><path d="M3 4h14M10 4v13M6 17h8" stroke={blue}/><path d="M15 9h3v8h-3" stroke={orange}/></>,
    font: <><path d="m3 17 5-13 5 13M5 12h6" stroke={blue}/><path d="M14 8h4m-2 0v9" stroke={orange}/></>,
    height: <><path d="M3 4h10M3 16h10M8 4v12" stroke={blue}/><path d="m5 7 3-3 3 3M5 13l3 3 3-3" stroke={orange}/></>,
    paragraph: <><path d="M3 4h14M3 8h10M3 12h14M3 16h10" stroke={blue}/><path d="M16 9v8m-2-2 2 2 2-2" stroke={orange}/></>,
    position: <><path d="M4 3v13h13" stroke={violet}/><path d="m2 6 2-3 2 3m8 8 3 2-3 2" stroke={orange}/><circle cx="11" cy="9" r="2" stroke={blue}/></>,
    rotation: <><path d="M5 15a7 7 0 1 1 11-8M16 3v4h-4" stroke={orange}/><path d="M7 13v-5h5v5z" stroke={blue}/></>,
    anchor: <><path d="M4 4h12v12H4zM10 1v18M1 10h18" stroke={blue}/><circle cx="4" cy="4" r="2" fill={orange}/></>,
    frame: <><path d="M2 3h16v14H2z" stroke={green}/><path d="M6 7h8M6 10h6M6 13h8" stroke={blue}/></>,
    symbol: <><circle cx="10" cy="10" r="6" stroke={blue}/><path d="m4 18 12-16M2 3h4M4 1v4" stroke={orange}/></>,
    layer: <><path d="m2 6 8-4 8 4-8 4z" stroke={blue}/><path d="m2 10 8 4 8-4m-16 4 8 4 8-4" stroke={green}/></>,
    field: <><path d="M6 3H3v14h3m8-14h3v14h-3" stroke={violet}/><path d="M8 7h4m-4 3h4m-4 3h4" stroke={green}/></>,
    leader: <><path d="M3 16 8 6h9M3 16l1-5 3 2z" stroke={blue}/><path d="M11 3h6M11 9h6" stroke={orange}/></>,
    print: <><path d="M5 7V2h10v5M5 14H2V7h16v7h-3M5 11h10v7H5z" stroke={blue}/><path d="M7 14h6" stroke={green}/></>,
    color: <><path d="m4 12 6-9 6 9z" stroke={blue}/><path d="M3 16h5" stroke={orange}/><path d="M8 16h5" stroke={green}/><path d="M13 16h5" stroke={violet}/></>
  };
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">{paths[kind]}</svg>;
}
