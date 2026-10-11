import {getCase} from './cases.ts';
type TopicSample = {first:string;revised:string;acceptance:string};
type CaseSample = {responsible:string;conditions:string;purpose:string;scope:string;reservations:string;objection:string;revisionHint:string;topics:Record<string,TopicSample>};
const samples:Record<string,CaseSample> = {
 campus:{responsible:'学生策划组编制安排，文化社团代表核对参与机会与介绍内容，校园管理方核对场地限制。',conditions:'仅使用已批准的白天活动时段，不占用疏散通道，不追加既定预算。',purpose:'在保留各方不同需求的前提下，形成公平、安全且可以复核的文化节安排。',scope:'本次校园文化节已批准的白天活动；不涉及新增预算或其他活动授权。',reservations:'文化表达细节、场地安排与资源分配中未纳入共同条款的内容仍待协商。',objection:'小众社团也需要基本舞台时间，不能仅按报名人数分配机会。',revisionHint:'回应基本展示机会，增加轮换分配与共同复审。',topics:{
 stage:{first:'优先把舞台时段分配给报名人数最多的社团，其他社团安排在展位展示。',revised:'每个报名社团至少获得一个20分钟展示时段，剩余时段通过轮换分配；社团自行确认介绍内容。',acceptance:'排期覆盖全部报名社团，每个社团至少有一个20分钟时段，且不超出批准时段。'},
 expression:{first:'由学生策划组统一改写社团介绍，统一展示风格后直接发布。',revised:'每个社团自行确认介绍文字和展示符号；存在争议时先暂停该内容，由社团代表与策划组共同修订后发布。',acceptance:'每份介绍均有所属社团的确认记录，争议内容在修订确认前不发布。'},
 schedule:{first:'为了吸引更多观众，把所有节目集中到晚间主舞台。',revised:'节目安排在批准的白天时段，设置轮换场地、观众容量和疏散路线；管理方核对后公布时间表。',acceptance:'活动时间在批准范围内，容量与疏散路线经管理方核对，替代场地安排完整。'}}},
 openair:{responsible:'研究团队编制汇总预警计划，医院与社区核对授权与当地能力，数据合规方核对用途、期限与访问记录。',conditions:'彩排仅使用虚构汇总数据，不涉及真实患者记录；原始患者数据不跨境，不绕过审批与访问留痕。',purpose:'兼顾预警时效、当地社区决定权与可审计的数据合作机制。',scope:'虚构跨国预警协作试点的汇总信息与流程验证；不授权真实数据传输。',reservations:'未纳入共同条款的数据用途、紧急触发条件和长期共享频率仍待各方协商。',objection:'小时级上报超出当地处理能力，社区需要授权和复审汇总共享的机会。',revisionHint:'回应当地能力与社区授权，改为每日最小必要汇总更新并共同复审。',topics:{
 speed:{first:'要求所有合作单位每小时上传一次预警汇总，以研究团队时效需求为优先。',revised:'常态每日提交一次经当地授权的最小必要汇总；出现约定阈值信号时走限时紧急审批，不共享原始患者记录。',acceptance:'常态汇总频率为每日一次，字段经过当地授权；模拟紧急请求具有限时审批与留痕，原始记录未跨境。'},
 sovereignty:{first:'研究团队可自行决定汇总信息的后续用途，合作单位不能撤回。',revised:'用途与共享字段由当地医院和社区先确认；新增用途须重新授权，撤回请求停止后续共享并保留处理记录。',acceptance:'每项用途与共享字段都有模拟授权记录，新增用途重新确认，撤回演练有停止共享和处理记录。'},
 emergency:{first:'研究团队发现异常即可无限期扩大访问权限，事后再告知其他方。',revised:'三方共同确认触发阈值；异常请求经指定审批人批准后限时生效，自动到期并保留访问记录，三方事后复审。',acceptance:'模拟异常请求包含共同触发条件、审批人、到期时间、访问记录和事后复审结果。'}}},
 neighborhood:{responsible:'居民代表核对休息与通行需求，商户代表提交外摆和清洁安排，街区管理方核对公共通行并组织可逆试点。',conditions:'不堵住宅入口、无障碍路线或紧急通道；在既定预算内试点，夜间安静时段不开展扩音经营。',purpose:'兼顾居民休息、合理经营和公共通行，形成可逆、可复审的公共空间规则。',scope:'本街区公共空间的虚构布局与使用规则试点；不涉及真实施工、收费或经营许可变更。',reservations:'未纳入共同条款的长期经营范围、维护费用和试点扩展仍待协商。',objection:'不能未经沟通长期取消全部经营展示空间，需要划定合理外摆区并共同核对。',revisionHint:'回应合理经营机会，划分通行、休息与外摆区域，采用可逆试点和共同复审。',topics:{
 space:{first:'把全部公共空间改成安静休息区，统一取消商户外摆和展示。',revised:'共同划分连续通行区、休息区和限界外摆区；住宅入口、无障碍路线与紧急通道保持畅通，先试点再共同调整。',acceptance:'模拟布局标明通行、休息与外摆区域，住宅入口、无障碍路线和紧急通道均畅通，三方核对记录完整。'},
 hours:{first:'商户可以全天外摆和扩音经营，居民自行避开繁忙时段。',revised:'外摆限于每日10:00至18:00，18:00后清场并保持安静；商户负责清洁，居民与管理方按试点反馈共同调整。',acceptance:'模拟安排明确10:00至18:00外摆与清场规则、安静时段和商户清洁责任，三方反馈有记录。'},
 pilot:{first:'布局发布后长期执行，维护与投诉由居民自行解决。',revised:'采用两周可逆试点，商户负责日常清洁，管理方安排设施维护，居民代表汇总反馈；三方复审后决定调整或停止。',acceptance:'模拟试点明确两周期限、清洁与维护负责人、反馈窗口和三方复审记录，保留调整或停止机制。'}}},
};
export function rehearsalSample(caseId:string,topicId?:string){const config=getCase(caseId),sample=samples[caseId],id=topicId??config.topics[0].id,topic=sample.topics[id]??{first:'由牵头方单独确定本议题安排，再告知其他参与方。',revised:'三方先共同核对本议题的具体需求、底线和责任，确认执行安排后试行，并共同复审结果。',acceptance:'本议题执行安排包含三方需求、底线与责任的核对记录，试行结果经指定复审人核对。'};return {...sample,topic,caseName:config.name};}
export function rehearsalAcceptance(caseId:string,topicId?:string){return '虚构彩排：'+rehearsalSample(caseId,topicId).topic.acceptance;}
export function rehearsalEvidence(caseId:string,task:{title:string;action:string;acceptance:string}){
 return ['虚构彩排完成依据（仅用于演示）：','案例：'+getCase(caseId).name,'任务：'+task.title,'模拟执行内容：'+task.action,'逐项核对标准：'+task.acceptance,'模拟材料：任务执行清单、参与方核对记录与复审记录（演示文字，无真实附件）。','彩排模拟结果：已按上述执行内容逐项整理核对材料，现申请指定复审人检查。','本说明不代表已经验收。'].join('\n');
}
