import { describe, expect, it } from 'vitest';
import { buildAnalyticsDrill } from './analytics';
import { buildMvpSeedData, emptyData } from './data';
import type { AppData, AssetItem, CandidateLead, JobNeed, PlatformAccount } from './types';

function createUpdateDelete<T extends { id: string }>(rows: T[], created: T, updated: T) {
  const afterCreate = [created, ...rows];
  const afterUpdate = afterCreate.map((item) => item.id === created.id ? updated : item);
  const afterDelete = afterUpdate.filter((item) => item.id !== created.id);
  return { afterCreate, afterUpdate, afterDelete };
}

describe('真实数据生命周期闭环', () => {
  it('fills current empty modules with MVP seed data without overwriting existing data', () => {
    const existing: AppData = { ...emptyData, jobs: [{ ...buildMvpSeedData().jobs[0], id: 'real-existing-job', title: '真实已有岗位' }] };
    const seeded = buildMvpSeedData(existing);

    expect(seeded.jobs).toHaveLength(1);
    expect(seeded.jobs[0].title).toBe('真实已有岗位');
    expect(seeded.candidateLeads.length).toBeGreaterThan(0);
    expect(seeded.modelApis.length).toBeGreaterThan(0);
    expect(seeded.integrationMappings.length).toBeGreaterThan(0);
    expect(seeded.reportActions.length).toBeGreaterThan(0);
    expect(seeded.auditLogs.length).toBeGreaterThan(0);
  });

  it('keeps every persisted business module non-empty after MVP seeding', () => {
    const seeded = buildMvpSeedData(emptyData);
    const requiredCollections: Array<[keyof AppData, unknown[]]> = [
      ['jobs', seeded.jobs],
      ['accounts', seeded.accounts],
      ['contents', seeded.contents],
      ['contentVersions', seeded.contentVersions],
      ['reviewComments', seeded.reviewComments],
      ['assets', seeded.assets],
      ['goals', seeded.goals],
      ['reports', seeded.reports],
      ['entries', seeded.entries],
      ['beisenResults', seeded.beisenResults],
      ['integrations', seeded.integrations],
      ['integrationSyncRuns', seeded.integrationSyncRuns],
      ['modelApis', seeded.modelApis],
      ['landingPages', seeded.landingPages],
      ['landingLeads', seeded.landingLeads],
      ['roles', seeded.roles],
      ['users', seeded.users],
      ['workflowRules', seeded.workflowRules],
      ['sensitiveRules', seeded.sensitiveRules],
      ['costs', seeded.costs],
      ['notifications', seeded.notifications],
      ['auditLogs', seeded.auditLogs],
      ['integrationMappings', seeded.integrationMappings],
      ['compliancePolicies', seeded.compliancePolicies],
      ['deploymentTasks', seeded.deploymentTasks],
      ['importRuns', seeded.importRuns],
      ['reportActions', seeded.reportActions],
      ['promptTemplates', seeded.promptTemplates],
      ['modelRunLogs', seeded.modelRunLogs],
      ['pluginRules', seeded.pluginRules],
      ['candidateLeads', seeded.candidateLeads],
      ['leadFollowUps', seeded.leadFollowUps],
      ['contentQualityScores', seeded.contentQualityScores],
      ['topics', seeded.topics],
      ['accountHealthSnapshots', seeded.accountHealthSnapshots],
      ['calendarMilestones', seeded.calendarMilestones],
      ['dataExplanations', seeded.dataExplanations],
      ['reviewMentions', seeded.reviewMentions],
    ];

    requiredCollections.forEach(([key, rows]) => {
      expect(rows.length, `${String(key)} should have MVP seed rows`).toBeGreaterThan(0);
    });
  });

  it('runs create/update/delete lifecycle for recruitment demand data', () => {
    const base = buildMvpSeedData(emptyData);
    const created: JobNeed = { ...base.jobs[0], id: 'life-job', title: '生命周期测试岗位' };
    const updated: JobNeed = { ...created, title: '生命周期测试岗位-已更新', status: '暂停' };
    const lifecycle = createUpdateDelete(base.jobs, created, updated);

    expect(lifecycle.afterCreate.some((item) => item.id === 'life-job')).toBe(true);
    expect(lifecycle.afterUpdate.find((item) => item.id === 'life-job')?.status).toBe('暂停');
    expect(lifecycle.afterDelete.some((item) => item.id === 'life-job')).toBe(false);
  });

  it('runs create/update/delete lifecycle for platform account and asset data', () => {
    const base = buildMvpSeedData(emptyData);
    const account: PlatformAccount = { ...base.accounts[0], id: 'life-account', name: '生命周期账号' };
    const accountLifecycle = createUpdateDelete(base.accounts, account, { ...account, status: '已停用' });
    const asset: AssetItem = { ...base.assets[0], id: 'life-asset', name: '生命周期素材' };
    const assetLifecycle = createUpdateDelete(base.assets, asset, { ...asset, authorization: '已授权', usageCount: 1 });

    expect(accountLifecycle.afterUpdate.find((item) => item.id === 'life-account')?.status).toBe('已停用');
    expect(accountLifecycle.afterDelete.some((item) => item.id === 'life-account')).toBe(false);
    expect(assetLifecycle.afterUpdate.find((item) => item.id === 'life-asset')?.usageCount).toBe(1);
    expect(assetLifecycle.afterDelete.some((item) => item.id === 'life-asset')).toBe(false);
  });

  it('runs create/update/delete lifecycle for candidate leads and keeps analytics drill usable', () => {
    const base = buildMvpSeedData(emptyData);
    const lead: CandidateLead = {
      id: 'life-lead',
      name: '生命周期候选人',
      contact: 'life@example.com',
      sourcePlatform: '小红书',
      sourceAccountId: 'acc-1',
      sourceContentId: 'ct-2',
      targetJobId: 'job-2',
      owner: '招聘专员A',
      stage: '待联系',
      beisenStatus: '待转入',
      note: 'E2E 生命周期样例',
      createdAt: '2026-05-26 10:00',
      updatedAt: '2026-05-26 10:00',
    };
    const updatedLead: CandidateLead = { ...lead, stage: '已联系', updatedAt: '2026-05-26 11:00' };
    const lifecycle = createUpdateDelete(base.candidateLeads, lead, updatedLead);
    const analytics = buildAnalyticsDrill({ ...base, candidateLeads: lifecycle.afterUpdate }, { dimension: 'platform', platform: '小红书', page: 1, pageSize: 10 });

    expect(lifecycle.afterCreate.some((item) => item.id === 'life-lead')).toBe(true);
    expect(lifecycle.afterUpdate.find((item) => item.id === 'life-lead')?.stage).toBe('已联系');
    expect(lifecycle.afterDelete.some((item) => item.id === 'life-lead')).toBe(false);
    expect(analytics.summary.views).toBeGreaterThan(0);
    expect(analytics.details.length).toBeGreaterThan(0);
  });
});
