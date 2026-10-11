import type { MapLink } from "./graph-types";
import { DEFAULT_CASE_ID, getCase } from './cases.ts';
import type { ProposalDetails } from './proposal';
export const actors = {
  coordinator: { actor: "林然", role: "协调员" },
  research: { actor: "Dr. Chen", role: "研究团队" },
  hospital: { actor: "Grace N.", role: "医院与社区" },
  compliance: { actor: "Matteo R.", role: "数据合规" },
} as const;
export type RoleKey = keyof typeof actors;
export type PartyKey = Exclude<RoleKey, "coordinator">;
export const parties: PartyKey[] = ["research", "hospital", "compliance"];
export type Profile = { goal: string; concern: string; boundary: string; flexible: string; revision: number };
export const profileFields = [
  { key: "goal", label: "希望达成", hint: "你希望合作带来什么结果？" },
  { key: "concern", label: "最担心的事", hint: "你担忧什么风险或影响？" },
  { key: "boundary", label: "不可接受的底线", hint: "哪些事情不可发生？" },
  { key: "flexible", label: "可协商的条件", hint: "在什么条件下愿意调整？没有可写“暂无”。" },
] as const;
export const voteLabels = { accept: "接受", conditional: "附条件接受", object: "仍有异议", info: "需要更多信息" } as const;
export type VoteChoice = keyof typeof voteLabels;
export type Vote = { choice: VoteChoice; note: string; proposalId: number; profileStamp: string; eventId: number };
export type Proposal = { id: number; version: number; text: string; details?: ProposalDetails; reason: string; actorKey: RoleKey; createdAt: string };
export type Topic = { id: string; title: string; description: string; proposal: Proposal | null; votes: Partial<Record<PartyKey, Vote>> };
export type ChangeEvent = { id: number; actorKey: RoleKey; kind: string; payload: string; createdAt: string };
export type CollaborationState = { caseId: string; revision: number; profiles: Record<PartyKey, Profile>; topics: Topic[]; history: ChangeEvent[]; links: MapLink[] };

export function initialState(caseId = DEFAULT_CASE_ID): CollaborationState {
  const config=getCase(caseId);
  return {
    caseId,
    revision: 0,
    profiles: Object.fromEntries(parties.map(p=>[p,{...config.profiles[p],revision:0}])) as Record<PartyKey,Profile>,
    topics: config.topics.map(t=>({...t,proposal:null,votes:{}})),
    history: [], links: [],
  };
}

export function profileStamp(state: CollaborationState) {
  return parties.map(key => `${key}:${state.profiles[key].revision}`).join("|");
}

export function profilesEqual(a: Profile, b: Pick<Profile, 'goal'|'concern'|'boundary'|'flexible'>) {
  return profileFields.every(f=>a[f.key].trim()===b[f.key].trim());
}

export function replayEvents(events: ChangeEvent[], caseId = DEFAULT_CASE_ID): CollaborationState {
  const state = initialState(caseId);
  for (const event of events) {
    const payload = JSON.parse(event.payload);
    if (event.kind === "profile" && event.actorKey !== "coordinator") {
      state.profiles[event.actorKey] = { ...payload.profile, revision: event.id };
    } else if (event.kind === "topic") {
      state.topics.push({ id: `topic-${event.id}`, title: payload.title, description: payload.description, proposal: null, votes: {} });
    } else if (event.kind === "link") {
      state.links.push({ ...payload, id: event.id, actorKey: event.actorKey, createdAt: event.createdAt });
    } else if (event.kind === "link_retract") {
      const link = state.links.find(item => item.id === payload.linkId);
      if (link) link.retired = payload.reason;
    } else {
      const topic = state.topics.find(item => item.id === payload.topicId);
      if (topic && event.kind === "proposal") {
        topic.proposal = { id: event.id, version: (topic.proposal?.version ?? 0) + 1, text: payload.text, details: payload.details, reason: payload.reason, actorKey: event.actorKey, createdAt: event.createdAt };
        topic.votes = {};
      } else if (topic && event.kind === "vote" && event.actorKey !== "coordinator" && topic.proposal?.id === payload.proposalId) {
        topic.votes[event.actorKey] = { ...payload, eventId: event.id };
      }
    }
    state.revision = event.id;
  }
  state.history = [...events].reverse();
  return state;
}

export function activeVotes(topic: Topic, state: CollaborationState) {
  const stamp = profileStamp(state);
  return Object.fromEntries(parties.flatMap(key => {
    const vote = topic.votes[key];
    return vote && vote.proposalId === topic.proposal?.id && vote.profileStamp === stamp ? [[key, vote]] : [];
  })) as Partial<Record<PartyKey, Vote>>;
}

export function topicStatus(topic: Topic, state: CollaborationState) {
  if (!topic.proposal) return { key: "open", label: "待提出方案", detail: "不同诉求已列出，尚未形成供三方确认的方案。" };
  const votes = activeVotes(topic, state);
  const values = Object.values(votes);
  if (values.some(vote => vote.choice === "object")) return { key: "conflict", label: "存在异议", detail: "至少一方仍有异议，请回应原因并修订方案。" };
  if (values.some(vote => vote.choice === "info")) return { key: "information", label: "需补充信息", detail: "补充信息后，由相应成员重新表态。" };
  if (values.length === 3 && values.every(vote => vote.choice === "accept")) return { key: "agreed", label: "三方已确认", detail: "三方明确接受当前版本，可进入和议书草案。" };
  if (values.length === 3 && values.some(vote => vote.choice === "conditional")) return { key: "conditional", label: "条件待纳入", detail: "三方已回应，但接受条件仍需写入新方案并重新确认；尚未生效。" };
  return { key: "pending", label: "待三方确认", detail: `当前 ${values.length}/3 方已回应，沉默不表示同意。` };
}

export function describeEvent(event: ChangeEvent, state: CollaborationState) {
  const p = JSON.parse(event.payload);
  const topic = state.topics.find(item => item.id === p.topicId)?.title ?? "议题";
  if (event.kind === "profile") return { title: "确认共享立场", text: profileFields.map(field => `${field.label}：${p.profile[field.key]}`).join("；") };
  if (event.kind === "topic") return { title: `新增议题 · ${p.title}`, text: p.description };
  if (event.kind === "proposal") return { title: `提交方案 · ${topic}`, text: `${p.text}${p.reason ? `\n修订说明：${p.reason}` : ""}` };
  if (event.kind === "link") return { title: `确认地图关联${p.aiRunId ? " · AI 建议经人工确认" : ""}`, text: `${p.reason}\n依据：${p.evidence.map((e: { label: string; text: string }) => `${e.label}「${e.text}」`).join("；")}` };
  if (event.kind === "link_retract") return { title: `撤销关联 #${p.linkId}`, text: p.reason };
  return { title: `表态 · ${topic} · ${voteLabels[p.choice as VoteChoice]}`, text: p.note || "明确接受该版本；不代表接受未来修改。" };
}
