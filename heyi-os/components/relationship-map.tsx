"use client";
import {useLanguage,localizeTree} from "../lib/language";
import { useState, type FormEvent } from "react";
import { baseNodes, buildGraph, linkIsStale, linkLabels, sourceCatalog, type SharedMessage } from "../lib/difference-graph";
import type { CollaborationState } from "../lib/collaboration";
import type { Evidence, LinkKind } from "../lib/graph-types";
import type { Mutate } from "./collaboration-panel";

export function EvidenceList({ items }: { items: Evidence[] }) {
 const {language}=useLanguage();

  return localizeTree(<div className="evidence-list">{items.map(e => <article key={e.id}><b>{e.label}</b><small>{e.example ? "案例设定 · 非成员确认" : `来源版本 #${e.version}`} · {e.id}</small><blockquote data-verbatim>{e.text}</blockquote></article>)}</div>,language);
}

export function RelationshipMap({ state, messages, mutate, busy, onTopic }: { state: CollaborationState; messages: SharedMessage[]; mutate: Mutate; busy: boolean; onTopic: (id: string) => void }) {
 const {language}=useLanguage();

  const [selected, setSelected] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<LinkKind>("concerns");
  const [topicId, setTopicId] = useState(state.topics[0].id);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState("");
  const [baseRevision, setBaseRevision] = useState(state.revision);
  const [retireReason, setRetireReason] = useState("");
  const graph = buildGraph(state, showHistory);
  const sources = sourceCatalog(state, messages);
  const nodes = baseNodes(state);
  const topic = state.topics.find(t => t.id === topicId) ?? state.topics[0];
  const actualFrom = kind === "addresses" ? `p:${topic.proposal?.id}` : from;
  const actualTo = kind === "concerns" ? `t:${topic.id}` : to;
  const selectedNode = graph.nodes.find(n => n.id === selected);
  const selectedEdge = graph.edges.find(e => e.id === selected);
  const selectedLink = state.links.find(l => l.id === selectedEdge?.linkId || `c:link:${l.id}` === selectedNode?.id);
  const related = graph.edges.filter(e => selectedNode ? e.from === selected || e.to === selected : selectedEdge ? e.id === selected : false);
  const columns = ["need", "conflict", "topic", "proposal"] as const;
  const groups = columns.map(kind => graph.nodes.filter(n => n.kind === kind));
  const height = Math.max(280, ...groups.map(g => g.length * 105 + 60));
  const positions = new Map(groups.flatMap((group, c) => group.map((n, i) => [n.id, { x: 20 + c * 280, y: 58 + i * 105 }] as const)));
  const stale = adding && baseRevision !== state.revision;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const evidenceIds = sources.filter(s => s.nodeId === actualFrom || s.nodeId === actualTo || s.id === extra).map(s => s.id);
    if (await mutate({ kind: "link", relationKind: kind, from: actualFrom, to: actualTo, topicId: topic.id, reason, evidenceIds, expectedRevision: baseRevision })) { setAdding(false); setReason(""); setExtra(""); }
  }
  return localizeTree(<section className="card relationship-map">
    <div className="head"><div><div className="eyebrow">LIVING DIFFERENCE MAP</div><h2>差异有来处，协商有依据</h2><p className="sub">{graph.nodes.length} 个节点 · {state.links.filter(l => !l.retired).length} 条人工关联 · r{state.revision} 自动同步</p></div><button className="secondary" onClick={() => { setAdding(!adding); setBaseRevision(state.revision); }}>＋ 关联需求与议题</button></div>
    <div className="graph-tools"><span>点击节点查看依据；点击连线查看理由。虚线表示待复核或历史关系。</span><label>缩放<select value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={0.7}>70%</option><option value={1}>100%</option><option value={1.2}>120%</option></select></label><label><input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} />包含撤销关系</label></div>
    <div className="graph-scroll" tabIndex={0} aria-label="动态差异关系图，可横向和纵向滚动"><div style={{ width: 1130 * zoom, height: height * zoom }}><div className="graph-stage" style={{ width: 1130, height, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
      {["01 · 各方需求与底线", "02 · 张力、异议与条件", "03 · 协商议题", "04 · 方案与确认"].map((text, i) => <div className="graph-column-title" style={{ left: 20 + i * 280 }} key={text}>{text}</div>)}
      <svg className="graph-lines" width={1130} height={height} aria-label="关系连线">{graph.edges.map(edge => {
        const a = positions.get(edge.from), b = positions.get(edge.to); if (!a || !b) return null;
        const forward = b.x > a.x, x1 = a.x + (forward ? 235 : 0), x2 = b.x + (forward ? 0 : 235), y1 = a.y + 40, y2 = b.y + 40;
        const active = selected === edge.id || selected === edge.from || selected === edge.to;
        return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + (forward ? 55 : -55)} ${y1}, ${x2 + (forward ? -55 : 55)} ${y2}, ${x2} ${y2}`} className={`${edge.stale ? "stale" : ""} ${active ? "highlight" : ""}`} tabIndex={0} role="button" aria-label={`${edge.label}：${edge.reason}`} onClick={() => { setSelected(edge.id); setRetireReason(""); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(edge.id); } }}><title>{edge.label} · {edge.stale ? "待复核 · " : ""}{edge.reason}</title></path>;
      })}</svg>
      {graph.nodes.map(node => { const p = positions.get(node.id)!; return <button key={node.id} className={`graph-node ${node.kind} ${selected === node.id ? "selected" : ""}`} style={{ left: p.x, top: p.y }} onClick={() => { setSelected(node.id); setRetireReason(""); if (node.topicId) onTopic(node.topicId); }}><b>{node.label}</b><span>{node.text}</span><small>{node.status}</small></button>; })}
      {!groups[1].length && <div className="graph-placeholder" style={{ left: 300 }}>暂无已记录的张力。<br />手动关联两项需求，或请 AI 提出待审核建议。<br />无记录不等于无分歧。</div>}
      {!groups[3].length && <div className="graph-placeholder" style={{ left: 860 }}>选择下方议题，<br />起草第一份可确认的方案。</div>}
    </div></div></div>
    {adding && <form className="editor-form" onSubmit={submit}><div className="form-columns"><label>关系类型<select value={kind} onChange={e => { setKind(e.target.value as LinkKind); setFrom(""); setTo(""); }}>{Object.entries(linkLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>由哪个议题处理<select value={topic.id} onChange={e => setTopicId(e.target.value)}>{state.topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div>
      {kind === "addresses" ? <p className="sub">{topic.proposal ? `当前方案 v${topic.proposal.version} → 需求` : "这个议题还没有方案，请先起草。"}</p> : <label>第一项需求<select required value={from} onChange={e => setFrom(e.target.value)}><option value="">选择需求</option>{nodes.filter(n => n.kind === "need").map(n => <option key={n.id} value={n.id}>{n.label}：{n.text.slice(0,45)}</option>)}</select></label>}
      {kind !== "concerns" && <label>{kind === "tension" ? "与之存在张力的需求" : "方案回应的需求"}<select required value={to} onChange={e => setTo(e.target.value)}><option value="">选择需求</option>{nodes.filter(n => n.kind === "need" && n.id !== from).map(n => <option key={n.id} value={n.id}>{n.label}：{n.text.slice(0,45)}</option>)}</select></label>}
      <label>关联理由<textarea required maxLength={600} value={reason} onChange={e => setReason(e.target.value)} placeholder="说明这两项内容为何相关，以及仍待确认的假设。" /></label>
      <label>补充引用（可选，两个端点原文会自动保留）<select value={extra} onChange={e => setExtra(e.target.value)}><option value="">无额外引用</option>{sources.map(s => <option key={s.id} value={s.id}>{s.label}：{s.text.slice(0,45)}</option>)}</select></label>
      {stale && <div className="notice">来源已更新，请核对当前原文后再提交。<button type="button" className="text-button" onClick={() => setBaseRevision(state.revision)}>已核对最新来源</button></div>}
      <p className="sub">记录关联只代表当前操作者的判断，不代表三方共识。可撤销，但保留历史。</p><button className="primary" disabled={busy || stale || !actualFrom || !actualTo || (kind === "addresses" && !topic.proposal)}>保存关联及原文依据</button>
    </form>}
    <div className="graph-inspector" aria-live="polite">{selectedNode || selectedEdge ? <><h3>{selectedNode?.label ?? selectedEdge?.label}</h3><p>{selectedNode?.text ?? selectedEdge?.reason}</p>{selectedLink && <p className="sub">关联 #{selectedLink.id} · {selectedLink.aiRunId ? "AI 建议经人工确认" : "人工建立"} · {selectedLink.retired ? "已撤销" : linkIsStale(selectedLink,state) ? "来源已变化，待复核" : "与当前来源版本一致"}</p>}<EvidenceList items={selectedNode?.evidence ?? selectedEdge?.evidence ?? []} />
      {related.length > 0 && <div className="actions">{related.map(e => <button className="secondary" key={e.id} onClick={() => setSelected(e.id)}>{e.stale ? "待复核 · " : ""}{e.label}</button>)}</div>}
      {selectedLink && !selectedLink.retired && <form className="retire-form" onSubmit={async e => { e.preventDefault(); if (await mutate({ kind: "link_retract", linkId: selectedLink.id, reason: retireReason })) { setSelected(""); setRetireReason(""); } }}><input aria-label="撤销关联原因" value={retireReason} onChange={e => setRetireReason(e.target.value)} required maxLength={600} placeholder="撤销原因；原依据会留在历史中" /><button className="secondary" disabled={busy || !retireReason.trim()}>撤销此关联</button></form>}
    </> : <p>选择一个节点或连线，查看它从哪里来、为什么相连。需求不会因方案达成共识而消失。</p>}</div>
  </section>,language);
}
