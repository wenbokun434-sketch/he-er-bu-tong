import {getCase} from './cases.ts';
import {rehearsalSample} from './rehearsal-samples.ts';
import {activeVotes,parties,topicStatus,type CollaborationState,type RoleKey} from './collaboration.ts';
import {documentApproved,effectiveDocument,type DocumentBody,type WorkflowState} from './workflow.ts';
import type {ProposalDetails} from './proposal.ts';
export const rehearsalTables = {
  messages:['id','case_id','actor','role','content','created_at'],
  collaboration_events:['id','case_id','actor_key','kind','payload','user_id','created_at'],
  workflow_events:['id','case_id','actor_key','kind','payload','user_id','created_at'],
  ai_runs:['id','case_id','actor_key','prompt','result','revision','model','status','error','created_at'],
} as const;
export function rehearsalDates(){const now=new Date();const day=now.toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});const offset=(n:number)=>{const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};return {start:offset(1),due:offset(3),review:offset(4),end:offset(14)};}
export function rehearsalProposal(revised:boolean,caseId='campus',topicId?:string):ProposalDetails {
 const d=rehearsalDates(),sample=rehearsalSample(caseId,topicId);
 return {responsible:sample.responsible,action:revised?sample.topic.revised:sample.topic.first,timing:d.due+' 前整理安排，'+d.review+' 三方共同核对。',conditions:sample.conditions,review:revised?'三方按约定逐项核对；发现遗漏或不符合底线的安排，暂停相关部分，修订后重新确认。':'由提出方汇总反馈后调整。'};
}
export function rehearsalDocument(body:DocumentBody,caseId='campus'):DocumentBody {
 const d=rehearsalDates(),sample=rehearsalSample(caseId);
 return {...body,title:sample.caseName+' · 彩排和议书',purpose:sample.purpose,scope:sample.scope,startDate:d.start,endDate:d.end,reviewDate:d.review,reservations:sample.reservations,reviewProcedure:'三方于 '+d.review+' 核对共同条款，提出修订时另存新版本并重新确认。',disputeProcedure:'异议提交协调员，一天内组织三方讨论；涉及各方底线的安排先暂停。',exitProcedure:'退出方提前两天通知协调员，交接已有安排并告知其他参与方。'};
}
export type DemoCue={phase:number;title:string;detail:string;view:string;role:RoleKey;complete?:boolean};
export function rehearsalCue(s:CollaborationState,w:WorkflowState):DemoCue{
 const t=s.topics[0],votes=activeVotes(t,s),status=topicStatus(t,s),sample=rehearsalSample(s.caseId,t.id);
 if(!t.proposal)return {phase:0,title:'提出第一稿，让分歧有具体对象',detail:'打开首个议题，填入第一稿示例并发布。发布不自动代表任何人接受。',view:'差异地图',role:'coordinator'};
 if(t.proposal.version===1&&!Object.values(votes).some(v=>v.choice==='object'||v.choice==='conditional'))return {phase:0,title:'让'+getCase(s.caseId).actors.hospital.role+'表达异议',detail:'选择“仍有异议”，说明“'+sample.objection+'”，再提交本方意见。',view:'差异地图',role:'hospital'};
 if(status.key==='conflict'||status.key==='conditional')return {phase:1,title:'把反对意见写进修订方案',detail:'使用修订稿示例，'+sample.revisionHint+'核对后发布新版本。',view:'差异地图',role:'coordinator'};
 if(status.key!=='agreed'){const p=parties.find(p=>votes[p]?.choice!=='accept')!;return {phase:2,title:'三方分别确认当前方案',detail:`当前 ${parties.filter(p=>votes[p]?.choice==='accept').length}/3 方接受。每次只提交当前角色的意见；附条件接受须先修订。`,view:'差异地图',role:p};}
 const d=w.documents.at(-1),effective=effectiveDocument(w,s);
 if(!d)return {phase:3,title:'把已确认方案整理成和议书',detail:'从已确认方案起草，可填入彩排正文；核对后保存固定版本。',view:'和议书工坊',role:'coordinator'};
 if(!effective){if(!d.submittedAt)return {phase:3,title:'核对文书并冻结送审',detail:'保存不等于批准。检查条款、期限、保留分歧和退出安排，再冻结送审。',view:'和议书工坊',role:'coordinator'};if(documentApproved(d))return {phase:3,title:'文书来源已变化，先重新整理',detail:'历史确认保留，但当前来源需复核。另存新版本并重新载入当前已确认方案。',view:'和议书工坊',role:'coordinator'};return {phase:3,title:'三方分别确认整份文书',detail:`当前 ${parties.filter(p=>d.votes[p]?.choice==='approve').length}/3 方接受。阅读正文并勾选确认，再提交本方意见。`,view:'和议书工坊',role:parties.find(p=>d.votes[p]?.choice!=='approve')!};}
 const task=w.tasks.find(t=>t.documentId===effective.id&&t.status!=='cancelled');
 if(!task)return {phase:4,title:'从成稿建立一项承诺',detail:'展开任务创建，点击“填入任务示例”，核对负责人、不同的复审人、期限和验收标准，再建立任务。',view:'承诺追踪',role:'coordinator'};
 if(task.status==='done')return {phase:4,title:'演示完成：不同立场形成共同的行动',detail:'回看和议书中的保留分歧与履约历史。你也可以导出成稿，展示最终成果。',view:'和议书工坊',role:'coordinator',complete:true};
 if(task.status==='review')return {phase:4,title:'报告完成之后，由复审人验收',detail:'前往承诺追踪，阅读负责人模拟完成依据，点击“填入验收意见示例”，核对后点击“依据已核实，验收通过”。',view:'承诺追踪',role:task.reviewerKey};
 return {phase:4,title:'负责人提交进度和完成依据',detail:'前往承诺追踪，点击“填入完成与验收示例”，自动填写说明、100% 进度和模拟完成依据；核对后点击“保存进度 / 提交验收”。',view:'承诺追踪',role:task.ownerKey};
}
