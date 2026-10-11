import { activeVotes, parties, profileStamp, topicStatus, type ChangeEvent, type CollaborationState, type PartyKey, type RoleKey } from './collaboration.ts';
import { getCase } from './cases.ts';
import { missingProposalFields, proposalFields, type ProposalDetails } from './proposal.ts';

export const documentFields = [
  {key:'title',label:'文书标题',hint:'明确合作事项与适用项目。',max:120},
  {key:'purpose',label:'共同目的',hint:'我们共同希望实现什么？不要求各方立场一致。',max:1600},
  {key:'scope',label:'适用范围与边界',hint:'参与方、地点、对象、权限及明确不适用的情形。',max:1600},
  {key:'reservations',label:'保留分歧与未决事项',hint:'哪些尚未达成一致？它们不是已通过条款；没有请明确写“暂无”。',max:2400},
  {key:'reviewProcedure',label:'复审与修订机制',hint:'谁参与复审、依据什么材料、如何提出修订并重新确认。',max:1600},
  {key:'disputeProcedure',label:'异议处理与暂停机制',hint:'出现分歧后向谁提出、多久回应、何种情况下暂停执行。',max:1600},
  {key:'exitProcedure',label:'退出与交接安排',hint:'退出条件、告知期限、未完成任务与资料如何交接。',max:1600},
] as const;
export type DocumentText = Record<typeof documentFields[number]['key'],string>;
export type Clause = {topicId:string;proposalId:number;title:string;details:ProposalDetails};
export type DocumentBody = DocumentText & {startDate:string;endDate:string;reviewDate:string;clauses:Clause[]};
export type SourceSnapshot = {topicId:string;title:string;proposalId:number;version:number;details:ProposalDetails;stamp:string;votes:ReturnType<typeof activeVotes>};
export type DocumentVote = {choice:'approve'|'revise';note:string;at:string;eventId:number};
export type DocumentVersion = {id:number;version:number;body:DocumentBody;sources:SourceSnapshot[];reason:string;actorKey:RoleKey;createdAt:string;submittedAt?:string;votes:Partial<Record<PartyKey,DocumentVote>>};
export const taskStatuses = {todo:'未开始',doing:'执行中',blocked:'受阻',review:'待验收',done:'已验收',cancelled:'已取消'} as const;
export type TaskStatus = keyof typeof taskStatuses;
export type Commitment = {id:number;documentId:number;clauseId:string;title:string;action:string;ownerKey:RoleKey;reviewerKey:RoleKey;dueDate:string;reviewDate:string;acceptance:string;status:TaskStatus;progress:number;evidence:string;createdAt:string;updatedAt:string;completedAt?:string};
export type WorkflowState = {caseId:string;revision:number;documents:DocumentVersion[];tasks:Commitment[];history:ChangeEvent[]};
export function emptyWorkflow(caseId:string):WorkflowState{return {caseId,revision:0,documents:[],tasks:[],history:[]};}
export function replayWorkflow(events:ChangeEvent[],caseId:string):WorkflowState {
  const s=emptyWorkflow(caseId);
  for(const e of events){
    const p=JSON.parse(e.payload);
    if(e.kind==='document_save')s.documents.push({id:e.id,version:s.documents.length+1,body:p.body,sources:p.sources,reason:p.reason,actorKey:e.actorKey,createdAt:e.createdAt,votes:{}});
    const d=s.documents.find(d=>d.id===p.documentId);
    if(d && e.kind==='document_submit')d.submittedAt=e.createdAt;
    if(d && e.kind==='document_vote' && e.actorKey!=='coordinator')d.votes[e.actorKey]={choice:p.choice,note:p.note,at:e.createdAt,eventId:e.id};
    if(e.kind==='task_create')s.tasks.push({...p,id:e.id,status:'todo',progress:0,evidence:'',createdAt:e.createdAt,updatedAt:e.createdAt});
    const t=s.tasks.find(t=>t.id===p.taskId);
    if(t){
      if(e.kind==='task_progress'){t.status=p.status;t.progress=p.progress;if(p.evidence)t.evidence=p.evidence;}
      if(e.kind==='task_schedule'){t.dueDate=p.dueDate;t.reviewDate=p.reviewDate;}
      if(e.kind==='task_review'){t.status=p.outcome==='accept'?'done':'doing';t.progress=p.outcome==='accept'?100:Math.min(t.progress,99);t.completedAt=p.outcome==='accept'?e.createdAt:undefined;}
      if(e.kind==='task_cancel')t.status='cancelled';
      if(e.kind==='task_reopen'){t.status='todo';t.progress=0;}
      t.updatedAt=e.createdAt;
    }
    s.revision=e.id;
  }
  s.history=[...events].reverse();return s;
}
export function eligibleTopics(s:CollaborationState){return s.topics.filter(t=>topicStatus(t,s).key==='agreed'&&t.proposal&&!missingProposalFields(t.proposal.details).length);}
export function makeDocument(s:CollaborationState):DocumentBody {
  const c=getCase(s.caseId),pending=s.topics.filter(t=>topicStatus(t,s).key!=='agreed');
  return {title:`${c.name} · 合作和议书`,purpose:c.direction,scope:'',reservations:pending.length?pending.map(t=>`${t.title}：${topicStatus(t,s).detail}`).join('\n'):'暂无未决议题；任何新增异议应依本书复审机制处理。',reviewProcedure:'',disputeProcedure:'',exitProcedure:'',startDate:'',endDate:'',reviewDate:'',clauses:eligibleTopics(s).map(t=>({topicId:t.id,proposalId:t.proposal!.id,title:t.title,details:{...t.proposal!.details!}}))};
}
export function documentApproved(d:DocumentVersion){return !!d.submittedAt&&parties.every(p=>d.votes[p]?.choice==='approve');}
export function documentMissing(body:DocumentBody){return [...documentFields.filter(f=>!body[f.key].trim()).map(f=>f.label),...(!body.startDate?['适用开始日期']:[]),...(!body.reviewDate?['首次复审日期']:[]),...(!body.clauses.length?['至少一项来源明确的共同条款']:[]),...body.clauses.flatMap((c,i)=>[...(!c.title.trim()?[`条款 ${i+1} 标题`]:[]),...missingProposalFields(c.details).map(label=>`条款 ${i+1} ${label}`)])];}
export function documentStale(d:DocumentVersion,s:CollaborationState){return d.sources.some(src=>{const t=s.topics.find(t=>t.id===src.topicId);return !t||t.proposal?.id!==src.proposalId||topicStatus(t,s).key!=='agreed'||src.stamp!==profileStamp(s);});}
export function effectiveDocument(w:WorkflowState,s:CollaborationState){const last=[...w.documents].reverse().find(documentApproved);return last&&!documentStale(last,s)?last:undefined;}
export function documentStatus(d:DocumentVersion,s:CollaborationState){if(documentStale(d,s))return '依据已变化 · 待复审';if(documentApproved(d))return '三方已确认';if(parties.some(p=>d.votes[p]?.choice==='revise'))return '有修订意见';return d.submittedAt?'待三方确认':'草稿';}
export function taskNeedsReview(t:Commitment,w:WorkflowState,s:CollaborationState){return effectiveDocument(w,s)?.id!==t.documentId;}
export function today(){return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});}
export function taskOverdue(t:Commitment,date=today()){return !['done','cancelled'].includes(t.status)&&t.dueDate<date;}
export function reviewDue(t:Commitment,date=today()){return !['done','cancelled'].includes(t.status)&&t.reviewDate<=date;}
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('请求格式不正确。');return v as Record<string,unknown>;}
function text(v:unknown,label:string,max=1600,required=true){if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))throw Error(`${label}${required?'不能为空，且':''}最多 ${max} 字。`);return v.trim();}
export function validDate(v:unknown,label:string,required=true){const str=text(v,label,10,required);if(!str&&!required)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(str)||Number(str.slice(0,4))<2000||Number.isNaN(Date.parse(str))||new Date(str+'T00:00:00Z').toISOString().slice(0,10)!==str)throw Error(`${label}必须是有效日期。`);return str;}
function role(v:unknown):RoleKey{if(typeof v!=='string'||!['coordinator',...parties].includes(v))throw Error('请选择有效角色。');return v as RoleKey;}
function normalizeBody(raw:unknown,s:CollaborationState):{body:DocumentBody;sources:SourceSnapshot[]}{
  const b=object(raw),fields=Object.fromEntries(documentFields.map(f=>[f.key,text(b[f.key],f.label,f.max,f.key==='title')])) as DocumentText;
  const startDate=validDate(b.startDate,'开始日期',false),endDate=validDate(b.endDate,'结束日期',false),reviewDate=validDate(b.reviewDate,'首次复审日期',false);
  if((endDate&&startDate&&endDate<startDate)||(reviewDate&&startDate&&reviewDate<startDate)||(endDate&&reviewDate&&reviewDate>endDate))throw Error('复审日期须在文书适用期内，结束日期不能早于开始日期。');
  if(!Array.isArray(b.clauses)||b.clauses.length>30)throw Error('共同条款最多 30 项。');
  const seen=new Set<string>(),sources:SourceSnapshot[]=[];
  const clauses=b.clauses.map(raw=>{const c=object(raw),t=eligibleTopics(s).find(t=>t.id===c.topicId&&t.proposal!.id===c.proposalId);if(!t||seen.has(t.id))throw Error('条款来源已变化、未获三方接受、内容不完整或重复；请重新选择。');seen.add(t.id);sources.push({topicId:t.id,title:t.title,proposalId:t.proposal!.id,version:t.proposal!.version,details:{...t.proposal!.details!},stamp:profileStamp(s),votes:activeVotes(t,s)});const rawDetails=object(c.details);return {topicId:t.id,proposalId:t.proposal!.id,title:text(c.title,'条款标题',120,false),details:Object.fromEntries(proposalFields.map(f=>[f.key,text(rawDetails[f.key],f.label,600,false)])) as ProposalDetails};});
  return {body:{...fields,startDate,endDate,reviewDate,clauses},sources};
}
// All permissions are demo-role rules; hosting remains owner-private, not a multi-user identity system.
export function prepareWorkflow(kind:string,input:unknown,actorKey:RoleKey,w:WorkflowState,s:CollaborationState):Record<string,unknown>|null {
  const p=object(input);role(actorKey);
  if(kind==='document_save'){
    if(w.documents.length>=200)throw Error('本案例已达到 200 个文书版本。');
    const value=normalizeBody(p.body,s),last=w.documents.at(-1);
    if(last&&JSON.stringify(last.body)===JSON.stringify(value.body)&&!documentStale(last,s))return null;
    return {...value,reason:text(p.reason,'修订说明',800,!!last)};
  }
  if(kind==='document_submit'||kind==='document_vote'){
    const d=w.documents.find(d=>d.id===p.documentId);if(!d)throw Error('文书版本不存在。');
    if(d.id!==w.documents.at(-1)?.id)throw Error('只能送审或确认最新版本。请查看最新文书。');
    if(documentStale(d,s))throw Error('文书依据已变化，请重新整理并保存新版本。');
    if(kind==='document_submit'){const missing=documentMissing(d.body);if(missing.length)throw Error(`送审前请补全：${missing.join('、')}。`);if(d.submittedAt)return null;return {documentId:d.id};}
    if(actorKey==='coordinator')throw Error('协调员不能替三方确认整份文书。');
    if(!d.submittedAt)throw Error('请先冻结并送交三方确认。');
    if(documentApproved(d))throw Error('此版本已经成稿；如需变更，请另存新版本。');
    if(!['approve','revise'].includes(String(p.choice))||p.reviewed!==true)throw Error('请阅读整份文书后明确提交意见。');
    const note=text(p.note,'确认或修订意见',1600,p.choice==='revise');
    if(d.votes[actorKey]?.choice===p.choice&&d.votes[actorKey]?.note===note)return null;
    return {documentId:d.id,choice:p.choice,note};
  }
  if(kind==='task_create'){
    const d=effectiveDocument(w,s);if(!d||d.id!==p.documentId)throw Error('任务只能来自当前有效、整份获三方确认的和议书。');
    const c=d.body.clauses.find(c=>c.topicId===p.clauseId);if(!c)throw Error('请选择当前和议书的条款。');
    if(w.tasks.some(t=>t.documentId===d.id&&t.clauseId===c.topicId))throw Error('该条款已建立承诺任务，请更新现有任务，避免重复。');
    const ownerKey=role(p.ownerKey),reviewerKey=role(p.reviewerKey);if(ownerKey===reviewerKey)throw Error('负责人和复审人须使用不同演示角色，不能自行验收。');
    const dueDate=validDate(p.dueDate,'执行截止日期'),reviewDate=validDate(p.reviewDate,'验收日期');if(reviewDate<dueDate)throw Error('验收日期不能早于执行截止日期。');
    return {documentId:d.id,clauseId:c.topicId,title:c.title,action:c.details.action,ownerKey,reviewerKey,dueDate,reviewDate,acceptance:text(p.acceptance,'验收标准',1600)};
  }
  const t=w.tasks.find(t=>t.id===p.taskId);if(!t)throw Error('任务不存在。');
  const note=text(p.note,'操作说明',1600);
  if(kind==='task_progress'){
    if(actorKey!==t.ownerKey)throw Error('只有本任务负责人可以更新执行进度和提交完成依据。');
    if(['done','cancelled','review'].includes(t.status))throw Error('此任务已提交验收或结束，需先复审退回或重新开启。');
    if(!['todo','doing','blocked','review'].includes(String(p.status)))throw Error('任务状态无效。');
    if(!Number.isInteger(p.progress)||Number(p.progress)<0||Number(p.progress)>100)throw Error('进度须是 0 到 100 的整数。');
    const evidence=text(p.evidence,'完成依据',2400,p.status==='review');
    if(p.status==='review'&&taskNeedsReview(t,w,s))throw Error('文书已变更或依据待复审，此任务不能直接申请验收。请处理文书并从有效版本建立任务。');
    return {taskId:t.id,status:p.status,progress:p.status==='review'?100:p.status==='todo'?0:Math.min(Number(p.progress),99),evidence,note};
  }
  if(kind==='task_schedule'){
    if(![t.ownerKey,'coordinator'].includes(actorKey))throw Error('只有负责人或协调员可以调整期限。');
    if(['done','cancelled'].includes(t.status))throw Error('已结束任务不能改期。');
    const dueDate=validDate(p.dueDate,'执行截止日期'),reviewDate=validDate(p.reviewDate,'验收日期');if(reviewDate<dueDate)throw Error('验收日期不能早于执行截止日期。');
    if(t.dueDate===dueDate&&t.reviewDate===reviewDate)return null;
    return {taskId:t.id,dueDate,reviewDate,note};
  }
  if(kind==='task_review'){
    if(actorKey!==t.reviewerKey)throw Error('只有指定复审人可以验收或退回。');
    if(!['accept','rework','reopen'].includes(String(p.outcome)))throw Error('复审结论无效。');
    if(p.outcome==='reopen'?t.status!=='done':t.status!=='review')throw Error('任务当前状态不允许这项复审操作。');
    if(p.outcome==='accept'&&taskNeedsReview(t,w,s))throw Error('来源文书已变更或待复审，不能按旧依据通过验收。');
    return {taskId:t.id,outcome:p.outcome,note};
  }
  if(kind==='task_cancel'||kind==='task_reopen'){
    if(actorKey!=='coordinator')throw Error('取消任务或恢复已取消任务由协调员操作，并保留理由。');
    if(kind==='task_cancel'&&['done','cancelled'].includes(t.status))throw Error('已结束任务不能再次取消。');
    if(kind==='task_reopen'&&t.status!=='cancelled')throw Error('只有已取消任务可以恢复；已验收任务由复审人重新开启。');
    return {taskId:t.id,note};
  }
  throw Error('不支持的文书或任务操作。');
}
export const workflowLabels:Record<string,string>={document_save:'保存文书版本',document_submit:'冻结送审',document_vote:'提交文书意见',task_create:'建立承诺任务',task_progress:'更新执行进度',task_schedule:'调整执行期限',task_review:'提交复审结论',task_cancel:'取消任务',task_reopen:'恢复任务'};
