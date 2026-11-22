const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const ts = require('typescript');

let occt;
require.extensions['.ts'] = (module, file) => {
  const baseRequire = module.require.bind(module);
  module.require = name => name === 'occt-wasm' ? occt : baseRequire(name);
  module._compile(ts.transpileModule(
    fs.readFileSync(file, 'utf8'),
    {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
  ).outputText, file);
};

const {captureAssemblyPlanarFaceReference, resolveAssemblyPlanarFaceReference, validateAssemblyPlanarFaceReference} =
  require('./assemblyFaceReferences.ts');

async function main() {
  const original = {id:'source', brep:'CASCADE Topology V3\nснимок\n'};
  const other = {...original, id:'copy'};
  const first = {id:'first', sourceBodyId:'source'};
  const second = {...first, id:'second'};
  const sources = {instances:[first,second], bodies:[original,other]};
  const plane = {faceIndex:3, origin:[2,0,0], normal:[-1,0,0]};
  const inspect = async brep => ({kind:'planar-faces', brep, faces:[plane]});
  const reference = await captureAssemblyPlanarFaceReference(sources, first.id, 3, inspect);
  assert.deepEqual(reference, {
    version:1, occurrenceId:'first', sourceBodyId:'source',
    snapshotDigest:createHash('sha256').update(original.brep).digest('hex'), faceIndex:3,
  });
  const secondReference = await captureAssemblyPlanarFaceReference(sources, second.id, 3, inspect);
  assert.notDeepEqual(secondReference, reference);
  assert.equal(secondReference.snapshotDigest, reference.snapshotDigest);

  const moved = {instances:[{...first,name:'renamed',parentId:'group',rotation:[10,20,30]}],
    bodies:[{...original,color:'#ffffff',visible:false}]};
  const reopened = validateAssemblyPlanarFaceReference(JSON.parse(JSON.stringify(reference)));
  const resolved = await resolveAssemblyPlanarFaceReference(moved, reopened, inspect);
  assert.deepEqual(resolved, {status:'resolved', face:plane});
  resolved.face.origin[0] = 100;
  assert.equal(plane.origin[0], 2);

  const mustNotInspect = async () => { throw Error('Unexpected kernel inspection'); };
  const changed = {...sources, bodies:[{...original,brep:original.brep + '\n'},other]};
  const switched = {...sources, instances:[{...first,sourceBodyId:'copy'}]};
  const reusedBody = {...original};
  const reusedSources = {...sources,bodies:[reusedBody,other]};
  assert.equal((await resolveAssemblyPlanarFaceReference(reusedSources, reference, inspect)).status, 'resolved');
  reusedBody.brep += '\n';
  assert.deepEqual(await resolveAssemblyPlanarFaceReference(reusedSources, reference, mustNotInspect), {status:'stale'});
  for (const snapshot of [changed,switched]) {
    assert.deepEqual(await resolveAssemblyPlanarFaceReference(snapshot, reference, mustNotInspect), {status:'stale'});
  }
  for (const snapshot of [{...sources,instances:[second]},{...sources,bodies:[other]}]) {
    assert.deepEqual(await resolveAssemblyPlanarFaceReference(snapshot, reference, mustNotInspect), {status:'broken'});
  }
  await assert.rejects(resolveAssemblyPlanarFaceReference(
    {...sources,bodies:[{...original,brep:original.brep + '\ud800'},other]}, reference, mustNotInspect,
  ), /Unicode/);
  const emptyInspection = async brep => ({kind:'planar-faces',brep,faces:[]});
  assert.deepEqual(await resolveAssemblyPlanarFaceReference(sources, reference, emptyInspection), {status:'unavailable'});
  await assert.rejects(captureAssemblyPlanarFaceReference(sources, first.id, 2, emptyInspection), /не найдена/);
  await assert.rejects(captureAssemblyPlanarFaceReference(sources, first.id, -1, mustNotInspect), /индекс/);
  await assert.rejects(resolveAssemblyPlanarFaceReference(sources, reference, async () => inspect('old')), /другому снимку/);
  await assert.rejects(resolveAssemblyPlanarFaceReference(sources, reference,
    async brep => ({kind:'planar-faces',brep,faces:[plane,plane]})), /Неоднозначный/);
  await assert.rejects(resolveAssemblyPlanarFaceReference(sources, reference,
    async brep => ({kind:'planar-faces',brep,faces:[{...plane,normal:[0,0,0]}]})), /плоскость/);

  for (const invalid of [
    {...reference,version:2}, {...reference,faceIndex:1.5}, {...reference,snapshotDigest:'unknown'},
    {...reference,occurrenceId:''}, {...reference,normal:[1,0,0]}, {...reference,faceIndex:Infinity},
  ]) assert.throws(() => validateAssemblyPlanarFaceReference(invalid));

  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const pending = captureAssemblyPlanarFaceReference(sources, first.id, 3, async brep => {
    await gate;
    return inspect(brep);
  });
  release();
  const oldSelection = await pending;
  assert.deepEqual(await resolveAssemblyPlanarFaceReference(changed, oldSelection, mustNotInspect), {status:'stale'});
  occt = await import('occt-wasm');
  const {ExactKernelBackend} = require('../kernel/backend.ts');
  const kernel = await occt.OcctKernel.init();
  try {
    const backend = new ExactKernelBackend(kernel);
    const native = backend.execute({op:'cylinder',radius:2,height:5,origin:[1,2,3]});
    const actualSources = {instances:[first,second],bodies:[{...original,brep:native.brep}]};
    const actualInspect = async brep => backend.inspectPlanarFaces(brep);
    const inspection = await actualInspect(native.brep);
    assert.equal(inspection.faces.length,2);
    for (const cap of inspection.faces) {
      const selected = await captureAssemblyPlanarFaceReference(actualSources, second.id, cap.faceIndex, actualInspect);
      const restored = JSON.parse(JSON.stringify(selected));
      assert.deepEqual(await resolveAssemblyPlanarFaceReference(actualSources,restored,actualInspect), {status:'resolved',face:cap});
    }
    assert.equal(kernel.shapeCount,0);
  } finally {
    kernel[Symbol.dispose]();
  }
  console.log('PASS exact snapshot and occurrence-bound planar face capture, reopen and fail-closed resolution');
}

main().catch(error => {console.error(error);process.exitCode=1;});
