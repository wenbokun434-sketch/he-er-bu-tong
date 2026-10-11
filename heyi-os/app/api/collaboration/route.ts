import { env } from "cloudflare:workers";
import { actors, parties, profileFields, profilesEqual, profileStamp, voteLabels, type Profile, type PartyKey, type RoleKey } from "../../../lib/collaboration";
import { isCaseId, readCaseId } from '../../../lib/cases';
import { missingProposalFields, normalizeProposal, proposalText } from '../../../lib/proposal';
import { readState, readMessages } from "../../../lib/server-state";
import { resolveLink, sourceCatalog } from "../../../lib/difference-graph";
import type { AiResult } from "../../../lib/graph-types";
const headers = { "Cache-Control": "no-store" };
function fail(error: string, status = 400) { return Response.json({ error }, { status, headers }); }
function bounded(value: unknown, max: number): value is string { return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max; }

export async function GET(request: Request) {
  const caseId=readCaseId(request); if(!caseId) return fail('案例不存在。',404);
  try { return Response.json({ state: await readState(caseId) }, { headers }); }
  catch { return fail("协作数据读取失败，请稍后重试。", 503); }
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return fail("请求格式不正确。"); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("请求格式不正确。");
  const body = input as Record<string, unknown>;
  const { actorKey, kind, expectedRevision } = body;
  if(!isCaseId(body.caseId)) return fail('请选择有效案例；旧页面请刷新后再操作。',409);
  const caseId=body.caseId;
  if (typeof actorKey !== "string" || !Object.hasOwn(actors, actorKey)) return fail("请选择有效的演示角色。");
  if (typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return fail("缺少协作版本，请刷新后再试。");
  try {
    const state = await readState(caseId);
    if (state.revision !== expectedRevision) return fail("其他成员已更新项目。已保留你的输入，请核对最新内容后再次提交。", 409);
    let payload: Record<string, unknown>;
    if (kind === "profile") {
      if (!parties.includes(actorKey as PartyKey)) return fail("协调员不能替成员发布立场。", 403);
      if (body.shareConfirmed !== true) return fail("请明确确认共享这些内容。");
      const profile = body.profile && typeof body.profile === "object" ? body.profile as Record<string, unknown> : {};
      if (!profileFields.every(field => bounded(profile[field.key], 600))) return fail("四项共享立场均需填写，每项不超过 600 字。");
      if(profilesEqual(state.profiles[actorKey as PartyKey],profile as Profile)) return Response.json({state,unchanged:true},{headers});
      payload = { profile: Object.fromEntries(profileFields.map(field => [field.key, (profile[field.key] as string).trim()])) };
    } else if (kind === "topic") {
      if (!bounded(body.title, 60) || !bounded(body.description, 600)) return fail("议题标题和说明不能为空，分别最多 60 和 600 字。");
      if (state.topics.length >= 30) return fail("演示项目最多包含 30 个议题。");
      payload = { title: body.title.trim(), description: body.description.trim() };
    } else if (kind === "link") {
      if (state.links.filter(l => !l.retired).length >= 150) return fail("当前最多保留 150 条有效关联，请先撤销不再需要的关联。");
      let candidate: Record<string, unknown> = { ...body, kind: body.relationKind };
      if (body.aiRunId) {
        if (typeof body.aiRunId !== "string" || !Number.isInteger(body.suggestionIndex)) return fail("AI 建议标识无效。");
        const run = await env.DB!.prepare("SELECT result FROM ai_runs WHERE id = ? AND case_id = ? AND status = 'complete'").bind(body.aiRunId,caseId).first<{ result: string }>();
        const suggestion = run && (JSON.parse(run.result) as AiResult).suggestions[body.suggestionIndex as number];
        if (!suggestion) return fail("AI 建议不存在。");
        candidate = { ...suggestion, evidenceIds: suggestion.evidence.map(e => e.id) };
      }
      try { payload = { ...resolveLink(candidate, state, sourceCatalog(state, await readMessages(caseId))), ...(body.aiRunId ? { aiRunId: body.aiRunId } : {}) }; }
      catch (error) { return fail(error instanceof Error ? error.message : "关联无效。"); }
      if (state.links.some(l => !l.retired && l.kind === payload.kind && l.from === payload.from && l.to === payload.to && l.topicId === payload.topicId && l.fromVersion === payload.fromVersion && l.toVersion === payload.toVersion)) return fail("同一版本的关联已存在，请查看原关联或先撤销。");
    } else if (kind === "link_retract") {
      if (!state.links.some(l => l.id === body.linkId && !l.retired) || !bounded(body.reason, 600)) return fail("请选择有效关联并说明撤销原因。");
      payload = { linkId: body.linkId, reason: body.reason.trim() };
    } else if (kind === "proposal" || kind === "vote") {
      const topic = state.topics.find(item => item.id === body.topicId);
      if (!topic) return fail("议题不存在，请刷新后再试。");
      if (kind === "proposal") {
        let details;
        try { details=normalizeProposal(body.details); } catch(error) { return fail(error instanceof Error ? error.message : '请补全方案五项内容。'); }
        if (typeof body.reason !== "string" || body.reason.length > 600 || (topic.proposal && !body.reason.trim())) return fail("修改已有方案时请填写修订说明，最多 600 字。");
        payload = { topicId: topic.id, details, text: proposalText(details), reason: body.reason.trim() };
      } else {
        if (!parties.includes(actorKey as PartyKey)) return fail("协调员不能替三方确认。", 403);
        if (!topic.proposal || body.proposalId !== topic.proposal.id || body.profileStamp !== profileStamp(state)) return fail("方案或立场已变化，请阅读最新版本后重新确认。", 409);
        if (typeof body.choice !== "string" || !Object.hasOwn(voteLabels, body.choice)) return fail("请选择有效的表态。");
        if(body.choice==='accept' && missingProposalFields(topic.proposal.details).length) return fail('当前为旧版未结构化方案，请先补全五项内容并发布新版本，再明确接受。');
        if (typeof body.note !== "string" || body.note.length > 800 || (body.choice !== "accept" && !body.note.trim())) return fail("请说明接受条件、异议或需要的信息，最多 800 字。");
        payload = { topicId: topic.id, proposalId: topic.proposal.id, profileStamp: profileStamp(state), choice: body.choice, note: body.note.trim() };
      }
    } else return fail("不支持的操作。");

    // Atomic revision check closes the race between reading state and appending.
    // Demo role is intentional; dispatch identity is recorded separately when present.
    const result = await env.DB!.prepare("INSERT INTO collaboration_events (case_id, actor_key, kind, payload, user_id) SELECT ?, ?, ?, ?, ? WHERE COALESCE((SELECT MAX(id) FROM collaboration_events WHERE case_id = ?), 0) = ? RETURNING id")
      .bind(caseId,actorKey as RoleKey, kind, JSON.stringify(payload), request.headers.get("oai-authenticated-user-id"),caseId, expectedRevision).first<{ id: number }>();
    if (!result) return fail("项目刚被更新，请核对最新内容后再次提交。你的输入仍然保留。", 409);
    return Response.json({ state: await readState(caseId), eventId: result.id }, { status: 201, headers });
  } catch { return fail("提交失败，输入已保留。请稍后重试。", 503); }
}
