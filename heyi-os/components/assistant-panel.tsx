"use client";
import { useEffect, useState, type FormEvent } from "react";
import { AI_CONSENT_VERSION, AI_PROVIDER } from "../lib/ai-config";
import { actors, type CollaborationState, type RoleKey } from "../lib/collaboration";
import { linkIsStale, linkLabels } from "../lib/difference-graph";
import type { AiRun } from "../lib/graph-types";
import { EvidenceList } from "./relationship-map";
import { timeLabel, type Mutate } from "./collaboration-panel";
import { getCase } from '../lib/cases';

export function AssistantPanel({ state, roleKey, mutate, busy }: { state: CollaborationState; roleKey: RoleKey; mutate: Mutate; busy: boolean }) {
  const actors=getCase(state.caseId).actors;
  const [runs, setRuns] = useState<AiRun[]>([]), [configured, setConfigured] = useState<boolean | null>(null), [model, setModel] = useState("");
  const [prompt, setPrompt] = useState(""), [consent, setConsent] = useState(false), [sending, setSending] = useState(false), [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  async function refresh() {
    const response = await fetch(`/api/assistant?caseId=${state.caseId}`, { cache: "no-store" });
    const data = await response.json() as { error?: string; configured: boolean; model: string; runs: AiRun[] };
    if (!response.ok) throw new Error(data.error || "AI 状态读取失败。");
    setConfigured(data.configured); setModel(data.model); setRuns(data.runs);
  }
  useEffect(() => { let active = true, running = false; const sync = async () => { if (!active || running) return; running = true; try { await refresh(); } catch (e) { if (active) setError(e instanceof Error ? e.message : "AI 状态读取失败。"); } finally { running = false; } }; void sync(); const timer = setInterval(sync, 5000); return () => { active = false; clearInterval(timer); }; }, []);
  async function send(e: FormEvent) {
    e.preventDefault(); if (!consent || sending || !prompt.trim()) return;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId:state.caseId, prompt, actorKey: roleKey, shareConfirmed: consent, consentVersion: AI_CONSENT_VERSION, requestId: crypto.randomUUID() }), signal: AbortSignal.timeout(65000) });
      const data = await response.json() as { error?: string; run?: AiRun };
      if (!response.ok) throw new Error(data.error || "AI 请求失败。");
      if (data.run?.status === "complete") { setSelected(data.run.id); setPrompt(""); }
      await refresh();
    } catch (e) { setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "请求未及时返回，请先查看分析历史，避免重复提交。" ); try { await refresh(); } catch {} }
    finally { setSending(false); }
  }
  const run = runs.find(r => r.id === selected) ?? runs[0];
  return <section className="card assistant-panel"><div className="head"><div><div className="eyebrow">AI FACILITATOR · 不代替人做决定</div><h2>让 AI 帮你问清楚、找依据</h2><p className="sub">{configured ? `${model} · 经 ${AI_PROVIDER} · 已配置服务端密钥` : configured === null ? "正在读取 AI 配置…" : "等待服务器配置密钥"} · 每次点击才调用，轮询不调用模型</p></div><span className="status">{sending ? "正在分析…" : runs.some(r => r.status === "complete" && r.model === model) ? "已有真实调用记录" : "尚无成功调用记录"}</span></div>
    <div className="ai-shortcuts">{["请梳理当前需求之间的张力，建议可审核的地图关联，并引用依据。", "请总结最近讨论：共同点、未解决的分歧、下一步该问各方什么？", "请提出一个可执行的折衷方案，按谁负责、做什么、何时执行、适用条件、如何复审五项组织；解释回应了谁的底线，不能替三方批准。", "请检查本案例当前已发布方案的完整性：逐项核对谁负责、做什么、何时执行、适用条件、如何复审。列出缺项与模糊表述，引用依据；区分字段齐全与实质可执行，不改变三方确认。"].map((p,i) => <button className="secondary" key={p} disabled={sending} onClick={() => setPrompt(p)}>{["分析差异地图", "总结会议分歧", "探索折衷方案", "检查方案完整性"][i]}</button>)}</div>
    <form className="editor-form" onSubmit={send}><label>向 AI 提问<textarea aria-label="向 AI 提问" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={1800} rows={3} required placeholder="例如：当前方案是否回应了各方底线？责任、时间和复审方式是否明确？" /></label><label className="checkbox"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />我同意将本问题及本案例的共享立场、当前议题／方案、最近最多 30 条共享消息与最近 3 次 AI 问答摘要发送至第三方平台 ACCTOKEN（www.acctoken.com），由其转发至 DeepSeek 模型服务；问题和结果保存为项目共享记录。其他案例和未提交草稿不会发送。</label><div className="actions"><button className="primary" disabled={!configured || sending || !consent || !prompt.trim()}>{sending ? "AI 正在处理，请稍候…" : "发送给 AI"}</button><small>全站案例共用限额：6 次／分钟、60 次／24 小时；API 按用量计费。</small></div></form>
    {error && <div className="feedback failure" role="alert">{error}</div>}
    <div className="ai-results"><div className="actions"><h3>共享分析记录</h3><button className="text-button" onClick={() => { setError(""); void refresh().catch(() => setError("读取失败，请重试。")); }}>刷新记录</button></div>{runs.length > 0 && <label className="ai-history-label">查看最近 20 次请求<select value={run?.id ?? ""} onChange={e => setSelected(e.target.value)}>{runs.map(r => <option key={r.id} value={r.id}>{timeLabel(r.createdAt)} · {r.status === "complete" ? "已完成" : r.status === "failed" ? "失败" : "处理中／结果待确认"} · {r.prompt.slice(0,35)}</option>)}</select></label>}
    {!run ? <p className="sub">还没有 AI 分析。这里不会显示预设答案。</p> : <article><p className="meta">{actors[run.actorKey as RoleKey]?.role} · {timeLabel(run.createdAt)} · {run.model} · 分析基于 r{run.revision}</p><h3>{run.prompt}</h3>{run.status === "failed" ? <p className="ai-failed">{run.error}</p> : !run.result ? <p>请求处理中；如长时间未完成，请刷新记录确认后再试。</p> : <>
      {run.revision !== state.revision && <div className="notice">分析后项目有更新。引用保留生成时的原文快照；采纳前请核对当前版本。</div>}<p className="ai-answer">{run.result.answer}</p>
      <details><summary>核对引用原文 · {run.result.citations.length} 项</summary><EvidenceList items={run.result.citations} /></details>
      {run.result.questions.length > 0 && <div className="ai-questions"><b>下一步可以问</b>{run.result.questions.map(q => <button className="text-button" key={q} onClick={() => setPrompt(q)}>{q} ↗</button>)}</div>}
      {run.result.suggestions.length > 0 && <><h3>待人工审核的地图关联</h3><p className="sub">AI 可能误解语义。来源校验只确认原文存在，不保证推论正确。</p>{run.result.suggestions.map((s,i) => {
        const stale = linkIsStale(s,state), duplicate = state.links.some(l => !l.retired && l.from === s.from && l.to === s.to && l.kind === s.kind && l.topicId === s.topicId && l.fromVersion === s.fromVersion && l.toVersion === s.toVersion);
        return <div className="ai-suggestion" key={i}><b>{linkLabels[s.kind]}</b><p>{s.reason}</p><details><summary>查看依据后决定</summary><EvidenceList items={s.evidence} /></details><button className="secondary" disabled={busy || stale || duplicate} onClick={() => void mutate({kind:"link", aiRunId:run.id, suggestionIndex:i})}>{duplicate ? "已加入地图" : stale ? "来源已变化，请重新分析" : "我已核对，加入地图"}</button></div>;
      })}</>}
      <p className="privacy">AI 内容不自动成为正式方案或三方表态。若要提交方案，请在差异地图的议题中起草并由三方分别确认。</p>
    </>}</article>}</div></section>;
}
