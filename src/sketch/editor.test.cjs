const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
// Render the actual function component with deterministic hook storage. This exercises
// handlers against the actual solver; browser QA separately covers SVG CTM/capture.
const React=require('react');let slots=[],cursor=0,effects=[];
const hooks={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;const storage=slots;return[storage[i],value=>{storage[i]=typeof value==='function'?value(storage[i]):value}]},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial})},useMemo:fn=>fn(),useEffect:fn=>effects.push(fn),useId:()=>':test:'};
const original=Module._load;Module._load=function(id,...args){return id==='react'?hooks:original.call(this,id,...args)};
const {SketchEditor,sketchViewBox,snapSketchCoordinate,solvedSketchDraft,removeSketchPointDraft,sketchCurveSvg,sketchGeometryViewBox}=require('./SketchEditor.tsx');Module._load=original;
const {createRectangleSketch,createCircleSketch,createArcSketch}=require('./model.ts');
function children(node){return Array.isArray(node)?node:node&&typeof node==='object'?[node,...children(node.props?.children)]:[]}
function all(tree){const out=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node||typeof node!=='object')return;out.push(node);visit(node.props?.children)}visit(tree);return out}
function label(node){const c=node.props?.children;return Array.isArray(c)?c.filter(v=>typeof v==='string').join(''):typeof c==='string'?c:''}
function mount(source){slots=[];let current=structuredClone(source),calls=0,validity;const render=()=>{cursor=0;effects=[];const tree=SketchEditor({sketch:current,onChange(next){current=next;calls++},onValidityChange(valid){validity=valid}});effects.splice(0).forEach(fn=>fn());return tree};return {render,get validity(){return validity},get current(){return current},get calls(){return calls}}}
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
// Raw editor inputs block dialog confirmation independently of accepted model state.
h=mount(free);tree=h.render();assert.equal(h.validity,true);assert.ok(all(tree).some(n=>n.props?.['data-sketch-profile-diagnostic']!==undefined));
const numeric=all(tree).find(n=>n.props?.label==='X p1');const parentSlots=slots;slots=[];cursor=0;effects=[];const numericTree=numeric.type(numeric.props);effects.splice(0).forEach(fn=>fn());
const input=all(numericTree).find(n=>n.type==='input');input.props.onChange({target:{value:''}});slots=parentSlots;tree=h.render();assert.equal(h.validity,false);assert.equal(h.calls,0);assert.equal(tree.props['data-sketch-editor-valid'],false);
button(tree,'Отменить ввод').props.onClick();h.render();assert.equal(h.validity,true);
// Finite but uncommitted coordinate text also blocks saving the previously accepted geometry.
numeric.props.onValidityChange(false);h.render();assert.equal(h.validity,false);numeric.props.onValidityChange(true);h.render();assert.equal(h.validity,true);
// Signed distance constraints preserve direction, and free points can be removed explicitly.
h=mount(free);tree=h.render();control(tree,'Тип ограничения').props.onChange({target:{value:'dx'}});tree=h.render();control(tree,'Значение ограничения').props.onChange({target:{value:'-12'}});tree=h.render();button(tree,'Добавить ограничение').props.onClick();assert.ok(Math.abs(h.current.points[1].x-h.current.points[0].x+12)<1e-7);assert.equal(h.current.constraints[0].value,-12);
h=mount(free);tree=h.render();button(tree,'Удалить точку').props.onClick();assert.equal(h.current.points.length,3);assert.ok(!h.current.points.some(p=>p.id==='p1'));
// Curves are actual SVG primitives, never polygon approximations; framing includes extrema.
const circle=createCircleSketch('circle',10),arc=createArcSketch('arc',10);
const circleShape=sketchCurveSvg(circle);assert.equal(circleShape.kind,'circle');assert.equal(circleShape.radius,10);assert.deepEqual(circleShape.center,[0,0]);
const circleBox=sketchGeometryViewBox(circle);assert.ok(circleBox[0]<-10&&circleBox[1]<-10&&circleBox[0]+circleBox[2]>10&&circleBox[1]+circleBox[3]>10);
h=mount(circle);tree=h.render();const svgCircle=all(tree).find(n=>n.props?.['data-sketch-curve']==='circle');assert.equal(svgCircle.type,'circle');assert.equal(svgCircle.props.r,10);assert.equal(button(tree,'Добавить точку').props.disabled,true);assert.equal(button(tree,'Удалить точку').props.disabled,true);assert.throws(()=>removeSketchPointDraft(circle,'rim'),/нельзя удалять/);
const positive=sketchCurveSvg(arc);assert.ok(Math.abs(positive.sweep-Math.PI)<1e-9);assert.match(positive.path,/A 10 10 0 0 0 -10 0 Z$/);assert.match(positive.path,/^M 0 0 L 10 0/);
const negative=sketchCurveSvg({...arc,closed:false,geometry:{...arc.geometry,ccw:false}});assert.ok(negative.sweep<0);assert.match(negative.path,/A 10 10 0 0 1 -10 0$/);assert.ok(!negative.path.includes(' L ')&&!negative.path.endsWith('Z'));
const longArc={...arc,closed:false,points:arc.points.map(p=>p.id==='end'?{...p,x:0,y:-10}:p)};assert.match(sketchCurveSvg(longArc).path,/A 10 10 0 1 0 0 10$/);
h=mount({...free,name:'Кривая',plane:'XZ',origin:[4,5,6]});tree=h.render();button(tree,'Окружность').props.onClick();assert.deepEqual([h.current.id,h.current.name,h.current.plane,h.current.origin],['s','Кривая','XZ',[4,5,6]]);assert.equal(h.current.geometry.kind,'circle');assert.equal(h.current.points.length,2);tree=h.render();button(tree,'Дуга').props.onClick();assert.equal(h.current.geometry.kind,'arc');assert.equal(h.current.points.length,3);tree=h.render();control(tree,'Против часовой стрелки').props.onChange({target:{checked:false}});assert.equal(h.current.geometry.ccw,false);
// Distance and four-point equal-length controls feed the real nonlinear solver.
h=mount(free);tree=h.render();control(tree,'Тип ограничения').props.onChange({target:{value:'distance'}});tree=h.render();control(tree,'Значение ограничения').props.onChange({target:{value:'14'}});tree=h.render();button(tree,'Добавить ограничение').props.onClick();let [p,q]=h.current.points;assert.ok(Math.abs(Math.hypot(q.x-p.x,q.y-p.y)-14)<1e-6);assert.equal(h.current.constraints[0].kind,'distance');
h=mount(free);tree=h.render();control(tree,'Тип ограничения').props.onChange({target:{value:'equal-length'}});tree=h.render();assert.ok(control(tree,'Третья точка'));assert.ok(control(tree,'Четвёртая точка'));button(tree,'Добавить ограничение').props.onClick();assert.deepEqual(h.current.constraints[0],{id:'c1',kind:'equal-length',a:'p1',b:'p2',c:'p3',d:'p4'});
assert.throws(()=>removeSketchPointDraft(h.current,'p3'),/Сначала удалите/);
console.log('PASS sketch editor actual solver handlers, rejected drafts/cancel, constraint values, millimetre pointer snapping/capture, locked drag and frame-preserving reset');
