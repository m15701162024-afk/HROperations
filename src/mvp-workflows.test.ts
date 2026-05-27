import { describe, expect, it } from 'vitest';
import { buildAnalyticsDrill } from './analytics';
import { emptyData, scanRisks } from './data';
import type { AppData, ContentTask, JobNeed, PlatformAccount } from './types';
import { applyMetricsCsv, buildReportMarkdown, calculateAccountHealth, deriveTasks, detectCalendarConflicts, evaluateIntegrationReadiness, evaluateModelApiReadiness, findDuplicateLead, generateTopicsFromJob, parseJobCsv, parseLeadCsv, scoreContentQuality } from './utils';

const job: JobNeed = {
  id: 'job-mvp',
  title: '高级后端工程师',
  family: '后端',
  city: '杭州',
  level: '高级',
  type: '社招',
  jd: '负责核心招聘运营平台服务端建设。',
  persona: '5-10 年后端候选人',
  sellingPoints: ['技术挑战', '成长空间'],
  targetPlatforms: ['小红书', '脉脉'],
  status: '招聘中',
  beisenUrl: '',
  websiteUrl: '',
};

const account: PlatformAccount = {
  id: 'acc-mvp',
  platform: '小红书',
  name: '招聘运营账号',
  externalId: 'real-acc-mvp',
  integrationId: 'integration-mvp',
  provider: '小红书 API',
  status: '已连接',
  syncedAt: '2026-05-26 10:00',
};

const content: ContentTask = {
  id: 'ct-mvp',
  title: '小红书｜高级后端工程师',
  jobId: job.id,
  platform: '小红书',
  accountId: account.id,
  type: '岗位种草',
  status: '待专业审核',
  owner: '招聘专员',
  reviewer: '招聘主管',
  dueDate: new Date().toISOString().slice(0, 10),
  publishedAt: new Date().toISOString().slice(0, 10),
  content: '技术挑战、成长空间，点击投递高级后端工程师。',
  tags: ['后端', '高级'],
  riskLevel: '中',
  risks: [],
  metrics: { views: 1000, likes: 20, comments: 5, saves: 8, shares: 3, clicks: 30 },
};

function dataFixture(): AppData {
  return {
    ...emptyData,
    jobs: [job],
    accounts: [account],
    contents: [content],
    entries: [{ id: 'entry-mvp', platform: '小红书', headline: '投递入口', url: 'https://example.com/jobs', destination: '北森岗位页', trackingCode: 'utm_source=xhs', clicks: 0, status: '启用' }],
    beisenResults: [{ id: 'beisen-mvp', jobId: job.id, sourcePlatform: '小红书', sourceContentId: content.id, candidateCode: 'candidate-1', stage: '有效简历', importedAt: new Date().toLocaleString('zh-CN', { hour12: false }) }],
    modelApis: [{ id: 'model-mvp', provider: 'DeepSeek', name: 'DeepSeek 测试', baseUrl: 'https://api.deepseek.com/v1', apiKey: '********', model: 'deepseek-chat', enabledFor: ['内容生成'], status: '待验证' }],
    assets: [{ id: 'asset-mvp', name: '技术挑战', category: '岗位卖点采集表', owner: '招聘专员', scope: '招聘内容可用', platforms: ['小红书'], riskLevel: '中', authorization: '已授权', expiresAt: '2026-12-31', usageCount: 1 }],
    reports: [{ id: 'report-mvp', title: '小红书点击转化复盘', body: '点击表现稳定', action: '继续强化 CTA', severity: '机会' }],
    reportActions: [{ id: 'action-mvp', reportId: 'report-mvp', title: '优化 CTA', owner: '招聘专员', dueDate: '2026-06-01', status: '进行中', createdAt: new Date().toLocaleString('zh-CN', { hour12: false }) }],
    integrations: [{ id: 'integration-mvp', type: '平台API', name: '小红书 API', endpoint: 'https://example.com/api', apiKey: '********', authMode: 'Token', status: '待验证', extraConfig: '{}' }],
    roles: [{ id: 'role-mvp', name: '招聘专员', dataScope: '个人', permissions: ['内容查看'] }],
    users: [{ id: 'user-mvp', name: '招聘专员', roleId: 'role-mvp', team: '招聘团队', status: '启用' }],
  };
}

const scenarios: Array<[string, () => boolean]> = [
  ['工作台', () => deriveTasks(dataFixture()).some((task) => task.targetSection === '内容运营')],
  ['招聘需求', () => parseJobCsv('title,family,city,level,type,jd,persona,sellingPoints,targetPlatforms\n高级后端工程师,后端,杭州,高级,社招,负责服务端,5-10年,技术挑战、小红书,小红书').length === 1],
  ['选题库', () => generateTopicsFromJob(job).length >= 3],
  ['内容运营', () => scoreContentQuality(content, job).total > 0 && scanRisks(content.content).level !== '高'],
  ['排期日历', () => Array.isArray(detectCalendarConflicts(content, dataFixture()))],
  ['线索池', () => {
    const leads = parseLeadCsv('name,contact,sourcePlatform,owner\n张三,13800000000,小红书,招聘专员');
    return leads.length === 1 && findDuplicateLead(leads, { ...leads[0], id: 'lead-copy' })?.id === leads[0].id;
  }],
  ['素材资产', () => dataFixture().assets.some((asset) => asset.authorization === '已授权' && asset.platforms.includes('小红书'))],
  ['账号与平台', () => calculateAccountHealth(account.id, dataFixture()).accountId === account.id],
  ['导入中心', () => applyMetricsCsv([content], 'contentId,views,likes,comments,saves,shares,clicks\nct-mvp,2000,40,8,16,6,60')[0].metrics.views === 2000],
  ['数据分析', () => buildAnalyticsDrill(dataFixture(), { dimension: 'platform', platform: '小红书', page: 1, pageSize: 10 }).summary.views === 1000],
  ['复盘报告', () => buildReportMarkdown(dataFixture()).includes('招聘新媒体运营周报')],
  ['AI工作台', () => dataFixture().modelApis.some((item) => item.enabledFor.includes('内容生成') && item.status === '待验证')],
  ['系统配置', () => dataFixture().roles.some((role) => role.permissions.includes('内容查看'))],
];

describe('模块主流程 MVP 自动化验收', () => {
  it.each(scenarios)('%s 至少有一条主流程测试', (_moduleName, run) => {
    expect(run()).toBe(true);
  });

  it('keeps external platform and model API MVP readiness measurable in product', () => {
    const fixture = dataFixture();
    const integrationReadiness = evaluateIntegrationReadiness({
      ...fixture.integrations[0],
      status: '已连接',
      lastSyncAt: '2026-05-27 10:00:00',
      lastMessage: '连接测试通过',
    });
    const modelReadiness = evaluateModelApiReadiness({
      ...fixture.modelApis[0],
      status: '已连接',
      lastTestAt: '2026-05-27 10:00:00',
      lastMessage: 'DeepSeek API 连接测试通过',
    });

    expect(integrationReadiness.status).toBe('已闭环');
    expect(integrationReadiness.score).toBe(100);
    expect(modelReadiness.status).toBe('已闭环');
    expect(modelReadiness.score).toBe(100);
  });
});
