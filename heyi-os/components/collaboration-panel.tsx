"use client";

import { useState, type FormEvent } from "react";
import { RelationshipMap } from "./relationship-map";
import { AssistantPanel } from "./assistant-panel";
import type { SharedMessage } from "../lib/difference-graph";
import { getCase } from '../lib/cases';
import { emptyProposal, missingProposalFields, proposalFields, type ProposalDetails } from '../lib/proposal';
import { actors, activeVotes, describeEvent, parties, profileFields, profileStamp, topicStatus, voteLabels, type CollaborationState, type PartyKey, type Profile, type RoleKey, type Topic, type VoteChoice } from "../lib/collaboration";

export type Mutate = (body: Record<string, unknown>) => Promise<boolean>;
export function timeLabel(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function SharedProfiles({ state }: { state: CollaborationState }) {
  const actors=getCase(state.caseId).actors;
  return <div className="profile-grid">{parties.map(key => <section className="card profile-summary" key={key}>
    <div className="person-line"><span className={`avatar ${key}`}>{actors[key].actor.slice(0, 1)}</span><div><h2>{actors[key].role}</h2><div className="sub">{actors[key].actor} · {state.profiles[key].revision ? "成员已提交" : "案例示例"}</div></div></div>
    {profileFields.map(field => <div className="profile-field" key={field.key}><b>{field.label}</b><p>{state.profiles[key][field.key]}</p></div>)}
  </section>)}</div>;
}

export function ProfilePanel({ state, roleKey, mutate, busy }: { state: CollaborationState; roleKey: RoleKey; mutate: Mutate; busy: boolean }) {
  const actors=getCase(state.caseId).actors;
  const [form, setForm] = useState<Profile | null>(null);
  const [baseRevision, setBaseRevision] = useState(state.revision);
  const [confirmed, setConfirmed] = useState(false);
  const stale = !!form && baseRevision !== state.revision;
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (await mutate({ kind: "profile", profile: form, shareConfirmed: confirmed, expectedRevision: baseRevision })) { setForm(null); setConfirmed(false); }
  }
  return <>
    <div className="notice"><b>共享立场 → 地图更新。</b> 只提交你愿意向项目成员公开的摘要。未提交的编辑内容仅在本页内存中，刷新后丢失；发布后会保存到共享历史，无法当作私人草稿撤回。</div>
    <section className="card profile-editor">
      <div className="head"><div><h2>{roleKey === "coordinator" ? "协调员 · 查看与组织" : `${actors[roleKey].role} · 我的共享立场`}</h2><div className="sub">原样保存不创建版本、不影响确认。修改内容后才触发复核；可直接沿用标为示例的案例设定。</div></div>
      {roleKey !== "coordinator" && !form && <button className="primary" onClick={() => { setForm({ ...state.profiles[roleKey] }); setBaseRevision(state.revision); }}>编辑我的立场</button>}</div>
      {roleKey === "coordinator" ? <p className="section-note">协调员可以查看三方公开摘要，但不能代替成员发布立场。请在左侧切换到某一参与方体验填写。</p> : form ? <form className="editor-form" onSubmit={publish}>
        {profileFields.map(field => <label key={field.key}>{field.label}<span className="field-hint">{field.hint}</span><textarea value={form[field.key]} onChange={event => setForm({ ...form, [field.key]: event.target.value })} maxLength={600} required rows={3} /></label>)}
        {stale && <div className="notice">其他成员已更新项目。你的输入保持不变，请先与下方最新共享立场比较。<button className="text-button" type="button" onClick={() => setBaseRevision(state.revision)}>我已核对最新内容，继续提交</button></div>}
        <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />我确认这四项内容可对项目成员公开，并进入变更记录。</label>
        <div className="actions"><button className="primary" disabled={busy || !confirmed || stale}>确认共享并更新地图</button><button className="secondary" type="button" onClick={() => setForm(null)}>取消编辑</button></div>
      </form> : <p className="section-note">下方为当前共享版本。点击“编辑我的立场”进行修改；草稿不会自动上传。</p>}
    </section>
    <SharedProfiles state={state} />
  </>;
}

function ProposalEditor({ topic, state, mutate, busy, close }: { topic: Topic; state: CollaborationState; mutate: Mutate; busy: boolean; close: () => void }) {
  const [details, setDetails] = useState<ProposalDetails>(topic.proposal?.details ?? emptyProposal());
  const [reason, setReason] = useState("");
  const [baseRevision, setBaseRevision] = useState(state.revision);
  const stale = baseRevision !== state.revision;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await mutate({ kind: "proposal", topicId: topic.id, details, reason, expectedRevision: baseRevision })) close();
  }
  return <form className="editor-form compact" onSubmit={submit}>
    <div className={`proposal-check ${missingProposalFields(details).length?'incomplete':''}`}>内容完整性：{5-missingProposalFields(details).length}/5 项已填写。{missingProposalFields(details).length ? `还需填写：${missingProposalFields(details).join('、')}。` : '五项已填齐，仅表示形式完整，不代表可行、合规或三方同意。'}</div>
    {topic.proposal && !topic.proposal.details && <details className="legacy-proposal"><summary>参考旧方案原文（保留，不自动代填）</summary><p>{topic.proposal.text}</p></details>}
    {proposalFields.map(field=><label key={field.key}>{field.label}<span className="field-hint">{field.hint}</span><textarea aria-label={field.label} placeholder={field.hint} value={details[field.key]} onChange={event=>setDetails({...details,[field.key]:event.target.value})} rows={3} maxLength={600} required /></label>)}
    <label>{topic.proposal ? "修订说明（必填）" : "提案说明（选填）"}<textarea placeholder="回应了谁的条件？仍保留哪些不同意见？" value={reason} onChange={event => setReason(event.target.value)} rows={2} maxLength={600} required={!!topic.proposal} /></label>
    <p className="field-hint">发布后创建新版本；三方均须重新表态。提案者不会被自动记为同意。</p>
    {stale && <div className="notice">项目出现新变化，你的草稿已保留。请核对上方最新方案和三方反馈。<button className="text-button" type="button" onClick={() => setBaseRevision(state.revision)}>我已核对，提交为新版本</button></div>}
    <p className="ai-check-note">AI 可在发布后通过下方“检查方案完整性”指出缺项与模糊表述，不会代填未共享草稿或替三方批准。</p>
    <div className="actions"><button className="primary" disabled={busy || stale || missingProposalFields(details).length>0}>发布方案 v{(topic.proposal?.version ?? 0) + 1}</button><button type="button" className="secondary" onClick={close}>取消</button></div>
  </form>;
}

function VoteForm({ topic, state, roleKey, mutate, busy }: { topic: Topic; state: CollaborationState; roleKey: PartyKey; mutate: Mutate; busy: boolean }) {
  const actors=getCase(state.caseId).actors;
  const existing = activeVotes(topic, state)[roleKey];
  const [choice, setChoice] = useState<VoteChoice>(existing?.choice ?? "accept");
  const [note, setNote] = useState(existing?.note ?? "");
  const [reviewedProposal, setReviewedProposal] = useState(topic.proposal!.id);
  const [reviewedProfiles, setReviewedProfiles] = useState(profileStamp(state));
  const stale = reviewedProposal !== topic.proposal!.id || reviewedProfiles !== profileStamp(state);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await mutate({ kind: "vote", topicId: topic.id, proposalId: reviewedProposal, profileStamp: reviewedProfiles, choice, note });
  }
  return <form className="editor-form compact vote-form" onSubmit={submit}>
    <label>以 {actors[roleKey].role} 身份回应 v{topic.proposal!.version}<select value={choice} onChange={event => setChoice(event.target.value as VoteChoice)}>{Object.entries(voteLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
    <label>{choice === "accept" ? "补充说明（选填）" : choice === "conditional" ? "必须纳入方案的接受条件" : choice === "object" ? "具体异议与底线" : "还需要什么信息？"}<textarea value={note} onChange={event => setNote(event.target.value)} placeholder={choice === "conditional" ? "例如：增加社区代表复审权，并明确暂停后续访问的权限。" : "写明原因或条件，让其他成员有据可回应。"} rows={3} maxLength={800} required={choice !== "accept"} /></label>
    {stale && <div className="notice">方案或共享立场已更新，你的未提交反馈仍保留。请阅读最新内容后重新确认。<button className="text-button" type="button" onClick={() => { setReviewedProposal(topic.proposal!.id); setReviewedProfiles(profileStamp(state)); }}>我已阅读当前版本，继续表态</button></div>}
    {missingProposalFields(topic.proposal!.details).length>0 && <p className="proposal-check incomplete">旧版方案尚未补全五项内容。历史表态保留；新的“接受”需先补全并发布新版本，仍可提出异议或信息需求。</p>}
    <button className="primary" disabled={busy || stale || (choice==='accept' && missingProposalFields(topic.proposal!.details).length>0)}>{existing ? "更新我的表态" : "确认提交表态"}</button>
    <p className="field-hint">只代表你所选演示角色对当前版本的回应，不是正式身份认证或法律签署。</p>
  </form>;
}

function TopicDetail({ topic, state, roleKey, mutate, busy, goMeeting }: { topic: Topic; state: CollaborationState; roleKey: RoleKey; mutate: Mutate; busy: boolean; goMeeting: () => void }) {
  const actors=getCase(state.caseId).actors;
  const [editing, setEditing] = useState(false);
  const status = topicStatus(topic, state);
  const votes = activeVotes(topic, state);
  return <section className="card topic-detail">
    <div className="head"><div><div className="eyebrow">SELECTED ISSUE</div><h2>{topic.title}</h2><div className="sub">{topic.description}</div></div><span className={`status ${status.key}`}>{status.label}</span></div>
    <div className="detail-body"><p className="status-explanation">{status.detail}</p>
      {topic.proposal ? <div className="proposal-text"><div className="person-line"><b>当前方案 · v{topic.proposal.version}</b><small>{actors[topic.proposal.actorKey].actor} · {timeLabel(topic.proposal.createdAt)}</small></div><ProposalContent proposal={topic.proposal} />{topic.proposal.reason && <div className="revision-reason">修订说明：{topic.proposal.reason}</div>}</div> : <div className="empty">还没有可确认的方案。先讨论，再把五项可执行规则提交到这里。</div>}
      <div className="actions"><button className="secondary" onClick={() => setEditing(!editing)}>{editing ? "收起编辑" : topic.proposal ? "修订方案 / 发起复审" : "起草首个方案"}</button><button className="text-button" onClick={goMeeting}>去会议室讨论 ↗</button></div>
      <h3 className="section-title">三方反馈 <span>每一方都有明确的声音</span></h3>
      <div className="vote-list">{parties.map(key => {
        const vote = votes[key];
        const oldVote = topic.votes[key];
        return <div className="vote-row" key={key}><div><b>{actors[key].role}</b><span className={`status ${vote?.choice ?? "pending"}`}>{vote ? voteLabels[vote.choice] : oldVote ? "立场变更 · 待复核" : "未回应"}</span></div><p>{vote?.note || (vote?.choice === "accept" ? "明确接受当前方案。" : oldVote ? "原表态已保留在历史中，不计入当前确认。" : "未回应不代表同意。")}</p></div>;
      })}</div>
      {editing && <ProposalEditor topic={topic} state={state} mutate={mutate} busy={busy} close={() => setEditing(false)} />}
      {topic.proposal && !editing && (roleKey === "coordinator" ? <div className="privacy">协调员可提出或修订方案，不能替三方表态。切换到参与方后可提交反馈。</div> : <VoteForm key={roleKey} topic={topic} state={state} roleKey={roleKey} mutate={mutate} busy={busy} />)}
    </div>
  </section>;
}

export function HistoryPanel({ state, topicId }: { state: CollaborationState; topicId?: string }) {
  const actors=getCase(state.caseId).actors;
  const [count, setCount] = useState(10);
  const events = state.history.filter(event => !topicId || JSON.parse(event.payload).topicId === topicId || event.kind === "profile");
  return <details className="card history-panel"><summary>变更记录 <span>{events.length} 条 · 方案、立场和表态均可追溯</span></summary><div className="history-list">
    {!events.length && <p className="section-note">还没有实际提交。案例示例不计入成员确认记录。</p>}
    {events.slice(0, count).map(event => { const item = describeEvent(event, state); return <article className="history-item" key={event.id}><div className="meta">#{event.id} · {actors[event.actorKey].actor} · {timeLabel(event.createdAt)}</div><b>{item.title}</b><p>{item.text}</p></article>; })}
    {events.length > count && <button className="secondary" onClick={() => setCount(count + 20)}>查看更多记录</button>}
  </div></details>;
}

export function DifferenceMap({ state, messages, roleKey, mutate, busy, goMeeting, goProfiles }: { state: CollaborationState; messages: SharedMessage[]; roleKey: RoleKey; mutate: Mutate; busy: boolean; goMeeting: () => void; goProfiles: () => void }) {
  const config=getCase(state.caseId);
  const [selected, setSelected] = useState(state.topics[0].id);
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const topic = state.topics.find(item => item.id === selected) ?? state.topics[0];
  const agreed = state.topics.filter(item => topicStatus(item, state).key === "agreed").length;
  const visible = state.topics.filter(item => filter === "all" || (topicStatus(item, state).key === "agreed") === (filter === "agreed"));
  async function addTopic(event: FormEvent) {
    event.preventDefault();
    if (await mutate({ kind: "topic", title, description })) { setAdding(false); setTitle(""); setDescription(""); }
  }
  return <>
    <div className="map-toolbar"><div><span className="version-label">共享地图 · r{state.revision}</span><p>立场与表态自动更新节点；人工关联或审核 AI 建议后更新连线。保留原文依据。</p></div><button className="secondary" onClick={goProfiles}>修改我的共享立场 ↗</button></div>
    <RelationshipMap state={state} messages={messages} mutate={mutate} busy={busy} onTopic={setSelected} />
    <h2 className="block-title">议题与方案工作区</h2>
    <div className="map-layout"><div>
      <section className="card map-canvas"><div className="common-node"><span className="eyebrow">COMMON DIRECTION · 案例设定</span><h2>{config.direction}</h2><p>{agreed}/{state.topics.length} 项方案在流程上获三方确认 · 内容完整性单独检查</p></div>
      <div className="map-filters" aria-label="筛选议题">{[["all", "全部议题"], ["open", "待处理"], ["agreed", "已确认"]].map(([key, label]) => <button key={key} aria-pressed={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <div className="topic-nodes">{visible.map(item => { const status = topicStatus(item, state); const count = Object.keys(activeVotes(item, state)).length; return <button key={item.id} className={`topic-node ${status.key} ${item.id === topic.id ? "selected" : ""}`} onClick={() => setSelected(item.id)} aria-pressed={item.id === topic.id}><span className={`status ${status.key}`}>{status.label}</span><h3>{item.title}</h3><p>{item.description}</p><div className="node-footer"><span>{item.proposal ? `v${item.proposal.version} · ${count}/3 方回应` : "无方案 · 等待提议"}</span><span>查看 →</span></div></button>; })}</div>
      {!visible.length && <div className="empty">该筛选下暂无议题。</div>}
      <button className="text-button add-topic" onClick={() => setAdding(!adding)}>{adding ? "取消新增" : "＋ 新增需要协商的议题"}</button>
      {adding && <form className="editor-form" onSubmit={addTopic}><label>议题名称<input value={title} onChange={event => setTitle(event.target.value)} required maxLength={60} /></label><label>需要协商的问题<textarea value={description} onChange={event => setDescription(event.target.value)} required rows={3} maxLength={600} /></label><button className="primary" disabled={busy}>创建共享议题</button></form>}
      </section>
      <div className="notice"><b>附条件接受 ≠ 已达成共识。</b> 请把条件写入新方案，再请三方分别确认。方案或共享立场变化会触发重新确认，旧记录不会删除。</div>
    </div><TopicDetail key={`${topic.id}:${roleKey}`} topic={topic} state={state} roleKey={roleKey} mutate={mutate} busy={busy} goMeeting={goMeeting} /></div>
    <h2 className="block-title">三方当前共享立场 <span>示例可由对应角色编辑替换</span></h2><SharedProfiles state={state} />
    <AssistantPanel state={state} roleKey={roleKey} mutate={mutate} busy={busy} />
    <HistoryPanel state={state} />
  </>;
}

export function AgreementPanel({ state }: { state: CollaborationState }) {
  const config=getCase(state.caseId), actors=config.actors;
  const agreed = state.topics.filter(topic => topicStatus(topic, state).key === "agreed");
  return <section className="card agreement-panel"><div className="head"><div><h2>和议书 · 协商草案</h2><div className="sub">随差异地图更新，仅纳入三方明确接受的当前版本；不是正式签署文件。</div></div></div><div className="agreement">
    <h3>01 · 共同方向（案例设定）</h3><p>{config.direction}</p>
    <h3>02 · 三方已确认的规则（流程状态）</h3>{agreed.length ? agreed.map(topic => <div className="agreement-rule" key={topic.id}><b>{topic.title} · v{topic.proposal!.version}</b><ProposalContent proposal={topic.proposal!} /><small>{parties.map(p=>actors[p].role).join('、')}曾明确接受当前版本；内容完整性不等于确认结果。</small></div>) : <p>暂无三方确认的规则。请在差异地图中提出方案，并由三个参与方分别回应。</p>}
    <h3>03 · 保留的分歧与待办问题</h3>{state.topics.filter(topic => topicStatus(topic, state).key !== "agreed").map(topic => <div className="agreement-rule" key={topic.id}><b>{topic.title} · {topicStatus(topic, state).label}</b><p>{topicStatus(topic, state).detail}</p>{Object.entries(activeVotes(topic, state)).filter(([, vote]) => vote.choice !== "accept").map(([key, vote]) => <p key={key}>{actors[key as PartyKey].role}：{vote.note}</p>)}</div>)}
  </div></section>;
}

function ProposalContent({proposal}:{proposal:NonNullable<Topic['proposal']>}) {
  const missing=missingProposalFields(proposal.details);
  return <><div className={`proposal-check ${missing.length?'incomplete':''}`}>{missing.length ? `内容待补全 · 旧版方案：${missing.join('、')}。原文与历史确认均保留，不能将历史确认当作完整性通过。` : '内容完整性：5/5 项已填写。仅检查字段齐全，可执行性仍需三方判断，AI 不能代替批准。'}</div>{proposal.details ? <div className="proposal-fields">{proposalFields.map(f=><div key={f.key}><b>{f.label}</b><p>{proposal.details![f.key]}</p></div>)}</div> : <p>{proposal.text}</p>}</>;
}
