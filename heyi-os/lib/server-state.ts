import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { collaborationEvents, messages } from "../db/schema";
import { replayEvents, type ChangeEvent } from "./collaboration";
export async function readState(caseId: string) {
  const events = await getDb().select({ id: collaborationEvents.id, actorKey: collaborationEvents.actorKey, kind: collaborationEvents.kind, payload: collaborationEvents.payload, createdAt: collaborationEvents.createdAt }).from(collaborationEvents).where(eq(collaborationEvents.caseId,caseId)).orderBy(asc(collaborationEvents.id));
  return replayEvents(events as ChangeEvent[],caseId);
}
export async function readMessages(caseId: string) { return (await getDb().select().from(messages).where(eq(messages.caseId,caseId)).orderBy(desc(messages.id)).limit(120)).reverse(); }
