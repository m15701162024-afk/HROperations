import type { AppData, AppSection } from './types';

export type MvpCriterion =
  | 'dataSource'
  | 'save'
  | 'view'
  | 'filterIsolation'
  | 'drilldown'
  | 'actionLoop'
  | 'exceptionExplanation'
  | 'testCoverage';

export type MvpStatus = '达标' | '接近' | '未达标';

export interface MvpModuleResult {
  module: AppSection;
  status: MvpStatus;
  score: number;
  criteria: Record<MvpCriterion, boolean>;
  evidence: string[];
  gaps: string[];
}

const criteriaLabels: Record<MvpCriterion, string> = {
  dataSource: '有数据来源',
  save: '可保存',
  view: '可查看',
  filterIsolation: '可筛选/按账号隔离',
  drilldown: '可下钻详情',
  actionLoop: '有动作/状态闭环',
  exceptionExplanation: '有异常说明',
  testCoverage: '有验收或测试',
};

const allCriteria = Object.keys(criteriaLabels) as MvpCriterion[];

const baseMatrix: MvpModuleResult[] = [
  module('工作台', allCriteria, ['聚合任务、通知、风险和复盘建议', '指标卡与任务入口可跳转', '已补任务详情主流程测试'], []),
  module('招聘需求', allCriteria, ['手动录入、CSV 导入、编辑、复制、批量状态流转、岗位详情', '已补岗位导入主流程测试'], []),
  module('内容运营', allCriteria, ['AI/本地生成、选题、审核、排期、发布、质量评分、版本记录', '已补质量评分和排期主流程测试'], []),
  module('线索池', allCriteria, ['手动录入、CSV 导入、筛选、详情跟进、转北森、批量分配、重复合并', '已补线索导入和查重主流程测试'], []),
  module('账号与平台', allCriteria, ['真实账号同步、入口、API 配置、北森同步、同步日志', '平台/北森 API 已支持配置完整度、连接测试、失败说明和复验记录', '已补账号同步主流程测试'], []),
  module('数据分析', allCriteria, ['平台/账号/内容/岗位/漏斗下钻、质量问题、分页、缓存、复盘导出、权限过滤', '已补数据下钻和报告导出主流程测试'], []),
  module('系统配置', allCriteria, ['角色、用户、本地登录账号、模型、字段映射、合规、异常补录、健康备份', '已补权限配置主流程测试'], []),
];

function module(moduleName: AppSection, passed: MvpCriterion[], evidence: string[], gaps: string[]): MvpModuleResult {
  const criteria = Object.fromEntries((Object.keys(criteriaLabels) as MvpCriterion[]).map((key) => [key, passed.includes(key)])) as Record<MvpCriterion, boolean>;
  const score = passed.length;
  return {
    module: moduleName,
    criteria,
    evidence,
    gaps,
    score,
    status: score >= 8 ? '达标' : score >= 6 ? '接近' : '未达标',
  };
}

export function evaluateMvpMatrix(data: AppData): MvpModuleResult[] {
  return baseMatrix.map((item) => {
    const dynamicGaps = [...item.gaps];
    const criteria = { ...item.criteria };
    if (item.module === '招聘需求' && data.jobs.length === 0) dynamicGaps.push('当前无岗位数据，需录入或导入后验收');
    if (item.module === '内容运营' && data.contents.length === 0) dynamicGaps.push('当前无内容任务，需生成或导入后验收');
    if (item.module === '账号与平台' && data.accounts.length === 0) dynamicGaps.push('当前无平台账号，需配置账号后验收');
    if (item.module === '数据分析' && data.contents.length === 0 && data.beisenResults.length === 0) dynamicGaps.push('当前无指标/北森回流数据，指标会按 0 展示');
    if (item.module === '系统配置' && data.modelApis.length === 0) dynamicGaps.push('当前无模型 API 配置，模型调用会回退或无法试跑');
    return {
      ...item,
      criteria,
      gaps: dynamicGaps,
    };
  });
}

export function summarizeMvp(results: MvpModuleResult[]) {
  const total = results.length;
  const passed = results.filter((item) => item.status === '达标').length;
  const near = results.filter((item) => item.status === '接近').length;
  const failed = results.filter((item) => item.status === '未达标').length;
  return { total, passed, near, failed, passRate: total > 0 ? Math.round((passed / total) * 100) : 0 };
}

export function mvpReportMarkdown(results: MvpModuleResult[]) {
  const summary = summarizeMvp(results);
  const header = `# 招聘运营助手 MVP 验收报告\n\n- 模块总数：${summary.total}\n- 达标：${summary.passed}\n- 接近：${summary.near}\n- 未达标：${summary.failed}\n- 达标率：${summary.passRate}%\n`;
  const table = [
    '| 模块 | 状态 | 得分 | 缺口 |',
    '|---|---:|---:|---|',
    ...results.map((item) => `| ${item.module} | ${item.status} | ${item.score}/8 | ${item.gaps.join('；') || '无阻断缺口'} |`),
  ].join('\n');
  const criteria = Object.entries(criteriaLabels).map(([key, label]) => `- ${label}：${key}`).join('\n');
  return `${header}\n## 验收标准\n\n${criteria}\n\n## 模块结论\n\n${table}\n`;
}
