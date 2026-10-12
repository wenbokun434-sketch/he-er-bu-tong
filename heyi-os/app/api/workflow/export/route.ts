import { readCaseId } from '../../../../lib/cases';
import { readWorkflow } from '../../../../lib/server-workflow';
import { readState } from '../../../../lib/server-state';
import { exportHtml,exportMarkdown } from '../../../../lib/document-export';
export async function GET(request:Request){
  const url=new URL(request.url),caseId=readCaseId(request),id=Number(url.searchParams.get('documentId')),format=url.searchParams.get('format'),language=url.searchParams.get('lang')==='en'?'en':'zh';
  if(!caseId||!Number.isSafeInteger(id)||id<=0||!['html','md'].includes(format||''))return Response.json({error:'导出参数无效。'},{status:400});
  try{const [w,s]=await Promise.all([readWorkflow(caseId),readState(caseId)]),d=w.documents.find(d=>d.id===id);if(!d)return Response.json({error:'本案例没有此文书版本。'},{status:404});
    return new Response(format==='html'?exportHtml(d,s,language):exportMarkdown(d,s,language),{headers:{'Content-Type':format==='html'?'text/html; charset=utf-8':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="heyi-${caseId}-v${d.version}.${format}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});
  }catch{return Response.json({error:'导出失败，请稍后重试。'},{status:503});}
}
