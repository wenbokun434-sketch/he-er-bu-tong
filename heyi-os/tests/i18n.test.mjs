import test from 'node:test';
import assert from 'node:assert/strict';
import {cases} from '../lib/cases.ts';
import {initialState} from '../lib/collaboration.ts';
import {emptyWorkflow,makeDocument} from '../lib/workflow.ts';
import {rehearsalCue,rehearsalProposal,rehearsalDocument} from '../lib/rehearsal.ts';
import {rehearsalAcceptance,rehearsalEvidence} from '../lib/rehearsal-samples.ts';
import {translateText,localizeData} from '../lib/i18n.ts';
import {exportHtml,exportMarkdown} from '../lib/document-export.ts';
import {askAssistant} from '../lib/ai-assistant.ts';
import {AI_MODEL} from '../lib/ai-config.ts';
const han=/[\u3400-\u9fff]/;
for(const c of cases)test('English case and rehearsal materials: '+c.id,()=>{
 const before=JSON.stringify(c),en=localizeData(c,'en');assert.doesNotMatch(JSON.stringify(en),han);assert.equal(en.id,c.id);assert.equal(JSON.stringify(c),before);
 const s=initialState(c.id),w=emptyWorkflow(c.id),snapshot=JSON.stringify({s,w});
 for(const topic of c.topics){for(const revised of [false,true]){const p=localizeData(rehearsalProposal(revised,c.id,topic.id),'en');assert.doesNotMatch(JSON.stringify(p),han);for(const field of Object.values(p))assert.ok(field.length<=600);}
  const acceptance=localizeData(rehearsalAcceptance(c.id,topic.id),'en');assert.doesNotMatch(acceptance,han);
  assert.doesNotMatch(localizeData(rehearsalEvidence(c.id,{title:topic.title,action:rehearsalProposal(true,c.id,topic.id).action,acceptance}),'en'),han);
 }
 assert.doesNotMatch(JSON.stringify(localizeData(rehearsalCue(s,w),'en')),han);
 const body=localizeData(rehearsalDocument(makeDocument(s),c.id),'en');assert.doesNotMatch(JSON.stringify(body),han);assert.equal(JSON.stringify({s,w}),snapshot);
 s.topics[0].proposal={id:10,version:1,details:rehearsalProposal(false,c.id),text:'',reason:'',actorKey:'coordinator',createdAt:'2026-10-12'};
 assert.doesNotMatch(JSON.stringify(localizeData(rehearsalCue(s,w),'en')),han);
});
test('English export translates labels and fictional content, preserves IDs, escapes text',()=>{
 const s=initialState('campus'),d={id:9,version:1,actorKey:'coordinator',createdAt:'2026-10-12',body:rehearsalDocument(makeDocument(s),'campus'),votes:{},sources:[],reason:''};
 const html=exportHtml(d,s,'en'),md=exportMarkdown(d,s,'en');assert.match(html,/<html lang="en">/);assert.match(md,/Shared Voices Festival/);assert.match(md,/Record #9/);assert.doesNotMatch(html,han);assert.doesNotMatch(md,han);
 d.body.title='<script>alert(1)</script>';assert.ok(!exportHtml(d,s,'en').includes('<script>'));assert.match(exportHtml(d,s,'en'),/&lt;script&gt;/);
 assert.match(exportMarkdown(d,s),/共同条款/);
});
test('English AI uses an explicit language instruction while preserving original evidence',async()=>{
 const original=globalThis.fetch,s=initialState('campus');try{globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.match(body.instructions,/in English/);assert.doesNotMatch(body.instructions,/用中文回答/);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:'Check stage access.',citationIds:['n:research:goal@0'],questions:['Who reviews the schedule?'],suggestions:[]})}]}]});};const result=await askAssistant('test-only-key',AI_MODEL,s,[],'coordinator','Check the arrangement',[],undefined,'en');assert.equal(result.citations[0].text,s.profiles.research.goal);}finally{globalThis.fetch=original;}
});
test('Dynamic copy translates without changing nonmatching authored text',()=>{assert.equal(translateText('当前 2/3 方已回应，沉默不表示同意。','en'),'Currently 2/3 parties responded. Silence is not agreement.');assert.equal(translateText('The draft remains mine.','en'),'The draft remains mine.');assert.equal(translateText('我自己的测试文字','zh'),'我自己的测试文字');});
