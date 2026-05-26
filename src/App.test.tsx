import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from './App';
import { scanRisks } from './data';
import type { AppData } from './types';

beforeEach(() => {
  localStorage.clear();
});

describe('招聘运营助手', () => {
  it('renders the main dashboard metrics', () => {
    render(<App />);

    expect(screen.getByText('招聘新媒体运营中台')).toBeInTheDocument();
    expect(screen.getByText('内容发布数量')).toBeInTheDocument();
    expect(screen.getByText('招聘入口点击')).toBeInTheDocument();
    expect(screen.getByText('暂无真实运营目标')).toBeInTheDocument();
  });

  it('generates content and creates a new content task', async () => {
    const realData: AppData = {
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
      accounts: [],
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
    localStorage.setItem('hr-assistant-data-mode', 'real-v1');
    localStorage.setItem('hr-assistant-data', JSON.stringify(realData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /内容运营/ }));
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
});
