"use client";
import {useEffect,useState} from 'react';
import {getCase} from '../lib/cases';
import type {CollaborationState,RoleKey} from '../lib/collaboration';
import type {WorkflowState} from '../lib/workflow';
import {rehearsalCue} from '../lib/rehearsal';
export function RehearsalGuide({state,roleKey,busy,onNavigate,onRole}:{state:CollaborationState;roleKey:RoleKey;busy:boolean;onNavigate:(view:string)=>void;onRole:(role:RoleKey)=>void}){
 const [w,setW]=useState<WorkflowState|null>(null),[error,setError]=useState(''),[confirm,setConfirm]=useState(false),[resetting,setResetting]=useState(false);
 const [archive,setArchive]=useState('');
 useEffect(()=>{let active=true;setArchive(sessionStorage.getItem('heyi-archive-'+state.caseId)||'');fetch('/api/rehearsal?caseId='+state.caseId,{cache:'no-store'}).then(r=>r.json() as Promise<{lastArchiveId?:string}>).then(data=>{if(active&&data.lastArchiveId)setArchive(data.lastArchiveId);}).catch(()=>{});return()=>{active=false;};},[state.caseId]);
 useEffect(()=>{let active=true,running=false;const sync=async()=>{if(!active||running)return;running=true;try{const r=await fetch('/api/workflow?caseId='+state.caseId,{cache:'no-store'});if(!r.ok)throw Error('同步中断，请稍后重试。');const data=await r.json() as {workflow:WorkflowState};if(active){setW(previous=>!previous||data.workflow.revision>=previous.revision?data.workflow:previous);setError('');}}catch(e){if(active)setError(e instanceof Error?e.message:'同步失败');}finally{running=false;}};const update=(event:Event)=>{const data=(event as CustomEvent<WorkflowState>).detail;if(data.caseId===state.caseId)setW(previous=>!previous||data.revision>=previous.revision?data:previous);};window.addEventListener('heyi-workflow-updated',update);void sync();const timer=setInterval(sync,2000);return()=>{active=false;clearInterval(timer);window.removeEventListener('heyi-workflow-updated',update);};},[state.caseId]);
 const cue=w?rehearsalCue(state,w):null,actors=getCase(state.caseId).actors;
 async function reset(){if(!w)return;setResetting(true);try{const r=await fetch('/api/rehearsal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseId:state.caseId,confirm:true,expectedRevision:state.revision,expectedWorkflowRevision:w.revision})});const data=await r.json() as {error?:string;archiveId:string};if(!r.ok)throw Error(data.error);sessionStorage.setItem('heyi-archive-'+state.caseId,data.archiveId);window.location.reload();}catch(e){setError(e instanceof Error?e.message:'重置失败');setResetting(false);}}
 return <section className="rehearsal-guide" aria-label="彩排导演提示"><div className="rehearsal-top"><span className="rehearsal-label">独立彩排 · 虚构教学材料</span><button className="text-button" disabled={busy||resetting} onClick={()=>setConfirm(!confirm)}>开始新一轮彩排</button></div>
 <ol className="rehearsal-steps">{['看见分歧','回应与修订','确认方案','确认和议书','执行与验收'].map((label,i)=><li key={label} className={cue&&(i<cue.phase||cue.complete)?'done':cue?.phase===i?'current':''} aria-current={cue?.phase===i?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
 {cue&&<div className="rehearsal-cue" role="status"><div><h2>{cue.title}</h2><p>{cue.detail}</p><strong>下一位操作：{actors[cue.role].actor} · {actors[cue.role].role}</strong></div><div className="rehearsal-controls"><button className="primary" disabled={busy||!!error||resetting} onClick={()=>onNavigate(cue.view)}>前往{cue.view} →</button>{roleKey!==cue.role&&<button className="secondary" disabled={busy||resetting} onClick={()=>onRole(cue.role)}>切换为{actors[cue.role].role}</button>}</div></div>}
 {!cue&&<p>正在读取演示进度…</p>}{error&&<p role="alert">{error}</p>}
 {archive&&<a className="text-button" href={`/api/rehearsal?caseId=${state.caseId}&archiveId=${encodeURIComponent(archive)}`}>下载上一轮数据快照 JSON</a>}
 {confirm&&<div className="rehearsal-reset" role="group" aria-label="确认重新彩排"><p>将归档并清空「{getCase(state.caseId).name}」的本轮消息、方案、文书和任务。其他案例和正常试用数据不受影响。未提交草稿会丢失。</p><button className="secondary" disabled={busy||resetting||!!error||!w} onClick={()=>void reset()}>{resetting?'正在归档…':'保存快照并重新开始'}</button><button className="text-button" disabled={resetting} onClick={()=>setConfirm(false)}>继续本轮</button></div>}
 </section>;
}
