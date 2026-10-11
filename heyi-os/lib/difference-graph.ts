import { actors, activeVotes, parties, profileFields, topicStatus, type CollaborationState } from "./collaboration.ts";
import type { Evidence, LinkDraft, LinkKind } from "./graph-types";
import { getCase } from './cases.ts';

export type SharedMessage = { id: number; actor: string; role: string; content: string; createdAt: string };
export type GraphNode = { id: string; kind: "need" | "conflict" | "topic" | "proposal"; label: string; text: string; version: number; topicId?: string; status?: string; evidence: Evidence[] };
export type GraphEdge = { id: string; from: string; to: string; label: string; stale: boolean; evidence: Evidence[]; reason: string; linkId?: number };
export const linkLabels: Record<LinkKind, string> = { concerns: "需求关联议题", tension: "两项需求存在张力", addresses: "方案回应需求" };

export function sourceCatalog(state: CollaborationState, messages: SharedMessage[] = []): Evidence[] {
  const actors=getCase(state.caseId).actors;
  const sources: Evidence[] = [];
  for (const party of parties) for (const field of profileFields) {
    const p = state.profiles[party], nodeId = `n:${party}:${field.key}`;
    sources.push({ id: `${nodeId}@${p.revision}`, nodeId, version: p.revision, label: `${actors[party].role} · ${field.label}`, text: p[field.key], example: p.revision === 0 });
  }
  for (const topic of state.topics) {
    const version = topic.id.startsWith("topic-") ? Number(topic.id.slice(6)) : 0, nodeId = `t:${topic.id}`;
    sources.push({ id: `${nodeId}@${version}`, nodeId, version, label: `议题 · ${topic.title}`, text: topic.description, example: version === 0 });
    if (topic.proposal) {
      const p = topic.proposal, nodeId = `p:${p.id}`;
      sources.push({ id: `${nodeId}@${p.id}`, nodeId, version: p.id, label: `${topic.title} · 方案 v${p.version}`, text: p.text, example: false });
    }
    for (const [party, vote] of Object.entries(activeVotes(topic, state))) {
      const nodeId = `v:${vote.eventId}`;
      sources.push({ id: `${nodeId}@${vote.eventId}`, nodeId, version: vote.eventId, label: `${actors[party as keyof typeof actors].role} · ${topic.title} · ${vote.choice}`, text: vote.note || "明确接受当前版本", example: false });
    }
  }
  for (const m of messages) sources.push({ id: `m:${m.id}@${m.id}`, nodeId: `m:${m.id}`, version: m.id, label: `会议消息 #${m.id} · ${m.actor} · ${m.createdAt}`, text: m.content, example: false });
  return sources;
}

export function baseNodes(state: CollaborationState): GraphNode[] {
  return sourceCatalog(state).filter(s => !s.nodeId.startsWith("v:")).map(s => {
    const topic = state.topics.find(t => s.nodeId === `t:${t.id}` || s.nodeId === `p:${t.proposal?.id}`);
    return { id: s.nodeId, kind: s.nodeId.startsWith("n:") ? "need" : s.nodeId.startsWith("t:") ? "topic" : "proposal", label: s.label, text: s.text, version: s.version, topicId: topic?.id, status: topic ? topicStatus(topic, state).label : s.example ? "案例示例" : "成员已共享", evidence: [s] };
  });
}

export function linkIsStale(link: LinkDraft, state: CollaborationState) {
  const catalog = sourceCatalog(state);
  return !catalog.some(s => s.nodeId === link.from && s.version === link.fromVersion) || !catalog.some(s => s.nodeId === link.to && s.version === link.toVersion) || link.evidence.some(e => !e.nodeId.startsWith("m:") && !catalog.some(s => s.id === e.id));
}

// Server resolves IDs into immutable copies of real sources; clients/models never supply quotes.
export function resolveLink(input: unknown, state: CollaborationState, sources: Evidence[]): LinkDraft {
  if (!input || typeof input !== "object") throw new Error("关联格式不正确。");
  const p = input as Record<string, unknown>, nodes = baseNodes(state);
  const from = nodes.find(n => n.id === p.from), to = nodes.find(n => n.id === p.to);
  const topic = state.topics.find(t => t.id === p.topicId);
  if (!from || !to || from.id === to.id || !topic) throw new Error("关联节点或议题已变化，请重新选择。");
  if (!((p.kind === "concerns" && from.kind === "need" && to.id === `t:${topic.id}`) || (p.kind === "tension" && from.kind === "need" && to.kind === "need") || (p.kind === "addresses" && from.id === `p:${topic.proposal?.id}` && to.kind === "need"))) throw new Error("请选择匹配的需求、议题和当前方案。");
  if (typeof p.reason !== "string" || !p.reason.trim() || p.reason.length > 600) throw new Error("请填写关联理由，最多 600 字。");
  if (!Array.isArray(p.evidenceIds) || p.evidenceIds.length < 1 || p.evidenceIds.length > 8 || p.evidenceIds.some(id => typeof id !== "string" || !sources.some(s => s.id === id))) throw new Error("引用来源不存在或已过期，请核对原文。");
  const ids = new Set([...p.evidenceIds, ...from.evidence.map(e => e.id), ...to.evidence.map(e => e.id)]);
  return { kind: p.kind as LinkKind, from: from.id, to: to.id, topicId: topic.id, reason: p.reason.trim(), evidence: sources.filter(s => ids.has(s.id)), fromVersion: from.version, toVersion: to.version };
}

export function buildGraph(state: CollaborationState, showHistory = false) {
  const actors=getCase(state.caseId).actors;
  const nodes = baseNodes(state), edges: GraphEdge[] = [];
  for (const topic of state.topics) {
    if (topic.proposal) edges.push({ id: `proposal:${topic.proposal.id}`, from: `t:${topic.id}`, to: `p:${topic.proposal.id}`, label: "当前方案", reason: "该方案由成员明确提交到此议题；不表示已获接受。", evidence: nodes.find(n => n.id === `p:${topic.proposal!.id}`)!.evidence, stale: false });
    for (const [party, vote] of Object.entries(activeVotes(topic, state))) if (vote.choice === "object" || vote.choice === "conditional" || vote.choice === "info") {
      const id = `c:vote:${vote.eventId}`, evidence = sourceCatalog(state).filter(s => s.nodeId === `v:${vote.eventId}`);
      nodes.push({ id, kind: "conflict", label: `${actors[party as keyof typeof actors].role} · ${vote.choice === "object" ? "明确异议" : vote.choice === "conditional" ? "接受条件" : "信息缺口"}`, text: vote.note, version: vote.eventId, topicId: topic.id, status: "成员反馈", evidence });
      edges.push({ id: `${id}:topic`, from: id, to: `t:${topic.id}`, label: "需回应", reason: vote.note, evidence, stale: false });
      edges.push({ id: `${id}:proposal`, from: id, to: `p:${topic.proposal!.id}`, label: "针对当前版本", reason: vote.note, evidence, stale: false });
    }
  }
  for (const link of state.links.filter(l => !l.retired || showHistory)) {
    const stale = !!link.retired || linkIsStale(link, state);
    for (const id of [link.from, link.to]) if (!nodes.some(n => n.id === id)) {
      const old = link.evidence.find(e => e.nodeId === id);
      if (old) nodes.push({ id, kind: id.startsWith("p:") ? "proposal" : "need", label: `${old.label}（历史）`, text: old.text, version: old.version, status: "旧版本", evidence: [old] });
    }
    const data = { stale, reason: link.retired ? `已撤销：${link.retired}；原理由：${link.reason}` : link.reason, evidence: link.evidence, linkId: link.id };
    if (link.kind === "tension") {
      const id = `c:link:${link.id}`;
      nodes.push({ id, kind: "conflict", label: "需求间张力", text: link.reason, version: link.id, topicId: link.topicId, status: link.retired ? "已撤销" : stale ? "来源变化 · 待复核" : "人工记录 · 非三方共识", evidence: link.evidence });
      edges.push({ id: `${id}:a`, from: link.from, to: id, label: "张力", ...data }, { id: `${id}:b`, from: link.to, to: id, label: "张力", ...data }, { id: `${id}:t`, from: id, to: `t:${link.topicId}`, label: "交由议题处理", ...data });
    } else edges.push({ id: `link:${link.id}`, from: link.from, to: link.to, label: linkLabels[link.kind], ...data });
  }
  return { nodes, edges };
}
