import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_BASE_URL, AI_MODEL, AI_CONSENT_VERSION, assistantEndpoint } from '../lib/ai-config.ts';
import { askAssistant, upstreamError } from '../lib/ai-assistant.ts';
import { initialState } from '../lib/collaboration.ts';

test('只允许已告知的 ACCTOKEN 地址，不向其他域名发送密钥',()=>{
 assert.equal(assistantEndpoint(AI_BASE_URL+'/'),'https://www.acctoken.com/v1/responses');
 for(const url of ['https://api.openai.com/v1','http://www.acctoken.com/v1','https://www.acctoken.com.evil.test/v1','https://user:pass@www.acctoken.com/v1','https://www.acctoken.com/v1?x=1'])assert.throws(()=>assistantEndpoint(url));
});
test('有效 DeepSeek 回答保留原文引用和待审核关联',async()=>{
 const old=globalThis.fetch;
 try {
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,assistantEndpoint());assert.equal(options.redirect,'manual');assert.equal(JSON.parse(options.body).model,AI_MODEL);
   return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:'可协商共享范围。',citationIds:['n:research:goal@0'],questions:['共享何种信息？'],suggestions:[{kind:'concerns',from:'n:research:goal',to:'t:speed',topicId:'speed',reason:'预警目标需要协商更新时效。',evidenceIds:['n:research:goal@0']}]})}]}]});
  };
  const result=await askAssistant('test-key',AI_MODEL,initialState(),[],'coordinator','分析');
  assert.equal(result.citations[0].text,initialState().profiles.research.goal);assert.equal(result.suggestions.length,1);
 }finally{globalThis.fetch=old;}
});
test('拒绝非 JSON、截断和伪造引用，不返回假答案',async()=>{
 const old=globalThis.fetch;
 try {
  for(const response of [new Response('<html>Error</html>',{status:502}),Response.json({status:'incomplete'}),Response.json({status:'completed',output:[{content:[{type:'output_text',text:'{"answer":"伪造","citationIds":["fake"],"questions":[],"suggestions":[]}'}]}]})]){
   globalThis.fetch=async()=>response;
   await assert.rejects(askAssistant('test-key',AI_MODEL,initialState(),[],'coordinator','分析'),/AI /);
  }
 }finally{globalThis.fetch=old;}
});
test('余额与认证错误引导至新服务商',()=>{
 assert.match(upstreamError(402),/ACCTOKEN/);assert.match(upstreamError(401),/密钥/);assert.match(upstreamError(429),/频繁/);
});
test('新服务商同意版本在客户端发送、服务端校验，旧配置无回退',()=>{
 assert.ok(AI_CONSENT_VERSION.includes('acctoken'));
 const route=readFileSync(new URL('../app/api/assistant/route.ts',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../components/assistant-panel.tsx',import.meta.url),'utf8');
 assert.match(route,/body\.consentVersion !== AI_CONSENT_VERSION/);assert.match(panel,/consentVersion: AI_CONSENT_VERSION/);
 assert.ok(panel.includes('第三方平台 ACCTOKEN'));assert.doesNotMatch(route,/OPENAI_API_KEY|OPENAI_MODEL|askOpenAI/);
});
