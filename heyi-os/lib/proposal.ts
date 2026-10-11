export const proposalFields = [
  {key:'responsible',label:'谁负责',hint:'写明牵头方、执行人和其他参与方各自的责任。'},
  {key:'action',label:'做什么',hint:'描述可执行的行动、交付结果或需要遵守的规则。'},
  {key:'timing',label:'何时执行',hint:'明确开始时间、截止时间、频率或触发后的时限。'},
  {key:'conditions',label:'适用条件',hint:'明确何时适用、权限和范围；哪些情况不适用？'},
  {key:'review',label:'如何复审',hint:'谁在什么时候检查结果？如何提出异议、暂停或修订？'},
] as const;
export type ProposalDetails = Record<typeof proposalFields[number]['key'], string>;
export const emptyProposal = (): ProposalDetails => ({responsible:'',action:'',timing:'',conditions:'',review:''});
export function missingProposalFields(details: unknown): string[] {
  const d=details && typeof details==='object' ? details as Record<string,unknown> : {};
  return proposalFields.filter(f=>typeof d[f.key]!=='string' || !(d[f.key] as string).trim()).map(f=>f.label);
}
export function normalizeProposal(details: unknown): ProposalDetails {
  const missing=missingProposalFields(details);
  if(missing.length) throw new Error(`请补全方案：${missing.join('、')}。`);
  const d=details as Record<string,string>;
  if(proposalFields.some(f=>d[f.key].trim().length>600)) throw new Error('方案每项最多 600 字。');
  return Object.fromEntries(proposalFields.map(f=>[f.key,d[f.key].trim()])) as ProposalDetails;
}
export function proposalText(details: ProposalDetails) { return proposalFields.map(f=>`${f.label}：${details[f.key]}`).join('\n\n'); }
