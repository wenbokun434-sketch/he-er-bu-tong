import type { Profile, RoleKey } from './collaboration';

export const DEFAULT_CASE_ID = 'openair';
export type CaseDefinition = {
  id: string; name: string; subtitle: string; icon: string; summary: string; direction: string;
  actors: Record<RoleKey, {actor: string; role: string}>;
  profiles: Record<Exclude<RoleKey, 'coordinator'>, Omit<Profile, 'revision'>>;
  topics: {id: string; title: string; description: string}[];
  tasks: {title: string; owner: string}[];
};
export const cases: CaseDefinition[] = [
  { id:'openair', name:'OpenAir Watch', subtitle:'跨国预警合作', icon:'◎',
    summary:'科研时效、社区决定权与数据合规之间，如何形成各方愿意遵守的合作规则？',
    direction:'建立兼顾预警能力、当地数据主权与患者权益的合作网络。',
    actors:{coordinator:{actor:'林然',role:'协调员'},research:{actor:'Dr. Chen',role:'研究团队'},hospital:{actor:'Grace N.',role:'医院与社区'},compliance:{actor:'Matteo R.',role:'数据合规'}},
    profiles:{
      research:{goal:'提高跨国预警的时效与模型质量。',concern:'更新过慢会错过早期信号。',boundary:'合作不能完全失去跨地区分析能力。',flexible:'可以不传输原始数据，协商汇总更新频率。'},
      hospital:{goal:'让当地患者和社区获得实际收益。',concern:'数据被再次利用，社区失去决定权。',boundary:'未经授权，原始患者数据不跨境。',flexible:'可分享最小必要汇总信息，但需社区复审。'},
      compliance:{goal:'建立可审计、可追责的合作机制。',concern:'紧急访问缺乏记录和明确权限。',boundary:'不能绕过审批、访问留痕和用途限制。',flexible:'可以简化紧急审批，但必须限时并事后复审。'},
    },
    topics:[{id:'speed',title:'预警速度',description:'如何兼顾预警时效与当地处理能力？'},{id:'sovereignty',title:'数据主权',description:'哪些信息可共享？谁决定用途与撤回？'},{id:'emergency',title:'紧急状态定义',description:'谁触发紧急访问？审批、期限和复审如何安排？'}],
    tasks:[{title:'确认紧急状态触发阈值',owner:'三方治理委员会'},{title:'发布社区可理解版数据说明',owner:'医院与社区'},{title:'完成数据访问审计测试',owner:'数据合规'}],
  },
  {id:'campus',name:'共声文化节',subtitle:'校园多元文化合作',icon:'◈',
    summary:'学生策划者、文化社团与校园管理方，如何兼顾表达空间、公平参与与场地秩序？',
    direction:'让不同文化都能被尊重地呈现，共同办一场可参与、可持续的校园文化节。',
    actors:{coordinator:{actor:'周宁',role:'协调员'},research:{actor:'许澄',role:'学生策划组'},hospital:{actor:'阿雅',role:'文化社团代表'},compliance:{actor:'王老师',role:'校园管理方'}},
    profiles:{
      research:{goal:'吸引更多同学参与，按期完成文化节。',concern:'节目协调过慢，预算和筹备时间不足。',boundary:'不能无限追加预算或临时取消主要活动。',flexible:'可调整舞台时段，把部分活动转为小型交流。'},
      hospital:{goal:'让少数文化也有平等表达和自我介绍的机会。',concern:'文化被猎奇化，热门社团挤占全部时段。',boundary:'未经同意不能改写社团介绍或使用有争议的符号。',flexible:'愿意共用展位和轮换演出，但须保留内容审核权。'},
      compliance:{goal:'保障场地秩序、可达性及周边师生正常作息。',concern:'人员拥挤、噪声和临时搭建带来风险。',boundary:'不能占用疏散通道或超过学校批准的活动时段。',flexible:'可在评估后延长白天使用时间并提供替代场地。'},
    },
    topics:[{id:'stage',title:'时段与资源分配',description:'热门活动与小众文化如何公平分配舞台、预算和展位？'},{id:'expression',title:'文化表达与审核',description:'谁确认介绍内容？如何处理不同理解与文化禁忌？'},{id:'schedule',title:'活动时间与场地',description:'如何协调活动体验、噪声限制和人员疏散？'}],
    tasks:[{title:'确认各社团参与时段',owner:'学生策划组'},{title:'复核文化介绍与展示内容',owner:'文化社团代表'},{title:'确认场地与无障碍安排',owner:'校园管理方'}],
  },
  {id:'neighborhood',name:'共邻空间',subtitle:'社区公共空间改造',icon:'⌂',
    summary:'居民、沿街商户与街区管理方，对同一片公共空间有不同期待，如何共同制定使用规则？',
    direction:'保留街区生活与经营活力，让公共空间对不同年龄和需求的人都友好。',
    actors:{coordinator:{actor:'苏禾',role:'协调员'},research:{actor:'陈阿姨',role:'居民代表'},hospital:{actor:'赵先生',role:'商户代表'},compliance:{actor:'刘工',role:'街区管理方'}},
    profiles:{
      research:{goal:'获得安静、可休息并适合老人儿童的公共空间。',concern:'夜间噪声、占道经营影响日常生活。',boundary:'不能堵住住宅入口、无障碍路线或影响夜间休息。',flexible:'可接受规定时段的小型市集与共享座椅。'},
      hospital:{goal:'保留合理经营机会，让街区更有吸引力。',concern:'统一改造增加成本，取消外摆影响生意。',boundary:'不能不经沟通就长期取消全部展示和经营空间。',flexible:'愿意限制外摆范围、共同清洁，并试行安静时段。'},
      compliance:{goal:'在有限预算内改善公共设施和通行秩序。',concern:'责任不清导致设施失修，规则无法持续执行。',boundary:'公共通行和紧急通道必须保持畅通。',flexible:'可先做可逆的试点，再依据反馈调整布局。'},
    },
    topics:[{id:'space',title:'空间使用边界',description:'休息区、通行区与经营区怎样划分？'},{id:'hours',title:'经营与安静时段',description:'怎样兼顾居民作息和商户经营？'},{id:'pilot',title:'试点与复审机制',description:'谁收集反馈、维护设施并决定是否调整试点？'}],
    tasks:[{title:'共同核对通行与休息区布局',owner:'居民代表'},{title:'提交外摆与清洁安排',owner:'商户代表'},{title:'安排试点评估与反馈窗口',owner:'街区管理方'}],
  },
];
export function isCaseId(id: unknown): id is string { return typeof id === 'string' && cases.some(c=>c.id===id); }
export function getCase(id = DEFAULT_CASE_ID): CaseDefinition { const result=cases.find(c=>c.id===id); if(!result) throw new Error('案例不存在。'); return result; }
export function readCaseId(request: Request) { const id=new URL(request.url).searchParams.get('caseId') ?? DEFAULT_CASE_ID; return isCaseId(id) ? id : null; }
