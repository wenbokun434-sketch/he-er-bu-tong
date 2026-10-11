import assert from 'node:assert/strict';
import {sourceCatalog, linkIsStale, buildGraph} from '../lib/difference-graph.ts';
const base = process.env.HEYI_TEST_URL || 'http://127.0.0.1:4173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Local QA only');
let state = (await (await fetch(base+'/api/collaboration')).json()).state;
async function post(payload, expected=201) {
 const r=await fetch(base+'/api/collaboration',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({caseId:'openair',actorKey:'research',expectedRevision:state.revision,...payload})});
 const data=await r.json(); assert.equal(r.status,expected,JSON.stringify(data)); if(r.ok)state=data.state;return data;
}
const topicId=state.topics[0].id;
const source=sourceCatalog(state).find(s=>s.nodeId==='n:research:goal');
assert.ok(source);
const link={kind:'link',relationKind:'concerns',from:source.nodeId,to:'t:'+topicId,topicId,reason:'本地验收：研究需求需要在此议题中明确回应。',evidenceIds:[source.id]};
await post({...link,evidenceIds:['fake-source']},400);
await post(link);
const saved=state.links.at(-1); assert.equal(saved.evidence.find(e=>e.id===source.id).text,source.text);
await post(link,400);
await post({...link,expectedRevision:state.revision-1},409);
await post({kind:'profile',shareConfirmed:true,profile:{...state.profiles.research,goal:state.profiles.research.goal+'（本地来源更新验收）'}});
assert.ok(linkIsStale(saved,state));
assert.ok(buildGraph(state).edges.find(e=>e.linkId===saved.id).stale);
await post({kind:'link_retract',linkId:saved.id,reason:'本地撤销验收，保留原文'});
assert.ok(!buildGraph(state).edges.some(e=>e.linkId===saved.id));
assert.ok(buildGraph(state,true).edges.some(e=>e.linkId===saved.id));
const ai=await fetch(base+'/api/assistant');assert.equal(ai.status,200);const info=await ai.json();assert.equal(typeof info.configured,'boolean');assert.ok(Array.isArray(info.runs));
const denied=await fetch(base+'/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actorKey:'research',prompt:'未同意不应调用',requestId:crypto.randomUUID(),shareConfirmed:false})});assert.equal(denied.status,400);
console.log('PASS: 来源校验、快照、重复保护、并发版本、来源变化、撤销历史及 AI 同意门槛。');
