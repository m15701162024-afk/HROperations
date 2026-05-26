import { render, screen, within } from '@testing-library/react';
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

    expect(screen.getByText('今日招聘运营概览')).toBeInTheDocument();
    expect(screen.getByText('内容发布数量')).toBeInTheDocument();
    expect(screen.getByText('招聘入口点击')).toBeInTheDocument();
    expect(screen.getByText('我的工作')).toBeInTheDocument();
    expect(screen.getByText('补齐MVP样例数据')).toBeInTheDocument();
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

  it('runs candidate lead create/update/delete lifecycle from the GUI', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /线索池/ }));
    await user.type(screen.getByPlaceholderText('姓名/昵称'), '生命周期候选人');
    await user.type(screen.getByPlaceholderText('联系方式'), 'life-ui@example.com');
    await user.click(screen.getByRole('button', { name: /保存线索/ }));

    const row = screen.getByText('生命周期候选人').closest('tr');
    expect(row).not.toBeNull();
    await user.selectOptions(within(row as HTMLElement).getByDisplayValue('待联系'), '已联系');
    expect(within(row as HTMLElement).getByDisplayValue('已联系')).toBeInTheDocument();

    await user.click(within(row as HTMLElement).getByRole('button', { name: '删除' }));
    expect(screen.queryByText('生命周期候选人')).not.toBeInTheDocument();
  });

  it('runs recruitment demand create/update/delete lifecycle from the GUI', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /招聘需求/ }));
    await user.type(screen.getByPlaceholderText('岗位名称'), '生命周期测试招聘需求');
    await user.type(screen.getByPlaceholderText('JD / 岗位描述'), '负责招聘运营平台真实业务闭环。');
    await user.type(screen.getByPlaceholderText('候选人画像：年限、能力、关注点、求职顾虑'), '3-8 年运营或产品背景');
    await user.type(screen.getByPlaceholderText('岗位卖点，用顿号分隔'), '真实业务、增长空间');
    await user.click(screen.getByRole('button', { name: /保存岗位/ }));

    await user.click(screen.getByRole('button', { name: '岗位库' }));
    let row = screen.getByText('生命周期测试招聘需求').closest('tr');
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole('button', { name: '编辑' }));
    await user.clear(screen.getByPlaceholderText('岗位名称'));
    await user.type(screen.getByPlaceholderText('岗位名称'), '生命周期测试招聘需求-已更新');
    await user.click(screen.getByRole('button', { name: /保存编辑/ }));

    await user.click(screen.getByRole('button', { name: '岗位库' }));
    row = screen.getByText('生命周期测试招聘需求-已更新').closest('tr');
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole('button', { name: '删除' }));
    expect(screen.queryByText('生命周期测试招聘需求-已更新')).not.toBeInTheDocument();
  });

  it('runs asset create/update/delete lifecycle from the GUI', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /素材资产/ }));
    await user.type(screen.getByPlaceholderText('素材名称'), '生命周期测试素材');
    await user.click(screen.getByRole('button', { name: '保存' }));

    const row = screen.getAllByText('生命周期测试素材')
      .map((item) => item.closest('.asset-row'))
      .find(Boolean);
    expect(row).not.toBeNull();
    await user.selectOptions(within(row as HTMLElement).getByDisplayValue('待审核'), '已授权');
    expect(within(row as HTMLElement).getByDisplayValue('已授权')).toBeInTheDocument();

    await user.click(within(row as HTMLElement).getByRole('button', { name: '删除' }));
    expect(screen.queryByText('生命周期测试素材')).not.toBeInTheDocument();
  });
});
