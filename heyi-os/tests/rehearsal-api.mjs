import assert from 'node:assert/strict';
const base=process.env.HEYI_TEST_URL;const json=async(path)=>(await (await fetch(base+path)).json());
const send=async(body,origin=new URL(base).origin)=>fetch(base+'/api/rehearsal',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
const mode=await json('/api/rehearsal?caseId=campus');
assert.equal(mode.enabled,true);
assert.equal(mode.aiConfigured,false,'隔离接口测试不能加载真实密钥');
const before=await json('/api/collaboration?caseId=campus'),workflow=await json('/api/workflow?caseId=campus'),other=await json('/api/collaboration?caseId=openair');
const body={caseId:'campus',confirm:true,expectedRevision:before.state.revision,expectedWorkflowRevision:workflow.workflow.revision};
assert.equal((await send(body,'http://evil.example')).status,403);
assert.equal((await send({...body,confirm:false})).status,400);
assert.equal((await send({...body,expectedRevision:body.expectedRevision+1})).status,409);
assert.equal((await json('/api/collaboration?caseId=campus')).state.revision,body.expectedRevision);
const response=await send(body);assert.equal(response.status,200);const {archiveId}=await response.json();
const archive=await json('/api/rehearsal?caseId=campus&archiveId='+archiveId);
assert.ok(archive.collaboration_events.length>0);assert.ok(archive.workflow_events.length>0);
assert.equal((await json('/api/collaboration?caseId=campus')).state.revision,0);
assert.equal((await json('/api/workflow?caseId=campus')).workflow.documents.length,0);
assert.equal((await json('/api/collaboration?caseId=openair')).state.revision,other.state.revision);
assert.equal((await fetch(base+'/api/rehearsal?caseId=openair&archiveId='+archiveId)).status,404);
console.log('PASS: rehearsal archive, atomic reset, stale revisions, same-origin gate and case isolation.');

for(const caseId of ['openair','neighborhood']){
 assert.equal((await json('/api/rehearsal?caseId='+caseId)).enabled,true);
 const before=await json('/api/collaboration?caseId='+caseId),workflow=await json('/api/workflow?caseId='+caseId);
 const untouchedId=caseId==='openair'?'neighborhood':'openair';
 const untouched=await json('/api/collaboration?caseId='+untouchedId);
 const response=await send({caseId,confirm:true,expectedRevision:before.state.revision,expectedWorkflowRevision:workflow.workflow.revision});
 assert.equal(response.status,200);const {archiveId}=await response.json();
 const archive=await json('/api/rehearsal?caseId='+caseId+'&archiveId='+archiveId);
 for(const rows of Object.values(archive))for(const row of rows)assert.equal(row.case_id,caseId);
 assert.equal((await json('/api/rehearsal?caseId='+caseId)).lastArchiveId,archiveId);
 assert.equal((await json('/api/collaboration?caseId='+caseId)).state.revision,0);
 assert.equal((await json('/api/collaboration?caseId='+untouchedId)).state.revision,untouched.state.revision);
 assert.equal((await fetch(base+'/api/rehearsal?caseId='+untouchedId+'&archiveId='+archiveId)).status,404);
}
console.log('PASS: all three cases have isolated rehearsal archives and reset.');
