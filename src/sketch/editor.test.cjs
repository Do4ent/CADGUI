const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
// Render the actual function component with deterministic hook storage. This exercises
// handlers against the actual solver; browser QA separately covers SVG CTM/capture.
const React=require('react');let slots=[],cursor=0;
const hooks={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial})},useMemo:fn=>fn(),useEffect:()=>{},useId:()=>':test:'};
const original=Module._load;Module._load=function(id,...args){return id==='react'?hooks:original.call(this,id,...args)};
const {SketchEditor,sketchViewBox,snapSketchCoordinate,solvedSketchDraft,removeSketchPointDraft}=require('./SketchEditor.tsx');Module._load=original;
const {createRectangleSketch}=require('./model.ts');
function children(node){return Array.isArray(node)?node:node&&typeof node==='object'?[node,...children(node.props?.children)]:[]}
function all(tree){const out=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node||typeof node!=='object')return;out.push(node);visit(node.props?.children)}visit(tree);return out}
function label(node){const c=node.props?.children;return Array.isArray(c)?c.filter(v=>typeof v==='string').join(''):typeof c==='string'?c:''}
function mount(source){slots=[];let current=structuredClone(source),calls=0;const render=()=>{cursor=0;return SketchEditor({sketch:current,onChange(next){current=next;calls++}})};return {render,get current(){return current},get calls(){return calls}}}
function button(tree,text){const found=all(tree).find(n=>n.type==='button'&&label(n)===text);assert.ok(found,`button ${text}`);return found}
function control(tree,name){const found=all(tree).find(n=>n.props?.['aria-label']===name);assert.ok(found,`control ${name}`);return found}
const rectangle=createRectangleSketch('s');const originalText=JSON.stringify(rectangle);
const draft=solvedSketchDraft({...rectangle,constraints:rectangle.constraints.map(c=>c.id==='width'?{...c,value:32}:c)});assert.ok(Math.abs(draft.points[1].x-32)<1e-7);assert.equal(JSON.stringify(rectangle),originalText);
assert.throws(()=>removeSketchPointDraft(rectangle,'p1'),/Сначала удалите/);
const bbox=sketchViewBox([{id:'p',x:-100,y:90}]);assert.ok(bbox[0]<-100&&bbox[1]<-90&&bbox[2]>100&&bbox[3]>90);assert.equal(snapSketchCoordinate(-3.7,true),-4);assert.equal(snapSketchCoordinate(-3.7,false),-3.7);
// A contradictory added fixed location remains a visible rejected draft; no invalid callback.
let h=mount(rectangle),tree=h.render();control(tree,'Тип ограничения').props.onChange({target:{value:'fixed'}});tree=h.render();control(tree,'X фиксации').props.onChange({target:{value:'9'}});tree=h.render();button(tree,'Добавить ограничение').props.onClick();tree=h.render();assert.equal(h.calls,0);assert.equal(tree.props['data-sketch-draft-status'],'rejected');assert.ok(all(tree).some(n=>n.props?.role==='alert'));button(tree,'Отменить неудачное изменение').props.onClick();tree=h.render();assert.equal(tree.props['data-sketch-draft-status'],'fully-constrained');
// Deleting referenced point is explicit failure, not implicit destructive constraint removal.
button(tree,'Удалить точку').props.onClick();tree=h.render();assert.equal(h.calls,0);assert.equal(h.current.constraints.length,7);
// Constraint value field uses actual solver and keeps source immutable.
h=mount(rectangle);tree=h.render();const width=all(tree).find(n=>n.props?.label==='Значение width');width.props.onCommit(35);assert.ok(Math.abs(h.current.points[1].x-35)<1e-7);assert.equal(JSON.stringify(rectangle),originalText);
// SVG pointer handlers use inverse CTM and snap in millimetres, preserve negative Y convention.
const free={...rectangle,closed:false,constraints:[]};h=mount(free);tree=h.render();let svg=control(tree,'Геометрия эскиза');let captured=null;
svg.ref.current={getScreenCTM:()=>({inverse:()=>({})}),createSVGPoint:()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y}}}),setPointerCapture:id=>captured=id,hasPointerCapture:id=>captured===id,releasePointerCapture:()=>captured=null};
control(tree,'Точка p2').props.onPointerDown({button:0,pointerId:8,preventDefault(){}});tree=h.render();svg=control(tree,'Геометрия эскиза');svg.props.onPointerMove({pointerId:8,clientX:26.6,clientY:-3.2});assert.equal(captured,8);assert.deepEqual(h.current.points[1],{id:'p2',x:27,y:3});svg.props.onPointerUp({pointerId:8});assert.equal(captured,null);
// Same gesture on fully constrained geometry produces error and keeps all solved points intact.
h=mount(rectangle);tree=h.render();svg=control(tree,'Геометрия эскиза');svg.ref.current={getScreenCTM:()=>({inverse:()=>({})}),createSVGPoint:()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y}}}),setPointerCapture(){}};control(tree,'Точка p2').props.onPointerDown({button:0,pointerId:2,preventDefault(){}});tree=h.render();control(tree,'Геометрия эскиза').props.onPointerMove({pointerId:2,clientX:55,clientY:0});assert.equal(h.calls,0);assert.equal(h.render().props['data-sketch-draft-status'],'rejected');
// Reset preserves attachment frame and identity, replaces prior geometry/constraints.
h=mount({...free,name:'Профиль',plane:'YZ',origin:[8,9,10]});tree=h.render();button(tree,'Прямоугольник').props.onClick();assert.deepEqual([h.current.id,h.current.name,h.current.plane,h.current.origin],['s','Профиль','YZ',[8,9,10]]);assert.equal(h.current.constraints.length,7);
// Signed distance constraints preserve direction, and free points can be removed explicitly.
h=mount(free);tree=h.render();control(tree,'Тип ограничения').props.onChange({target:{value:'dx'}});tree=h.render();control(tree,'Значение ограничения').props.onChange({target:{value:'-12'}});tree=h.render();button(tree,'Добавить ограничение').props.onClick();assert.ok(Math.abs(h.current.points[1].x-h.current.points[0].x+12)<1e-7);assert.equal(h.current.constraints[0].value,-12);
h=mount(free);tree=h.render();button(tree,'Удалить точку').props.onClick();assert.equal(h.current.points.length,3);assert.ok(!h.current.points.some(p=>p.id==='p1'));
console.log('PASS sketch editor actual solver handlers, rejected drafts/cancel, constraint values, millimetre pointer snapping/capture, locked drag and frame-preserving reset');
