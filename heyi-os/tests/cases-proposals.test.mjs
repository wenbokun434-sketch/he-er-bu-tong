import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,getCase,isCaseId} from '../lib/cases.ts';
import {initialState,profilesEqual,replayEvents,profileStamp,topicStatus} from '../lib/collaboration.ts';
import {sourceCatalog} from '../lib/difference-graph.ts';
import {prepareContext} from '../lib/ai-assistant.ts';
import {emptyProposal,missingProposalFields,normalizeProposal,proposalText} from '../lib/proposal.ts';

test('三个案例的角色、画像和议题独立且创建状态不会共享引用',()=>{
 assert.equal(new Set(cases.map(c=>c.id)).size,3);assert.equal(isCaseId('unknown'),false);
 for(const c of cases){const s=initialState(c.id);assert.equal(s.caseId,c.id);assert.equal(s.topics[0].title,c.topics[0].title);assert.ok(sourceCatalog(s)[0].label.includes(c.actors.research.role));s.profiles.research.goal='临时修改';assert.notEqual(initialState(c.id).profiles.research.goal,'临时修改');}
});
test('画像比较忽略首尾空白但不会忽略实际内容变化',()=>{
 const p=initialState().profiles.hospital;assert.ok(profilesEqual(p,{...p,goal:' '+p.goal+'\n'}));assert.equal(profilesEqual(p,{...p,goal:p.goal+'新条件'}),false);
});
test('五项全部填写才通过结构检查，保存统一的方案正文',()=>{
 const d={responsible:'学生策划组',action:'安排轮换展位',timing:'活动前一周公布',conditions:'通道保持畅通',review:'社团和管理方两天内联合复核'};
 assert.equal(missingProposalFields(emptyProposal()).length,5);
 for(const key of Object.keys(d))assert.throws(()=>normalizeProposal({...d,[key]:' '}));
 assert.equal(normalizeProposal({...d,action:' 安排轮换展位 '}).action,d.action);assert.match(proposalText(d),/如何复审：/);
 assert.throws(()=>normalizeProposal({...d,review:'x'.repeat(601)}));
});
test('旧方案原文和历史确认保留，但完整性仍为待补全',()=>{
 const stamp=profileStamp(initialState());const events=[{id:1,kind:'proposal',actorKey:'research',payload:JSON.stringify({topicId:'speed',text:'11',reason:''}),createdAt:'2026-10-11 00:00:00'},...['research','hospital','compliance'].map((actorKey,i)=>({id:i+2,kind:'vote',actorKey,payload:JSON.stringify({topicId:'speed',proposalId:1,profileStamp:stamp,choice:'accept',note:''}),createdAt:'2026-10-11 00:00:00'}))];
 const state=replayEvents(events);assert.equal(state.topics[0].proposal.text,'11');assert.equal(topicStatus(state.topics[0],state).key,'agreed');assert.equal(missingProposalFields(state.topics[0].proposal.details).length,5);
});
test('AI 上下文使用所选案例的身份与内容完整性，不混入医院模板',()=>{
 const state=initialState('campus'),c=JSON.parse(prepareContext(state,[],'hospital','检查方案').input);
 assert.equal(c.case.id,'campus');assert.equal(c.requestingRole,'文化社团代表');assert.match(c.qualityPolicy,/不能替成员批准/);assert.equal(c.topics[0].missingFields.length,5);assert.ok(!JSON.stringify(c).includes('原始患者数据'));
});
