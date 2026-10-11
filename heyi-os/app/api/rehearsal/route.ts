import {env} from 'cloudflare:workers';
import {isCaseId} from '../../../lib/cases';
import {rehearsalTables} from '../../../lib/rehearsal';
const headers={'Cache-Control':'no-store'};
const enabled=()=>String((env as unknown as {HEYI_REHEARSAL?:string}).HEYI_REHEARSAL)==='true';
const fail=(error:string,status=400)=>Response.json({error},{status,headers});
export async function GET(request:Request){
 if(!enabled())return Response.json({enabled:false},{headers});
 const url=new URL(request.url),caseId=url.searchParams.get('caseId');
 if(!isCaseId(caseId))return fail('请选择有效案例。');
 const id=url.searchParams.get('archiveId');
 if(id){const row=await env.DB!.prepare('SELECT payload FROM rehearsal_archives WHERE id=? AND case_id=?').bind(id,caseId).first<{payload:string}>();if(!row)return fail('快照不存在。',404);return new Response(row.payload,{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="rehearsal-${id}.json"`}});}
 const latest=await env.DB!.prepare('SELECT id FROM rehearsal_archives WHERE case_id=? ORDER BY rowid DESC LIMIT 1').bind(caseId).first<{id:string}>();
 return Response.json({enabled:true,lastArchiveId:latest?.id??null},{headers});
}
export async function POST(request:Request){
 if(!enabled())return fail('正常试用模式不提供彩排重置。',403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('请从本机彩排页面操作。',403);
 let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>;}catch{return fail('请求格式错误。');}
 if(!body||!isCaseId(body.caseId)||body.confirm!==true||![body.expectedRevision,body.expectedWorkflowRevision].every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0))return fail('请核对当前案例并确认开始新一轮。');
 try{
  const id=crypto.randomUUID(),caseId=body.caseId;
  // Snapshot and deletion share one atomic D1 batch. Every delete requires the
  // guarded snapshot insert to succeed; a stale revision cannot clear anything.
  const fragments=Object.entries(rehearsalTables).map(([table,columns])=>`'${table}',json((SELECT COALESCE(json_group_array(json_object(${columns.map(c=>`'${c}',${c}`).join(',')})),'[]') FROM ${table} WHERE case_id=?))`);
  const insert=env.DB!.prepare(`INSERT INTO rehearsal_archives(id,case_id,payload) SELECT ?,?,json_object(${fragments.join(',')}) WHERE COALESCE((SELECT MAX(id) FROM collaboration_events WHERE case_id=?),0)=? AND COALESCE((SELECT MAX(id) FROM workflow_events WHERE case_id=?),0)=? RETURNING id`).bind(id,caseId,...Object.keys(rehearsalTables).map(()=>caseId),caseId,body.expectedRevision,caseId,body.expectedWorkflowRevision);
  const results=await env.DB!.batch([insert,...Object.keys(rehearsalTables).map(table=>env.DB!.prepare(`DELETE FROM ${table} WHERE case_id=? AND EXISTS(SELECT 1 FROM rehearsal_archives WHERE id=?)`).bind(caseId,id))]);
  if(!results[0].results.length)return fail('案例已有新记录，请核对后再开始新一轮。',409);
  return Response.json({archiveId:id},{headers});
 }catch{return fail('未能开始新一轮，请稍后重试。',503);}
}
