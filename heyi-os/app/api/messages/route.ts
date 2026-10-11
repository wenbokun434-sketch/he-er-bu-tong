import { getDb } from "../../../db";
import { messages } from "../../../db/schema";
import { getCase, isCaseId, readCaseId } from '../../../lib/cases';
import { readMessages } from '../../../lib/server-state';
import type { RoleKey } from '../../../lib/collaboration';

const headers={'Cache-Control':'no-store'};
const fail=(error:string,status=400)=>Response.json({error},{status,headers});

export async function GET(request:Request) {
  const caseId=readCaseId(request); if(!caseId)return fail('案例不存在。',404);
  try {
    return Response.json({caseId,messages:await readMessages(caseId)},{headers});
  } catch {
    return fail('会议记录暂时无法读取。',503);
  }
}

export async function POST(request: Request) {
  let body;
  try{body=await request.json() as Record<string,unknown>;}catch{return fail('消息格式不正确。');}
  if(!body || typeof body!=='object')return fail('消息格式不正确。');
  if(!isCaseId(body.caseId))return fail('请选择有效案例；旧页面请刷新后再操作。',409);
  const config=getCase(body.caseId);
  if(typeof body.actorKey!=='string' || !Object.hasOwn(config.actors,body.actorKey))return fail('请选择有效的演示角色。');
  if(typeof body.content!=='string' || !body.content.trim() || body.content.length>800)return fail('消息须为 1–800 字。');
  const identity=config.actors[body.actorKey as RoleKey];
  try {
    const [message] = await getDb().insert(messages).values({caseId:body.caseId,...identity,content:body.content.trim()}).returning();
    return Response.json({ message }, { status: 201, headers });
  } catch {
    return fail('消息保存失败，请稍后重试。',503);
  }
}
