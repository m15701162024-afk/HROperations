import { describe, expect, it } from 'vitest';
import { buildAnalyticsDrill, detectMetricQualityIssues, summarizeMetrics } from './analytics';
import type { AppData } from './types';

const baseData: AppData = {
  jobs: [{
    id: 'job-1',
    title: '高级前端工程师',
    family: '前端',
    city: '杭州',
    level: '高级',
    type: '社招',
    jd: '',
    persona: '',
    sellingPoints: [],
    targetPlatforms: ['小红书'],
    status: '招聘中',
    beisenUrl: '',
    websiteUrl: '',
  }],
  accounts: [{
    id: 'acc-1',
    platform: '小红书',
    name: '招聘号',
    externalId: 'real-acc-1',
    integrationId: 'integration-xhs',
    provider: '小红书 API',
    status: '已连接',
    syncedAt: '2026-05-26 10:00',
  }],
  contents: [{
    id: 'ct-1',
    title: '小红书｜高级前端工程师',
    jobId: 'job-1',
    platform: '小红书',
    accountId: 'acc-1',
    type: '岗位种草',
    status: '已发布',
    owner: '招聘运营',
    reviewer: '招聘主管',
    dueDate: '2026-05-20',
    publishedAt: '2026-05-20',
    content: '欢迎投递',
    tags: ['前端'],
    riskLevel: '低',
    risks: [],
    metrics: { views: 1000, likes: 50, comments: 10, saves: 20, shares: 5, clicks: 40 },
  }],
  contentVersions: [],
  reviewComments: [],
  assets: [],
  goals: [],
  reports: [],
  entries: [],
  beisenResults: [
    { id: 'b-1', jobId: 'job-1', sourcePlatform: '小红书', sourceContentId: 'ct-1', candidateCode: 'C001', stage: '已投递', importedAt: '2026-05-21' },
    { id: 'b-2', jobId: 'job-1', sourcePlatform: '小红书', sourceContentId: 'ct-1', candidateCode: 'C002', stage: '有效简历', importedAt: '2026-05-21' },
    { id: 'b-3', jobId: 'job-1', sourcePlatform: '小红书', sourceContentId: 'ct-1', candidateCode: 'C003', stage: '已入职', importedAt: '2026-05-21' },
  ],
  integrations: [],
  integrationSyncRuns: [],
  modelApis: [],
  landingPages: [],
  landingLeads: [],
  roles: [],
  users: [],
  workflowRules: [],
  sensitiveRules: [],
  costs: [{ id: 'cost-1', targetType: '平台', targetId: '小红书', laborCost: 100, mediaCost: 200, productionCost: 300 }],
  notifications: [],
  auditLogs: [],
  integrationMappings: [],
  compliancePolicies: [],
  deploymentTasks: [],
  importRuns: [],
  reportActions: [],
  promptTemplates: [],
  modelRunLogs: [],
  pluginRules: [],
  tasks: [],
  taskCompletions: [],
  candidateLeads: [],
  leadFollowUps: [],
  contentQualityScores: [],
  topics: [],
  accountHealthSnapshots: [],
  calendarMilestones: [],
  dataExplanations: [],
  reviewMentions: [],
  operationSettings: {
    contentQualityBlockScore: 70,
    accountInactiveWarningDays: 14,
    accountInactiveDangerDays: 30,
    dailyAccountPublishLimit: 2,
    dataCollectionDelayDays: 2,
    weeklyPlatformTargets: {},
    reviewSlaHours: 24,
  },
};

describe('analytics drill service', () => {
  it('summarizes unified metrics and conversion rates', () => {
    const summary = summarizeMetrics(baseData, { dimension: 'platform', platform: '小红书' });

    expect(summary.views).toBe(1000);
    expect(summary.interactions).toBe(85);
    expect(summary.clicks).toBe(40);
    expect(summary.applications).toBe(3);
    expect(summary.effectiveResumes).toBe(2);
    expect(summary.hires).toBe(1);
    expect(summary.clickRate).toBe(0.04);
    expect(summary.effectiveRate).toBeCloseTo(0.6667, 4);
  });

  it('returns zero metrics for empty real data', () => {
    const result = buildAnalyticsDrill({ ...baseData, contents: [], beisenResults: [], costs: [] }, { dimension: 'summary', platform: '全部' });

    expect(result.summary.views).toBe(0);
    expect(result.summary.clickRate).toBe(0);
    expect(result.details).toEqual([]);
  });

  it('detects quality issues for unattributed beisen results', () => {
    const issues = detectMetricQualityIssues({
      ...baseData,
      beisenResults: [{ id: 'bad-1', jobId: '', sourcePlatform: '未知', candidateCode: 'C404', stage: '已投递', importedAt: '2026-05-21' }],
    }, { dimension: 'summary', platform: '全部' });

    expect(issues.some((issue) => issue.issueType === '无法归因')).toBe(true);
  });

  it('detects duplicate imported attribution rows', () => {
    const issues = detectMetricQualityIssues({
      ...baseData,
      beisenResults: [
        { id: 'dup-1', jobId: 'job-1', sourcePlatform: '小红书', sourceContentId: 'ct-1', candidateCode: 'C001', stage: '已投递', importedAt: '2026-05-21' },
        { id: 'dup-2', jobId: 'job-1', sourcePlatform: '小红书', sourceContentId: 'ct-1', candidateCode: 'C001', stage: '已投递', importedAt: '2026-05-21' },
      ],
    }, { dimension: 'summary', platform: '全部' });

    expect(issues.some((issue) => issue.issueType === '重复数据')).toBe(true);
  });

  it('keeps fully unattributed beisen rows out of metrics while surfacing quality issues', () => {
    const data = {
      ...baseData,
      beisenResults: [
        ...baseData.beisenResults,
        { id: 'bad-2', jobId: '', sourcePlatform: '未知' as const, candidateCode: 'C999', stage: '已入职' as const, importedAt: '2026-05-21' },
      ],
    };
    const result = buildAnalyticsDrill(data, { dimension: 'summary', platform: '全部' });

    expect(result.summary.applications).toBe(3);
    expect(result.summary.hires).toBe(1);
    expect(result.qualityIssues.some((issue) => issue.issueType === '无法归因')).toBe(true);
  });

  it('does not count rows that point to missing jobs and missing content', () => {
    const result = buildAnalyticsDrill({
      ...baseData,
      beisenResults: [
        ...baseData.beisenResults,
        { id: 'bad-job', jobId: 'missing-job', sourcePlatform: '未知' as const, candidateCode: 'C998', stage: '已入职' as const, importedAt: '2026-05-21' },
      ],
    }, { dimension: 'summary', platform: '全部' });

    expect(result.summary.applications).toBe(3);
    expect(result.summary.hires).toBe(1);
  });

  it('returns acceptance metadata for account, content, job and funnel drilldowns', () => {
    const account = buildAnalyticsDrill(baseData, { dimension: 'account', platform: '小红书' }).breakdowns[0];
    expect(account.meta?.provider).toBe('小红书 API');
    expect(account.meta?.publishCount).toBe(1);
    expect(account.meta?.healthScore).toBeTypeOf('number');

    const content = buildAnalyticsDrill(baseData, { dimension: 'content', contentId: 'ct-1' }).details[0];
    expect(content.meta?.riskLevel).toBe('低');
    expect(content.meta?.beisenStageDistribution).toMatchObject({ 已投递: 1, 有效简历: 1, 已入职: 1 });

    const job = buildAnalyticsDrill(baseData, { dimension: 'job', jobId: 'job-1' }).breakdowns[0];
    expect(job.meta?.contentCount).toBe(1);
    expect(job.meta?.platformContributions).toBe('小红书:1000曝光/3投递');

    const funnel = buildAnalyticsDrill({ ...baseData, contents: [{ ...baseData.contents[0], metrics: { ...baseData.contents[0].metrics, clicks: 0 } }], beisenResults: [] }, { dimension: 'funnel', platform: '小红书' });
    expect(funnel.breakdowns.find((item) => item.id === 'clicks')?.meta?.abnormal).toBe(true);
  });

  it('marks published-before-schedule content as medium risk date issue', () => {
    const issues = detectMetricQualityIssues({
      ...baseData,
      contents: [{ ...baseData.contents[0], dueDate: '2026-05-22', publishedAt: '2026-05-20' }],
    }, { dimension: 'summary', platform: '全部' });

    expect(issues.find((issue) => issue.issueType === '日期异常')?.severity).toBe('中');
  });
});
