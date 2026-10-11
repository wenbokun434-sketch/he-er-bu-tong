"use client";

import { type FormEvent, useEffect, useState } from "react";
import { topicStatus, type CollaborationState, type RoleKey } from "../lib/collaboration";
import { cases, getCase, isCaseId } from '../lib/cases';
import { missingProposalFields } from '../lib/proposal';
import { AssistantPanel } from "../components/assistant-panel";
import { DifferenceMap, ProfilePanel, timeLabel } from "../components/collaboration-panel";

import { RehearsalGuide } from "../components/rehearsal-guide";
import { WorkflowPanel } from "../components/workflow-panel";

type Message = { id: number; actor: string; role: string; content: string; createdAt: string };
const nav = ["工作台", "协作画像", "差异地图", "协作会议室", "和议书工坊", "承诺追踪"];

export default function Home() {
  const [caseId,setCaseId]=useState<string|null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{const restore=()=>{const id=new URL(window.location.href).searchParams.get('caseId');setCaseId(isCaseId(id)?id:null);setReady(true);};restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[]);
  function choose(id:string|null){const url=new URL(window.location.href);if(id)url.searchParams.set('caseId',id);else url.searchParams.delete('caseId');window.history.pushState({},'',url);setCaseId(id);}
  if(!ready)return <main className="case-library"><p>正在打开协作空间…</p></main>;
  if(caseId)return <CaseWorkspace key={caseId} caseId={caseId} onLeave={()=>choose(null)} />;
  return <main className="case-library"><div className="brand"><i>和</i><span>和议书</span><small>HEYI OS</small></div><div className="eyebrow">ONE VALUE · MANY CONTEXTS</div><h1>不同的立场，共同的行动。</h1><p className="case-intro">选择一个案例，在真实的协作流程中练习“和而不同”。保留彼此的差异，让每一项共同规则都有依据。</p><div className="case-library-note">案例为虚构教学情境。每个案例的立场、消息、地图、方案和 AI 历史独立保存；同一案例内由演示角色共享，不是个人私有副本。</div><div className="case-grid">{cases.map(c=><article className="card case-card" key={c.id}><span className="case-icon">{c.icon}</span><span className="eyebrow">{c.subtitle}</span><h2>{c.name}</h2><p>{c.summary}</p><div className="case-parties">{Object.entries(c.actors).filter(([key])=>key!=='coordinator').map(([key,a])=><span key={key}>{a.role}</span>)}</div><div className="case-topics">{c.topics.map(t=>t.title).join(' · ')}</div><button className="primary" onClick={()=>choose(c.id)}>进入案例 →</button></article>)}</div><p className="case-footer">选择案例 → 共享立场 → 讨论与完善方案 → 三方分别确认 → 查看和议书</p></main>;
}

function CaseWorkspace({caseId,onLeave}:{caseId:string;onLeave:()=>void}) {
  const config=getCase(caseId), actors=config.actors;
  const [roleKey, setRoleKey] = useState<RoleKey>("coordinator");
  const [view, setView] = useState("工作台");
  const [leaveRequested,setLeaveRequested]=useState(false);
  const [rehearsal,setRehearsal]=useState(false);
  const [workflowBusy,setWorkflowBusy]=useState(false);
  useEffect(()=>{let active=true;fetch('/api/rehearsal?caseId='+caseId,{cache:'no-store'}).then(r=>r.json() as Promise<{enabled:boolean}>).then(data=>{if(active)setRehearsal(data.enabled===true);}).catch(()=>{});return()=>{active=false;};},[caseId]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<CollaborationState | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<RoleKey,string>>>({});
  const draft=drafts[roleKey]??'';
  const setDraft=(value:string)=>setDrafts(previous=>({...previous,[roleKey]:value}));
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mapError, setMapError] = useState("");
  const [messageError, setMessageError] = useState("");
  const current = actors[roleKey];

  async function fetchMessages() {
    try {
      const response = await fetch(`/api/messages?caseId=${caseId}`, { cache: "no-store" });
      const data = await response.json() as { messages: Message[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "读取失败");
      setMessages(data.messages); setMessageError("");
    } catch { setMessageError("会议服务暂不可用，请稍后重试。"); }
  }
  async function fetchCollaboration() {
    try {
      const response = await fetch(`/api/collaboration?caseId=${caseId}`, { cache: "no-store" });
      const data = await response.json() as { state: CollaborationState; error?: string };
      if (!response.ok) throw new Error(data.error ?? "读取失败");
      setState(previous => !previous || data.state.revision >= previous.revision ? data.state : previous);
      setMapError("");
    } catch { setMapError("地图数据暂不可用。已显示的内容可能不是最新版本，恢复后再提交。"); }
  }
  useEffect(() => {
    let active = true;
    let running = false;
    const sync = async () => {
      if (!active || running) return;
      running = true;
      await Promise.all([fetchMessages(), fetchCollaboration()]);
      running = false;
    };
    void sync();
    const timer = window.setInterval(sync, 2000);
    window.addEventListener("focus", sync);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", sync); };
  }, []);

  async function mutate(body: Record<string, unknown>) {
    if (!state || busy || mapError) return false;
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/collaboration", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: state.revision, ...body, actorKey: roleKey, caseId }) });
      const data = await response.json() as { state: CollaborationState; error?: string; unchanged?:boolean };
      if (!response.ok) { if (response.status === 409) await fetchCollaboration(); throw new Error(data.error ?? "提交失败"); }
      setState(previous => !previous || data.state.revision >= previous.revision ? data.state : previous);
      setSuccess(data.unchanged ? "内容没有变化，未创建新版本；已有确认和地图关联保持不变。" : body.kind === "link" ? "关联及依据已保存，动态地图已更新。" : body.kind === "link_retract" ? "关联已撤销，原文和理由仍保留在历史中。" : body.kind === "profile" ? "共享立场已保存，地图已更新。已有确认将等待三方复核。" : body.kind === "proposal" ? "五项内容已保存为新方案；形式完整不等于三方同意，请分别提交表态。" : body.kind === "vote" ? "你的表态已保存，地图状态已更新。" : "共享议题已创建，可在地图中选择并提出方案。");
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "提交失败，输入已保留。"); return false; }
    finally { setBusy(false); }
  }
  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({caseId,actorKey:roleKey,content}) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "发送失败");
      setDraft(""); await fetchMessages();
    } catch (err) { setError(err instanceof Error ? err.message : "发送失败"); }
    finally { setSending(false); }
  }
  function navigate(next: string) { setView(next); setError(""); setSuccess(""); }
  const agreedCount = state?.topics.filter(topic => topicStatus(topic, state).key === "agreed").length ?? 0;

  const overview = <>
    <div className="grid"><section className="card"><div className="head"><div><h2>当前协作状态</h2><div className="sub">{config.name} · 共享立场与方案确认</div></div><span className={mapError || messageError ? "sync-offline" : "online"}>{mapError || messageError ? "同步待恢复" : "每 2 秒同步"}</span></div><div className="stat-grid"><div className="stat"><strong>{agreedCount}</strong><span>流程已获三方确认</span></div><div className="stat"><strong>{state ? state.topics.length - agreedCount : "—"}</strong><span>仍待处理的议题</span></div><div className="stat"><strong>{messages.length}</strong><span>最近共享消息</span></div></div></section><section className="card"><div className="head"><div><h2>当前角色 · {current.role}</h2><div className="sub">{current.actor} · 演示操作视角</div></div></div><div className="private"><div className="label">EXPLICIT SHARING</div><p>{roleKey === "coordinator" ? "组织议题、提出和修订方案，查看三方公开摘要。不能替三方发布立场或确认方案。" : "编辑自己的共享立场，对当前方案表达接受、附条件接受、异议或信息需求。"}</p><button className="text-button" onClick={() => navigate("差异地图")}>开始一次真实协商 →</button></div></section></div>
    <div className="notice"><b>演示角色模式。</b> 同一访问者可切换角色体验三方流程，尚未实现账号与项目角色绑定。成员确认是演示操作记录，不是正式签署；请勿输入真实敏感信息。</div>
    {state?.topics.some(t=>t.proposal && missingProposalFields(t.proposal.details).length>0) && <div className="notice"><b>流程确认 ≠ 内容完整。</b> 本案例包含旧版方案，原文与历史确认已保留。请在差异地图补全五项内容，再请三方确认新版本。</div>}<h2 className="block-title">五个核心模块</h2><div className="module-grid">{nav.slice(1).map((item, index) => <button className="card module" key={item} onClick={() => navigate(item)}><i>{["◎", "⌘", "◌", "▤", "◷"][index]}</i><b>{item}</b><p>{["填写并确认共享目标、担忧与底线", "提出方案，让三方分别表达和确认", "持续、可追溯的共享讨论", "编辑、保存、逐方确认并导出固定版本", "从成稿建立任务、报告进度并验收复审"][index]}</p></button>)}</div>
  </>;
  const meeting = <div className="grid"><section className="card meeting"><div className="meeting-top"><div><h2>项目协作会议室</h2><div className="sub">共享讨论 → 在差异地图中提交正式方案与反馈</div></div><span className={messageError ? "sync-offline" : "online"}>{messageError ? "暂未同步" : "实时同步中"}</span></div><div className="feed">{messages.length ? messages.map(message => <div className="msg" key={message.id}><div className="meta"><b>{message.actor}</b>{message.role} · {timeLabel(message.createdAt)}</div><p>{message.content}</p></div>) : <div className="empty">暂无共享消息。以任一演示角色发送第一条讨论内容。</div>}</div><form className="composer" onSubmit={sendMessage}><input aria-label="共享讨论内容" value={draft} onChange={event => setDraft(event.target.value)} maxLength={800} placeholder="发送至共享会议室。请勿输入敏感信息。" /><button className="primary" disabled={sending || !draft.trim()}>{sending ? "发送中…" : "发送"}</button></form></section><aside className="card"><div className="head"><div><h2>讨论与确认分开</h2><div className="sub">聊天表达不是正式表态</div></div></div><div className="side-info"><div className="row"><b>当前待处理议题</b>{state?.topics.filter(topic => topicStatus(topic, state).key !== "agreed").map(topic => <p key={topic.id}>{topic.title} · {topicStatus(topic, state).label}</p>)}</div><div className="row"><b>下一步</b><p>把讨论结果写成方案，在差异地图中请三方逐一确认。</p><button className="text-button" onClick={() => navigate("差异地图")}>进入差异地图 ↗</button></div><div className="row"><b>AI 状态</b><p>下方 AI 助手可分析共享讨论并引用来源。建议须人工审核，不会替任何一方同意。</p></div></div></aside></div>;
  let content = view === "工作台" ? overview : view === "协作会议室" ? <>{meeting}{state && <AssistantPanel state={state} roleKey={roleKey} mutate={mutate} busy={busy || !!mapError} />}</> : null;
  if (["协作画像", "差异地图", "和议书工坊", "承诺追踪"].includes(view)) {
    content = !state ? <div className="empty">{mapError ? "暂时无法读取协作数据，请重试。" : "正在读取协作记录…"}</div> : view === "协作画像" ? <ProfilePanel key={roleKey} state={state} roleKey={roleKey} mutate={mutate} busy={busy || !!mapError} /> : view === "差异地图" ? <DifferenceMap rehearsal={rehearsal} state={state} messages={messages} roleKey={roleKey} mutate={mutate} busy={busy || !!mapError} goMeeting={() => navigate("协作会议室")} goProfiles={() => navigate("协作画像")} /> : <WorkflowPanel onBusyChange={setWorkflowBusy} rehearsal={rehearsal} state={state} roleKey={roleKey} mode={view==="和议书工坊"?"documents":"tasks"} />;
  }
  return <div className="shell"><aside className="side"><div className="brand"><i>和</i><span>和议书</span><small>HEYI OS</small></div><div className="project"><b>● {config.name}</b><span>{config.subtitle}</span><button className="text-button" disabled={busy || sending || workflowBusy} onClick={()=>setLeaveRequested(true)}>← 选择其他案例</button>{leaveRequested && <div className="case-switch-confirm" role="group" aria-label="确认切换案例"><p>已共享内容会保留在本案例；未提交草稿将丢失。</p><button className="text-button" disabled={busy || sending || workflowBusy} onClick={onLeave}>确认返回案例库</button><button className="text-button" onClick={()=>setLeaveRequested(false)}>继续当前案例</button></div>}</div><nav className="nav">{nav.map(item => <button key={item} className={view === item ? "active" : ""} onClick={() => navigate(item)}>{item}</button>)}</nav><div className="identity"><label htmlFor="role">演示角色 / 非账号权限</label><select id="role" value={roleKey} disabled={busy || sending || workflowBusy} onChange={event => { setRoleKey(event.target.value as RoleKey); setError(""); setSuccess(""); }}>{Object.entries(actors).map(([key, role]) => <option key={key} value={key}>{role.actor} · {role.role}</option>)}</select></div></aside><main className="main"><header className="top"><span className="crumb">案例空间 / {config.name} / {view}</span><span className="secure">共享数据 · {state ? `r${state.revision}` : "读取中"}</span></header><section className="content"><div className="title-row"><div><div className="eyebrow">HARMONY WITHOUT UNIFORMITY</div><h1>{view}</h1><p>让不同立场被看见，让共同规则经得起每一方确认。</p></div><span className="role-badge">当前：{current.actor} · {current.role}</span></div>
    {rehearsal&&state&&<RehearsalGuide key={state.caseId} state={state} roleKey={roleKey} busy={busy||sending||workflowBusy} onNavigate={navigate} onRole={setRoleKey}/>}
    <div className="demo-strip">{rehearsal?'独立彩排数据库 · AI 不调用付费接口 · ':''}演示角色可自由切换 · 共享数据持久保存 · 不输入真实敏感信息</div>
    {(mapError || messageError) && <div className="feedback failure" role="alert">{mapError || messageError}<button className="text-button" onClick={() => { void fetchCollaboration(); void fetchMessages(); }}>重试同步</button></div>}
    {error && <div className="feedback failure" role="alert">{error}</div>}{success && <div className="feedback success" role="status">{success}</div>}
    {content}</section></main></div>;
}
