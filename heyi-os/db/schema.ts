import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rehearsalArchives = sqliteTable('rehearsal_archives', {
  id: text('id').primaryKey(), caseId: text('case_id').notNull(),
  payload: text('payload').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Only shared meeting messages are stored here. Private reflections never enter
// this table until their author intentionally posts a shared version.
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id").notNull().default("openair"),
  actor: text("actor").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[index('messages_case_id_idx').on(table.caseId,table.id)]);

// Append-only, explicitly shared collaboration changes; never stores local drafts.
export const collaborationEvents = sqliteTable("collaboration_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id").notNull().default("openair"),
  actorKey: text("actor_key").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  userId: text("user_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[index('collaboration_events_case_id_idx').on(table.caseId,table.id)]);

export const aiRuns = sqliteTable("ai_runs", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().default("openair"),
  actorKey: text("actor_key").notNull(),
  prompt: text("prompt").notNull(),
  result: text("result"),
  revision: integer("revision").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[index('ai_runs_case_created_idx').on(table.caseId,table.createdAt)]);

// Immutable document and task audit events, isolated from negotiation revisions.
export const workflowEvents = sqliteTable('workflow_events', {
  id: integer('id').primaryKey({autoIncrement:true}),
  caseId: text('case_id').notNull(),
  actorKey: text('actor_key').notNull(),
  kind: text('kind').notNull(),
  payload: text('payload').notNull(),
  userId: text('user_id'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[index('workflow_events_case_idx').on(table.caseId,table.id)]);
