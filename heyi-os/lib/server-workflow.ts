import { env } from 'cloudflare:workers';
import { replayWorkflow } from './workflow';
import type { ChangeEvent } from './collaboration';
export async function readWorkflow(caseId:string){
  const rows=await env.DB!.prepare('SELECT id,actor_key AS actorKey,kind,payload,created_at AS createdAt FROM workflow_events WHERE case_id = ? ORDER BY id').bind(caseId).all<ChangeEvent>();
  return replayWorkflow(rows.results,caseId);
}
