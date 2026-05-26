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
    type: '招聘专用账号',
    positioning: '岗位种草',
    owner: '招聘运营',
    publishingRoles: ['招聘专员'],
    reviewRule: '默认',
    attribution: '招聘团队',
    authStatus: '已授权',
    status: '启用',
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
});
