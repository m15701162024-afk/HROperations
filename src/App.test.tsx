import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from './App';
import { scanRisks } from './data';
import type { AppData } from './types';

beforeEach(() => {
  localStorage.clear();
});

function makeRealContentData(accounts: AppData['accounts'] = []): AppData {
  return {
    jobs: [{
      id: 'real-job-1',
      title: '高级前端工程师',
      family: '前端',
      city: '杭州',
      level: '高级',
      type: '社招',
      jd: '负责招聘运营系统前端体验建设。',
      persona: '3-8 年前端工程师',
      sellingPoints: ['产品从 0 到 1', '技术挑战'],
      targetPlatforms: ['小红书'],
      status: '招聘中',
      beisenUrl: '',
      websiteUrl: '',
    }],
    accounts,
    contents: [],
    contentVersions: [],
    reviewComments: [],
    assets: [],
    goals: [],
    reports: [],
    entries: [],
    beisenResults: [],
    integrations: [],
    integrationSyncRuns: [],
    modelApis: [],
    landingPages: [],
    landingLeads: [],
    roles: [],
    users: [],
    workflowRules: [],
    sensitiveRules: [],
    costs: [],
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
      reviewSlaHours: 24,
      weeklyPlatformTargets: {},
    },
  };
}

describe('招聘运营助手', () => {
  it('renders the main dashboard metrics', () => {
    render(<App />);

    expect(screen.getByText('招聘内容运营指挥台')).toBeInTheDocument();
    expect(screen.getByText('招聘中岗位')).toBeInTheDocument();
    expect(screen.getByText('渠道点击')).toBeInTheDocument();
    expect(screen.getByText('内容工厂')).toBeInTheDocument();
    expect(screen.queryByText('补齐MVP样例数据')).not.toBeInTheDocument();
  });

  it('blocks content creation when no real platform account is connected', async () => {
    localStorage.setItem('hr-assistant-data-mode', 'real-v2-empty-platform-data');
    localStorage.setItem('hr-assistant-data', JSON.stringify(makeRealContentData()));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /内容工厂/ }));
    await user.click(screen.getByRole('button', { name: /生成平台内容/ }));

    expect(screen.getByText('请先在账号与平台同步真实平台账号')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保存为内容任务/ })).toBeDisabled();
  });

  it('generates content and creates a new content task', async () => {
    const realData = makeRealContentData([{
      id: 'acc-real-xhs',
      platform: '小红书',
      name: '真实小红书招聘号',
      externalId: 'xhs-real-001',
      integrationId: 'integration-xhs',
      provider: '小红书开放 API',
      status: '已连接',
      syncedAt: '2026-05-27 10:00',
    }]);
    localStorage.setItem('hr-assistant-data-mode', 'real-v2-empty-platform-data');
    localStorage.setItem('hr-assistant-data', JSON.stringify(realData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /内容工厂/ }));
    await user.click(screen.getByRole('button', { name: /生成平台内容/ }));
    expect(screen.getByDisplayValue(/内容初稿/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /保存为内容任务/ }));
    expect(screen.getAllByText(/小红书｜高级前端工程师内容初稿/).length).toBeGreaterThan(0);
  });

  it('detects high risk expressions', () => {
    const result = scanRisks('这里包含薪酬、奖金、算法、客户信息和转正承诺');

    expect(result.level).toBe('高');
    expect(result.risks.length).toBeGreaterThan(1);
  });

  it('creates a job brief inside the content factory', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /内容工厂/ }));
    await user.type(screen.getByPlaceholderText('岗位名称，例如 高级前端工程师'), '生命周期测试招聘需求');
    await user.type(screen.getByPlaceholderText('候选人画像/关注点'), '3-8 年运营或产品背景');
    await user.type(screen.getByPlaceholderText('岗位卖点，用顿号分隔'), '真实业务、增长空间');
    await user.click(screen.getByRole('button', { name: /保存简报/ }));

    expect(screen.getByDisplayValue('生命周期测试招聘需求')).toBeInTheDocument();
  });

  it('keeps slim navigation and moves planning into content operations', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole('button', { name: /招聘需求/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /线索池/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /系统配置/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /运营首页/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /内容工厂/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /渠道数据/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /连接配置/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /内容工厂/ }));
    expect(screen.getByRole('button', { name: '选题' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '排期' })).toBeInTheDocument();
  });
});
