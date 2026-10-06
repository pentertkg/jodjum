const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const { handler } = require('./server.cjs');
const source = fs.readFileSync('dist/app.js', 'utf8').replace(/render\(\);\s*$/, '');
let checks = 0;
const eq = (actual, expected) => { assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected); checks++; };
const ok = value => { assert.ok(value); checks++; };
function storage() {
  const data = new Map();
  return { data, fail: false, getItem(k) { return data.get(k) ?? null; }, setItem(k, v) { if (this.fail) { const e = new Error('Full'); e.name = 'QuotaExceededError'; throw e; } data.set(k, v); }, removeItem(k) { data.delete(k); } };
}
function locks() {
  let queue = Promise.resolve();
  return { request(name, fn) { const job = queue.then(fn); queue = job.catch(() => {}); return job; } };
}
function setup(store = storage(), lock = locks()) {
  const nodes = new Map(), events = new Map();
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', classList: { add() {}, remove() {} }, value: '', hidden: false, focus() {}, addEventListener() {} }); return nodes.get(selector); };
  const context = vm.createContext({ console, crypto: require('node:crypto').webcrypto, TextEncoder, Blob, URL, Intl, Date, structuredClone, setTimeout: () => 0, clearTimeout() {}, localStorage: store, navigator: { locks: lock }, document: { querySelector: node, querySelectorAll: () => [], addEventListener() {} }, window: { addEventListener: (name, fn) => events.set(name, fn) }, confirm: () => true });
  vm.runInContext(source, context);
  vm.runInContext('render=()=>{}', context);
  vm.runInContext(fs.readFileSync('dist/xlsx.js', 'utf8'), context);
  return { context, store, node, events, run: code => vm.runInContext(code, context) };
}
const newLog = task => `({id:uid(),date:'2026-10-06',task:${JSON.stringify(task)},project:'efinAI',status:'Done',priority:'Medium',custom:{},duration:60,created_at:'2026-10-06T00:00:00Z'})`;
(async () => {
  const t = setup(), run = t.run;
  eq(run("weekStart('2026-10-06')"), '2026-10-05');
  eq(run("addDays('2026-10-01',-1)"), '2026-09-30');
  eq(run("validDate('2026-02-29')"), false); eq(run("validDate('2024-02-29')"), true);
  eq(run("validate({date:'2026-10-06',project:'efinAI',task:'API',status:'Done',duration:30})"), '');
  eq(run("validate({date:'2026-10-06',project:'efinAI',task:' ',status:'Done'})"), 'กรุณาระบุชื่องาน');
  eq(run("validate({date:'2026-10-06',project:'efinAI',task:'API',status:'Done',duration:-1})"), 'ระยะเวลาต้องไม่ติดลบ');
  eq(run("validate({date:'2026-10-06',project:'efinAI',task:'API',status:'Done',start_time:'17:00',end_time:'09:00'})"), 'เวลาสิ้นสุดต้องไม่น้อยกว่าเวลาเริ่ม');
  ok(run("validate({date:'2026-10-06',project:'efinAI',task:'API',status:'Done',reference_url:'javascript:alert(1)'})"));
  run(`state.logs=[${newLog('Test API')}, {...${newLog('Meeting')},project:'Internal',status:'In Progress'}]`);
  eq(run('filtered().length'), 2); eq(run("projectFilter='Internal';filtered().map(l=>l.task)"), ['Meeting']);
  eq(run("projectFilter='';statusFilter='Done';filtered().map(l=>l.task)"), ['Test API']);
  eq(run("statusFilter='';search='api';filtered().map(l=>l.task)"), ['Test API']);
  run("search='';state.logs[0].custom={custom_preserved:'ข้อมูลเดิม'};settings=defaults();moveField(0,2)");
  eq(run("getValue(state.logs[0],'custom_preserved')"), 'ข้อมูลเดิม');
  eq(run('settings.slice(0,3).map(f=>f.id)'), ['project','task','date']);
  eq(run("esc('<script>')"), '&lt;script&gt;');
  ok(run("fieldControl({id:'custom_a',label:'Client',type:'Multi Select',options:['A','B'],required:true},['B']).includes('value=\"B\" selected')"));

  // Two tabs share both real storage state and one serialized lock queue.
  const shared = storage(), sharedLock = locks(), a = setup(shared, sharedLock), b = setup(shared, sharedLock);
  eq(await a.run(`commit('A',()=>state.logs.push(${newLog('A')}))`), true);
  eq(await b.run(`commit('B',()=>state.logs.push(${newLog('B')}))`), false);
  eq(JSON.parse(shared.getItem('jodjum.v1')).logs.map(l => l.task), ['A']);
  const undoA = a.node('#undo').onclick;
  eq(await b.run(`commit('B',()=>state.logs.push(${newLog('B')}))`), true);
  eq(JSON.parse(shared.getItem('jodjum.v1')).logs.map(l => l.task), ['A','B']);
  await undoA(); eq(JSON.parse(shared.getItem('jodjum.v1')).logs.map(l => l.task), ['A','B']);
  a.events.get('storage')({ key: 'jodjum.v1', newValue: shared.getItem('jodjum.v1') });
  eq(a.run('state.logs.length'), 2);
  const simultaneousStore=storage(), simultaneousLock=locks(), c=setup(simultaneousStore,simultaneousLock), d=setup(simultaneousStore,simultaneousLock);
  const result=await Promise.all([c.run(`commit('C',()=>state.logs.push(${newLog('C')}))`),d.run(`commit('D',()=>state.logs.push(${newLog('D')}))`)]);
  eq(result, [true,false]); eq(JSON.parse(simultaneousStore.getItem('jodjum.v1')).logs.length,1);

  // Reject malformed imports before storage is replaced.
  const validate = setup();
  for (const mutation of ["data.logs[0].date='2026-99-99'", "data.logs[0].date='2026-02-30'", "data.logs[0].duration=-1", "data.logs[0].duration='60'", "data.logs[0].start_time='24:00'", "data.logs[0].start_time='12:00';data.logs[0].end_time='09:00'", "data.fields.find(f=>f.id==='status').options=[]", "data.logs[0].project='Unknown'", "data.logs[0].custom=[]", "data.fields.find(f=>f.id==='date').default='2026-13-01'"]) {
    validate.run(`data=initial();data.logs=[${newLog('Valid')}];${mutation}`);
    assert.throws(() => validate.run('validateBackup(data)')); checks++;
  }
  const recoverStore=storage(); recoverStore.setItem('jodjum.v1','{broken json');
  const recovery=setup(recoverStore);
  eq(recovery.run('recoveryRaw'),'{broken json'); eq(await recovery.run(`commit('bad',()=>state.logs.push(${newLog('X')}))`),false);
  eq(recoverStore.getItem('jodjum.v1'),'{broken json');
  eq(await recovery.run("commit('restore',()=>state=initial(),{replaceRecovery:true,beforeImport:true})"),true);
  eq(recoverStore.getItem('jodjum.v1.before-import'),'{broken json');
  const rollback=setup(); const rawBefore=rollback.store.getItem('jodjum.v1');
  rollback.run("render=()=>{throw Error('Render failed')}");
  eq(await rollback.run(`commit('fail',()=>state.logs.push(${newLog('X')}))`),false); eq(rollback.store.getItem('jodjum.v1'),rawBefore);
  const quota=setup();quota.store.fail=true;
  eq(await quota.run(`commit('fail',()=>state.logs.push(${newLog('X')}))`),false);eq(quota.run('state.logs.length'),0);

  // A saved existing record must not clear the new-task draft; drafts migrate by target.
  const drafts=setup();drafts.run(`state.logs=[${newLog('Existing')}];readLogForm=()=>({date:'2026-10-06',project:'efinAI',task:'Edited',status:'Done'});modal={kind:'log',editId:state.logs[0].id,dirty:true};localStorage.setItem(draftKey(null),JSON.stringify({values:{task:'New draft'}}));localStorage.setItem(draftKey(modal.editId),JSON.stringify({values:{task:'Edit draft'}}))`);
  const existingId=drafts.run('state.logs[0].id');await drafts.run('saveLog()');
  ok(drafts.store.getItem('jodjum.v1.draft.new'));eq(drafts.store.getItem('jodjum.v1.draft.'+existingId),null);
  eq(drafts.run('state.logs[0].task'),'Edited');
  drafts.store.setItem('jodjum.v1.draft',JSON.stringify({values:{task:'Legacy'},editId:existingId}));
  eq(drafts.run('loadDraft(null).values.task'),'New draft');ok(drafts.store.getItem('jodjum.v1.draft'));
  eq(drafts.run(`loadDraft('${existingId}').values.task`),'Legacy');eq(drafts.store.getItem('jodjum.v1.draft'),null);
  const doubleSave=setup();doubleSave.run("modal={kind:'log',dirty:true};readLogForm=()=>({date:'2026-10-06',project:'efinAI',task:'Single record',status:'Done'})");
  const doubleResult=await Promise.all([doubleSave.run('saveLog()'),doubleSave.run('saveLog()')]);eq(doubleResult,[true,false]);eq(doubleSave.run('state.logs.length'),1);
  const importing=setup();await importing.run(`commit('original',()=>state.logs.push(${newLog('Original')}))`);const oldRaw=importing.store.getItem('jodjum.v1');
  eq(await importing.run("commit('bad import',()=>{state=initial();state.logs=[{id:uid(),date:'2026-99-99',task:'Bad',project:'efinAI',status:'Done',custom:{}}]},{beforeImport:true})"),false);eq(importing.store.getItem('jodjum.v1'),oldRaw);
  eq(await importing.run("commit('valid import',()=>state=initial(),{beforeImport:true})"),true);eq(importing.store.getItem('jodjum.v1.before-import'),oldRaw);
  const failingDraft=setup();failingDraft.run("modal={kind:'log',dirty:true};readLogForm=()=>({task:'Do not lose me'})");failingDraft.store.fail=true;failingDraft.run('closeModal()');eq(failingDraft.run('modal.kind'),'log');

  // Copy drafts cannot replace a new-task draft, and resume by source record.
  const copies=setup();copies.run(`showModal=()=>{};state.logs=[${newLog('Source')}];localStorage.setItem(draftKey(null),JSON.stringify({values:{task:'Original unfinished work'}}));openLog(state.logs[0].id,true);modal.dirty=true;readLogForm=()=>({date:'2026-10-06',project:'efinAI',task:'Copy in progress',status:'Done'});saveDraft()`);
  const sourceId=copies.run('state.logs[0].id');
  eq(JSON.parse(copies.store.getItem('jodjum.v1.draft.new')).values.task,'Original unfinished work');
  eq(JSON.parse(copies.store.getItem('jodjum.v1.draft.copy.'+sourceId)).values.task,'Copy in progress');
  copies.run('modal=null;openLog(state.logs[0].id,true)');eq(copies.run('modal.copySource'),sourceId);eq(copies.run('modal.editId'),null);
  eq(copies.run('loadDraft(null,modal.copySource).values.task'),'Copy in progress');
  eq(await copies.run('saveLog()'),true);eq(copies.run('state.logs.length'),2);
  eq(copies.store.getItem('jodjum.v1.draft.copy.'+sourceId),null);ok(copies.store.getItem('jodjum.v1.draft.new'));
  // IDs and time calculation are independent of the Settings preview.
  ok(t.run("fieldControl(state.fields.find(f=>f.id==='date'),undefined,true).includes('id=\"preview-date\"')"));
  ok(t.run("fieldControl(state.fields.find(f=>f.id==='date')).includes('id=\"input-date\"')"));
  t.node('#input-start_time').value='01:00';t.node('#input-end_time').value='02:00';
  t.node('#log-form #input-start_time').value='09:00';t.node('#log-form #input-end_time').value='10:30';t.run('calculateTime()');
  eq(t.node('#log-form #input-duration').value,90);eq(t.node('#input-duration').value,'');
  t.run("search='API';priorityFilter='High';period='today'");
  const exportScope=t.run('exportContext()');ok(exportScope.includes('API')&&exportScope.includes('High')&&exportScope.includes('วันนี้'));
  t.run("search='';priorityFilter='';period='all'");eq(t.run('exportContext()'),'');

  // Real HTTP server: malformed requests followed by a successful request.
  const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const request=pathname=>new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port:server.address().port,path:pathname},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))}).on('error',reject));
  try { eq(await request('/%'),400);eq(await request('/%ZZ'),400);eq(await request('/%00'),400);eq(await request('/'),200);eq(await request('/%2e%2e/README.md'),403); } finally {await new Promise(resolve=>server.close(resolve));}
  const blob=t.context.window.makeXlsx([{name:'Work Log',rows:[['Task','Duration'],['ไทย\tข้อความ\nemoji 🌿\u0001\u000b\ufffe\ud800',90],['=HYPERLINK("https://example.com")',30]]},{name:'Summary',rows:[['Tasks','Hours'],[2,2]]}]);
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/validation.xlsx',Buffer.from(await blob.arrayBuffer()));
  const bytes=Buffer.from(await blob.arrayBuffer());eq(bytes.subarray(0,2).toString(),'PK');
  let offset=0;const archive=new Map();while(bytes.readUInt32LE(offset)===0x04034b50){const len=bytes.readUInt32LE(offset+18),nameLen=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),start=offset+30+nameLen+extra;archive.set(bytes.subarray(offset+30,offset+30+nameLen).toString(),bytes.subarray(start,start+len).toString());offset=start+len}
  const worksheet=archive.get('xl/worksheets/sheet1.xml');ok(worksheet.includes('ไทย')&&worksheet.includes('🌿'));ok(worksheet.includes('\t')&&worksheet.includes('\n'));ok(!worksheet.includes('\u0001')&&!worksheet.includes('\u000b')&&!worksheet.includes('\ufffe')&&!worksheet.includes('\ud800'));ok(!worksheet.includes('<f>'));
  console.log(`${checks} checks passed (cross-tab writes, imports, rollback, drafts, UX regressions, HTTP and XLSX).`);
})().catch(error=>{console.error(error);process.exitCode=1;});
