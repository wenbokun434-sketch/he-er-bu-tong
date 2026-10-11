export type Evidence = { id: string; nodeId: string; version: number; label: string; text: string; example: boolean };
export type LinkKind = "concerns" | "tension" | "addresses";
export type LinkDraft = { kind: LinkKind; from: string; to: string; topicId: string; reason: string; evidence: Evidence[]; fromVersion: number; toVersion: number };
export type MapLink = LinkDraft & { id: number; actorKey: string; createdAt: string; aiRunId?: string; retired?: string };
export type AiResult = { answer: string; citations: Evidence[]; questions: string[]; suggestions: LinkDraft[] };
export type AiRun = { id: string; actorKey: string; prompt: string; result: AiResult | null; revision: number; model: string; createdAt: string; status: string; error: string | null };
