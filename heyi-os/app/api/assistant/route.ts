import { env } from "cloudflare:workers";
import { actors, type RoleKey } from "../../../lib/collaboration";
import { readState, readMessages } from "../../../lib/server-state";
import { askAssistant } from "../../../lib/ai-assistant";
import { AI_BASE_URL, AI_CONSENT_VERSION, AI_MODEL, AI_PROVIDER } from "../../../lib/ai-config";
import { isCaseId, readCaseId } from '../../../lib/cases';

const headers = { "Cache-Control": "no-store" };
const model = () => env.ACCTOKEN_MODEL || AI_MODEL;
const fail = (error: string, status = 400) => Response.json({ error }, { status, headers });
type RunRow = { id: string; actorKey: string; prompt: string; result: string | null; revision: number; model: string; status: string; error: string | null; createdAt: string };
const columns = "id, actor_key AS actorKey, prompt, result, revision, model, status, error, created_at AS createdAt";
function present(r: RunRow) { return { ...r, result: r.result ? JSON.parse(r.result) : null }; }
export async function GET(request: Request) {
  const caseId=readCaseId(request); if(!caseId)return fail('案例不存在。',404);
  try {
    const rows = await env.DB!.prepare(`SELECT ${columns} FROM ai_runs WHERE case_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20`).bind(caseId).all<RunRow>();
    return Response.json({ caseId, configured: !!env.ACCTOKEN_API_KEY, provider: AI_PROVIDER, consentVersion: AI_CONSENT_VERSION, model: model(), runs: rows.results.map(present) }, { headers });
  } catch { return fail("AI 历史暂时不可用。", 503); }
}
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 12000) return fail("请求过长。", 413);
  let body;
  try { body = await request.json() as Record<string, unknown>; } catch { return fail("请求格式错误。"); }
  if (!body || typeof body !== "object" || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 1800 || typeof body.actorKey !== "string" || !Object.hasOwn(actors, body.actorKey) || typeof body.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestId) || body.shareConfirmed !== true) return fail("请确认问题及共享上下文可以发送至 AI 并保存到项目。");
  if (body.consentVersion !== AI_CONSENT_VERSION) return fail("AI 服务已切换至 ACCTOKEN，请刷新页面并重新确认数据发送说明。", 409);
  if(!isCaseId(body.caseId))return fail('请选择有效案例；旧页面请刷新后再操作。',409);
  const caseId=body.caseId;
  if (!env.ACCTOKEN_API_KEY) return fail("服务器尚未配置 ACCTOKEN 密钥，无法生成真实回答。", 503);
  let claimed = false;
  try {
    const old = await env.DB!.prepare(`SELECT ${columns} FROM ai_runs WHERE id = ? AND case_id = ?`).bind(body.requestId,caseId).first<RunRow>();
    if (old) return Response.json({ run: present(old) }, { headers });
    const state = await readState(caseId);
    // One atomic insert enforces project-wide request limits even across concurrent Workers.
    const claim = await env.DB!.prepare("INSERT INTO ai_runs (id, case_id, actor_key, prompt, revision, model, status) SELECT ?, ?, ?, ?, ?, ?, 'pending' WHERE (SELECT COUNT(*) FROM ai_runs WHERE created_at >= datetime('now', '-1 minute')) < 6 AND (SELECT COUNT(*) FROM ai_runs WHERE created_at >= datetime('now', '-1 day')) < 60 AND NOT EXISTS (SELECT 1 FROM ai_runs WHERE status = 'pending' AND created_at >= datetime('now', '-90 seconds')) RETURNING id")
      .bind(body.requestId,caseId, body.actorKey, body.prompt.trim(), state.revision, model()).first();
    if (!claim) return fail("AI 正在处理其他请求，或已达到项目限额（每分钟 6 次、24 小时 60 次）。请稍后再试。", 429);
    claimed = true;
    const recent = await env.DB!.prepare("SELECT prompt, result FROM ai_runs WHERE case_id = ? AND status = 'complete' ORDER BY created_at DESC, rowid DESC LIMIT 3").bind(caseId).all<{ prompt: string; result: string }>();
    const previous = recent.results.reverse().map(r => ({ question: r.prompt, answer: String(JSON.parse(r.result).answer).slice(0, 1800) }));
    const result = await askAssistant(env.ACCTOKEN_API_KEY, model(), state, await readMessages(caseId), body.actorKey as RoleKey, body.prompt.trim(), previous, env.ACCTOKEN_BASE_URL || AI_BASE_URL);
    await env.DB!.prepare("UPDATE ai_runs SET status = 'complete', result = ? WHERE id = ? AND case_id = ?").bind(JSON.stringify(result), body.requestId,caseId).run();
    const run = await env.DB!.prepare(`SELECT ${columns} FROM ai_runs WHERE id = ? AND case_id = ?`).bind(body.requestId,caseId).first<RunRow>();
    return Response.json({ run: present(run!) }, { status: 201, headers });
  } catch (error) {
    const message = error instanceof Error && /^(AI |API )/.test(error.message) && !error.message.includes("sk-") ? error.message : "AI 请求超时或服务异常，请稍后重试。此次没有生成有效回答。";
    if (claimed) try { await env.DB!.prepare("UPDATE ai_runs SET status = 'failed', error = ? WHERE id = ? AND case_id = ?").bind(message.slice(0, 300), body.requestId,caseId).run(); } catch { /* Preserve the original error without leaking infrastructure details. */ }
    return fail(message, 502);
  }
}
