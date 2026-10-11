import { env } from 'cloudflare:workers';
import { isCaseId, readCaseId } from '../../../lib/cases';
import { actors, type RoleKey } from '../../../lib/collaboration';
import { readState } from '../../../lib/server-state';
import { readWorkflow } from '../../../lib/server-workflow';
import { prepareWorkflow } from '../../../lib/workflow';
const headers={'Cache-Control':'no-store'};
const fail=(error:string,status=400)=>Response.json({error},{status,headers});
export async function GET(request:Request){const caseId=readCaseId(request);if(!caseId)return fail('案例不存在。',404);try{return Response.json({workflow:await readWorkflow(caseId)},{headers});}catch{return fail('文书与任务暂时无法读取，请重试。',503);}}
export async function POST(request:Request){
  let body;
  try{const raw=await request.text();if(raw.length>160000)return fail('文书内容过长。',413);body=JSON.parse(raw);}catch{return fail('请求格式不正确。');}
  if(!body||!isCaseId(body.caseId)||typeof body.actorKey!=='string'||!Object.hasOwn(actors,body.actorKey)||typeof body.kind!=='string')return fail('请刷新并选择有效案例及演示角色。');
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!Number.isSafeInteger(body.expectedCollaborationRevision)||body.expectedCollaborationRevision<0)return fail('缺少版本信息，请刷新。');
  try{
    const [w,s]=await Promise.all([readWorkflow(body.caseId),readState(body.caseId)]);
    if(w.revision!==body.expectedRevision||s.revision!==body.expectedCollaborationRevision)return fail('其他成员已更新文书、任务或协商依据。输入已保留，请核对最新版本后再提交。',409);
    let payload;try{payload=prepareWorkflow(body.kind,body,body.actorKey as RoleKey,w,s);}catch(e){return fail(e instanceof Error?e.message:'操作无效。');}
    if(payload===null)return Response.json({workflow:w,unchanged:true},{headers});
    const result=await env.DB!.prepare('INSERT INTO workflow_events (case_id,actor_key,kind,payload,user_id) SELECT ?,?,?,?,? WHERE COALESCE((SELECT MAX(id) FROM workflow_events WHERE case_id = ?),0) = ? AND COALESCE((SELECT MAX(id) FROM collaboration_events WHERE case_id = ?),0) = ? RETURNING id').bind(body.caseId,body.actorKey,body.kind,JSON.stringify(payload),request.headers.get('oai-authenticated-user-id'),body.caseId,w.revision,body.caseId,s.revision).first<{id:number}>();
    if(!result)return fail('刚刚发生了其他更新，请核对新版本后重试。',409);
    return Response.json({workflow:await readWorkflow(body.caseId),eventId:result.id},{status:201,headers});
  }catch{return fail('保存失败，输入已保留。请稍后重试。',503);}
}
