import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,profileStamp} from '../lib/collaboration.ts';
import {emptyWorkflow} from '../lib/workflow.ts';
import {rehearsalCue,rehearsalProposal,rehearsalDocument} from '../lib/rehearsal.ts';
test('导演提示区分异议、修订、逐方确认和文书阶段，不自动批准',()=>{const s=initialState('campus'),w=emptyWorkflow('campus'),t=s.topics[0];assert.equal(rehearsalCue(s,w).phase,0);t.proposal={id:10,version:1,details:rehearsalProposal(false)};assert.equal(rehearsalCue(s,w).role,'hospital');t.votes.hospital={choice:'object',proposalId:10,profileStamp:profileStamp(s)};assert.equal(rehearsalCue(s,w).phase,1);t.proposal={...t.proposal,id:11,version:2};t.votes={};assert.equal(rehearsalCue(s,w).role,'research');for(const p of ['research','hospital','compliance'])t.votes[p]={choice:'accept',proposalId:11,profileStamp:profileStamp(s)};assert.equal(rehearsalCue(s,w).phase,3);assert.equal(w.documents.length,0);});
test('彩排正文保留原有来源条款，日期顺序有效',()=>{const clauses=[{topicId:'stage',proposalId:1,title:'test',details:rehearsalProposal(true)}];const body=rehearsalDocument({clauses});assert.equal(body.clauses,clauses);assert.ok(body.startDate<body.reviewDate&&body.reviewDate<body.endDate);});

import {cases} from '../lib/cases.ts';
import {rehearsalAcceptance,rehearsalEvidence} from '../lib/rehearsal-samples.ts';
for(const c of cases){
 test(c.name+'：指引使用当前角色，九个议题的示例与文书不串案例',()=>{
  const s=initialState(c.id),w=emptyWorkflow(c.id),topic=s.topics[0];
  const original=JSON.stringify({s,w});
  assert.equal(rehearsalCue(s,w).phase,0);
  assert.equal(JSON.stringify({s,w}),original,'读取指引不会写入协商或工作流');
  topic.proposal={id:10,version:1,details:rehearsalProposal(false,c.id,topic.id)};
  const cue=rehearsalCue(s,w);
  assert.ok(cue.title.includes(c.actors.hospital.role));
  if(c.id!=='campus')assert.doesNotMatch(cue.detail,/社团|舞台/);
  for(const t of c.topics){
   const first=rehearsalProposal(false,c.id,t.id),revised=rehearsalProposal(true,c.id,t.id);
   assert.notEqual(first.action,revised.action);
   for(const key of ['responsible','action','timing','conditions','review'])assert.ok(revised[key]);
   const acceptance=rehearsalAcceptance(c.id,t.id);
   const evidence=rehearsalEvidence(c.id,{title:t.title,action:revised.action,acceptance});
   assert.ok(evidence.includes(c.name)&&evidence.includes(t.title)&&evidence.includes(acceptance));
   if(c.id!=='campus')assert.doesNotMatch(JSON.stringify({first,revised,acceptance,evidence}),/社团|舞台/);
  }
  const clauses=[{topicId:topic.id,proposalId:10,title:topic.title,details:topic.proposal.details}];
  const body=rehearsalDocument({clauses},c.id);
  assert.ok(body.title.includes(c.name));assert.equal(body.clauses,clauses);
 });
}

test('新增议题也可填写通用彩排任务，不会使用其他案例的内容',()=>{const proposal=rehearsalProposal(true,'openair','custom-topic');assert.ok(proposal.action);assert.match(rehearsalAcceptance('openair','custom-topic'),/本议题/);assert.doesNotMatch(JSON.stringify(proposal),/舞台|外摆/);});
