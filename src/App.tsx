import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Filter,
  GitBranch,
  Home,
  Link,
  LockKeyhole,
  Megaphone,
  Bell,
  PieChart,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type ApiUser, createSystemBackup, loadRemoteData, loadSystemHealth, loginLocalApi, normalizeAppData, runIntegrationSync, runModelTask, saveRemoteData, sendIntegrationMessage, testIntegrationConfig, testModelApiConfig, uploadAssetFile } from './api';
import { emptyData, generateContent, nextStatus, platformPositioning, platforms, scanRisks } from './data';
import type { AccountType, AppData, AppSection, AssetItem, BeisenResult, CalendarMilestone, CandidateLead, CompliancePolicy, ContentReviewComment, ContentStatus, ContentTask, ContentVersion, CostRecord, DeploymentTask, IntegrationConfig, IntegrationMapping, IntegrationSyncRun, JobNeed, LandingPage, LandingPageLead, LeadFollowUp, ModelApiConfig, NotificationItem, OperationSettings, PermissionRole, Platform, PlatformAccount, RecruitmentEntry, ReportInsight, SensitiveRule, TaskItem, TopicItem, UserProfile, WorkflowRule } from './types';
import type { ImportRun, ModelRunLog, PluginRule, PromptTemplate, ReportAction, ReviewMention } from './types';
import { applyMetricsCsv, buildDataExplanations, buildPlatformStrategy, buildRecommendations, buildReportMarkdown, calculateAccountHealth, calculateRoi, deriveTasks, detectCalendarConflicts, downloadText, exportJson, findDuplicateLead, generateTopicsFromJob, parseBeisenCsv, parseJobCsv, parseLeadCsv, readJsonFile, scoreContentQuality, toCsv } from './utils';

type Section = AppSection;

const navItems: { key: Section; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: '工作台', icon: Home },
  { key: '招聘需求', icon: ClipboardList },
  { key: '选题库', icon: Sparkles },
  { key: '内容运营', icon: Megaphone },
  { key: '排期日历', icon: Target },
  { key: '线索池', icon: Users },
  { key: '素材资产', icon: Database },
  { key: '账号与平台', icon: Users },
  { key: '导入中心', icon: Database },
  { key: '数据分析', icon: BarChart3 },
  { key: '复盘报告', icon: BookOpen },
  { key: 'AI工作台', icon: Bot },
  { key: '系统配置', icon: Settings },
];

const contentTypes = ['岗位种草', '技术团队内容', '员工故事', '公司/业务介绍', '面试/求职干货', '短视频脚本', '图文笔记', '长文', '校招内容'];
const sectionPermissions: Record<Section, string> = {
  工作台: '工作台查看',
  招聘需求: '岗位查看',
  选题库: '内容创建',
  内容运营: '内容查看',
  排期日历: '内容查看',
  线索池: '岗位查看',
  素材资产: '素材查看',
  账号与平台: '账号查看',
  导入中心: '数据导入',
  数据分析: '数据查看',
  复盘报告: '复盘查看',
  AI工作台: 'AI配置',
  系统配置: '系统配置',
};

function isLegacyDemoData(data: Partial<AppData>) {
  const demoJobIds = new Set(['job-1', 'job-2', 'job-3']);
  const demoContentIds = new Set(['ct-1', 'ct-2', 'ct-3']);
  return Boolean(
    data.jobs?.some((job) => demoJobIds.has(job.id))
    || data.contents?.some((content) => demoContentIds.has(content.id))
    || data.auditLogs?.some((log) => log.action === '初始化种子数据'),
  );
}

function useAppData() {
  const [storageMode, setStorageMode] = useState<'本地缓存' | '本地API'>('本地缓存');
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [authError, setAuthError] = useState('');
  const [apiToken, setApiToken] = useState(() => localStorage.getItem('hr-assistant-api-token') ?? '');
  const saveQueue = useRef(Promise.resolve(false));
  const [data, setData] = useState<AppData>(() => {
    const mode = localStorage.getItem('hr-assistant-data-mode');
    if (mode !== 'real-v1') {
      localStorage.setItem('hr-assistant-data-mode', 'real-v1');
      localStorage.setItem('hr-assistant-data', JSON.stringify(emptyData));
      return emptyData;
    }
    const stored = localStorage.getItem('hr-assistant-data');
    if (!stored) return emptyData;
    const parsed = JSON.parse(stored) as Partial<AppData>;
    if (isLegacyDemoData(parsed)) {
      localStorage.setItem('hr-assistant-data', JSON.stringify(emptyData));
      return emptyData;
    }
    return normalizeAppData(parsed);
  });

  useEffect(() => {
    let active = true;
    void loadRemoteData(apiToken).then((remote) => {
      if (!active) return;
      if (remote.status === 'unauthorized') {
        setAuthRequired(true);
        setStorageMode('本地缓存');
        return;
      }
      if (remote.status !== 'ok') return;
      setData(remote.data);
      setApiUser(remote.user ?? null);
      setAuthRequired(false);
      setStorageMode('本地API');
      localStorage.setItem('hr-assistant-data-mode', 'real-v1');
      localStorage.setItem('hr-assistant-data', JSON.stringify(remote.data));
    });
    return () => {
      active = false;
    };
  }, [apiToken]);

  const update = (next: AppData) => {
    setData(next);
    localStorage.setItem('hr-assistant-data-mode', 'real-v1');
    localStorage.setItem('hr-assistant-data', JSON.stringify(next));
    saveQueue.current = saveQueue.current.then(() => saveRemoteData(next, apiToken), () => saveRemoteData(next, apiToken));
    void saveQueue.current.then((saved) => {
      if (saved) setStorageMode('本地API');
    });
  };

  const login = async (username: string, password: string) => {
    setAuthError('');
    try {
      const result = await loginLocalApi(username, password);
      localStorage.setItem('hr-assistant-api-token', result.token);
      setApiToken(result.token);
      setApiUser(result.user);
      setAuthRequired(false);
    } catch {
      setAuthError('账号或密码不正确');
    }
  };

  const logout = () => {
    localStorage.removeItem('hr-assistant-api-token');
    setApiToken('');
    setApiUser(null);
    setAuthRequired(true);
    setStorageMode('本地缓存');
  };

  const audit = (action: string, target: string, nextData?: AppData) => {
    const base = nextData ?? data;
    update({
      ...base,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actor: '当前用户',
          action,
          target,
          createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        },
        ...base.auditLogs,
      ],
    });
  };

  const resetData = () => {
    update(emptyData);
  };

  return { data, update, audit, resetData, storageMode, apiUser, apiToken, authRequired, authError, login, logout };
}

function StatCard({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <section className="stat-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      <Icon size={22} />
    </section>
  );
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'info' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <Database size={22} />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function makeNotification(title: string, body: string, targetSection: string, level: NotificationItem['level'] = '提醒'): NotificationItem {
  return {
    id: `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    body,
    targetSection,
    level,
    read: false,
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  };
}

function getConfiguredNextStatus(content: ContentTask, rules: WorkflowRule[]) {
  const riskOrder = { 低: 1, 中: 2, 高: 3 };
  const rule = rules.find((item) => item.enabled
    && (item.platform === '全部' || item.platform === content.platform)
    && (item.contentType === '全部' || item.contentType === content.type)
    && riskOrder[content.riskLevel] >= riskOrder[item.minRiskLevel]);
  if (!rule) return nextStatus(content.status);
  const index = rule.steps.indexOf(content.status);
  if (index < 0 || index === rule.steps.length - 1) return nextStatus(content.status);
  return rule.steps[index + 1];
}

function Progress({ current, target }: { current: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="progress" aria-label={`完成度 ${percent}%`}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function LoginScreen({ onLogin, error }: { onLogin: (username: string, password: string) => Promise<void>; error: string }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    await onLogin(username, password);
    setLoading(false);
  };

  return (
    <div className="login-page">
      <form className="login-panel" onSubmit={(event) => void submit(event)}>
        <div className="brand login-brand">
          <div><Sparkles size={22} /></div>
          <span>招聘运营助手</span>
        </div>
        <h1>登录本地工作台</h1>
        <p>本地 API 已启用，请登录后继续使用真实数据工作区。</p>
        <label>
          账号
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button className="full" type="submit" disabled={loading}>{loading ? '登录中' : '登录'}</button>
        <small>本地账号：admin。首次创建管理员时需通过 HR_ASSISTANT_ADMIN_PASSWORD 设置初始密码。</small>
      </form>
    </div>
  );
}

function Dashboard({ data, audit, openSection }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void; openSection: (section: Section) => void }) {
  const [goal, setGoal] = useState({ title: '', dimension: '平台', target: 0, current: 0, metric: '发布篇数' });
  const [drilldown, setDrilldown] = useState<'内容' | '曝光' | '互动' | '点击' | ''>('');
  const [taskFilter, setTaskFilter] = useState<'全部' | TaskItem['type']>('全部');
  const tasks = useMemo(() => deriveTasks(data), [data]);
  const visibleTasks = tasks.filter((task) => taskFilter === '全部' || task.type === taskFilter);
  const totals = useMemo(() => {
    const published = data.contents.filter((item) => item.status === '已发布' || item.status === '数据回收中' || item.status === '已复盘').length;
    const views = data.contents.reduce((sum, item) => sum + item.metrics.views, 0);
    const interactions = data.contents.reduce((sum, item) => sum + item.metrics.likes + item.metrics.comments + item.metrics.saves + item.metrics.shares, 0);
    const clicks = data.contents.reduce((sum, item) => sum + item.metrics.clicks, 0);
    return { published, views, interactions, clicks };
  }, [data.contents]);

  const createGoal = () => {
    if (!goal.title.trim()) return;
    const item = {
      id: `goal-${Date.now()}`,
      title: goal.title,
      dimension: goal.dimension,
      target: Number(goal.target) || 0,
      current: Number(goal.current) || 0,
      metric: goal.metric,
      status: '进行中' as const,
    };
    audit('创建运营目标', item.title, { ...data, goals: [item, ...data.goals] });
    setGoal({ title: '', dimension: '平台', target: 0, current: 0, metric: '发布篇数' });
  };

  const removeGoal = (id: string) => {
    const target = data.goals.find((item) => item.id === id);
    audit('删除运营目标', target?.title ?? id, { ...data, goals: data.goals.filter((item) => item.id !== id) });
  };
  const assetWarnings = data.assets.filter((asset) => {
    if (!asset.expiresAt) return false;
    const days = Math.ceil((new Date(asset.expiresAt).getTime() - Date.now()) / 86400000);
    return days <= 30;
  });
  const pendingNotices = [
    ...data.notifications.filter((notice) => !notice.read),
    ...assetWarnings.map((asset) => makeNotification('素材授权即将到期', `${asset.name} 有效期至 ${asset.expiresAt}`, '素材资产', '预警')),
    ...data.contents.filter((content) => content.riskLevel === '高').map((content) => makeNotification('高风险内容待审核', content.title, '内容运营', '待办')),
  ].slice(0, 8);
  const markNoticeRead = (id: string) => {
    audit('标记通知已读', id, { ...data, notifications: data.notifications.map((notice) => notice.id === id ? { ...notice, read: true } : notice) });
  };
  const markAllNoticesRead = () => {
    audit('批量标记通知已读', `${data.notifications.filter((notice) => !notice.read).length} 条`, { ...data, notifications: data.notifications.map((notice) => ({ ...notice, read: true })) });
  };
  const completeTask = (taskId: string) => {
    audit('完成工作台任务', taskId, { ...data, taskCompletions: [...new Set([...data.taskCompletions, taskId])] });
  };

  return (
    <div className="page-grid">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">招聘新媒体运营中台</span>
          <h1>从 JD 到内容、审核、发布、归因和复盘的一条链路</h1>
          <p>当前版本覆盖 PRD 中的一期核心闭环：岗位需求、AI 生成、风险识别、排期发布、数据看板、素材与账号权限、复盘沉淀。</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => openSection('内容运营')}><Sparkles size={16} />生成内容</button>
          <button className="secondary" onClick={() => openSection('数据分析')}><BarChart3 size={16} />查看看板</button>
        </div>
      </div>

      <div className="stats-row">
        <button className="stat-button" onClick={() => setDrilldown(drilldown === '内容' ? '' : '内容')}><StatCard label="内容发布数量" value={totals.published} note="已发布/回收/复盘" icon={FileText} /></button>
        <button className="stat-button" onClick={() => setDrilldown(drilldown === '曝光' ? '' : '曝光')}><StatCard label="曝光/阅读/播放" value={totals.views.toLocaleString()} note="全平台合计" icon={Rocket} /></button>
        <button className="stat-button" onClick={() => setDrilldown(drilldown === '互动' ? '' : '互动')}><StatCard label="互动量" value={totals.interactions.toLocaleString()} note="赞评藏转合计" icon={PieChart} /></button>
        <button className="stat-button" onClick={() => setDrilldown(drilldown === '点击' ? '' : '点击')}><StatCard label="招聘入口点击" value={totals.clicks.toLocaleString()} note="北森/官网跳转前" icon={Link} /></button>
      </div>
      {drilldown && (
        <section className="panel wide">
          <div className="panel-title"><h2>{drilldown}数据下钻</h2><BarChart3 size={18} /></div>
          <div className="entry-grid">
            {platforms.map((platform) => {
              const contents = data.contents.filter((item) => item.platform === platform);
              const views = contents.reduce((sum, item) => sum + item.metrics.views, 0);
              const clicks = contents.reduce((sum, item) => sum + item.metrics.clicks, 0);
              const interactions = contents.reduce((sum, item) => sum + item.metrics.likes + item.metrics.comments + item.metrics.saves + item.metrics.shares, 0);
              return (
                <article key={platform}>
                  <strong>{platform}</strong>
                  <span>{contents.length} 内容 · {views} 曝光 · {interactions} 互动 · {clicks} 点击</span>
                  <button className="ghost" onClick={() => openSection('数据分析')}>进入平台分析</button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel wide">
        <div className="panel-title">
          <h2>今日任务中心</h2>
          <ClipboardList size={18} />
        </div>
        <div className="module-tabs">
          {(['全部', '待发布', '待审核', '数据待回收', '高风险待处理', '素材授权到期', '线索待跟进', '账号停更'] as const).map((item) => (
            <button key={item} className={taskFilter === item ? 'active' : ''} onClick={() => setTaskFilter(item)}>{item}</button>
          ))}
        </div>
        <div className="task-summary-grid">
          <div><span>待处理</span><b>{tasks.length}</b></div>
          <div><span>高优先级</span><b>{tasks.filter((task) => task.priority === '高').length}</b></div>
          <div><span>线索待跟进</span><b>{tasks.filter((task) => task.type === '线索待跟进').length}</b></div>
          <div><span>审核/发布</span><b>{tasks.filter((task) => task.type === '待审核' || task.type === '待发布').length}</b></div>
        </div>
        {visibleTasks.length === 0 && <EmptyState title="暂无待处理任务" body="当内容、线索、素材、账号出现待办时会自动进入这里。" />}
        <div className="task-list">
          {visibleTasks.map((task) => (
            <div className="task-row" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <span>{task.body}</span>
                <small>{task.owner || '未分配'} · {task.dueDate || '无截止日期'}</small>
              </div>
              <div className="row-actions">
                <Badge tone={task.priority === '高' ? 'danger' : task.priority === '中' ? 'warn' : 'info'}>{task.priority}</Badge>
                <button className="ghost" onClick={() => openSection(task.targetSection)}>处理</button>
                <button className="ghost" onClick={() => completeTask(task.id)}>完成</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <h2>通知中心</h2>
          <Bell size={18} />
        </div>
        <div className="toolbar-actions compact-actions">
          <button className="ghost" onClick={markAllNoticesRead}>全部已读</button>
        </div>
        {pendingNotices.length === 0 && <EmptyState title="暂无待办通知" body="高风险内容、素材授权到期、审核流待办会在这里汇总。" />}
        <div className="notice-list">
          {pendingNotices.map((notice) => (
            <div className="compact-row" key={notice.id}>
              <div><strong>{notice.title}</strong><span>{notice.body}</span></div>
              <div className="row-actions">
                <Badge tone={notice.level === '预警' ? 'danger' : notice.level === '待办' ? 'warn' : 'info'}>{notice.level}</Badge>
                {navItems.some((item) => item.key === notice.targetSection) && <button className="ghost" onClick={() => openSection(notice.targetSection as Section)}>处理</button>}
                {data.notifications.some((item) => item.id === notice.id) && <button className="ghost" onClick={() => markNoticeRead(notice.id)}>已读</button>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <h2>运营目标进度</h2>
          <Target size={18} />
        </div>
        <div className="inline-form">
          <input value={goal.title} onChange={(event) => setGoal({ ...goal, title: event.target.value })} placeholder="目标名称" />
          <input value={goal.dimension} onChange={(event) => setGoal({ ...goal, dimension: event.target.value })} placeholder="目标维度" />
          <input value={goal.metric} onChange={(event) => setGoal({ ...goal, metric: event.target.value })} placeholder="指标名称" />
          <input type="number" value={goal.target} onChange={(event) => setGoal({ ...goal, target: Number(event.target.value) })} placeholder="目标值" />
          <button onClick={createGoal}><Plus size={16} />保存目标</button>
        </div>
        <div className="goal-list">
          {data.goals.length === 0 && <EmptyState title="暂无真实运营目标" body="请先录入目标或导入真实排期数据，当前进度按 0 计算。" />}
          {data.goals.map((goal) => (
            <article key={goal.id} className="goal-item">
              <div>
                <strong>{goal.title}</strong>
                <span>{goal.dimension} · {goal.metric}</span>
              </div>
              <Progress current={goal.current} target={goal.target} />
              <b>{goal.current}/{goal.target}</b>
              <button className="ghost" onClick={() => removeGoal(goal.id)}>删除</button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>高风险待办</h2>
          <AlertTriangle size={18} />
        </div>
        {data.contents.filter((item) => item.riskLevel === '高').length === 0 && <EmptyState title="暂无高风险待办" body="没有内容数据时高风险数量为 0；录入内容后系统会自动扫描。" />}
        {data.contents.filter((item) => item.riskLevel === '高').map((item) => (
          <div className="compact-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.platform} · {item.status}</span>
            </div>
            <Badge tone="danger">高风险</Badge>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>自动复盘建议</h2>
          <Bot size={18} />
        </div>
        {data.reports.length === 0 && <EmptyState title="暂无复盘建议" body="导入平台数据或录入内容指标后，可生成真实周报和运营建议。" />}
        {data.reports.map((report) => (
          <div className="insight" key={report.id}>
            <Badge tone={report.severity === '机会' ? 'good' : report.severity === '风险' ? 'danger' : 'info'}>{report.severity}</Badge>
            <strong>{report.title}</strong>
            <p>{report.action}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

const emptyJob: Omit<JobNeed, 'id' | 'sellingPoints' | 'targetPlatforms' | 'status'> & { sellingPoints: string; targetPlatforms: string } = {
  title: '',
  family: '后端',
  city: '杭州',
  level: '中高级',
  type: '社招',
  jd: '',
  persona: '',
  sellingPoints: '',
  targetPlatforms: '小红书、脉脉',
  beisenUrl: '',
  websiteUrl: '',
};

function Jobs({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [form, setForm] = useState(emptyJob);
  const [csv, setCsv] = useState('');
  const [editingId, setEditingId] = useState('');
  const [detailId, setDetailId] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [closeReason, setCloseReason] = useState('');
  const [activePanel, setActivePanel] = useState<'录入岗位' | '批量导入' | '岗位库'>('录入岗位');

  const createJob = () => {
    if (!form.title.trim()) return;
    const job: JobNeed = {
      ...form,
      id: `job-${Date.now()}`,
      sellingPoints: form.sellingPoints.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean),
      targetPlatforms: form.targetPlatforms.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean) as Platform[],
      status: '招聘中',
    };
    audit('创建岗位需求', job.title, { ...data, jobs: [job, ...data.jobs] });
    setForm(emptyJob);
  };

  const importJobs = () => {
    const jobs = parseJobCsv(csv);
    if (jobs.length === 0) return;
    audit('导入岗位需求', `${jobs.length} 条`, { ...data, jobs: [...jobs, ...data.jobs] });
    setCsv('');
  };

  const exportJobs = () => {
    downloadText('招聘需求.csv', toCsv(data.jobs.map((job) => ({
      title: job.title,
      family: job.family,
      city: job.city,
      level: job.level,
      type: job.type,
      targetPlatforms: job.targetPlatforms.join('、'),
      status: job.status,
      beisenUrl: job.beisenUrl,
      websiteUrl: job.websiteUrl,
    }))), 'text/csv;charset=utf-8');
  };

  const removeJob = (id: string) => {
    const target = data.jobs.find((job) => job.id === id);
    audit('删除岗位需求', target?.title ?? id, {
      ...data,
      jobs: data.jobs.filter((job) => job.id !== id),
      contents: data.contents.filter((content) => content.jobId !== id),
    });
  };
  const startEditJob = (job: JobNeed) => {
    setEditingId(job.id);
    setActivePanel('录入岗位');
    setForm({
      title: job.title,
      family: job.family,
      city: job.city,
      level: job.level,
      type: job.type,
      jd: job.jd,
      persona: job.persona,
      sellingPoints: job.sellingPoints.join('、'),
      targetPlatforms: job.targetPlatforms.join('、'),
      beisenUrl: job.beisenUrl,
      websiteUrl: job.websiteUrl,
    });
  };
  const saveJobEdit = () => {
    const target = data.jobs.find((job) => job.id === editingId);
    if (!target || !form.title.trim()) return;
    const nextJob: JobNeed = {
      ...target,
      ...form,
      sellingPoints: form.sellingPoints.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean),
      targetPlatforms: form.targetPlatforms.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean) as Platform[],
    };
    audit('编辑岗位需求', nextJob.title, { ...data, jobs: data.jobs.map((job) => job.id === editingId ? nextJob : job) });
    setEditingId('');
    setForm(emptyJob);
  };
  const toggleJobStatus = (id: string, status: JobNeed['status']) => {
    const target = data.jobs.find((job) => job.id === id);
    audit('更新岗位状态', `${target?.title ?? id}：${status}`, {
      ...data,
      jobs: data.jobs.map((job) => job.id === id ? { ...job, status } : job),
    });
  };
  const toggleSelectJob = (id: string) => {
    setSelectedJobIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const batchUpdateJobStatus = (status: JobNeed['status']) => {
    if (selectedJobIds.length === 0) return;
    audit('批量更新岗位状态', `${selectedJobIds.length} 个岗位：${status}${closeReason ? `，原因：${closeReason}` : ''}`, {
      ...data,
      jobs: data.jobs.map((job) => selectedJobIds.includes(job.id) ? { ...job, status } : job),
      notifications: [
        makeNotification('岗位批量状态更新', `${selectedJobIds.length} 个岗位已更新为 ${status}${closeReason ? `，原因：${closeReason}` : ''}`, '招聘需求', '提醒'),
        ...data.notifications,
      ],
    });
    setSelectedJobIds([]);
    setCloseReason('');
  };
  const duplicateJob = (job: JobNeed) => {
    const copy: JobNeed = {
      ...job,
      id: `job-${Date.now()}`,
      title: `${job.title}（复制）`,
      status: '招聘中',
    };
    audit('复制岗位需求', copy.title, { ...data, jobs: [copy, ...data.jobs] });
  };

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>招聘需求</h1>
          <p>手动创建、表格导入与后续北森同步的岗位需求源头。</p>
        </div>
        <button onClick={exportJobs}><FileText size={16} />导出岗位CSV</button>
      </section>
      <section className="panel wide">
        <div className="module-tabs">
          {(['录入岗位', '批量导入', '岗位库'] as const).map((item) => (
            <button key={item} className={activePanel === item ? 'active' : ''} onClick={() => setActivePanel(item)}>{item}</button>
          ))}
        </div>
      </section>
      {activePanel === '录入岗位' && <section className="panel wide">
        <div className="panel-title"><h2>新增岗位需求</h2><Plus size={18} /></div>
        <div className="form-grid">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="岗位名称" />
          <input value={form.family} onChange={(event) => setForm({ ...form, family: event.target.value })} placeholder="岗位族群" />
          <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="城市" />
          <input value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} placeholder="岗位层级" />
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as JobNeed['type'] })}>
            <option>社招</option>
            <option>校招</option>
            <option>实习</option>
            <option>职能</option>
          </select>
          <input value={form.targetPlatforms} onChange={(event) => setForm({ ...form, targetPlatforms: event.target.value })} placeholder="目标平台，用顿号分隔" />
          <textarea value={form.jd} onChange={(event) => setForm({ ...form, jd: event.target.value })} placeholder="JD / 岗位描述" />
          <textarea value={form.persona} onChange={(event) => setForm({ ...form, persona: event.target.value })} placeholder="候选人画像：年限、能力、关注点、求职顾虑" />
          <textarea value={form.sellingPoints} onChange={(event) => setForm({ ...form, sellingPoints: event.target.value })} placeholder="岗位卖点，用顿号分隔" />
          <input value={form.beisenUrl} onChange={(event) => setForm({ ...form, beisenUrl: event.target.value })} placeholder="北森岗位链接" />
          <input value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="官网招聘链接" />
        </div>
        <div className="card-actions-inline">
          <button className="full" onClick={editingId ? saveJobEdit : createJob}><Plus size={16} />{editingId ? '保存编辑' : '保存岗位'}</button>
          {editingId && <button className="secondary" onClick={() => { setEditingId(''); setForm(emptyJob); }}>取消编辑</button>}
        </div>
      </section>}
      {activePanel === '批量导入' && <section className="panel wide">
        <div className="panel-title"><h2>CSV 导入</h2><Database size={18} /></div>
        <p className="helper">支持字段：title/family/city/level/type/jd/persona/sellingPoints/targetPlatforms，或中文表头。</p>
        <textarea className="small-textarea" value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="title,family,city&#10;高级前端,前端,杭州" />
        <button className="full" onClick={importJobs}><Database size={16} />解析并导入</button>
      </section>}
      {activePanel === '岗位库' && <section className="panel wide">
        <div className="inline-form">
          <input value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="批量暂停/关闭原因，可选" />
          <button className="secondary" onClick={() => batchUpdateJobStatus('招聘中')}>批量开启</button>
          <button className="ghost" onClick={() => batchUpdateJobStatus('暂停')}>批量暂停</button>
          <button className="ghost" onClick={() => batchUpdateJobStatus('关闭')}>批量关闭</button>
          <Badge tone="info">已选 {selectedJobIds.length}</Badge>
        </div>
        <table>
          <thead>
            <tr>
              <th>选择</th>
              <th>岗位</th>
              <th>族群</th>
              <th>层级</th>
              <th>目标平台</th>
              <th>状态</th>
              <th>入口</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.jobs.length === 0 && (
              <tr>
                <td colSpan={8}><EmptyState title="暂无真实岗位需求" body="请通过上方表单录入，或粘贴 CSV 批量导入。" /></td>
              </tr>
            )}
            {data.jobs.map((job) => (
              <tr key={job.id}>
                <td><input type="checkbox" checked={selectedJobIds.includes(job.id)} onChange={() => toggleSelectJob(job.id)} /></td>
                <td>
                  <strong>{job.title}</strong>
                  <span>{job.persona}</span>
                </td>
                <td>{job.family}</td>
                <td>{job.level}</td>
                <td>{job.targetPlatforms.join(' / ')}</td>
                <td><Badge tone={job.status === '招聘中' ? 'good' : job.status === '暂停' ? 'warn' : 'neutral'}>{job.status}</Badge></td>
                <td><Badge tone="info">北森/官网</Badge></td>
                <td>
                  <div className="row-actions">
                    <button className="ghost" onClick={() => setDetailId(detailId === job.id ? '' : job.id)}>详情</button>
                    <button className="ghost" onClick={() => startEditJob(job)}>编辑</button>
                    <button className="ghost" onClick={() => duplicateJob(job)}>复制</button>
                    <button className="ghost" onClick={() => toggleJobStatus(job.id, job.status === '招聘中' ? '暂停' : '招聘中')}>{job.status === '招聘中' ? '暂停' : '开启'}</button>
                    <button className="ghost" onClick={() => removeJob(job.id)}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {detailId && data.jobs.filter((job) => job.id === detailId).map((job) => (
          <div className="detail-panel" key={job.id}>
            <strong>{job.title}</strong>
            <div className="template-grid">
              <div className="template-chip">岗位基础<small>{job.city} · {job.type} · {job.family} · {job.level}</small></div>
              <div className="template-chip">内容覆盖<small>{data.contents.filter((content) => content.jobId === job.id).length} 条内容 · {job.targetPlatforms.join('、')}</small></div>
              <div className="template-chip">北森回流<small>{data.beisenResults.filter((result) => result.jobId === job.id).length} 条候选人结果</small></div>
            </div>
            <p>{job.jd || '暂无 JD'}</p>
            <span>候选人画像：{job.persona || '未填写'}</span>
            <span>岗位卖点：{job.sellingPoints.join('、') || '未填写'}</span>
            <span>北森入口：{job.beisenUrl || '未配置'} · 官网入口：{job.websiteUrl || '未配置'}</span>
            <div className="card-actions-inline">
              <button className="secondary" onClick={() => startEditJob(job)}>编辑当前岗位</button>
              <button className="ghost" onClick={() => downloadText(`${job.title}-内容简报.md`, `# ${job.title}\n\n## JD\n${job.jd}\n\n## 候选人画像\n${job.persona}\n\n## 岗位卖点\n${job.sellingPoints.join('、')}`, 'text/markdown;charset=utf-8')}>导出岗位简报</button>
            </div>
          </div>
        ))}
      </section>}
    </div>
  );
}

function findModelApi(data: AppData, purpose: ModelApiConfig['enabledFor'][number]) {
  return data.modelApis.find((item) => item.enabledFor.includes(purpose) && item.status === '已连接')
    ?? data.modelApis.find((item) => item.enabledFor.includes(purpose));
}

function compareVersionText(current: string, previous?: string) {
  if (!previous) return '暂无上一版本可对比';
  const currentLines = current.split('\n').map((line) => line.trim()).filter(Boolean);
  const previousLines = previous.split('\n').map((line) => line.trim()).filter(Boolean);
  const previousSet = new Set(previousLines);
  const currentSet = new Set(currentLines);
  const added = currentLines.filter((line) => !previousSet.has(line)).slice(0, 3);
  const removed = previousLines.filter((line) => !currentSet.has(line)).slice(0, 3);
  const addedText = added.length > 0 ? `新增：${added.join(' / ')}` : '无新增段落';
  const removedText = removed.length > 0 ? `删除：${removed.join(' / ')}` : '无删除段落';
  return `${addedText}；${removedText}`;
}

function normalizeRemoteRows(data: unknown): Record<string, string | number | boolean | undefined>[] {
  if (Array.isArray(data)) return data as Record<string, string | number | boolean | undefined>[];
  if (typeof data === 'object' && data !== null && Array.isArray((data as { records?: unknown[] }).records)) {
    return (data as { records: Record<string, string | number | boolean | undefined>[] }).records;
  }
  if (typeof data === 'object' && data !== null && Array.isArray((data as { metrics?: unknown[] }).metrics)) {
    return (data as { metrics: Record<string, string | number | boolean | undefined>[] }).metrics;
  }
  return [];
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function safeJsonObject(text: string) {
  const parsed = safeParseJson(text);
  return typeof parsed === 'object' && parsed !== null && !('raw' in parsed) ? parsed : {};
}

function nowText() {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

function daysUntil(date: string) {
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function integrationExtra(integration: IntegrationConfig) {
  const parsed = integration.extraConfig ? safeParseJson(integration.extraConfig) : {};
  return typeof parsed === 'object' && parsed !== null ? parsed as { fields?: Record<string, string>; fieldMapping?: Record<string, string>; dedupeKey?: string } : {};
}

function integrationFieldMapping(extra: { fields?: Record<string, string>; fieldMapping?: Record<string, string> }) {
  return extra.fieldMapping ?? extra.fields;
}

function mappedValue(row: Record<string, string | number | boolean | undefined>, fields: Record<string, string> | undefined, key: string, fallback: string) {
  return row[fields?.[key] ?? key] ?? row[key] ?? row[fallback];
}

function ContentOps({ data, audit, apiToken }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void; apiToken?: string }) {
  const [jobId, setJobId] = useState(data.jobs[0]?.id ?? '');
  const [platform, setPlatform] = useState<Platform>('小红书');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [revisionDrafts, setRevisionDrafts] = useState<Record<string, string>>({});
  const [calendarView, setCalendarView] = useState<'周视图' | '月视图'>('月视图');
  const [scheduleDetailId, setScheduleDetailId] = useState('');
  const [publishChecks, setPublishChecks] = useState<Record<string, string[]>>({});

  const selectedJob = data.jobs.find((job) => job.id === jobId) ?? data.jobs[0];
  const risk = scanRisks(draft);
  const filtered = data.contents.filter((item) => item.title.includes(query) || item.platform.includes(query) || item.type.includes(query));
  const calendarItems = data.contents
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .reduce<Record<string, ContentTask[]>>((acc, item) => {
      const key = item.publishedAt ?? item.dueDate;
      acc[key] = [...(acc[key] ?? []), item];
      return acc;
    }, {});
  const platformPlans = platforms.map((item) => {
    const count = data.contents.filter((content) => content.platform === item).length;
    const target = item === 'B站' || item === '抖音' ? 1 : item === '公众号' || item === '知乎' || item === '技术社区' ? 2 : 3;
    return { platform: item, count, target };
  });
  const scheduleDetail = data.contents.find((item) => item.id === scheduleDetailId);

  const handleGenerate = async () => {
    if (!selectedJob) return;
    const model = findModelApi(data, '内容生成');
    if (model) {
      setAiStatus('正在调用大模型生成内容...');
      const result = await runModelTask(model, '内容生成', { job: selectedJob, platform }, apiToken);
      if (result.ok && result.text) {
        setDraft(result.text);
        setAiStatus(`已使用 ${model.name} 生成`);
        return;
      }
      setAiStatus(`模型调用失败，已回退本地模板：${result.message ?? '未知错误'}`);
    } else {
      setAiStatus('未配置内容生成模型，使用本地模板');
    }
    setDraft(generateContent(selectedJob, platform));
  };

  const handleCreateTask = async () => {
    if (!selectedJob || !draft.trim()) return;
    const accountId = data.accounts.find((acc) => acc.platform === platform)?.id ?? data.accounts[0]?.id ?? '';
    let scanned = scanRisks(draft);
    const riskModel = findModelApi(data, '风险识别');
    if (riskModel) {
      setAiStatus('正在调用大模型识别风险...');
      const result = await runModelTask(riskModel, '风险识别', { text: draft }, apiToken);
      if (result.ok && result.text) {
        try {
          const parsed = JSON.parse(result.text) as { level?: '低' | '中' | '高'; risks?: string[] };
          scanned = {
            level: parsed.level === '低' || parsed.level === '中' || parsed.level === '高' ? parsed.level : scanned.level,
            risks: Array.isArray(parsed.risks) ? parsed.risks : scanned.risks,
          };
          setAiStatus(`已使用 ${riskModel.name} 识别风险`);
        } catch {
          setAiStatus('模型风险识别返回格式不可解析，已回退本地规则');
        }
      } else {
        setAiStatus(`模型风险识别失败，已回退本地规则：${result.message ?? '未知错误'}`);
      }
    }
    const newTask: ContentTask = {
      id: `ct-${Date.now()}`,
      title: `${platform}｜${selectedJob.title}内容初稿`,
      jobId: selectedJob.id,
      platform,
      accountId,
      type: platform === 'B站' || platform === '抖音' ? '短视频脚本' : platform === '小红书' ? '岗位种草' : '技术/行业观点',
      status: 'AI已生成',
      owner: '招聘专员',
      reviewer: scanned.level === '高' ? 'HR负责人' : '招聘主管',
      dueDate: '2026-05-30',
      content: draft,
      tags: [selectedJob.family, selectedJob.level, platform],
      riskLevel: scanned.level,
      risks: scanned.risks,
      metrics: { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, clicks: 0 },
    };
    const version: ContentVersion = {
      id: `ver-${Date.now()}`,
      contentId: newTask.id,
      version: 1,
      body: draft,
      editor: '当前用户',
      changeNote: '创建 AI 初稿',
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    audit('创建内容任务', newTask.title, { ...data, contents: [newTask, ...data.contents], contentVersions: [version, ...data.contentVersions] });
  };

  const advance = (id: string) => {
    const target = data.contents.find((item) => item.id === id);
    if (!target) return;
    const status = getConfiguredNextStatus(target, data.workflowRules);
    audit('推进审核状态', target?.title ?? id, {
      ...data,
      contents: data.contents.map((item) => (item.id === id ? { ...item, status } : item)),
      notifications: [
        makeNotification('内容状态已更新', `${target.title} 已进入 ${status}`, '内容运营', '提醒'),
        ...data.notifications,
      ],
    });
  };

  const addReviewComment = (id: string, decision: ContentReviewComment['decision']) => {
    const target = data.contents.find((item) => item.id === id);
    const comment = reviewDrafts[id]?.trim();
    if (!target || !comment) return;
    const review: ContentReviewComment = {
      id: `rv-${Date.now()}`,
      contentId: id,
      reviewer: target.reviewer,
      stage: target.status,
      decision,
      comment,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    const mentionedNames = [...comment.matchAll(/@([\u4e00-\u9fa5A-Za-z0-9_-]+)/g)].map((match) => match[1]);
    const mentions: ReviewMention[] = mentionedNames.map((name) => ({
      id: `mention-${Date.now()}-${name}`,
      contentId: id,
      userId: name,
      commentId: review.id,
      read: false,
      createdAt: nowText(),
    }));
    const nextStatus: ContentStatus = decision === '驳回' ? '驳回修改' : target.status;
    audit(decision === '驳回' ? '驳回内容' : '提交审核意见', target.title, {
      ...data,
      contents: data.contents.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)),
      reviewComments: [review, ...data.reviewComments],
      reviewMentions: [...mentions, ...data.reviewMentions],
      notifications: [
        makeNotification('内容审核意见已记录', `${target.title}：${decision}`, '内容运营', decision === '驳回' ? '待办' : '提醒'),
        ...mentions.map((mention) => makeNotification('审核评论提到了你', `${target.title} @${mention.userId}`, '内容运营', '待办')),
        ...data.notifications,
      ],
    });
    setReviewDrafts({ ...reviewDrafts, [id]: '' });
  };

  const saveRevision = (id: string) => {
    const target = data.contents.find((item) => item.id === id);
    const body = revisionDrafts[id]?.trim();
    if (!target || !body || body === target.content) return;
    const versions = data.contentVersions.filter((version) => version.contentId === id);
    const nextVersionNumber = Math.max(0, ...versions.map((version) => version.version)) + 1;
    const scanned = scanRisks(body);
    const version: ContentVersion = {
      id: `ver-${Date.now()}`,
      contentId: id,
      version: nextVersionNumber,
      body,
      editor: '当前用户',
      changeNote: '根据审核意见修订',
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    audit('保存内容修订', target.title, {
      ...data,
      contents: data.contents.map((item) => (
        item.id === id
          ? { ...item, content: body, riskLevel: scanned.level, risks: scanned.risks, status: item.status === '驳回修改' ? '待专业审核' : item.status }
          : item
      )),
      contentVersions: [version, ...data.contentVersions],
    });
    setRevisionDrafts({ ...revisionDrafts, [id]: '' });
  };

  const publishContent = (id: string) => {
    const target = data.contents.find((item) => item.id === id);
    const latestScore = data.contentQualityScores.find((score) => score.contentId === id);
    if (latestScore && latestScore.total < data.operationSettings.contentQualityBlockScore) {
      audit('内容质量分阻断发布', `${target?.title ?? id}：${latestScore.total}分`, {
        ...data,
        notifications: [
          makeNotification('内容质量分过低', `${target?.title ?? id} 当前 ${latestScore.total} 分，低于阈值 ${data.operationSettings.contentQualityBlockScore}`, '内容运营', '预警'),
          ...data.notifications,
        ],
      });
      return;
    }
    const checks = publishChecks[id] ?? [];
    if (checks.length < 3) {
      audit('发布检查未通过', target?.title ?? id, {
        ...data,
        notifications: [
          makeNotification('发布检查未完成', `${target?.title ?? id} 需要完成合规、素材授权、入口配置检查`, '内容运营', '预警'),
          ...data.notifications,
        ],
      });
      return;
    }
    audit('标记内容已发布', target?.title ?? id, {
      ...data,
      contents: data.contents.map((item) => item.id === id ? { ...item, status: '已发布', publishedAt: new Date().toISOString().slice(0, 10) } : item),
    });
  };
  const togglePublishCheck = (id: string, check: string) => {
    setPublishChecks((current) => {
      const checks = current[id] ?? [];
      return { ...current, [id]: checks.includes(check) ? checks.filter((item) => item !== check) : [...checks, check] };
    });
  };

  const removeContent = (id: string) => {
    const target = data.contents.find((item) => item.id === id);
    audit('删除内容任务', target?.title ?? id, {
      ...data,
      contents: data.contents.filter((item) => item.id !== id),
      contentVersions: data.contentVersions.filter((version) => version.contentId !== id),
      reviewComments: data.reviewComments.filter((comment) => comment.contentId !== id),
    });
  };
  const updateContentField = (id: string, patch: Partial<ContentTask>) => {
    const target = data.contents.find((item) => item.id === id);
    if (!target) return;
    audit('编辑内容任务', target.title, {
      ...data,
      contents: data.contents.map((item) => item.id === id ? { ...item, ...patch } : item),
    });
  };
  const shiftContentDate = (id: string, days: number) => {
    const target = data.contents.find((item) => item.id === id);
    if (!target) return;
    const base = target.dueDate ? new Date(target.dueDate) : new Date();
    base.setDate(base.getDate() + days);
    updateContentField(id, { dueDate: base.toISOString().slice(0, 10) });
  };
  const duplicateContent = (id: string) => {
    const target = data.contents.find((item) => item.id === id);
    if (!target) return;
    const copy: ContentTask = {
      ...target,
      id: `ct-${Date.now()}`,
      title: `${target.title}（复制）`,
      status: '草稿',
      dueDate: new Date().toISOString().slice(0, 10),
      publishedAt: undefined,
      metrics: { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, clicks: 0 },
    };
    audit('复制内容任务', copy.title, { ...data, contents: [copy, ...data.contents] });
  };
  const runQualityScore = (id: string) => {
    const target = data.contents.find((item) => item.id === id);
    if (!target) return;
    const job = data.jobs.find((item) => item.id === target.jobId);
    const score = scoreContentQuality(target, job);
    audit('内容质量评分', `${target.title}：${score.total}分`, { ...data, contentQualityScores: [score, ...data.contentQualityScores] });
  };

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>内容运营</h1>
          <p>AI 多平台生成、风险识别、审核状态流转、排期发布一体管理。</p>
        </div>
        <div className="toolbar-actions">
          <button onClick={() => downloadText('内容指标导入模板.csv', 'contentId,title,views,likes,comments,saves,shares,clicks\\n', 'text/csv;charset=utf-8')}><FileText size={16} />下载指标模板</button>
          <div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索内容、平台、类型" /></div>
        </div>
      </section>

      <section className="panel generator">
        <div className="panel-title">
          <h2>AI 内容生成</h2>
          <Sparkles size={18} />
        </div>
        {data.jobs.length === 0 && <EmptyState title="请先录入真实岗位" body="AI 内容生成需要真实 JD、岗位卖点和目标平台作为输入。" />}
        <label>
          岗位需求
          <select value={jobId} onChange={(event) => setJobId(event.target.value)} disabled={data.jobs.length === 0}>
            {data.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
        </label>
        <label>
          目标平台
          <select value={platform} onChange={(event) => setPlatform(event.target.value as Platform)}>
            {platforms.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <div className="platform-note">{platformPositioning[platform]}</div>
        <button onClick={() => void handleGenerate()} disabled={data.jobs.length === 0}><Bot size={16} />生成平台内容</button>
        {aiStatus && <div className="platform-note"><Bot size={16} />{aiStatus}</div>}
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="生成或编辑内容初稿" />
        <div className="risk-box">
          <ShieldCheck size={16} />
          <span>风险等级：<b>{risk.level}</b></span>
          {risk.risks.length > 0 && <small>{risk.risks.join('；')}</small>}
        </div>
        <button className="full" onClick={() => void handleCreateTask()}><Plus size={16} />保存为内容任务</button>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <h2>排期日历</h2>
          <ClipboardList size={18} />
        </div>
        <div className="segmented">
          <button className={calendarView === '周视图' ? 'active' : ''} onClick={() => setCalendarView('周视图')}>周视图</button>
          <button className={calendarView === '月视图' ? 'active' : ''} onClick={() => setCalendarView('月视图')}>月视图</button>
        </div>
        <div className="template-grid frequency-grid">
          {platformPlans.map((plan) => (
            <div className="template-chip" key={plan.platform}>
              {plan.platform}
              <small>本期已排 {plan.count} 条 / 建议 {plan.target} 条{plan.count < plan.target ? '，需补排' : '，达标'}</small>
            </div>
          ))}
        </div>
        {Object.keys(calendarItems).length === 0 && <EmptyState title="暂无内容排期" body="生成内容任务后，会按截止日期和发布时间进入排期日历。" />}
        <div className={`calendar-grid ${calendarView === '周视图' ? 'week-mode' : ''}`}>
          {Object.entries(calendarItems).map(([date, items]) => (
            <article key={date} className="calendar-day">
              <strong>{date}</strong>
              {items.map((item) => (
                <div key={item.id} className="calendar-item">
                  <span>{item.platform} · {item.type}</span>
                  <b>{item.title}</b>
                  {daysUntil(item.dueDate) < 0 && item.status !== '已发布' && <Badge tone="danger">已逾期</Badge>}
                  <Badge tone={item.status === '已发布' ? 'good' : item.riskLevel === '高' ? 'danger' : 'info'}>{item.status}</Badge>
                  <button className="ghost" onClick={() => setScheduleDetailId(scheduleDetailId === item.id ? '' : item.id)}>下钻</button>
                  <div className="row-actions">
                    <button className="ghost" onClick={() => shiftContentDate(item.id, -1)}>前移</button>
                    <button className="ghost" onClick={() => shiftContentDate(item.id, 1)}>后移</button>
                  </div>
                  <input type="date" value={item.dueDate} onChange={(event) => updateContentField(item.id, { dueDate: event.target.value })} />
                </div>
              ))}
            </article>
          ))}
        </div>
        {scheduleDetail && (
          <div className="detail-panel">
            <strong>{scheduleDetail.title}</strong>
            <div className="template-grid">
              <div className="template-chip">内容状态<small>{scheduleDetail.status} · {scheduleDetail.riskLevel}风险</small></div>
              <div className="template-chip">协作信息<small>{scheduleDetail.owner} 负责 · {scheduleDetail.reviewer} 审核</small></div>
              <div className="template-chip">效果数据<small>{scheduleDetail.metrics.views} 曝光 · {scheduleDetail.metrics.clicks} 点击</small></div>
            </div>
            <p>{scheduleDetail.content}</p>
            <div className="checklist-row">
              {['合规已审', '素材已授权', '入口已配置'].map((check) => (
                <label key={check}><input type="checkbox" checked={(publishChecks[scheduleDetail.id] ?? []).includes(check)} onChange={() => togglePublishCheck(scheduleDetail.id, check)} />{check}</label>
              ))}
            </div>
            <div className="card-actions-inline">
              <button className="secondary" onClick={() => advance(scheduleDetail.id)}>推进审核</button>
              <button className="ghost" onClick={() => publishContent(scheduleDetail.id)}>标记发布</button>
              <button className="ghost" onClick={() => duplicateContent(scheduleDetail.id)}>复制任务</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <h2>内容任务与审核流</h2>
          <Filter size={18} />
        </div>
        <div className="content-list">
          {filtered.length === 0 && <EmptyState title="暂无真实内容任务" body="录入岗位后可生成内容任务；发布后的指标会进入看板。" />}
          {filtered.map((item) => {
            const versions = data.contentVersions
              .filter((version) => version.contentId === item.id)
              .sort((a, b) => b.version - a.version);
            const comments = data.reviewComments.filter((comment) => comment.contentId === item.id);
            const revisionText = revisionDrafts[item.id] ?? item.content;
            const qualityScore = data.contentQualityScores.find((score) => score.contentId === item.id);
            return (
            <article className="content-card" key={item.id}>
              <div>
                <div className="card-head">
                  <h3>{item.title}</h3>
                  <Badge tone={item.riskLevel === '高' ? 'danger' : item.riskLevel === '中' ? 'warn' : 'good'}>{item.riskLevel}风险</Badge>
                </div>
                <p>{item.content}</p>
                <div className="meta-line">
                  <span>{item.platform}</span>
                  <span>{item.type}</span>
                  <span>负责人：{item.owner}</span>
                  <span>审核：{item.reviewer}</span>
                  <span>截止：{item.dueDate}</span>
                </div>
                <div className="quality-box">
                  <div><strong>{qualityScore?.total ?? '未评分'}</strong><span>内容质量分</span></div>
                  {qualityScore ? (
                    <p>标题 {qualityScore.titleScore}/20 · 画像 {qualityScore.personaScore}/20 · 卖点 {qualityScore.sellingPointScore}/20 · 平台 {qualityScore.platformFitScore}/15 · CTA {qualityScore.ctaScore}/10 · 合规 {qualityScore.complianceScore}/15</p>
                  ) : <p>发布前建议先进行内容质量评分。</p>}
                  {qualityScore?.suggestions.map((suggestion) => <small key={suggestion}>{suggestion}</small>)}
                  <button className="ghost" onClick={() => runQualityScore(item.id)}>重新评分</button>
                </div>
                <div className="inline-form compact-edit">
                  <input value={item.owner} onChange={(event) => updateContentField(item.id, { owner: event.target.value })} placeholder="负责人" />
                  <input value={item.reviewer} onChange={(event) => updateContentField(item.id, { reviewer: event.target.value })} placeholder="审核人" />
                  <input type="date" value={item.dueDate} onChange={(event) => updateContentField(item.id, { dueDate: event.target.value })} />
                </div>
                <details className="version-box">
                  <summary>版本历史与对比（{versions.length}）</summary>
                  <p className="diff-line">{compareVersionText(versions[0]?.body ?? item.content, versions[1]?.body)}</p>
                  {versions.map((version) => (
                    <p key={version.id}>V{version.version} · {version.editor} · {version.changeNote} · {version.createdAt}</p>
                  ))}
                </details>
                <details className="version-box">
                  <summary>审核意见（{comments.length}）</summary>
                  {comments.length === 0 && <p>暂无审核意见</p>}
                  {comments.map((comment) => (
                    <p key={comment.id}>{comment.decision} · {comment.reviewer} · {comment.stage} · {comment.comment} · {comment.createdAt}</p>
                  ))}
                </details>
                <div className="review-editor">
                  <textarea
                    value={reviewDrafts[item.id] ?? ''}
                    onChange={(event) => setReviewDrafts({ ...reviewDrafts, [item.id]: event.target.value })}
                    placeholder="填写审核意见、修改建议或风险说明"
                  />
                  <div className="card-actions-inline">
                    <button className="secondary" onClick={() => addReviewComment(item.id, '修改建议')}>提交意见</button>
                    <button className="ghost" onClick={() => addReviewComment(item.id, '驳回')}>驳回修改</button>
                  </div>
                </div>
                <details className="version-box">
                  <summary>修订内容</summary>
                  <textarea
                    value={revisionText}
                    onChange={(event) => setRevisionDrafts({ ...revisionDrafts, [item.id]: event.target.value })}
                    placeholder="在这里调整内容，保存后生成新版本"
                  />
                  <button className="secondary" onClick={() => saveRevision(item.id)}>保存修订版本</button>
                </details>
                <details className="version-box">
                  <summary>发布前检查</summary>
                  <div className="checklist-row">
                    {['合规已审', '素材已授权', '入口已配置'].map((check) => (
                      <label key={check}><input type="checkbox" checked={(publishChecks[item.id] ?? []).includes(check)} onChange={() => togglePublishCheck(item.id, check)} />{check}</label>
                    ))}
                  </div>
                </details>
              </div>
              <div className="card-actions">
                <Badge tone="info">{item.status}</Badge>
                <button onClick={() => advance(item.id)}><CheckCircle2 size={16} />推进状态</button>
                <button className="secondary" onClick={() => publishContent(item.id)}><Rocket size={16} />标记发布</button>
                <button className="ghost" onClick={() => duplicateContent(item.id)}>复制</button>
                <button className="ghost" onClick={() => removeContent(item.id)}>删除</button>
              </div>
            </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Assets({ data, audit, apiToken }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void; apiToken?: string }) {
  const [asset, setAsset] = useState({ name: '', category: '公司/业务介绍', owner: '招聘专员', scope: '招聘内容可用' });
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [activePanel, setActivePanel] = useState<'素材库' | '采集表' | '模板案例'>('素材库');
  const [templateDetail, setTemplateDetail] = useState('');
  const [collectionDraft, setCollectionDraft] = useState('');
  const collectionTemplates = [
    { name: '技术案例采集表', fields: '项目背景、技术挑战、技术栈、解决方案、团队分工、业务价值、可公开范围、禁止公开内容、适合平台、审核人' },
    { name: '员工访谈采集表', fields: '员工角色、加入时间、成长经历、印象项目、团队氛围、管理风格、候选人建议、实名授权、照片授权、有效期' },
    { name: '岗位卖点采集表', fields: '岗位名称、候选人关注点、薪酬范围口径、技术挑战、团队氛围、成长路径、工作强度说明、禁用表达' },
  ];

  const createAsset = async () => {
    if (!asset.name.trim()) return;
    setUploadStatus(assetFile ? '正在上传素材文件...' : '');
    let fileMeta: Pick<AssetItem, 'fileName' | 'fileUrl' | 'mimeType' | 'fileSize' | 'uploadedAt'> = {};

    if (assetFile) {
      try {
        fileMeta = await uploadAssetFile(assetFile, apiToken);
        setUploadStatus('文件已上传并关联到素材记录');
      } catch {
        setUploadStatus('文件上传失败，已仅保存素材记录');
      }
    }

    const item: AssetItem = {
      id: `asset-${Date.now()}`,
      ...asset,
      ...fileMeta,
      platforms: ['小红书', '脉脉', '公众号'],
      riskLevel: asset.category.includes('员工') || asset.category.includes('技术') ? '高' : '中',
      authorization: '待审核',
      expiresAt: '2026-12-31',
      usageCount: 0,
    };
    audit('新增素材', item.name, { ...data, assets: [item, ...data.assets] });
    setAsset({ name: '', category: '公司/业务介绍', owner: '招聘专员', scope: '招聘内容可用' });
    setAssetFile(null);
  };

  const removeAsset = (id: string) => {
    const target = data.assets.find((item) => item.id === id);
    audit('删除素材', target?.name ?? id, { ...data, assets: data.assets.filter((item) => item.id !== id) });
  };
  const updateAsset = (id: string, patch: Partial<AssetItem>) => {
    const target = data.assets.find((item) => item.id === id);
    if (!target) return;
    audit('更新素材授权', target.name, { ...data, assets: data.assets.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };
  const saveCollectionAsAsset = () => {
    if (!templateDetail || !collectionDraft.trim()) return;
    const item: AssetItem = {
      id: `asset-${Date.now()}`,
      name: `${templateDetail}-${nowText()}`,
      category: templateDetail,
      owner: '招聘团队',
      scope: '待审核后使用',
      platforms: ['小红书', '脉脉', '公众号'],
      riskLevel: collectionDraft.includes('客户') || collectionDraft.includes('薪酬') ? '高' : '中',
      authorization: '待审核',
      expiresAt: '',
      usageCount: 0,
    };
    audit('采集表保存为素材', item.name, { ...data, assets: [item, ...data.assets] });
    setCollectionDraft('');
    setActivePanel('素材库');
  };

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>素材资产</h1>
          <p>素材库、采集表、模板库和案例库统一沉淀，并保留授权与使用记录。</p>
        </div>
        <button onClick={() => exportJson('素材资产.json', data.assets)}><FileText size={16} />导出素材</button>
      </section>
      <section className="panel wide">
        <div className="module-tabs">
          {(['素材库', '采集表', '模板案例'] as const).map((item) => (
            <button key={item} className={activePanel === item ? 'active' : ''} onClick={() => setActivePanel(item)}>{item}</button>
          ))}
        </div>
      </section>
      {activePanel === '素材库' && <section className="panel wide">
        <div className="panel-title"><h2>新增素材记录</h2><Plus size={18} /></div>
        <div className="inline-form">
          <input value={asset.name} onChange={(event) => setAsset({ ...asset, name: event.target.value })} placeholder="素材名称" />
          <input value={asset.category} onChange={(event) => setAsset({ ...asset, category: event.target.value })} placeholder="素材类型" />
          <input value={asset.owner} onChange={(event) => setAsset({ ...asset, owner: event.target.value })} placeholder="负责人" />
          <input value={asset.scope} onChange={(event) => setAsset({ ...asset, scope: event.target.value })} placeholder="使用范围" />
          <label className="file-picker">
            <input type="file" onChange={(event) => setAssetFile(event.target.files?.[0] ?? null)} />
            {assetFile ? assetFile.name : '选择文件'}
          </label>
          <button onClick={() => void createAsset()}><Plus size={16} />保存</button>
        </div>
        {uploadStatus && <p className="upload-note">{uploadStatus}</p>}
      </section>}
      {activePanel === '素材库' && <section className="panel wide">
        <div className="panel-title"><h2>素材库</h2><Database size={18} /></div>
        {data.assets.length === 0 && <EmptyState title="暂无真实素材" body="请录入公司介绍、JD、图片授权、FAQ 或技术案例采集记录。" />}
        {data.assets.map((asset) => (
          <div className="asset-row" key={asset.id}>
            {asset.mimeType?.startsWith('image/') && asset.fileUrl && <img className="asset-preview" src={asset.fileUrl} alt={asset.name} />}
            <strong>{asset.name}</strong>
            <span>{asset.category} · {asset.scope}</span>
            {asset.fileUrl && (
              <a className="asset-file" href={asset.fileUrl} target="_blank" rel="noreferrer">
                {asset.fileName ?? '查看文件'}{asset.fileSize ? ` · ${Math.round(asset.fileSize / 1024)} KB` : ''}
              </a>
            )}
            <div><Badge tone={asset.riskLevel === '高' ? 'danger' : asset.riskLevel === '中' ? 'warn' : 'good'}>{asset.riskLevel}风险</Badge><Badge>{asset.authorization}</Badge></div>
            {daysUntil(asset.expiresAt) <= 30 && <Badge tone="danger">授权即将到期</Badge>}
            <div className="inline-form compact-edit">
              <select value={asset.authorization} onChange={(event) => updateAsset(asset.id, { authorization: event.target.value })}>
                <option>待审核</option>
                <option>已授权</option>
                <option>需补充授权</option>
                <option>禁止使用</option>
              </select>
              <input type="date" value={asset.expiresAt} onChange={(event) => updateAsset(asset.id, { expiresAt: event.target.value })} />
              <select value={asset.riskLevel} onChange={(event) => updateAsset(asset.id, { riskLevel: event.target.value as AssetItem['riskLevel'] })}>
                <option>低</option>
                <option>中</option>
                <option>高</option>
              </select>
            </div>
            <details className="version-box">
              <summary>关联内容预览</summary>
              {data.contents.filter((content) => content.content.includes(asset.name) || content.tags.includes(asset.category)).length === 0 && <p>暂无关联内容</p>}
              {data.contents.filter((content) => content.content.includes(asset.name) || content.tags.includes(asset.category)).map((content) => (
                <p key={content.id}>{content.title} · {content.platform} · {content.status}</p>
              ))}
            </details>
            <button className="ghost" onClick={() => removeAsset(asset.id)}>删除</button>
          </div>
        ))}
      </section>}
      {activePanel === '采集表' && <section className="panel wide">
        <div className="panel-title"><h2>采集表框架</h2><FileText size={18} /></div>
        <div className="entry-grid">
          {collectionTemplates.map((item) => (
            <article key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.fields}</span>
              <div className="card-actions-inline">
                <button className="secondary" onClick={() => setTemplateDetail(item.name)}>打开填写</button>
                <button className="ghost" onClick={() => downloadText(`${item.name}.csv`, `${item.fields.replaceAll('、', ',')}\n`, 'text/csv;charset=utf-8')}>下载采集表</button>
              </div>
            </article>
          ))}
        </div>
        {templateDetail && (
          <div className="detail-panel">
            <strong>{templateDetail}</strong>
            <textarea className="small-textarea" value={collectionDraft} onChange={(event) => setCollectionDraft(event.target.value)} placeholder="在这里粘贴或填写采集内容，确认后可保存为素材记录。示例：项目背景/技术挑战/可公开范围..." />
            <div className="card-actions-inline">
              <button className="secondary" onClick={saveCollectionAsAsset}>保存为素材</button>
              <button className="ghost" onClick={() => {
                setAsset({ ...asset, name: `${templateDetail}-${nowText()}`, category: templateDetail, scope: '待审核后使用' });
                setActivePanel('素材库');
              }}>带入新增素材</button>
            </div>
          </div>
        )}
      </section>}
      {activePanel === '模板案例' && <section className="panel wide">
        <div className="panel-title"><h2>模板库与案例库</h2><BookOpen size={18} /></div>
        <div className="template-grid">
          {contentTypes.map((type) => (
            <button key={type} className="template-chip clickable-card" onClick={() => setTemplateDetail(type)}>
              {type}<small>标题/开头/CTA/标签结构化沉淀</small>
            </button>
          ))}
        </div>
        {templateDetail && (
          <div className="detail-panel">
            <strong>{templateDetail}模板</strong>
            <p>标题结构：目标人群 + 场景痛点 + 岗位/团队亮点。正文结构：真实场景、岗位价值、候选人关注点回应、行动入口。</p>
            <textarea className="small-textarea" defaultValue={`【${templateDetail}】标题示例\n开头：候选人最关心的问题是什么？\n正文：结合岗位、团队、技术挑战和成长空间展开。\nCTA：查看岗位/私信沟通/进入招聘落地页。`} />
            <button className="ghost" onClick={() => downloadText(`${templateDetail}模板.md`, `# ${templateDetail}模板\n\n标题结构：目标人群 + 场景痛点 + 岗位/团队亮点\n\n正文结构：真实场景、岗位价值、候选人关注点回应、行动入口`, 'text/markdown;charset=utf-8')}>导出模板</button>
          </div>
        )}
      </section>}
    </div>
  );
}

function Accounts({ data, audit, apiToken }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void; apiToken?: string }) {
  const [entry, setEntry] = useState({ platform: '小红书' as Platform, headline: '', url: '', destination: '北森岗位页' as RecruitmentEntry['destination'] });
  const [integration, setIntegration] = useState({ type: '北森' as IntegrationConfig['type'], name: '', endpoint: '', apiKey: '', extraConfig: '', authMode: 'Token' as IntegrationConfig['authMode'] });
  const [landing, setLanding] = useState({ title: '', slug: '', pageType: '岗位集合页' as LandingPage['pageType'], destinationUrl: '' });
  const [editingAccountId, setEditingAccountId] = useState('');
  const [editingEntryId, setEditingEntryId] = useState('');
  const [activePanel, setActivePanel] = useState<'平台总览' | '账号入口' | '账号健康度' | 'API集成' | '落地页'>('平台总览');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('小红书');
  const [editingIntegrationId, setEditingIntegrationId] = useState('');
  const [landingLeadDrafts, setLandingLeadDrafts] = useState<Record<string, { name: string; contact: string; targetJobId: string; sourcePlatform: Platform | '未知'; note: string }>>({});
  const [account, setAccount] = useState({
    platform: '小红书' as Platform,
    name: '',
    type: '招聘专用账号' as AccountType,
    owner: '',
    positioning: '',
    publishingRoles: '招聘专员',
    reviewRule: '默认审核流程',
    attribution: '招聘团队',
    authStatus: '未授权' as PlatformAccount['authStatus'],
    status: '启用' as PlatformAccount['status'],
  });
  const platformDetail = {
    accounts: data.accounts.filter((item) => item.platform === selectedPlatform),
    entries: data.entries.filter((item) => item.platform === selectedPlatform),
    contents: data.contents.filter((item) => item.platform === selectedPlatform),
    results: data.beisenResults.filter((item) => item.sourcePlatform === selectedPlatform),
  };

  const buildAccountPayload = () => ({
    platform: account.platform,
    name: account.name,
    type: account.type,
    owner: account.owner,
    positioning: account.positioning,
    publishingRoles: account.publishingRoles.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean),
    reviewRule: account.reviewRule,
    attribution: account.attribution,
    authStatus: account.authStatus,
    status: account.status,
  });
  const resetAccountForm = () => {
    setAccount({
      platform: '小红书',
      name: '',
      type: '招聘专用账号',
      owner: '',
      positioning: '',
      publishingRoles: '招聘专员',
      reviewRule: '默认审核流程',
      attribution: '招聘团队',
      authStatus: '未授权',
      status: '启用',
    });
  };
  const createAccount = () => {
    if (!account.name.trim()) return;
    const payload = buildAccountPayload();
    if (editingAccountId) {
      const target = data.accounts.find((item) => item.id === editingAccountId);
      if (!target) return;
      const next = { ...target, ...payload };
      audit('编辑平台账号', next.name, { ...data, accounts: data.accounts.map((item) => item.id === editingAccountId ? next : item) });
      setEditingAccountId('');
      resetAccountForm();
      return;
    }
    const item: PlatformAccount = {
      id: `acc-${Date.now()}`,
      ...payload,
    };
    audit('新增平台账号', item.name, { ...data, accounts: [item, ...data.accounts] });
    resetAccountForm();
  };

  const createEntry = () => {
    if (!entry.headline.trim() || !entry.url.trim()) return;
    if (editingEntryId) {
      const target = data.entries.find((item) => item.id === editingEntryId);
      if (!target) return;
      const next = { ...target, ...entry };
      audit('编辑招聘入口', next.headline, { ...data, entries: data.entries.map((item) => item.id === editingEntryId ? next : item) });
      setEditingEntryId('');
      setEntry({ platform: '小红书', headline: '', url: '', destination: '北森岗位页' });
      return;
    }
    const item: RecruitmentEntry = {
      id: `entry-${Date.now()}`,
      ...entry,
      trackingCode: `${entry.platform}-${Date.now()}`,
      clicks: 0,
      status: '启用',
    };
    audit('配置招聘入口', item.headline, { ...data, entries: [item, ...data.entries] });
    setEntry({ platform: '小红书', headline: '', url: '', destination: '北森岗位页' });
  };

  const createIntegration = () => {
    if (!integration.name.trim()) return;
    if (editingIntegrationId) {
      const target = data.integrations.find((item) => item.id === editingIntegrationId);
      if (!target) return;
      audit('编辑集成配置', integration.name, {
        ...data,
        integrations: data.integrations.map((item) => item.id === editingIntegrationId ? { ...target, ...integration, status: integration.endpoint ? '待验证' : '未配置' } : item),
      });
      setEditingIntegrationId('');
      setIntegration({ type: '北森', name: '', endpoint: '', apiKey: '', extraConfig: '', authMode: 'Token' });
      return;
    }
    const item: IntegrationConfig = {
      id: `integration-${Date.now()}`,
      ...integration,
      status: integration.endpoint ? '待验证' : '未配置',
    };
    audit('新增集成配置', item.name, { ...data, integrations: [item, ...data.integrations] });
    setIntegration({ type: '北森', name: '', endpoint: '', apiKey: '', extraConfig: '', authMode: 'Token' });
  };
  const applyPlatformApiPreset = (platformName: Platform) => {
    setIntegration({
      type: '平台API',
      name: `${platformName} 指标接口`,
      endpoint: '',
      apiKey: '',
      authMode: 'Token',
      extraConfig: JSON.stringify({
        platform: platformName,
        method: 'GET',
        endpointPath: '/metrics',
        fields: { contentId: 'contentId', title: 'title', views: 'views', likes: 'likes', comments: 'comments', saves: 'saves', shares: 'shares', clicks: 'clicks' },
      }, null, 2),
    });
    setActivePanel('API集成');
  };

  const testIntegration = async (id: string) => {
    const target = data.integrations.find((item) => item.id === id);
    if (!target) return;
    const result = await testIntegrationConfig(target, apiToken);
    audit('测试集成配置', `${target.name}：${result.message}`, {
      ...data,
      integrations: data.integrations.map((item) => item.id === id ? {
        ...item,
        status: result.status,
        lastSyncAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      } : item),
      notifications: [
        makeNotification('集成连接测试', `${target.name}：${result.message}`, '账号与平台', result.ok ? '提醒' : '预警'),
        ...data.notifications,
      ],
    });
  };

  const sendNotificationDigest = async (id: string) => {
    const target = data.integrations.find((item) => item.id === id);
    if (!target) return;
    const pending = data.notifications.filter((item) => item.level === '待办' || item.level === '预警').slice(0, 8);
    const message = [
      '招聘运营助手待办摘要',
      `待办/预警数量：${pending.length}`,
      ...pending.map((item) => `- ${item.title}：${item.body}`),
    ].join('\n');
    const result = await sendIntegrationMessage(target, message, apiToken);
    audit('发送通知摘要', `${target.name}：${result.message}`, {
      ...data,
      notifications: [
        makeNotification('通知摘要发送结果', `${target.name}：${result.message}`, '账号与平台', result.ok ? '提醒' : '预警'),
        ...data.notifications,
      ],
    });
  };

  const recordSyncRun = (
    integrationItem: IntegrationConfig,
    syncType: IntegrationSyncRun['syncType'],
    ok: boolean,
    message: string,
    recordCount: number,
    nextData: AppData,
    retryCount = 0,
    detail = '',
  ): AppData => ({
    ...nextData,
    integrations: nextData.integrations.map((item) => item.id === integrationItem.id ? {
      ...item,
      status: ok ? '已连接' : '连接失败',
      lastSyncAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      lastMessage: message,
    } : item),
    integrationSyncRuns: [{
      id: `sync-${Date.now()}`,
      integrationId: integrationItem.id,
      syncType,
      status: ok ? '成功' : '失败',
      message,
      recordCount,
      retryCount,
      detail,
      ranAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    }, ...nextData.integrationSyncRuns],
  });

  const syncBeisenLeads = async (id: string) => {
    const target = data.integrations.find((item) => item.id === id);
    if (!target) return;
    const extra = integrationExtra(target);
    const syncedCodes = new Set(data.beisenResults.map((item) => item.candidateCode));
    const pending = data.landingLeads.filter((lead) => lead.status === '待转入北森' && !syncedCodes.has(`lead-${lead.id}`));
    const payload = {
      records: pending.map((lead) => ({
        candidateCode: `lead-${lead.id}`,
        name: lead.name,
        contact: lead.contact,
        jobId: lead.targetJobId,
        sourcePlatform: lead.sourcePlatform,
        note: lead.note,
        submittedAt: lead.submittedAt,
      })),
      extraConfig: extra,
    };
    const result = await runIntegrationSync(target, '北森线索同步', payload, apiToken);
    const beisenResults: BeisenResult[] = result.ok ? pending.map((lead) => ({
      id: `beisen-lead-${lead.id}`,
      jobId: lead.targetJobId,
      sourcePlatform: lead.sourcePlatform,
      sourceContentId: lead.landingPageId,
      candidateCode: `lead-${lead.id}`,
      stage: '已投递',
      importedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    })) : [];
    const mergedBeisenResults = [...beisenResults, ...data.beisenResults].filter((item, index, list) => (
      list.findIndex((candidate) => candidate.candidateCode === item.candidateCode && candidate.stage === item.stage) === index
    ));
    const next = recordSyncRun(target, '北森线索同步', result.ok, result.message, pending.length, {
      ...data,
      landingLeads: result.ok ? data.landingLeads.map((lead) => lead.status === '待转入北森' ? { ...lead, status: '已转入北森' } : lead) : data.landingLeads,
      beisenResults: result.ok ? mergedBeisenResults : data.beisenResults,
      notifications: [
        makeNotification('北森线索同步结果', `${target.name}：${result.message}，记录 ${pending.length} 条`, '账号与平台', result.ok ? '提醒' : '预警'),
        ...data.notifications,
      ],
    }, result.retryCount ?? 0, `去重键：candidateCode；跳过已同步 ${data.landingLeads.filter((lead) => syncedCodes.has(`lead-${lead.id}`)).length} 条`);
    audit('同步北森线索', `${target.name}：${result.message}`, next);
  };

  const pullPlatformMetrics = async (id: string) => {
    const target = data.integrations.find((item) => item.id === id);
    if (!target) return;
    const extra = integrationExtra(target);
    const fieldMapping = integrationFieldMapping(extra);
    const result = await runIntegrationSync(target, '平台指标拉取', { extraConfig: extra, since: target.lastSyncAt }, apiToken);
    const rows = normalizeRemoteRows(result.data);
    const normalizedRows = rows.map((row) => ({
      contentId: mappedValue(row, fieldMapping, 'contentId', '内容ID'),
      title: mappedValue(row, fieldMapping, 'title', '标题'),
      views: mappedValue(row, fieldMapping, 'views', '曝光'),
      likes: mappedValue(row, fieldMapping, 'likes', '点赞'),
      comments: mappedValue(row, fieldMapping, 'comments', '评论'),
      saves: mappedValue(row, fieldMapping, 'saves', '收藏'),
      shares: mappedValue(row, fieldMapping, 'shares', '分享'),
      clicks: mappedValue(row, fieldMapping, 'clicks', '点击'),
    }));
    const csv = normalizedRows.length > 0 ? toCsv(normalizedRows) : '';
    const nextContents = csv ? applyMetricsCsv(data.contents, csv) : data.contents;
    const next = recordSyncRun(target, '平台指标拉取', result.ok, result.message, rows.length || result.recordCount, {
      ...data,
      contents: nextContents,
      notifications: [
        makeNotification('平台指标拉取结果', `${target.name}：${result.message}，记录 ${rows.length || result.recordCount} 条`, '数据分析', result.ok ? '提醒' : '预警'),
        ...data.notifications,
      ],
    }, result.retryCount ?? 0, fieldMapping ? `已应用字段映射：${Object.keys(fieldMapping).join('、')}` : '未配置字段映射');
    audit('拉取平台指标', `${target.name}：${result.message}`, next);
  };

  const createLanding = () => {
    if (!landing.title.trim()) return;
    const item: LandingPage = {
      id: `landing-${Date.now()}`,
      ...landing,
      linkedJobIds: data.jobs.map((job) => job.id),
      status: '草稿',
      visits: 0,
      clicks: 0,
    };
    audit('创建落地页', item.title, { ...data, landingPages: [item, ...data.landingPages] });
    setLanding({ title: '', slug: '', pageType: '岗位集合页', destinationUrl: '' });
  };

  const updateLandingMetric = (id: string, metric: 'visits' | 'clicks') => {
    const target = data.landingPages.find((item) => item.id === id);
    if (!target) return;
    audit(metric === 'visits' ? '记录落地页访问' : '记录落地页点击', target.title, {
      ...data,
      landingPages: data.landingPages.map((item) => item.id === id ? { ...item, [metric]: item[metric] + 1 } : item),
    });
  };

  const publishLandingPage = (id: string) => {
    const target = data.landingPages.find((item) => item.id === id);
    if (!target) return;
    audit('发布落地页', target.title, {
      ...data,
      landingPages: data.landingPages.map((item) => item.id === id ? { ...item, status: '已发布' } : item),
    });
  };

  const submitLandingLead = (landingPage: LandingPage) => {
    const draft = landingLeadDrafts[landingPage.id] ?? {
      name: '',
      contact: '',
      targetJobId: data.jobs[0]?.id ?? '',
      sourcePlatform: '未知' as Platform | '未知',
      note: '',
    };
    if (!draft.name.trim() || !draft.contact.trim()) return;
    const duplicated = data.landingLeads.some((lead) => lead.landingPageId === landingPage.id && lead.contact === draft.contact);
    if (duplicated) {
      audit('拦截重复落地页线索', `${landingPage.title}：${draft.contact}`, {
        ...data,
        notifications: [
          makeNotification('重复线索已拦截', `${draft.contact} 已在 ${landingPage.title} 留资`, '账号与平台', '预警'),
          ...data.notifications,
        ],
      });
      return;
    }
    const lead: LandingPageLead = {
      id: `lead-${Date.now()}`,
      landingPageId: landingPage.id,
      ...draft,
      status: '待转入北森',
      submittedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    audit('提交落地页线索', `${landingPage.title}：${lead.name}`, {
      ...data,
      landingPages: data.landingPages.map((item) => item.id === landingPage.id ? { ...item, clicks: item.clicks + 1 } : item),
      landingLeads: [lead, ...data.landingLeads],
      notifications: [
        makeNotification('新增落地页线索', `${lead.name} 来自 ${landingPage.title}`, '账号与平台', '待办'),
        ...data.notifications,
      ],
    });
    setLandingLeadDrafts({ ...landingLeadDrafts, [landingPage.id]: { ...draft, name: '', contact: '', note: '' } });
  };

  const transferLandingLeadToBeisen = (leadId: string) => {
    const lead = data.landingLeads.find((item) => item.id === leadId);
    if (!lead || lead.status === '已转入北森') return;
    const landingPage = data.landingPages.find((item) => item.id === lead.landingPageId);
    const result: BeisenResult = {
      id: `beisen-lead-${Date.now()}`,
      jobId: lead.targetJobId,
      sourcePlatform: lead.sourcePlatform,
      sourceContentId: landingPage?.id,
      candidateCode: `lead-${lead.id}`,
      stage: '已投递',
      importedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    audit('线索转入北森前置结果', lead.name, {
      ...data,
      landingLeads: data.landingLeads.map((item) => item.id === leadId ? { ...item, status: '已转入北森' } : item),
      beisenResults: [result, ...data.beisenResults],
      notifications: [
        makeNotification('线索已进入北森回流池', `${lead.name} 已按“已投递”进入归因数据`, '数据分析', '提醒'),
        ...data.notifications,
      ],
    });
  };

  const exportLandingLeads = () => {
    downloadText('落地页线索.csv', toCsv(data.landingLeads.map((lead) => ({
      id: lead.id,
      landingPageId: lead.landingPageId,
      name: lead.name,
      contact: lead.contact,
      targetJobId: lead.targetJobId,
      sourcePlatform: lead.sourcePlatform,
      note: lead.note,
      status: lead.status,
      submittedAt: lead.submittedAt,
    }))), 'text/csv;charset=utf-8');
  };

  const removeAccount = (id: string) => {
    const target = data.accounts.find((item) => item.id === id);
    audit('删除平台账号', target?.name ?? id, { ...data, accounts: data.accounts.filter((item) => item.id !== id) });
  };

  const removeEntry = (id: string) => {
    const target = data.entries.find((item) => item.id === id);
    audit('删除招聘入口', target?.headline ?? id, { ...data, entries: data.entries.filter((item) => item.id !== id) });
  };
  const startEditIntegration = (item: IntegrationConfig) => {
    setEditingIntegrationId(item.id);
    setIntegration({ type: item.type, name: item.name, endpoint: item.endpoint, apiKey: item.apiKey ?? '', extraConfig: item.extraConfig ?? '', authMode: item.authMode });
    setActivePanel('API集成');
  };
  const removeIntegration = (id: string) => {
    const target = data.integrations.find((item) => item.id === id);
    audit('删除集成配置', target?.name ?? id, { ...data, integrations: data.integrations.filter((item) => item.id !== id) });
  };
  const startEditAccount = (item: PlatformAccount) => {
    setEditingAccountId(item.id);
    setAccount({
      platform: item.platform,
      name: item.name,
      type: item.type,
      owner: item.owner,
      positioning: item.positioning,
      publishingRoles: item.publishingRoles.join('、'),
      reviewRule: item.reviewRule,
      attribution: item.attribution,
      authStatus: item.authStatus,
      status: item.status,
    });
  };
  const patchAccount = (id: string, patch: Partial<PlatformAccount>, action = '更新平台账号') => {
    const target = data.accounts.find((item) => item.id === id);
    if (!target) return;
    audit(action, target.name, { ...data, accounts: data.accounts.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };
  const startEditEntry = (item: RecruitmentEntry) => {
    setEditingEntryId(item.id);
    setEntry({ platform: item.platform, headline: item.headline, url: item.url, destination: item.destination });
  };

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>账号与平台</h1>
          <p>管理平台账号定位、授权状态、发布权限、主页招聘入口和数据归属。</p>
        </div>
        <div className="toolbar-actions">
          <button onClick={() => exportJson('平台账号与招聘入口.json', { accounts: data.accounts, entries: data.entries, landingPages: data.landingPages })}><FileText size={16} />导出配置</button>
          <button className="secondary" onClick={exportLandingLeads}><Database size={16} />导出线索</button>
        </div>
      </section>
      <section className="panel wide">
        <div className="module-tabs">
          {(['平台总览', '账号入口', '账号健康度', 'API集成', '落地页'] as const).map((item) => (
            <button key={item} className={activePanel === item ? 'active' : ''} onClick={() => setActivePanel(item)}>{item}</button>
          ))}
        </div>
      </section>
      {activePanel === '平台总览' && <section className="panel wide">
        <div className="panel-title"><h2>平台详情下钻</h2><BarChart3 size={18} /></div>
        <div className="platform-card-grid">
          {platforms.map((item) => {
            const contentCount = data.contents.filter((content) => content.platform === item).length;
            const accountCount = data.accounts.filter((account) => account.platform === item).length;
            const entryCount = data.entries.filter((entry) => entry.platform === item).length;
            return (
              <button key={item} className={`platform-card ${selectedPlatform === item ? 'active' : ''}`} onClick={() => setSelectedPlatform(item)}>
                <strong>{item}</strong>
                <span>{platformPositioning[item]}</span>
                <small>{accountCount} 账号 · {entryCount} 入口 · {contentCount} 内容</small>
              </button>
            );
          })}
        </div>
        <div className="detail-panel">
          <strong>{selectedPlatform} 运营详情</strong>
          <div className="template-grid">
            <div className="template-chip">账号<small>{platformDetail.accounts.map((item) => item.name).join('、') || '未配置'}</small></div>
            <div className="template-chip">入口<small>{platformDetail.entries.map((item) => item.headline).join('、') || '未配置'}</small></div>
            <div className="template-chip">内容效果<small>{platformDetail.contents.reduce((sum, item) => sum + item.metrics.views, 0)} 曝光 · {platformDetail.contents.reduce((sum, item) => sum + item.metrics.clicks, 0)} 点击</small></div>
            <div className="template-chip">北森回流<small>{platformDetail.results.length} 条</small></div>
          </div>
          <div className="card-actions-inline">
            <button className="secondary" onClick={() => { setAccount({ ...account, platform: selectedPlatform, positioning: platformPositioning[selectedPlatform] }); setActivePanel('账号入口'); }}>配置该平台账号</button>
            <button className="ghost" onClick={() => applyPlatformApiPreset(selectedPlatform)}>配置该平台 API</button>
          </div>
        </div>
      </section>}
      {activePanel === '账号入口' && <section className="panel wide">
        <div className="panel-title"><h2>新增平台账号</h2><Users size={18} /></div>
        <div className="inline-form">
          <select value={account.platform} onChange={(event) => setAccount({ ...account, platform: event.target.value as Platform })}>
            {platforms.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} placeholder="账号名称" />
          <select value={account.type} onChange={(event) => setAccount({ ...account, type: event.target.value as AccountType })}>
            <option>招聘专用账号</option>
            <option>HR个人IP账号</option>
            <option>技术负责人账号</option>
            <option>校招账号</option>
          </select>
          <input value={account.owner} onChange={(event) => setAccount({ ...account, owner: event.target.value })} placeholder="负责人" />
          <button onClick={createAccount}><Plus size={16} />{editingAccountId ? '保存编辑' : '保存账号'}</button>
          {editingAccountId && <button className="secondary" onClick={() => { setEditingAccountId(''); resetAccountForm(); }}>取消</button>}
        </div>
        <input value={account.positioning} onChange={(event) => setAccount({ ...account, positioning: event.target.value })} placeholder="账号定位，例如：岗位种草、校招答疑、技术观点" />
        <div className="inline-form compact-edit">
          <input value={account.publishingRoles} onChange={(event) => setAccount({ ...account, publishingRoles: event.target.value })} placeholder="发布权限角色，用顿号分隔" />
          <input value={account.reviewRule} onChange={(event) => setAccount({ ...account, reviewRule: event.target.value })} placeholder="审核规则，例如：技术负责人+品牌合规" />
          <input value={account.attribution} onChange={(event) => setAccount({ ...account, attribution: event.target.value })} placeholder="数据归属，例如：招聘团队/校招项目" />
          <select value={account.authStatus} onChange={(event) => setAccount({ ...account, authStatus: event.target.value as PlatformAccount['authStatus'] })}>
            <option>未授权</option>
            <option>已授权</option>
            <option>授权过期</option>
          </select>
          <select value={account.status} onChange={(event) => setAccount({ ...account, status: event.target.value as PlatformAccount['status'] })}>
            <option>启用</option>
            <option>停用</option>
          </select>
        </div>
      </section>}
      {activePanel === '账号入口' && <section className="panel wide">
        <table>
          <thead>
            <tr>
              <th>账号</th>
              <th>定位</th>
              <th>负责人</th>
              <th>发布权限</th>
              <th>授权</th>
              <th>归属</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.length === 0 && (
              <tr>
                <td colSpan={8}><EmptyState title="暂无真实平台账号" body="请录入实际运营账号，数据归属和发布权限会基于账号配置计算。" /></td>
              </tr>
            )}
            {data.accounts.map((account) => (
              <tr key={account.id}>
                <td><strong>{account.platform}｜{account.name}</strong><span>{account.type}</span></td>
                <td>{account.positioning}</td>
                <td>{account.owner}</td>
                <td>{account.publishingRoles.join(' / ')}</td>
                <td><Badge tone={account.authStatus === '已授权' ? 'good' : account.authStatus === '授权过期' ? 'danger' : 'warn'}>{account.authStatus}</Badge></td>
                <td>{account.attribution}</td>
                <td><Badge tone={account.status === '启用' ? 'good' : 'neutral'}>{account.status}</Badge></td>
                <td>
                  <div className="row-actions">
                    <button className="ghost" onClick={() => startEditAccount(account)}>编辑</button>
                    <button className="ghost" onClick={() => patchAccount(account.id, { status: account.status === '启用' ? '停用' : '启用' }, '切换平台账号状态')}>{account.status === '启用' ? '停用' : '启用'}</button>
                    <button className="ghost" onClick={() => patchAccount(account.id, { authStatus: account.authStatus === '已授权' ? '授权过期' : '已授权' }, '更新平台账号授权')}>{account.authStatus === '已授权' ? '设为过期' : '设为授权'}</button>
                    <button className="ghost" onClick={() => removeAccount(account.id)}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>}
      {activePanel === '账号入口' && <section className="panel wide">
        <div className="panel-title"><h2>平台主页招聘入口</h2><Link size={18} /></div>
        <div className="inline-form">
          <select value={entry.platform} onChange={(event) => setEntry({ ...entry, platform: event.target.value as Platform })}>
            {platforms.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={entry.headline} onChange={(event) => setEntry({ ...entry, headline: event.target.value })} placeholder="入口名称" />
          <input value={entry.url} onChange={(event) => setEntry({ ...entry, url: event.target.value })} placeholder="北森/官网链接" />
          <select value={entry.destination} onChange={(event) => setEntry({ ...entry, destination: event.target.value as RecruitmentEntry['destination'] })}>
            <option>北森岗位页</option>
            <option>公司官网招聘页</option>
            <option>自建落地页</option>
          </select>
          <button onClick={createEntry}><Plus size={16} />{editingEntryId ? '保存入口' : '新增入口'}</button>
          {editingEntryId && <button className="secondary" onClick={() => { setEditingEntryId(''); setEntry({ platform: '小红书', headline: '', url: '', destination: '北森岗位页' }); }}>取消</button>}
        </div>
        <div className="entry-grid">
          {data.entries.length === 0 && <EmptyState title="暂无真实招聘入口" body="请配置平台主页中的北森或官网入口，后续点击会进入归因看板。" />}
          {data.entries.map((item) => (
            <article key={item.id}>
              <strong>{item.platform}｜{item.headline}</strong>
              <span>{item.destination} · {item.trackingCode}</span>
              <span>{item.url}</span>
              <Badge tone="info">{item.clicks} 点击</Badge>
              <div className="row-actions">
                <button className="ghost" onClick={() => startEditEntry(item)}>编辑</button>
                <button className="ghost" onClick={() => removeEntry(item.id)}>删除</button>
              </div>
            </article>
          ))}
        </div>
      </section>}
      {activePanel === '账号健康度' && <section className="panel wide">
        <div className="panel-title"><h2>账号健康度</h2><PieChart size={18} /></div>
        <div className="entry-grid">
          {data.accounts.length === 0 && <EmptyState title="暂无账号健康数据" body="配置真实平台账号并发布内容后，会计算健康等级。" />}
          {data.accounts.map((account) => {
            const health = calculateAccountHealth(account.id, data);
            return (
              <article key={account.id}>
                <strong>{account.platform}｜{account.name}</strong>
                <span>{account.positioning}</span>
                <Badge tone={health.level === '健康' ? 'good' : health.level === '需关注' ? 'warn' : 'danger'}>{health.level}</Badge>
                <div className="metric-mini-grid">
                  <span>发布 <b>{health.publishCount}</b></span>
                  <span>均曝 <b>{health.averageViews}</b></span>
                  <span>互动率 <b>{(health.averageInteractionRate * 100).toFixed(1)}%</b></span>
                  <span>点击率 <b>{(health.averageClickRate * 100).toFixed(1)}%</b></span>
                  <span>停更 <b>{health.inactiveDays >= 999 ? '无发布' : `${health.inactiveDays}天`}</b></span>
                  <span>定位 <b>{health.positioningMatchScore}%</b></span>
                </div>
                {health.suggestions.length === 0 ? <p>账号运营状态正常。</p> : health.suggestions.map((suggestion) => <p key={suggestion}>{suggestion}</p>)}
              </article>
            );
          })}
        </div>
      </section>}
      {activePanel === 'API集成' && <section className="panel wide">
        <div className="panel-title"><h2>平台与系统集成配置</h2><RefreshCw size={18} /></div>
        <div className="usage-steps">
          <div><b>1</b><span>选择北森/平台API/企微飞书</span></div>
          <div><b>2</b><span>填写接口地址、Token、字段映射</span></div>
          <div><b>3</b><span>测试连接后执行同步或拉取</span></div>
        </div>
        <div className="inline-form">
          <select value={integration.type} onChange={(event) => setIntegration({ ...integration, type: event.target.value as IntegrationConfig['type'] })}>
            <option>北森</option>
            <option>平台API</option>
            <option>企业微信</option>
            <option>飞书</option>
            <option>BI</option>
          </select>
          <input value={integration.name} onChange={(event) => setIntegration({ ...integration, name: event.target.value })} placeholder="集成名称" />
          <input value={integration.endpoint} onChange={(event) => setIntegration({ ...integration, endpoint: event.target.value })} placeholder="接口地址 / Webhook" />
          <input value={integration.apiKey} onChange={(event) => setIntegration({ ...integration, apiKey: event.target.value })} placeholder="API Key / Token" />
          <select value={integration.authMode} onChange={(event) => setIntegration({ ...integration, authMode: event.target.value as IntegrationConfig['authMode'] })}>
            <option>Token</option>
            <option>OAuth</option>
            <option>Webhook</option>
            <option>文件导入</option>
            <option>未配置</option>
          </select>
          <button onClick={createIntegration}><Plus size={16} />{editingIntegrationId ? '保存编辑' : '保存集成'}</button>
          {editingIntegrationId && <button className="secondary" onClick={() => { setEditingIntegrationId(''); setIntegration({ type: '北森', name: '', endpoint: '', apiKey: '', extraConfig: '', authMode: 'Token' }); }}>取消</button>}
        </div>
        <div className="module-tabs">
          {platforms.map((item) => <button key={item} onClick={() => applyPlatformApiPreset(item)}>{item} API模板</button>)}
        </div>
        <textarea className="small-textarea" value={integration.extraConfig} onChange={(event) => setIntegration({ ...integration, extraConfig: event.target.value })} placeholder={'扩展配置 JSON，例如：{"tenantId":"xxx","appId":"xxx","fields":{"name":"candidateName"}}'} />
        <div className="entry-grid">
          {data.integrations.length === 0 && <EmptyState title="暂无真实集成配置" body="配置北森、平台 API、企微/飞书或 BI 后，系统会记录连接状态。" />}
          {data.integrations.map((item) => (
            <article key={item.id}>
              <strong>{item.type}｜{item.name}</strong>
              <span>{item.authMode} · {item.endpoint || '未填写接口地址'} · {item.apiKey ? '已配置密钥' : '未配置密钥'}</span>
              {item.lastMessage && <span>最近结果：{item.lastMessage}</span>}
              <Badge tone={item.status === '已连接' ? 'good' : item.status === '连接失败' ? 'danger' : 'warn'}>{item.status}</Badge>
              <div className="card-actions-inline">
                <button className="ghost" onClick={() => void testIntegration(item.id)}>测试连接</button>
                {item.type === '北森' && <button className="ghost" onClick={() => void syncBeisenLeads(item.id)}>同步线索</button>}
                {item.type === '平台API' && <button className="ghost" onClick={() => void pullPlatformMetrics(item.id)}>拉取指标</button>}
                {(item.type === '企业微信' || item.type === '飞书') && <button className="ghost" onClick={() => void sendNotificationDigest(item.id)}>发送摘要</button>}
                <button className="ghost" onClick={() => startEditIntegration(item)}>编辑</button>
                <button className="ghost" onClick={() => removeIntegration(item.id)}>删除</button>
              </div>
            </article>
          ))}
        </div>
        {data.integrationSyncRuns.length > 0 && (
          <details className="version-box">
            <summary>同步运行记录（{data.integrationSyncRuns.length}）</summary>
            {data.integrationSyncRuns.slice(0, 8).map((run) => (
              <p key={run.id}>{run.syncType} · {run.status} · {run.message} · {run.recordCount} 条 · 重试 {run.retryCount ?? 0} 次 · {run.detail || '无详情'} · {run.ranAt}</p>
            ))}
          </details>
        )}
      </section>}
      {activePanel === '落地页' && <section className="panel wide">
        <div className="panel-title"><h2>招聘落地页</h2><FileText size={18} /></div>
        <div className="inline-form">
          <input value={landing.title} onChange={(event) => setLanding({ ...landing, title: event.target.value })} placeholder="页面标题" />
          <input value={landing.slug} onChange={(event) => setLanding({ ...landing, slug: event.target.value })} placeholder="页面路径 slug" />
          <select value={landing.pageType} onChange={(event) => setLanding({ ...landing, pageType: event.target.value as LandingPage['pageType'] })}>
            <option>岗位集合页</option>
            <option>校招专题页</option>
            <option>技术开放日</option>
            <option>自定义落地页</option>
          </select>
          <input value={landing.destinationUrl} onChange={(event) => setLanding({ ...landing, destinationUrl: event.target.value })} placeholder="最终跳转地址" />
          <button onClick={createLanding}><Plus size={16} />创建页面</button>
        </div>
        <div className="entry-grid">
          {data.landingPages.length === 0 && <EmptyState title="暂无招聘落地页" body="可创建岗位集合页、校招专题页或技术活动页，本地阶段先生成配置和归因数据。" />}
          {data.landingPages.map((item) => {
            const draft = landingLeadDrafts[item.id] ?? {
              name: '',
              contact: '',
              targetJobId: data.jobs[0]?.id ?? '',
              sourcePlatform: '未知' as Platform | '未知',
              note: '',
            };
            const leads = data.landingLeads.filter((lead) => lead.landingPageId === item.id);
            return (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>/{item.slug || item.id} · {item.pageType} · 关联岗位 {item.linkedJobIds.length} 个</span>
              <Badge tone="info">{item.visits} 访问 / {item.clicks} 点击 / {leads.length} 线索</Badge>
              <div className="card-actions-inline">
                <button className="ghost" onClick={() => publishLandingPage(item.id)}>发布</button>
                <button className="ghost" onClick={() => updateLandingMetric(item.id, 'visits')}>记录访问</button>
                <button className="ghost" onClick={() => updateLandingMetric(item.id, 'clicks')}>记录点击</button>
              </div>
              <details className="version-box">
                <summary>本地表单与线索（{leads.length}）</summary>
                <div className="lead-form">
                  <input
                    value={draft.name}
                    onChange={(event) => setLandingLeadDrafts({ ...landingLeadDrafts, [item.id]: { ...draft, name: event.target.value } })}
                    placeholder="候选人姓名"
                  />
                  <input
                    value={draft.contact}
                    onChange={(event) => setLandingLeadDrafts({ ...landingLeadDrafts, [item.id]: { ...draft, contact: event.target.value } })}
                    placeholder="手机号/邮箱/微信"
                  />
                  <select
                    value={draft.targetJobId}
                    onChange={(event) => setLandingLeadDrafts({ ...landingLeadDrafts, [item.id]: { ...draft, targetJobId: event.target.value } })}
                  >
                    <option value="">未选择岗位</option>
                    {data.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                  </select>
                  <select
                    value={draft.sourcePlatform}
                    onChange={(event) => setLandingLeadDrafts({ ...landingLeadDrafts, [item.id]: { ...draft, sourcePlatform: event.target.value as Platform | '未知' } })}
                  >
                    <option>未知</option>
                    {platforms.map((platform) => <option key={platform}>{platform}</option>)}
                  </select>
                  <input
                    value={draft.note}
                    onChange={(event) => setLandingLeadDrafts({ ...landingLeadDrafts, [item.id]: { ...draft, note: event.target.value } })}
                    placeholder="候选人备注"
                  />
                  <button className="secondary" onClick={() => submitLandingLead(item)}>提交线索</button>
                </div>
                {leads.map((lead) => (
                  <div className="lead-row" key={lead.id}>
                    <span>{lead.name} · {lead.contact} · {lead.sourcePlatform} · {lead.status} · {lead.submittedAt}</span>
                    <button className="ghost" disabled={lead.status === '已转入北森'} onClick={() => transferLandingLeadToBeisen(lead.id)}>转入北森</button>
                  </div>
                ))}
              </details>
            </article>
            );
          })}
        </div>
      </section>}
    </div>
  );
}

function Analytics({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [metricsCsv, setMetricsCsv] = useState('');
  const [beisenCsv, setBeisenCsv] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | '全部'>('全部');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [cost, setCost] = useState({ targetType: '内容' as CostRecord['targetType'], targetId: '', laborCost: 0, mediaCost: 0, productionCost: 0 });
  const inDateRange = (date?: string) => {
    if (!date) return true;
    if (dateRange.from && date < dateRange.from) return false;
    if (dateRange.to && date > dateRange.to) return false;
    return true;
  };
  const filteredContentsByDate = data.contents.filter((item) => inDateRange(item.publishedAt ?? item.dueDate));
  const byPlatform = platforms.map((platform) => {
    const items = filteredContentsByDate.filter((item) => item.platform === platform);
    const results = data.beisenResults.filter((item) => item.sourcePlatform === platform);
    const interactions = items.reduce((sum, item) => sum + item.metrics.likes + item.metrics.comments + item.metrics.saves + item.metrics.shares, 0);
    const clicks = items.reduce((sum, item) => sum + item.metrics.clicks, 0);
    return {
      platform,
      views: items.reduce((sum, item) => sum + item.metrics.views, 0),
      interactions,
      clicks,
      count: items.length,
      applications: results.filter((item) => item.stage === '已投递').length,
      effective: results.filter((item) => item.stage === '有效简历' || item.stage === '初筛通过' || item.stage === '已约面' || item.stage === '已面试' || item.stage === 'Offer' || item.stage === '已入职').length,
      offers: results.filter((item) => item.stage === 'Offer' || item.stage === '已入职').length,
      hires: results.filter((item) => item.stage === '已入职').length,
    };
  });
  const visiblePlatforms = byPlatform.filter((item) => item.count > 0 || item.applications > 0);
  const maxViews = Math.max(...byPlatform.map((p) => p.views), 1);
  const selectedContents = selectedPlatform === '全部' ? filteredContentsByDate : filteredContentsByDate.filter((item) => item.platform === selectedPlatform);
  const selectedResults = selectedPlatform === '全部' ? data.beisenResults : data.beisenResults.filter((item) => item.sourcePlatform === selectedPlatform);
  const selectedViews = selectedContents.reduce((sum, item) => sum + item.metrics.views, 0);
  const selectedInteractions = selectedContents.reduce((sum, item) => sum + item.metrics.likes + item.metrics.comments + item.metrics.saves + item.metrics.shares, 0);
  const selectedClicks = selectedContents.reduce((sum, item) => sum + item.metrics.clicks, 0);
  const selectedApplications = selectedResults.filter((item) => item.stage === '已投递').length;
  const selectedEffective = selectedResults.filter((item) => item.stage === '有效简历' || item.stage === '初筛通过' || item.stage === '已约面' || item.stage === '已面试' || item.stage === 'Offer' || item.stage === '已入职').length;
  const selectedHires = selectedResults.filter((item) => item.stage === '已入职').length;
  const formatRate = (value: number, base: number) => `${base > 0 ? ((value / base) * 100).toFixed(1) : '0.0'}%`;
  const stageOrder: BeisenResult['stage'][] = ['已投递', '有效简历', '初筛通过', '已约面', '已面试', 'Offer', '已入职'];
  const stageStats = stageOrder.map((stage) => ({
    stage,
    count: selectedResults.filter((item) => item.stage === stage).length,
  }));
  const familyStats = data.jobs.map((job) => {
    const related = selectedContents.filter((item) => item.jobId === job.id);
    const clicks = related.reduce((sum, item) => sum + item.metrics.clicks, 0);
    const views = related.reduce((sum, item) => sum + item.metrics.views, 0);
    return { id: job.id, family: job.family, title: job.title, clicks, views, count: related.length };
  }).filter((item) => item.count > 0);
  const typeStats = contentTypes.map((type) => {
    const related = selectedContents.filter((item) => item.type === type);
    return {
      type,
      count: related.length,
      views: related.reduce((sum, item) => sum + item.metrics.views, 0),
      clicks: related.reduce((sum, item) => sum + item.metrics.clicks, 0),
    };
  }).filter((item) => item.count > 0);
  const maxSelectedViews = Math.max(...selectedContents.map((item) => item.metrics.views), 1);
  const maxStageCount = Math.max(...stageStats.map((item) => item.count), 1);
  const explanations = buildDataExplanations(data);
  const strategyJob = data.jobs[0];
  const strategy = buildPlatformStrategy(strategyJob, data);
  const importMetrics = () => {
    const nextContents = applyMetricsCsv(data.contents, metricsCsv);
    audit('导入平台指标', '内容数据', { ...data, contents: nextContents });
    setMetricsCsv('');
  };
  const importBeisen = () => {
    const results = parseBeisenCsv(beisenCsv);
    if (results.length === 0) return;
    audit('导入北森结果', `${results.length} 条`, { ...data, beisenResults: [...results, ...data.beisenResults] });
    setBeisenCsv('');
  };
  const createCost = () => {
    const item: CostRecord = {
      id: `cost-${Date.now()}`,
      targetType: cost.targetType,
      targetId: cost.targetId || 'all',
      laborCost: Number(cost.laborCost) || 0,
      mediaCost: Number(cost.mediaCost) || 0,
      productionCost: Number(cost.productionCost) || 0,
    };
    audit('录入成本', `${item.targetType}:${item.targetId}`, { ...data, costs: [item, ...data.costs] });
    setCost({ targetType: '内容', targetId: '', laborCost: 0, mediaCost: 0, productionCost: 0 });
  };
  const roi = calculateRoi(data);

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>数据分析</h1>
          <p>按平台、账号、岗位族群、内容类型分析曝光、互动、点击和跳转漏斗。</p>
        </div>
        <button onClick={importMetrics}><RefreshCw size={16} />导入指标</button>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>使用路径</h2><Target size={18} /></div>
        <div className="usage-steps">
          <div><b>1</b><span>先在“内容运营”发布内容，或在“导入中心”导入内容指标</span></div>
          <div><b>2</b><span>再导入北森回流结果，建立平台/内容/岗位归因</span></div>
          <div><b>3</b><span>最后按平台下钻看曝光、点击、投递和入职效果</span></div>
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>平台下钻</h2><BarChart3 size={18} /></div>
        <div className="analytics-filterbar">
          <label>开始日期<input type="date" value={dateRange.from} onChange={(event) => setDateRange({ ...dateRange, from: event.target.value })} /></label>
          <label>结束日期<input type="date" value={dateRange.to} onChange={(event) => setDateRange({ ...dateRange, to: event.target.value })} /></label>
          <button className="ghost" onClick={() => setDateRange({ from: '', to: '' })}>清空时间筛选</button>
        </div>
        <div className="module-tabs">
          <button className={selectedPlatform === '全部' ? 'active' : ''} onClick={() => setSelectedPlatform('全部')}>全部</button>
          {platforms.map((platform) => <button key={platform} className={selectedPlatform === platform ? 'active' : ''} onClick={() => setSelectedPlatform(platform)}>{platform}</button>)}
        </div>
        <div className="stats-row compact-stats analytics-stats">
          <StatCard label="内容数" value={selectedContents.length} note="当前筛选平台" icon={FileText} />
          <StatCard label="曝光" value={selectedViews.toLocaleString()} note={`互动率 ${formatRate(selectedInteractions, selectedViews)}`} icon={Rocket} />
          <StatCard label="点击" value={selectedClicks.toLocaleString()} note={`点击率 ${formatRate(selectedClicks, selectedViews)}`} icon={Link} />
          <StatCard label="北森回流" value={selectedResults.length} note="投递/面试/入职" icon={Users} />
        </div>
        <div className="analytics-kpi-strip">
          <div><span>互动量</span><b>{selectedInteractions.toLocaleString()}</b><small>赞评藏转合计</small></div>
          <div><span>投递转化</span><b>{formatRate(selectedApplications, selectedClicks)}</b><small>{selectedApplications} 投递 / {selectedClicks} 点击</small></div>
          <div><span>有效简历率</span><b>{formatRate(selectedEffective, selectedApplications)}</b><small>{selectedEffective} 有效 / {selectedApplications} 投递</small></div>
          <div><span>入职转化</span><b>{formatRate(selectedHires, selectedApplications)}</b><small>{selectedHires} 入职 / {selectedApplications} 投递</small></div>
        </div>
      </section>
      <section className="panel wide analytics-board">
        <div className="panel-title"><h2>平台效率矩阵</h2><PieChart size={18} /></div>
        {visiblePlatforms.length === 0 && <EmptyState title="暂无真实平台指标" body="请先发布内容并导入平台后台数据；当前平台曝光、互动和点击均按 0 展示。" />}
        <div className="platform-metric-grid">
          {visiblePlatforms.map((item) => (
            <button key={item.platform} className={`platform-metric-card ${selectedPlatform === item.platform ? 'active' : ''}`} onClick={() => setSelectedPlatform(item.platform)}>
              <div>
                <strong>{item.platform}</strong>
                <Badge tone={item.hires > 0 ? 'good' : item.clicks > 0 ? 'info' : 'neutral'}>{item.count} 内容</Badge>
              </div>
              <div className="metric-mini-grid">
                <span>曝光 <b>{item.views.toLocaleString()}</b></span>
                <span>互动 <b>{item.interactions.toLocaleString()}</b></span>
                <span>点击 <b>{item.clicks.toLocaleString()}</b></span>
                <span>入职 <b>{item.hires}</b></span>
              </div>
              <Progress current={item.views} target={maxViews} />
              <small>点击率 {formatRate(item.clicks, item.views)} · 有效率 {formatRate(item.effective, item.applications)} · Offer {item.offers}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>智能数据解释与平台策略</h2><Bot size={18} /></div>
        <div className="entry-grid">
          <article>
            <strong>数据解释</strong>
            {explanations.length === 0 && <span>当前暂无异常解释。导入真实曝光、点击、投递后会自动生成业务说明。</span>}
            {explanations.map((item) => (
              <div className="insight" key={item.id}>
                <Badge tone={item.severity === '风险' ? 'danger' : item.severity === '机会' ? 'good' : 'info'}>{item.severity}</Badge>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{item.evidence.join(' · ')}</small>
              </div>
            ))}
          </article>
          <article>
            <strong>{strategyJob ? `${strategyJob.title} 平台策略` : '平台策略建议'}</strong>
            {strategy.map((item) => <p key={item}>{item}</p>)}
          </article>
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>{selectedPlatform} 内容明细</h2><Search size={18} /></div>
        {selectedContents.length === 0 && <EmptyState title="暂无内容明细" body="当前平台或日期范围没有真实内容数据。" />}
        {selectedContents.length > 0 && (
          <table className="analytics-table">
            <thead>
              <tr>
                <th>内容</th>
                <th>平台/账号</th>
                <th>曝光</th>
                <th>互动</th>
                <th>点击</th>
                <th>点击率</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {selectedContents
                .slice()
                .sort((a, b) => b.metrics.views - a.metrics.views)
                .map((item) => {
                  const account = data.accounts.find((accountItem) => accountItem.id === item.accountId);
                  const interactions = item.metrics.likes + item.metrics.comments + item.metrics.saves + item.metrics.shares;
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.title}</strong><span>{item.type} · {item.dueDate}</span></td>
                      <td>{item.platform}<span>{account?.name ?? '未绑定账号'}</span></td>
                      <td>{item.metrics.views.toLocaleString()}<Progress current={item.metrics.views} target={maxSelectedViews} /></td>
                      <td>{interactions.toLocaleString()}</td>
                      <td>{item.metrics.clicks.toLocaleString()}</td>
                      <td>{formatRate(item.metrics.clicks, item.metrics.views)}</td>
                      <td><Badge tone={item.status === '已发布' || item.status === '数据回收中' || item.status === '已复盘' ? 'good' : 'warn'}>{item.status}</Badge></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>平台指标导入</h2><Database size={18} /></div>
        <p className="helper">支持字段：contentId/title、views、likes、comments、saves、shares、clicks，也支持中文表头。未导入时看板指标为 0。</p>
        <textarea className="small-textarea" value={metricsCsv} onChange={(event) => setMetricsCsv(event.target.value)} placeholder="contentId,views,likes,comments,saves,shares,clicks&#10;ct-xxx,1000,20,3,8,2,15" />
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>北森结果回流</h2><RefreshCw size={18} /></div>
        <p className="helper">支持字段：jobId、sourcePlatform、sourceContentId、candidateCode、stage。stage 可为：已投递、有效简历、初筛通过、已约面、已面试、Offer、已入职。</p>
        <textarea className="small-textarea" value={beisenCsv} onChange={(event) => setBeisenCsv(event.target.value)} placeholder="jobId,sourcePlatform,sourceContentId,candidateCode,stage&#10;job-xxx,小红书,ct-xxx,C001,已投递" />
        <button className="full" onClick={importBeisen}><Database size={16} />导入北森结果</button>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>成本录入</h2><Target size={18} /></div>
        <div className="form-grid single">
          <select value={cost.targetType} onChange={(event) => setCost({ ...cost, targetType: event.target.value as CostRecord['targetType'] })}>
            <option>内容</option>
            <option>平台</option>
            <option>岗位族群</option>
          </select>
          <input value={cost.targetId} onChange={(event) => setCost({ ...cost, targetId: event.target.value })} placeholder="对象 ID，可空表示全部" />
          <input type="number" value={cost.laborCost} onChange={(event) => setCost({ ...cost, laborCost: Number(event.target.value) })} placeholder="人工成本" />
          <input type="number" value={cost.mediaCost} onChange={(event) => setCost({ ...cost, mediaCost: Number(event.target.value) })} placeholder="投放成本" />
          <input type="number" value={cost.productionCost} onChange={(event) => setCost({ ...cost, productionCost: Number(event.target.value) })} placeholder="制作成本" />
        </div>
        <button className="full" onClick={createCost}><Plus size={16} />保存成本</button>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>真实 ROI</h2><PieChart size={18} /></div>
        <div className="funnel">
          <div>总成本 <b>{roi.totalCost}</b></div>
          <div>投递人数 <b>{roi.applications}</b></div>
          <div>有效简历 <b>{roi.effective}</b></div>
          <div>入职人数 <b>{roi.hires}</b></div>
        </div>
        <div className="roi-row">
          <Badge tone="info">单投递 {roi.costPerApplication}</Badge>
          <Badge tone="info">单有效 {roi.costPerEffective}</Badge>
          <Badge tone="info">单入职 {roi.costPerHire}</Badge>
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>平台效果对比</h2><BarChart3 size={18} /></div>
        <div className="bar-list">
          {visiblePlatforms.length === 0 && <EmptyState title="暂无真实平台指标" body="请先发布内容并导入平台后台数据；当前平台曝光、互动和点击均按 0 展示。" />}
          {visiblePlatforms.map((item) => (
            <div key={item.platform} className="bar-row">
              <strong>{item.platform}</strong>
              <Progress current={item.views} target={maxViews} />
              <span>{item.views.toLocaleString()} 曝光 · {item.interactions} 互动 · {item.clicks} 点击</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>岗位族群效果</h2><GitBranch size={18} /></div>
        {familyStats.length === 0 && <EmptyState title="暂无岗位族群数据" body="录入真实岗位并关联内容后，这里会按岗位族群汇总曝光和点击。" />}
        {familyStats.map((job) => <div className="compact-row" key={job.id}><div><strong>{job.family}</strong><span>{job.title} · {job.count} 条内容 · {job.views.toLocaleString()} 曝光</span></div><Badge tone="info">{job.clicks} 点击</Badge></div>)}
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>多触点归因</h2><Link size={18} /></div>
        {data.beisenResults.length === 0 && <EmptyState title="暂无北森回流归因" body="导入北森结果后，会按平台、内容和岗位关联投递/入职结果。" />}
        <div className="attribution-grid">
          {stageStats.map((item) => (
            <div key={item.stage} className="stage-card">
              <span>{item.stage}</span>
              <b>{item.count}</b>
              <Progress current={item.count} target={maxStageCount} />
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>内容类型贡献</h2><BookOpen size={18} /></div>
        {typeStats.length === 0 && <EmptyState title="暂无内容类型数据" body="发布或导入真实内容后，可按内容类型查看贡献。" />}
        {typeStats.map((item) => (
          <div className="compact-row" key={item.type}>
            <div><strong>{item.type}</strong><span>{item.count} 条内容 · {item.views.toLocaleString()} 曝光</span></div>
            <Badge tone="info">{item.clicks} 点击</Badge>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title"><h2>漏斗代理指标</h2><Target size={18} /></div>
        <div className="funnel">
          <div>发布内容 <b>{data.contents.length}</b></div>
          <div>曝光阅读 <b>{data.contents.reduce((sum, item) => sum + item.metrics.views, 0).toLocaleString()}</b></div>
          <div>互动行为 <b>{data.contents.reduce((sum, item) => sum + item.metrics.likes + item.metrics.comments + item.metrics.saves + item.metrics.shares, 0).toLocaleString()}</b></div>
          <div>入口点击 <b>{data.contents.reduce((sum, item) => sum + item.metrics.clicks, 0)}</b></div>
        </div>
      </section>
    </div>
  );
}

function TopicLibrary({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [topic, setTopic] = useState({ title: '', type: '岗位种草', platform: '全部' as TopicItem['platform'], targetJobId: '', owner: '招聘运营', inspiration: '', tags: '' });
  const addTopic = () => {
    if (!topic.title.trim()) return;
    const item: TopicItem = {
      id: `topic-${Date.now()}`,
      title: topic.title,
      type: topic.type,
      platform: topic.platform,
      targetJobId: topic.targetJobId || undefined,
      owner: topic.owner,
      status: '待认领',
      inspiration: topic.inspiration,
      tags: topic.tags.split(/[、,，/]/).map((tag) => tag.trim()).filter(Boolean),
      source: '人工',
      createdAt: nowText(),
      updatedAt: nowText(),
    };
    audit('新增选题', item.title, { ...data, topics: [item, ...data.topics] });
    setTopic({ title: '', type: '岗位种草', platform: '全部', targetJobId: '', owner: '招聘运营', inspiration: '', tags: '' });
  };
  const generateTopics = (jobId: string) => {
    const job = data.jobs.find((item) => item.id === jobId);
    if (!job) return;
    const topics = generateTopicsFromJob(job);
    audit('AI生成岗位选题', job.title, { ...data, topics: [...topics, ...data.topics] });
  };
  const updateTopic = (id: string, patch: Partial<TopicItem>) => {
    const target = data.topics.find((item) => item.id === id);
    if (!target) return;
    audit('更新选题', target.title, { ...data, topics: data.topics.map((item) => item.id === id ? { ...item, ...patch, updatedAt: nowText() } : item) });
  };
  const convertTopicToContent = (item: TopicItem) => {
    const job = data.jobs.find((current) => current.id === item.targetJobId) ?? data.jobs[0];
    if (!job) return;
    const risk = scanRisks(item.inspiration);
    const content: ContentTask = {
      id: `content-${Date.now()}`,
      title: `${item.platform === '全部' ? job.targetPlatforms[0] ?? '小红书' : item.platform}｜${item.title}`,
      jobId: job.id,
      platform: item.platform === '全部' ? job.targetPlatforms[0] ?? '小红书' : item.platform,
      accountId: data.accounts.find((account) => account.platform === (item.platform === '全部' ? job.targetPlatforms[0] : item.platform))?.id ?? '',
      type: item.type,
      status: '草稿',
      owner: item.owner,
      reviewer: '',
      dueDate: new Date().toISOString().slice(0, 10),
      content: item.inspiration || `围绕 ${job.title} 展开，回应候选人关注点并给出投递入口。`,
      tags: item.tags,
      riskLevel: risk.level,
      risks: risk.risks,
      metrics: { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, clicks: 0 },
    };
    audit('选题转内容任务', item.title, {
      ...data,
      contents: [content, ...data.contents],
      topics: data.topics.map((topicItem) => topicItem.id === item.id ? { ...topicItem, status: '已生成内容', updatedAt: nowText() } : topicItem),
    });
  };
  return (
    <div className="page-grid">
      <section className="toolbar">
        <div><h1>选题库</h1><p>沉淀岗位种草、技术观点、职场话题和校招内容选题，并转化为内容任务。</p></div>
        <button onClick={() => exportJson('选题库.json', data.topics)}><FileText size={16} />导出选题</button>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>新增选题</h2><Sparkles size={18} /></div>
        <div className="inline-form">
          <input value={topic.title} onChange={(event) => setTopic({ ...topic, title: event.target.value })} placeholder="选题标题" />
          <select value={topic.type} onChange={(event) => setTopic({ ...topic, type: event.target.value })}>{contentTypes.map((type) => <option key={type}>{type}</option>)}</select>
          <select value={topic.platform} onChange={(event) => setTopic({ ...topic, platform: event.target.value as TopicItem['platform'] })}><option>全部</option>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select>
          <select value={topic.targetJobId} onChange={(event) => setTopic({ ...topic, targetJobId: event.target.value })}><option value="">关联岗位</option>{data.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select>
          <button onClick={addTopic}><Plus size={16} />保存选题</button>
        </div>
        <div className="inline-form model-form">
          <input value={topic.owner} onChange={(event) => setTopic({ ...topic, owner: event.target.value })} placeholder="负责人" />
          <input value={topic.tags} onChange={(event) => setTopic({ ...topic, tags: event.target.value })} placeholder="标签，用顿号分隔" />
        </div>
        <textarea className="small-textarea" value={topic.inspiration} onChange={(event) => setTopic({ ...topic, inspiration: event.target.value })} placeholder="选题灵感、候选人痛点、可引用素材或平台表达方向" />
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>从岗位生成选题</h2><Bot size={18} /></div>
        <div className="entry-grid">
          {data.jobs.length === 0 && <EmptyState title="暂无岗位" body="先录入真实岗位后，可从岗位一键生成选题。" />}
          {data.jobs.map((job) => <article key={job.id}><strong>{job.title}</strong><span>{job.family} · {job.level} · {job.targetPlatforms.join('、')}</span><button className="ghost" onClick={() => generateTopics(job.id)}>生成 3 个选题</button></article>)}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>选题列表</h2><ClipboardList size={18} /></div>
        <div className="entry-grid">
          {data.topics.length === 0 && <EmptyState title="暂无真实选题" body="新增选题或从岗位生成选题后，会在这里管理认领、写作和复盘状态。" />}
          {data.topics.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.type} · {item.platform} · {item.owner} · {item.tags.join('、')}</span>
              <p>{item.inspiration}</p>
              <select value={item.status} onChange={(event) => updateTopic(item.id, { status: event.target.value as TopicItem['status'] })}>
                <option>待认领</option><option>已认领</option><option>写作中</option><option>已生成内容</option><option>已发布</option><option>已复盘</option><option>已归档</option>
              </select>
              <div className="row-actions"><Badge tone="info">{item.source}</Badge><button className="ghost" onClick={() => convertTopicToContent(item)}>转内容任务</button></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScheduleCalendar({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [view, setView] = useState<'周' | '月'>('周');
  const [platform, setPlatform] = useState<Platform | '全部'>('全部');
  const [accountId, setAccountId] = useState('全部');
  const [milestone, setMilestone] = useState({ title: '', date: new Date().toISOString().slice(0, 10), type: '招聘活动' as CalendarMilestone['type'], note: '' });
  const filtered = data.contents.filter((content) => (platform === '全部' || content.platform === platform) && (accountId === '全部' || content.accountId === accountId));
  const dates = [...new Set([...filtered.map((content) => content.dueDate), ...data.calendarMilestones.map((item) => item.date)])].filter(Boolean).sort();
  const updateContentDate = (id: string, dueDate: string) => {
    const target = data.contents.find((content) => content.id === id);
    audit('调整内容排期', `${target?.title ?? id}：${dueDate}`, { ...data, contents: data.contents.map((content) => content.id === id ? { ...content, dueDate } : content) });
  };
  const addMilestone = () => {
    if (!milestone.title.trim()) return;
    const item: CalendarMilestone = { id: `mile-${Date.now()}`, ...milestone };
    audit('新增日历节点', item.title, { ...data, calendarMilestones: [item, ...data.calendarMilestones] });
    setMilestone({ title: '', date: new Date().toISOString().slice(0, 10), type: '招聘活动', note: '' });
  };
  return (
    <div className="page-grid">
      <section className="toolbar">
        <div><h1>排期日历</h1><p>按周/月查看内容排期、平台频次、账号冲突和招聘节点。</p></div>
        <div className="toolbar-actions"><button className={view === '周' ? '' : 'secondary'} onClick={() => setView('周')}>周视图</button><button className={view === '月' ? '' : 'secondary'} onClick={() => setView('月')}>月视图</button></div>
      </section>
      <section className="panel wide">
        <div className="inline-form">
          <select value={platform} onChange={(event) => setPlatform(event.target.value as Platform | '全部')}><option>全部</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="全部">全部账号</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.platform}｜{account.name}</option>)}</select>
        </div>
        <div className={`calendar-grid ${view === '周' ? 'week-mode' : ''}`}>
          {dates.length === 0 && <EmptyState title="暂无排期" body="内容任务有截止日期后，会进入排期日历。" />}
          {dates.map((date) => (
            <div className="calendar-day" key={date}>
              <strong>{date}</strong>
              {data.calendarMilestones.filter((item) => item.date === date).map((item) => <div className="calendar-item milestone-item" key={item.id}><Badge tone="info">{item.type}</Badge><span>{item.title}</span><small>{item.note}</small></div>)}
              {filtered.filter((content) => content.dueDate === date).map((content) => {
                const conflicts = detectCalendarConflicts(content, data);
                return (
                  <div className="calendar-item" key={content.id}>
                    <strong>{content.title}</strong>
                    <span>{content.platform} · {content.status}</span>
                    <input type="date" value={content.dueDate} onChange={(event) => updateContentDate(content.id, event.target.value)} />
                    {conflicts.map((conflict) => <Badge key={conflict.type} tone={conflict.level === '阻断' ? 'danger' : conflict.level === '预警' ? 'warn' : 'info'}>{conflict.type}</Badge>)}
                    <details className="version-box"><summary>查看详情</summary><p>{content.content}</p>{conflicts.map((conflict) => <p key={conflict.message}>{conflict.message}</p>)}</details>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>招聘节点</h2><Target size={18} /></div>
        <div className="inline-form">
          <input value={milestone.title} onChange={(event) => setMilestone({ ...milestone, title: event.target.value })} placeholder="节点名称" />
          <input type="date" value={milestone.date} onChange={(event) => setMilestone({ ...milestone, date: event.target.value })} />
          <select value={milestone.type} onChange={(event) => setMilestone({ ...milestone, type: event.target.value as CalendarMilestone['type'] })}><option>节假日</option><option>校招节点</option><option>招聘活动</option><option>业务节点</option><option>自定义</option></select>
          <input value={milestone.note} onChange={(event) => setMilestone({ ...milestone, note: event.target.value })} placeholder="说明" />
          <button onClick={addMilestone}><Plus size={16} />新增节点</button>
        </div>
      </section>
    </div>
  );
}

function LeadPool({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [lead, setLead] = useState({ name: '', contact: '', sourcePlatform: '小红书' as Platform | '未知', sourceAccountId: '', sourceContentId: '', targetJobId: '', owner: '招聘专员', note: '' });
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [csv, setCsv] = useState('');
  const [follow, setFollow] = useState({ actor: '招聘专员', method: '私信' as LeadFollowUp['method'], result: '未回复' as LeadFollowUp['result'], content: '', nextFollowAt: '' });
  const [filters, setFilters] = useState({ keyword: '', platform: '全部' as Platform | '未知' | '全部', stage: '全部' as CandidateLead['stage'] | '全部', owner: '', jobId: '全部' });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [batchOwner, setBatchOwner] = useState('');
  const addLead = () => {
    if (!lead.name.trim() && !lead.contact.trim()) return;
    const item: CandidateLead = { id: `lead-${Date.now()}`, ...lead, sourceAccountId: lead.sourceAccountId || undefined, sourceContentId: lead.sourceContentId || undefined, targetJobId: lead.targetJobId || undefined, stage: '待联系', beisenStatus: '待转入', duplicateOf: undefined, createdAt: nowText(), updatedAt: nowText() };
    const duplicated = findDuplicateLead(data.candidateLeads, item);
    audit('新增候选人线索', item.name || item.contact, { ...data, candidateLeads: [{ ...item, duplicateOf: duplicated?.id }, ...data.candidateLeads] });
    setLead({ name: '', contact: '', sourcePlatform: '小红书', sourceAccountId: '', sourceContentId: '', targetJobId: '', owner: '招聘专员', note: '' });
  };
  const importLeads = () => {
    const leads = parseLeadCsv(csv, data.candidateLeads);
    if (leads.length === 0) return;
    audit('导入候选人线索', `${leads.length} 条`, { ...data, candidateLeads: [...leads, ...data.candidateLeads] });
    setCsv('');
  };
  const updateLead = (id: string, patch: Partial<CandidateLead>) => {
    const target = data.candidateLeads.find((item) => item.id === id);
    audit('更新候选人线索', target?.name ?? id, { ...data, candidateLeads: data.candidateLeads.map((item) => item.id === id ? { ...item, ...patch, updatedAt: nowText() } : item) });
  };
  const addFollowUp = () => {
    if (!selectedLeadId || !follow.content.trim()) return;
    const item: LeadFollowUp = { id: `follow-${Date.now()}`, leadId: selectedLeadId, ...follow, nextFollowAt: follow.nextFollowAt || undefined, createdAt: nowText() };
    audit('新增线索跟进', selectedLeadId, { ...data, leadFollowUps: [item, ...data.leadFollowUps] });
    setFollow({ actor: '招聘专员', method: '私信', result: '未回复', content: '', nextFollowAt: '' });
  };
  const transferToBeisen = (id: string) => {
    const item = data.candidateLeads.find((leadItem) => leadItem.id === id);
    if (!item) return;
    const result: BeisenResult = { id: `beisen-lead-${Date.now()}`, jobId: item.targetJobId ?? '', sourcePlatform: item.sourcePlatform, sourceContentId: item.sourceContentId, candidateCode: `lead-${item.id}`, stage: '已投递', importedAt: nowText() };
    audit('线索转入北森', item.name || item.contact, { ...data, candidateLeads: data.candidateLeads.map((leadItem) => leadItem.id === id ? { ...leadItem, stage: '已转北森', beisenStatus: '已转入', updatedAt: nowText() } : leadItem), beisenResults: [result, ...data.beisenResults] });
  };
  const filteredLeads = data.candidateLeads.filter((item) => (
    (!filters.keyword || `${item.name}${item.contact}${item.note}`.includes(filters.keyword))
    && (filters.platform === '全部' || item.sourcePlatform === filters.platform)
    && (filters.stage === '全部' || item.stage === filters.stage)
    && (!filters.owner || item.owner.includes(filters.owner))
    && (filters.jobId === '全部' || item.targetJobId === filters.jobId)
  ));
  const toggleLeadSelect = (id: string) => {
    setSelectedLeadIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const batchAssignOwner = () => {
    if (!batchOwner.trim() || selectedLeadIds.length === 0) return;
    audit('批量分配线索', `${selectedLeadIds.length} 条线索 -> ${batchOwner}`, {
      ...data,
      candidateLeads: data.candidateLeads.map((item) => selectedLeadIds.includes(item.id) ? { ...item, owner: batchOwner, updatedAt: nowText() } : item),
    });
    setBatchOwner('');
  };
  const batchTransferToBeisen = () => {
    const selected = data.candidateLeads.filter((item) => selectedLeadIds.includes(item.id) && item.beisenStatus !== '已转入');
    const results: BeisenResult[] = selected.map((item) => ({ id: `beisen-lead-${item.id}-${Date.now()}`, jobId: item.targetJobId ?? '', sourcePlatform: item.sourcePlatform, sourceContentId: item.sourceContentId, candidateCode: `lead-${item.id}`, stage: '已投递', importedAt: nowText() }));
    audit('批量线索转北森', `${selected.length} 条`, {
      ...data,
      candidateLeads: data.candidateLeads.map((item) => selectedLeadIds.includes(item.id) ? { ...item, stage: '已转北森', beisenStatus: '已转入', updatedAt: nowText() } : item),
      beisenResults: [...results, ...data.beisenResults],
    });
    setSelectedLeadIds([]);
  };
  const mergeDuplicateLeads = () => {
    const groups = data.candidateLeads.reduce<Record<string, CandidateLead[]>>((acc, item) => {
      if (!item.contact.trim()) return acc;
      acc[item.contact] = [...(acc[item.contact] ?? []), item];
      return acc;
    }, {});
    const duplicateIds = Object.values(groups).flatMap((group) => group.slice(1).map((item) => item.id));
    if (duplicateIds.length === 0) return;
    audit('合并重复线索', `${duplicateIds.length} 条重复线索`, { ...data, candidateLeads: data.candidateLeads.filter((item) => !duplicateIds.includes(item.id)) });
  };
  const selectedLead = data.candidateLeads.find((item) => item.id === selectedLeadId);
  return (
    <div className="page-grid">
      <section className="toolbar">
        <div><h1>线索池</h1><p>管理平台私信、评论、落地页和手动录入的候选人线索，并转入北森归因。</p></div>
        <button onClick={() => downloadText('候选人线索.csv', toCsv(data.candidateLeads.map((item) => ({ name: item.name, contact: item.contact, sourcePlatform: item.sourcePlatform, owner: item.owner, stage: item.stage, beisenStatus: item.beisenStatus }))), 'text/csv;charset=utf-8')}><FileText size={16} />导出线索</button>
      </section>
      <div className="stats-row">
        <StatCard label="总线索" value={data.candidateLeads.length} note="真实线索池" icon={Users} />
        <StatCard label="待联系" value={data.candidateLeads.filter((item) => item.stage === '待联系').length} note="需要跟进" icon={Bell} />
        <StatCard label="已转北森" value={data.candidateLeads.filter((item) => item.beisenStatus === '已转入').length} note="进入 ATS" icon={CheckCircle2} />
        <StatCard label="疑似重复" value={data.candidateLeads.filter((item) => item.duplicateOf).length} note="按联系方式识别" icon={AlertTriangle} />
      </div>
      <section className="panel wide">
        <div className="panel-title"><h2>新增线索</h2><Plus size={18} /></div>
        <div className="inline-form">
          <input value={lead.name} onChange={(event) => setLead({ ...lead, name: event.target.value })} placeholder="姓名/昵称" />
          <input value={lead.contact} onChange={(event) => setLead({ ...lead, contact: event.target.value })} placeholder="联系方式" />
          <select value={lead.sourcePlatform} onChange={(event) => setLead({ ...lead, sourcePlatform: event.target.value as Platform | '未知' })}><option>未知</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={lead.targetJobId} onChange={(event) => setLead({ ...lead, targetJobId: event.target.value })}><option value="">意向岗位</option>{data.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select>
          <button onClick={addLead}><Plus size={16} />保存线索</button>
        </div>
        <div className="inline-form model-form"><input value={lead.owner} onChange={(event) => setLead({ ...lead, owner: event.target.value })} placeholder="跟进人" /><input value={lead.note} onChange={(event) => setLead({ ...lead, note: event.target.value })} placeholder="备注" /></div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>批量导入</h2><Database size={18} /></div>
        <textarea className="small-textarea" value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="name,contact,sourcePlatform,targetJobId,owner,note&#10;张三,13800000000,脉脉,job-xxx,招聘专员,Java候选人" />
        <button className="full" onClick={importLeads}>导入线索</button>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>线索列表</h2><Users size={18} /></div>
        <div className="inline-form">
          <input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} placeholder="搜索姓名/联系方式/备注" />
          <select value={filters.platform} onChange={(event) => setFilters({ ...filters, platform: event.target.value as Platform | '未知' | '全部' })}><option>全部</option><option>未知</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value as CandidateLead['stage'] | '全部' })}><option>全部</option><option>待联系</option><option>已联系</option><option>已转北森</option><option>无效</option><option>暂不合适</option></select>
          <select value={filters.jobId} onChange={(event) => setFilters({ ...filters, jobId: event.target.value })}><option value="全部">全部岗位</option>{data.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select>
        </div>
        <div className="inline-form">
          <input value={filters.owner} onChange={(event) => setFilters({ ...filters, owner: event.target.value })} placeholder="跟进人筛选" />
          <input value={batchOwner} onChange={(event) => setBatchOwner(event.target.value)} placeholder="批量分配给" />
          <button className="secondary" onClick={batchAssignOwner}>批量分配</button>
          <button className="ghost" onClick={batchTransferToBeisen}>批量转北森</button>
          <button className="ghost" onClick={mergeDuplicateLeads}>合并重复</button>
        </div>
        <Badge tone="info">已选 {selectedLeadIds.length} / 当前 {filteredLeads.length}</Badge>
        {data.candidateLeads.length === 0 && <EmptyState title="暂无真实线索" body="可手动录入、CSV 导入或从落地页线索转入。" />}
        <table>
          <thead><tr><th>选择</th><th>线索</th><th>来源</th><th>意向岗位</th><th>阶段</th><th>北森</th><th>操作</th></tr></thead>
          <tbody>
            {filteredLeads.map((item) => (
              <tr key={item.id}>
                <td><input type="checkbox" checked={selectedLeadIds.includes(item.id)} onChange={() => toggleLeadSelect(item.id)} /></td>
                <td><strong>{item.name || '未命名'}</strong><span>{item.contact}{item.duplicateOf ? ' · 疑似重复' : ''}</span></td>
                <td>{item.sourcePlatform}<span>{data.accounts.find((account) => account.id === item.sourceAccountId)?.name ?? '未绑定账号'}</span></td>
                <td>{data.jobs.find((job) => job.id === item.targetJobId)?.title ?? '未关联'}</td>
                <td><select value={item.stage} onChange={(event) => updateLead(item.id, { stage: event.target.value as CandidateLead['stage'] })}><option>待联系</option><option>已联系</option><option>已转北森</option><option>无效</option><option>暂不合适</option></select></td>
                <td><Badge tone={item.beisenStatus === '已转入' ? 'good' : item.beisenStatus === '转入失败' ? 'danger' : 'warn'}>{item.beisenStatus}</Badge></td>
                <td><div className="row-actions"><button className="ghost" onClick={() => setSelectedLeadId(item.id)}>详情/跟进</button><button className="ghost" onClick={() => transferToBeisen(item.id)} disabled={item.beisenStatus === '已转入'}>转北森</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedLead && <div className="detail-panel">
          <strong>{selectedLead.name || selectedLead.contact}</strong>
          <span>{selectedLead.note || '暂无备注'}</span>
          <div className="inline-form">
            <input value={follow.actor} onChange={(event) => setFollow({ ...follow, actor: event.target.value })} placeholder="跟进人" />
            <select value={follow.method} onChange={(event) => setFollow({ ...follow, method: event.target.value as LeadFollowUp['method'] })}><option>私信</option><option>电话</option><option>微信</option><option>邮件</option><option>评论</option><option>其他</option></select>
            <select value={follow.result} onChange={(event) => setFollow({ ...follow, result: event.target.value as LeadFollowUp['result'] })}><option>未回复</option><option>有意向</option><option>已投递</option><option>不合适</option><option>待下次跟进</option></select>
            <input type="date" value={follow.nextFollowAt} onChange={(event) => setFollow({ ...follow, nextFollowAt: event.target.value })} />
            <button onClick={addFollowUp}>保存跟进</button>
          </div>
          <textarea className="small-textarea" value={follow.content} onChange={(event) => setFollow({ ...follow, content: event.target.value })} placeholder="沟通记录" />
          {data.leadFollowUps.filter((item) => item.leadId === selectedLead.id).map((item) => <p key={item.id}>{item.createdAt} · {item.actor} · {item.method} · {item.result}：{item.content}</p>)}
        </div>}
      </section>
    </div>
  );
}

function csvPreviewRows(csv: string) {
  const rows = csv.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length === 0) return { headers: [] as string[], rows: [] as string[][] };
  const headers = rows[0].split(',').map((item) => item.trim());
  return {
    headers,
    rows: rows.slice(1, 6).map((row) => row.split(',').map((item) => item.trim())),
  };
}

function csvAllRows(csv: string) {
  const rows = csv.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length === 0) return { headers: [] as string[], rows: [] as string[][] };
  const headers = rows[0].split(',').map((item) => item.trim());
  return {
    headers,
    rows: rows.slice(1).map((row) => row.split(',').map((item) => item.trim())),
  };
}

function rowObject(headers: string[], row: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
}

function remapCsv(csv: string, mappingText: string) {
  const parsedMapping = safeJsonObject(mappingText) as Record<string, string>;
  const rows = csv.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length === 0) return csv;
  const headers = rows[0].split(',').map((item) => item.trim());
  const mappedHeaders = headers.map((header) => parsedMapping[header] || header);
  return [mappedHeaders.join(','), ...rows.slice(1)].join('\n');
}

function ImportCenter({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [source, setSource] = useState<ImportRun['source']>('岗位');
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('手动粘贴.csv');
  const [lastImportMessage, setLastImportMessage] = useState('');
  const [mappingText, setMappingText] = useState('{"岗位名称":"title","平台":"platform","账号名称":"name","曝光":"views","点击":"clicks","候选人编号":"candidateCode"}');
  const [confirmImport, setConfirmImport] = useState(false);
  const mappedCsv = remapCsv(csv, mappingText);
  const preview = csvPreviewRows(mappedCsv);
  const allRows = csvAllRows(mappedCsv);
  const requiredHeaders: Record<ImportRun['source'], string[]> = {
    岗位: ['title'],
    内容指标: ['contentId'],
    北森结果: ['jobId', 'candidateCode', 'stage'],
    账号: ['platform', 'name'],
    素材: ['name', 'category'],
  };
  const missing = requiredHeaders[source].filter((header) => !preview.headers.includes(header));
  const rowErrors = allRows.rows
    .map((row, index) => {
      const object = rowObject(allRows.headers, row);
      const emptyFields = requiredHeaders[source].filter((header) => !String(object[header] ?? '').trim());
      return emptyFields.length > 0 ? `第 ${index + 2} 行缺少：${emptyFields.join('、')}` : '';
    })
    .filter(Boolean);
  const templates: Record<ImportRun['source'], string> = {
    岗位: 'title,family,city,level,type,jd,persona,sellingPoints,targetPlatforms,beisenUrl,websiteUrl\n',
    内容指标: 'contentId,title,views,likes,comments,saves,shares,clicks\n',
    北森结果: 'jobId,sourcePlatform,sourceContentId,candidateCode,stage\n',
    账号: 'platform,name,type,owner,positioning\n',
    素材: 'name,category,owner,scope,authorization,expiresAt\n',
  };
  const runImport = () => {
    if (!csv.trim()) return;
    let next: AppData = data;
    let recordCount = 0;
    const errors = [...(missing.length > 0 ? [`缺少必要字段：${missing.join('、')}`] : []), ...rowErrors];
    if (!confirmImport) {
      setLastImportMessage(errors.length === 0 ? `预检通过：将导入 ${allRows.rows.length} 行，请勾选确认后再导入` : errors.join('；'));
      return;
    }
    if (errors.length === 0) {
      if (source === '岗位') {
        const jobs = parseJobCsv(mappedCsv);
        recordCount = jobs.length;
        next = { ...next, jobs: [...jobs, ...next.jobs] };
      }
      if (source === '内容指标') {
        next = { ...next, contents: applyMetricsCsv(next.contents, mappedCsv) };
        recordCount = Math.max(0, mappedCsv.trim().split(/\r?\n/).length - 1);
      }
      if (source === '北森结果') {
        const results = parseBeisenCsv(mappedCsv);
        recordCount = results.length;
        next = { ...next, beisenResults: [...results, ...next.beisenResults] };
      }
      if (source === '账号') {
        const accounts = allRows.rows.map((row) => {
          const object = rowObject(allRows.headers, row);
          return {
            id: `acc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            platform: (object.platform || '小红书') as Platform,
            name: object.name || '未命名账号',
            type: (object.type || '招聘专用账号') as AccountType,
            owner: object.owner || '',
            positioning: object.positioning || '',
            publishingRoles: ['招聘专员'],
            reviewRule: '默认审核流程',
            attribution: '招聘团队',
            authStatus: '未授权' as const,
            status: '启用' as const,
          };
        });
        recordCount = accounts.length;
        next = { ...next, accounts: [...accounts, ...next.accounts] };
      }
      if (source === '素材') {
        const assets = allRows.rows.map((row) => {
          const object = rowObject(allRows.headers, row);
          return {
            id: `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: object.name || '未命名素材',
            category: object.category || '未分类',
            owner: object.owner || '',
            scope: object.scope || '招聘内容可用',
            platforms: ['小红书', '脉脉'] as Platform[],
            riskLevel: '中' as const,
            authorization: object.authorization || '待审核',
            expiresAt: object.expiresAt || '',
            usageCount: 0,
          };
        });
        recordCount = assets.length;
        next = { ...next, assets: [...assets, ...next.assets] };
      }
    }
    const run: ImportRun = {
      id: `import-${Date.now()}`,
      source,
      fileName,
      mapping: mappingText,
      status: errors.length === 0 ? '成功' : '失败',
      recordCount,
      errorRows: errors,
      createdAt: nowText(),
    };
    audit('执行数据导入', `${source}：${run.status}`, { ...next, importRuns: [run, ...next.importRuns] });
    setLastImportMessage(errors.length === 0 ? `已导入 ${recordCount} 条${source}数据` : errors.join('；'));
    if (errors.length === 0) setCsv('');
    setConfirmImport(false);
  };

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>导入中心</h1>
          <p>统一处理岗位、平台指标、北森结果、账号和素材的模板、预览、校验与导入历史。</p>
        </div>
        <button onClick={() => downloadText(`${source}导入模板.csv`, templates[source], 'text/csv;charset=utf-8')}><FileText size={16} />下载模板</button>
      </section>
      <section className="panel wide">
        <div className="module-tabs">
          {(['岗位', '内容指标', '北森结果', '账号', '素材'] as ImportRun['source'][]).map((item) => (
            <button key={item} className={source === item ? 'active' : ''} onClick={() => setSource(item)}>{item}</button>
          ))}
        </div>
        <div className="usage-steps">
          <div><b>1</b><span>选择导入类型并下载模板</span></div>
          <div><b>2</b><span>粘贴真实 CSV 数据，系统先预览前 5 行</span></div>
          <div><b>3</b><span>校验通过后写入对应业务模块</span></div>
        </div>
        <div className="inline-form">
          <select value={source} onChange={(event) => setSource(event.target.value as ImportRun['source'])}>
            <option>岗位</option>
            <option>内容指标</option>
            <option>北森结果</option>
            <option>账号</option>
            <option>素材</option>
          </select>
          <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="文件名" />
          <button onClick={runImport}><Database size={16} />校验并导入</button>
        </div>
        <label className="checkbox-line"><input type="checkbox" checked={confirmImport} onChange={(event) => setConfirmImport(event.target.checked)} />确认写入业务数据</label>
        <textarea className="small-textarea" value={csv} onChange={(event) => setCsv(event.target.value)} placeholder={templates[source]} />
        <textarea className="small-textarea" value={mappingText} onChange={(event) => setMappingText(event.target.value)} placeholder='字段映射 JSON，例如 {"岗位名称":"title","曝光":"views"}' />
        <div className="platform-note"><Database size={16} />识别到 {allRows.rows.length} 行数据，预览显示前 {preview.rows.length} 行。必要字段：{requiredHeaders[source].join('、')}</div>
        {lastImportMessage && <div className="platform-note"><CheckCircle2 size={16} />{lastImportMessage}</div>}
        {missing.length > 0 && <div className="platform-note danger-note"><AlertTriangle size={16} />缺少必要字段：{missing.join('、')}</div>}
        {rowErrors.length > 0 && (
          <div className="platform-note danger-note">
            <AlertTriangle size={16} />发现 {rowErrors.length} 条错误行
            <button className="ghost" onClick={() => downloadText(`${source}导入错误行.txt`, rowErrors.join('\n'), 'text/plain;charset=utf-8')}>下载错误行</button>
          </div>
        )}
        <table>
          <thead><tr>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{preview.rows.map((row, index) => <tr key={index}>{preview.headers.map((header, cell) => <td key={header}>{row[cell]}</td>)}</tr>)}</tbody>
        </table>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>导入历史</h2><ClipboardList size={18} /></div>
        {data.importRuns.length === 0 && <EmptyState title="暂无导入历史" body="每次导入都会记录来源、映射、错误行和导入数量。" />}
        <div className="entry-grid">
          {data.importRuns.map((run) => (
            <article key={run.id}>
              <strong>{run.source}｜{run.fileName}</strong>
              <span>{run.mapping || '未识别映射'} · {run.recordCount} 条 · {run.createdAt}</span>
              <Badge tone={run.status === '成功' ? 'good' : 'danger'}>{run.status}</Badge>
              {run.errorRows.map((error) => <span key={error}>{error}</span>)}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Reports({ data, audit, apiToken }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void; apiToken?: string }) {
  const [aiRecommendations, setAiRecommendations] = useState<string[]>([]);
  const [aiStatus, setAiStatus] = useState('');
  const [actionDraft, setActionDraft] = useState({ title: '', owner: '', dueDate: '', reportId: '' });
  const [selectedReportId, setSelectedReportId] = useState('');
  const [reportEdit, setReportEdit] = useState({ title: '', body: '', action: '', severity: '建议' as ReportInsight['severity'] });
  const [reportParams, setReportParams] = useState({ period: '周报' as '周报' | '月报' | '自定义', platform: '全部' as Platform | '全部', family: '全部', from: '', to: '' });
  const recommendations = aiRecommendations.length > 0 ? aiRecommendations : buildRecommendations(data);
  const inReportRange = (date?: string) => {
    if (!date) return true;
    if (reportParams.from && date < reportParams.from) return false;
    if (reportParams.to && date > reportParams.to) return false;
    return true;
  };
  const scopedContents = data.contents.filter((item) => (
    inReportRange(item.publishedAt ?? item.dueDate)
    && (reportParams.platform === '全部' || item.platform === reportParams.platform)
    && (reportParams.family === '全部' || data.jobs.find((job) => job.id === item.jobId)?.family === reportParams.family)
  ));
  const sortedContents = scopedContents.slice().sort((a, b) => (b.metrics.clicks + b.metrics.likes + b.metrics.comments) - (a.metrics.clicks + a.metrics.likes + a.metrics.comments));
  const generatedReports = data.reports.length > 0
    ? data.reports
    : data.contents.length > 0
      ? [{
          id: 'auto-rp-empty',
          title: '已有内容数据，等待更多真实指标',
          body: '当前系统已存在内容任务，但复盘需要曝光、互动、点击等真实平台指标支撑。',
          action: '请在数据分析页导入平台指标 CSV，再生成周报。',
          severity: '建议' as const,
        }]
      : [];
  const generateReport = async () => {
    let reportRecommendations = recommendations;
    const model = findModelApi(data, '复盘建议');
    if (model) {
      setAiStatus('正在调用大模型生成复盘建议...');
      const result = await runModelTask(model, '复盘建议', { data }, apiToken);
      if (result.ok && result.text) {
        reportRecommendations = result.text.split(/\n+/).map((item) => item.replace(/^[-\d.、\s]+/, '').trim()).filter(Boolean);
        setAiRecommendations(reportRecommendations);
        setAiStatus(`已使用 ${model.name} 生成复盘建议`);
      } else {
        setAiStatus(`模型调用失败，已回退本地建议：${result.message ?? '未知错误'}`);
      }
    } else {
      setAiStatus('未配置复盘建议模型，使用本地规则');
    }
    const contentCount = scopedContents.length;
    const clickCount = scopedContents.reduce((sum, item) => sum + item.metrics.clicks, 0);
    const views = scopedContents.reduce((sum, item) => sum + item.metrics.views, 0);
    const interactions = scopedContents.reduce((sum, item) => sum + item.metrics.likes + item.metrics.comments + item.metrics.saves + item.metrics.shares, 0);
    const platformLine = platforms.map((platform) => {
      const items = scopedContents.filter((content) => content.platform === platform);
      return items.length ? `${platform} ${items.length} 条/${items.reduce((sum, item) => sum + item.metrics.clicks, 0)} 点击` : '';
    }).filter(Boolean).join('；');
    const report = {
      id: `rp-${Date.now()}`,
      title: `${reportParams.period}复盘：${contentCount} 条内容 / ${clickCount} 次点击`,
      body: `范围：${reportParams.platform} · ${reportParams.family}。曝光 ${views}，互动 ${interactions}，点击 ${clickCount}。${platformLine ? `平台拆解：${platformLine}。` : ''}${reportRecommendations.join(' ')}`,
      action: '请将高表现内容转为模板，低表现内容进入标题/CTA/平台匹配复盘，并补齐缺失的北森结果。',
      severity: '建议' as const,
    };
    const actions: ReportAction[] = [
      { id: `report-action-${Date.now()}-1`, reportId: report.id, title: '沉淀高表现内容模板', owner: '新媒体运营', dueDate: reportParams.to || '', status: '未开始', createdAt: nowText() },
      { id: `report-action-${Date.now()}-2`, reportId: report.id, title: '补齐低表现内容的点击和北森回流数据', owner: '招聘专员', dueDate: reportParams.to || '', status: '未开始', createdAt: nowText() },
    ];
    audit('生成复盘报告', report.title, { ...data, reports: [report, ...data.reports], reportActions: [...actions, ...data.reportActions] });
  };
  const createReportAction = () => {
    if (!actionDraft.title.trim()) return;
    const item: ReportAction = {
      id: `report-action-${Date.now()}`,
      reportId: actionDraft.reportId || data.reports[0]?.id || 'manual',
      title: actionDraft.title,
      owner: actionDraft.owner || '未分配',
      dueDate: actionDraft.dueDate,
      status: '未开始',
      createdAt: nowText(),
    };
    audit('创建复盘行动项', item.title, { ...data, reportActions: [item, ...data.reportActions] });
    setActionDraft({ title: '', owner: '', dueDate: '', reportId: '' });
  };
  const updateReportAction = (id: string, status: ReportAction['status']) => {
    const target = data.reportActions.find((item) => item.id === id);
    audit('更新复盘行动项', `${target?.title ?? id}：${status}`, { ...data, reportActions: data.reportActions.map((item) => item.id === id ? { ...item, status } : item) });
  };
  const openReport = (report: ReportInsight) => {
    setSelectedReportId(report.id);
    setReportEdit({ title: report.title, body: report.body, action: report.action, severity: report.severity });
  };
  const saveReportEdit = () => {
    const target = data.reports.find((item) => item.id === selectedReportId);
    if (!target) return;
    audit('编辑复盘报告', reportEdit.title, { ...data, reports: data.reports.map((item) => item.id === selectedReportId ? { ...item, ...reportEdit } : item) });
  };
  const removeReport = (id: string) => {
    const target = data.reports.find((item) => item.id === id);
    audit('删除复盘报告', target?.title ?? id, { ...data, reports: data.reports.filter((item) => item.id !== id), reportActions: data.reportActions.filter((item) => item.reportId !== id) });
    if (selectedReportId === id) setSelectedReportId('');
  };
  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>复盘报告</h1>
          <p>自动识别高低表现内容，生成周报/月报、行动建议和案例沉淀。</p>
        </div>
        <div className="toolbar-actions">
          <button onClick={() => void generateReport()}><Sparkles size={16} />生成复盘</button>
          <button onClick={() => downloadText('招聘新媒体运营周报.md', buildReportMarkdown(data), 'text/markdown;charset=utf-8')}><FileText size={16} />下载周报</button>
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>AI 运营策略建议</h2><Bot size={18} /></div>
        <div className="inline-form">
          <select value={reportParams.period} onChange={(event) => setReportParams({ ...reportParams, period: event.target.value as '周报' | '月报' | '自定义' })}><option>周报</option><option>月报</option><option>自定义</option></select>
          <select value={reportParams.platform} onChange={(event) => setReportParams({ ...reportParams, platform: event.target.value as Platform | '全部' })}><option>全部</option>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select>
          <select value={reportParams.family} onChange={(event) => setReportParams({ ...reportParams, family: event.target.value })}><option>全部</option>{[...new Set(data.jobs.map((job) => job.family))].map((family) => <option key={family}>{family}</option>)}</select>
          <input type="date" value={reportParams.from} onChange={(event) => setReportParams({ ...reportParams, from: event.target.value })} />
          <input type="date" value={reportParams.to} onChange={(event) => setReportParams({ ...reportParams, to: event.target.value })} />
        </div>
        {aiStatus && <div className="platform-note"><Bot size={16} />{aiStatus}</div>}
        <div className="template-grid">
          {recommendations.map((item) => <div className="template-chip" key={item}>策略建议<small>{item}</small></div>)}
        </div>
      </section>
      <section className="panel wide">
        <div className="report-header">
          <span>2026 年 5 月招聘新媒体运营周报 / 月报</span>
          <Badge tone="good">自动生成</Badge>
        </div>
        <div className="report-grid">
          {generatedReports.length === 0 && <EmptyState title="暂无真实复盘报告" body="没有真实内容和平台指标时，系统不生成演示洞察。" />}
          {generatedReports.map((report) => (
            <article key={report.id} className="report-card">
              <Badge tone={report.severity === '机会' ? 'good' : report.severity === '风险' ? 'danger' : 'info'}>{report.severity}</Badge>
              <h3>{report.title}</h3>
              <p>{report.body}</p>
              <strong>行动计划：{report.action}</strong>
              <div className="card-actions-inline">
                <button className="secondary" onClick={() => openReport(report)}>打开详情</button>
                {data.reports.some((item) => item.id === report.id) && <button className="ghost" onClick={() => removeReport(report.id)}>删除</button>}
              </div>
            </article>
          ))}
        </div>
        {selectedReportId && (
          <div className="detail-panel">
            <strong>复盘报告详情</strong>
            <input value={reportEdit.title} onChange={(event) => setReportEdit({ ...reportEdit, title: event.target.value })} placeholder="报告标题" />
            <textarea className="small-textarea" value={reportEdit.body} onChange={(event) => setReportEdit({ ...reportEdit, body: event.target.value })} placeholder="报告正文" />
            <textarea className="small-textarea" value={reportEdit.action} onChange={(event) => setReportEdit({ ...reportEdit, action: event.target.value })} placeholder="行动计划" />
            <select value={reportEdit.severity} onChange={(event) => setReportEdit({ ...reportEdit, severity: event.target.value as ReportInsight['severity'] })}>
              <option>机会</option>
              <option>风险</option>
              <option>建议</option>
            </select>
            <div className="card-actions-inline">
              <button className="secondary" onClick={saveReportEdit}>保存报告</button>
              <button className="ghost" onClick={() => downloadText(`${reportEdit.title || '复盘报告'}.md`, `# ${reportEdit.title}\n\n${reportEdit.body}\n\n## 行动计划\n${reportEdit.action}`, 'text/markdown;charset=utf-8')}>导出当前报告</button>
            </div>
          </div>
        )}
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>高低表现内容对比</h2><Sparkles size={18} /></div>
        <div className="template-grid">
          {data.contents.length === 0 && <EmptyState title="暂无高表现特征" body="导入真实内容效果后，系统会提炼标题、平台、账号和岗位族群特征。" />}
          {sortedContents.slice(0, 4)
            .map((content) => (
              <div className="template-chip" key={content.id}>高表现｜{content.title}<small>{content.platform} · {content.metrics.clicks} 点击 · {content.metrics.likes + content.metrics.comments} 互动</small></div>
            ))}
          {sortedContents.length > 1 && sortedContents.slice(-3).reverse()
            .map((content) => (
              <div className="template-chip" key={`low-${content.id}`}>低表现｜{content.title}<small>{content.platform} · {content.metrics.clicks} 点击 · 建议复盘标题和渠道匹配</small></div>
            ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>复盘行动跟踪</h2><ClipboardList size={18} /></div>
        <div className="inline-form">
          <input value={actionDraft.title} onChange={(event) => setActionDraft({ ...actionDraft, title: event.target.value })} placeholder="行动项，例如补齐小红书岗位种草模板" />
          <input value={actionDraft.owner} onChange={(event) => setActionDraft({ ...actionDraft, owner: event.target.value })} placeholder="负责人" />
          <input type="date" value={actionDraft.dueDate} onChange={(event) => setActionDraft({ ...actionDraft, dueDate: event.target.value })} />
          <select value={actionDraft.reportId} onChange={(event) => setActionDraft({ ...actionDraft, reportId: event.target.value })}>
            <option value="">关联最近报告</option>
            {data.reports.map((report) => <option value={report.id} key={report.id}>{report.title}</option>)}
          </select>
          <button onClick={createReportAction}><Plus size={16} />新增行动项</button>
        </div>
        {data.reportActions.length === 0 && <EmptyState title="暂无复盘行动项" body="生成复盘后，可把建议拆成负责人、截止日期和处理状态。" />}
        <div className="entry-grid">
          {data.reportActions.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.owner} · {item.dueDate || '未定日期'} · {item.createdAt}</span>
              <select value={item.status} onChange={(event) => updateReportAction(item.id, event.target.value as ReportAction['status'])}>
                <option>未开始</option>
                <option>进行中</option>
                <option>已完成</option>
              </select>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AiWorkbench({ data, audit, apiToken }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void; apiToken?: string }) {
  const [template, setTemplate] = useState({ task: '内容生成' as PromptTemplate['task'], name: '', provider: '通用', prompt: '' });
  const [runDraft, setRunDraft] = useState({ templateId: '', modelApiId: '', input: '' });
  const [status, setStatus] = useState('');
  const [modelApi, setModelApi] = useState({
    provider: 'DeepSeek' as ModelApiConfig['provider'],
    name: '',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    enabledFor: '内容生成、风险识别、复盘建议、标题推荐',
  });
  const addWorkbenchModelApi = () => {
    if (!modelApi.name.trim()) return;
    const item: ModelApiConfig = {
      id: `model-api-${Date.now()}`,
      provider: modelApi.provider,
      name: modelApi.name,
      baseUrl: modelApi.baseUrl,
      apiKey: modelApi.apiKey,
      model: modelApi.model,
      enabledFor: modelApi.enabledFor.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean) as ModelApiConfig['enabledFor'],
      status: modelApi.baseUrl && modelApi.apiKey && modelApi.model ? '待验证' : '未配置',
    };
    audit('保存统一大模型配置', item.name, { ...data, modelApis: [item, ...data.modelApis] });
    setModelApi({ provider: 'DeepSeek', name: '', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat', enabledFor: '内容生成、风险识别、复盘建议、标题推荐' });
  };
  const testWorkbenchModelApi = async (id: string) => {
    const target = data.modelApis.find((item) => item.id === id);
    if (!target) return;
    const result = await testModelApiConfig(target, apiToken);
    audit('测试统一大模型配置', `${target.name}：${result.message}`, {
      ...data,
      modelApis: data.modelApis.map((item) => item.id === id ? { ...item, status: result.status, lastTestAt: nowText() } : item),
      notifications: [makeNotification('大模型连接测试', `${target.name}：${result.message}`, 'AI工作台', result.ok ? '提醒' : '预警'), ...data.notifications],
    });
  };
  const removeWorkbenchModelApi = (id: string) => {
    const target = data.modelApis.find((item) => item.id === id);
    audit('删除统一大模型配置', target?.name ?? id, { ...data, modelApis: data.modelApis.filter((item) => item.id !== id) });
  };
  const addTemplate = () => {
    if (!template.name.trim() || !template.prompt.trim()) return;
    const item: PromptTemplate = {
      id: `prompt-${Date.now()}`,
      ...template,
      enabled: true,
      updatedAt: nowText(),
    };
    audit('新增提示词模板', item.name, { ...data, promptTemplates: [item, ...data.promptTemplates] });
    setTemplate({ task: '内容生成', name: '', provider: '通用', prompt: '' });
  };
  const toggleTemplate = (id: string) => {
    const target = data.promptTemplates.find((item) => item.id === id);
    audit('切换提示词模板状态', target?.name ?? id, { ...data, promptTemplates: data.promptTemplates.map((item) => item.id === id ? { ...item, enabled: !item.enabled, updatedAt: nowText() } : item) });
  };
  const runTemplate = async (retryLog?: ModelRunLog) => {
    const selectedTemplate = retryLog
      ? data.promptTemplates.find((item) => item.task === retryLog.task && item.enabled)
      : data.promptTemplates.find((item) => item.id === runDraft.templateId) ?? data.promptTemplates.find((item) => item.enabled);
    const selectedModel = data.modelApis.find((item) => item.id === (retryLog?.modelApiId || runDraft.modelApiId)) ?? findModelApi(data, selectedTemplate?.task ?? '内容生成');
    if (!selectedTemplate || !selectedModel) {
      setStatus('请先配置启用的提示词模板和大模型 API');
      return;
    }
    setStatus('正在调用模型...');
    const task = selectedTemplate.task === '标题推荐' ? '内容生成' : selectedTemplate.task;
    const result = await runModelTask(selectedModel, task, {
      prompt: selectedTemplate.prompt,
      input: retryLog?.inputSummary || runDraft.input,
    }, apiToken);
    const log: ModelRunLog = {
      id: `model-log-${Date.now()}`,
      modelApiId: selectedModel.id,
      task: selectedTemplate.task,
      status: result.ok ? '成功' : '失败',
      inputSummary: retryLog?.inputSummary || runDraft.input.slice(0, 200),
      outputPreview: result.text?.slice(0, 400) ?? '',
      message: result.message ?? (result.ok ? '调用成功' : '调用失败'),
      ranAt: nowText(),
    };
    audit('运行大模型任务', `${selectedTemplate.name}：${log.status}`, { ...data, modelRunLogs: [log, ...data.modelRunLogs] });
    setStatus(log.message);
  };

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>AI 工作台</h1>
          <p>统一管理大模型 Token/API、提示词模板、任务试跑、调用日志和失败重试；内容、复盘、风险识别都从这里读取模型配置。</p>
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>统一模型入口</h2><LockKeyhole size={18} /></div>
        <div className="usage-steps">
          <div><b>1</b><span>在这里保存 DeepSeek/OpenAI 兼容 API</span></div>
          <div><b>2</b><span>选择模型用途：内容生成、风险识别、复盘建议、标题推荐</span></div>
          <div><b>3</b><span>各业务模块自动读取启用模型，不再分别维护 Token</span></div>
        </div>
        <div className="inline-form">
          <select value={modelApi.provider} onChange={(event) => setModelApi({ ...modelApi, provider: event.target.value as ModelApiConfig['provider'] })}>
            <option>DeepSeek</option>
            <option>OpenAI</option>
            <option>Azure OpenAI</option>
            <option>通义千问</option>
            <option>智谱</option>
            <option>私有模型</option>
            <option>其他</option>
          </select>
          <input value={modelApi.name} onChange={(event) => setModelApi({ ...modelApi, name: event.target.value })} placeholder="配置名称，例如 DeepSeek 招聘助手" />
          <input value={modelApi.baseUrl} onChange={(event) => setModelApi({ ...modelApi, baseUrl: event.target.value })} placeholder="API Base URL" />
          <input value={modelApi.model} onChange={(event) => setModelApi({ ...modelApi, model: event.target.value })} placeholder="模型名称" />
          <button onClick={addWorkbenchModelApi}><Plus size={16} />保存模型</button>
        </div>
        <div className="inline-form model-form">
          <input type="password" value={modelApi.apiKey} onChange={(event) => setModelApi({ ...modelApi, apiKey: event.target.value })} placeholder="API Key / Token" />
          <input value={modelApi.enabledFor} onChange={(event) => setModelApi({ ...modelApi, enabledFor: event.target.value })} placeholder="用途，用顿号分隔" />
        </div>
        <div className="entry-grid">
          {data.modelApis.length === 0 && <EmptyState title="暂无统一模型配置" body="保存模型后，内容生成、风险识别和复盘建议会统一调用这里的配置。" />}
          {data.modelApis.map((item) => (
            <article key={item.id}>
              <strong>{item.provider}｜{item.name}</strong>
              <span>{item.baseUrl} · {item.model} · {item.apiKey ? 'Token已配置' : 'Token未配置'}</span>
              <span>用途：{item.enabledFor.join('、')}</span>
              <Badge tone={item.status === '已连接' ? 'good' : item.status === '连接失败' ? 'danger' : 'warn'}>{item.status}</Badge>
              {item.lastTestAt && <span>最近测试：{item.lastTestAt}</span>}
              <div className="card-actions-inline">
                <button className="ghost" onClick={() => void testWorkbenchModelApi(item.id)}>测试连接</button>
                <button className="ghost" onClick={() => removeWorkbenchModelApi(item.id)}>删除</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>提示词模板</h2><Bot size={18} /></div>
        <div className="inline-form">
          <select value={template.task} onChange={(event) => setTemplate({ ...template, task: event.target.value as PromptTemplate['task'] })}>
            <option>内容生成</option>
            <option>风险识别</option>
            <option>复盘建议</option>
            <option>标题推荐</option>
          </select>
          <input value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} placeholder="模板名称" />
          <input value={template.provider} onChange={(event) => setTemplate({ ...template, provider: event.target.value })} placeholder="适用模型/平台" />
          <button onClick={addTemplate}><Plus size={16} />保存模板</button>
        </div>
        <textarea className="small-textarea" value={template.prompt} onChange={(event) => setTemplate({ ...template, prompt: event.target.value })} placeholder="输入系统提示词、变量说明和输出格式要求" />
        <div className="entry-grid">
          {data.promptTemplates.length === 0 && <EmptyState title="暂无提示词模板" body="可创建内容生成、风险识别、复盘建议和标题推荐模板。" />}
          {data.promptTemplates.map((item) => (
            <article key={item.id}>
              <strong>{item.task}｜{item.name}</strong>
              <span>{item.provider} · {item.updatedAt}</span>
              <p>{item.prompt}</p>
              <button className="ghost" onClick={() => toggleTemplate(item.id)}>{item.enabled ? '停用' : '启用'}</button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>任务试跑</h2><Sparkles size={18} /></div>
        <div className="inline-form">
          <select value={runDraft.templateId} onChange={(event) => setRunDraft({ ...runDraft, templateId: event.target.value })}>
            <option value="">选择模板</option>
            {data.promptTemplates.filter((item) => item.enabled).map((item) => <option value={item.id} key={item.id}>{item.task}｜{item.name}</option>)}
          </select>
          <select value={runDraft.modelApiId} onChange={(event) => setRunDraft({ ...runDraft, modelApiId: event.target.value })}>
            <option value="">选择模型配置</option>
            {data.modelApis.map((item) => <option value={item.id} key={item.id}>{item.name}｜{item.model}</option>)}
          </select>
          <button onClick={() => void runTemplate()}><Bot size={16} />运行</button>
        </div>
        <textarea className="small-textarea" value={runDraft.input} onChange={(event) => setRunDraft({ ...runDraft, input: event.target.value })} placeholder="输入岗位、平台、内容草稿或复盘数据" />
        {status && <div className="platform-note"><Bot size={16} />{status}</div>}
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>调用日志</h2><ClipboardList size={18} /></div>
        {data.modelRunLogs.length === 0 && <EmptyState title="暂无模型调用日志" body="AI 工作台和内容/复盘模块调用后会记录成功、失败、输入摘要和输出预览。" />}
        <div className="entry-grid">
          {data.modelRunLogs.map((log) => (
            <article key={log.id}>
              <strong>{log.task} · {log.status}</strong>
              <span>{data.modelApis.find((item) => item.id === log.modelApiId)?.name ?? log.modelApiId} · {log.ranAt}</span>
              <span>{log.message}</span>
              {log.outputPreview && <p>{log.outputPreview}</p>}
              {log.status === '失败' && <button className="ghost" onClick={() => void runTemplate(log)}>重试</button>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsPage({ data, update, resetData, apiToken }: { data: AppData; update: (data: AppData) => void; resetData: () => void; apiToken?: string }) {
  const [role, setRole] = useState({ name: '', dataScope: '个人' as PermissionRole['dataScope'], permissions: '岗位查看、内容创建' });
  const [rule, setRule] = useState({ keyword: '', category: '合规表达', riskLevel: '高' as SensitiveRule['riskLevel'], suggestion: '' });
  const [user, setUser] = useState({ name: '', roleId: '', team: '招聘团队' });
  const [workflow, setWorkflow] = useState({ name: '', platform: '全部' as WorkflowRule['platform'], contentType: '全部', minRiskLevel: '高' as WorkflowRule['minRiskLevel'] });
  const [mapping, setMapping] = useState({ name: '', integrationType: '北森' as IntegrationMapping['integrationType'], scenario: '北森线索同步' as IntegrationMapping['scenario'], method: 'POST' as IntegrationMapping['method'], endpointPath: '', resultPath: '', fieldMapping: '{"candidateName":"name","mobile":"contact","jobCode":"jobId"}' });
  const [policy, setPolicy] = useState({ title: '', scope: '隐私授权' as CompliancePolicy['scope'], owner: '', content: '' });
  const [task, setTask] = useState({ title: '', category: '平台接口' as DeploymentTask['category'], owner: '', dueDate: '', note: '' });
  const [pluginRule, setPluginRule] = useState({ platform: '小红书' as Platform, name: '', urlPattern: '', selectors: '{"title":"h1","views":".view","likes":".like"}' });
  const [systemStatus, setSystemStatus] = useState('');
  const [modelApi, setModelApi] = useState({
    provider: 'OpenAI' as ModelApiConfig['provider'],
    name: '',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: '',
    enabledFor: '内容生成、风险识别、复盘建议',
  });
  const permissionOptions = ['工作台查看', '岗位查看', '内容查看', '内容创建', '内容审核', '素材查看', '账号查看', '数据查看', '数据导入', '复盘查看', 'AI配置', '系统配置', '全部'];
  const toggleRolePermission = (permission: string) => {
    const current = role.permissions.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean);
    const next = current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission];
    setRole({ ...role, permissions: next.join('、') });
  };
  const addRole = () => {
    if (!role.name.trim()) return;
    const item: PermissionRole = {
      id: `role-${Date.now()}`,
      name: role.name,
      dataScope: role.dataScope,
      permissions: role.permissions.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean),
    };
    update({ ...data, roles: [item, ...data.roles] });
    setRole({ name: '', dataScope: '个人', permissions: '岗位查看、内容创建' });
  };
  const addRule = () => {
    if (!rule.keyword.trim()) return;
    const item: SensitiveRule = {
      id: `rule-${Date.now()}`,
      ...rule,
      enabled: true,
    };
    update({ ...data, sensitiveRules: [item, ...data.sensitiveRules] });
    setRule({ keyword: '', category: '合规表达', riskLevel: '高', suggestion: '' });
  };
  const addUser = () => {
    if (!user.name.trim()) return;
    const item: UserProfile = {
      id: `user-${Date.now()}`,
      name: user.name,
      roleId: user.roleId || data.roles[0]?.id || 'default-role',
      team: user.team,
      status: '启用',
    };
    update({ ...data, users: [item, ...data.users] });
    setUser({ name: '', roleId: '', team: '招聘团队' });
  };
  const removeRole = (id: string) => {
    update({ ...data, roles: data.roles.filter((item) => item.id !== id), users: data.users.map((item) => item.roleId === id ? { ...item, roleId: '' } : item) });
  };
  const updateUserStatus = (id: string, status: UserProfile['status']) => {
    update({ ...data, users: data.users.map((item) => item.id === id ? { ...item, status } : item) });
  };
  const applyRolePreset = (preset: '招聘专员' | '运营管理员' | '技术审核人' | '管理层') => {
    const presets: Record<typeof preset, { dataScope: PermissionRole['dataScope']; permissions: string }> = {
      招聘专员: { dataScope: '个人', permissions: '工作台查看、岗位查看、内容查看、内容创建、素材查看、账号查看、数据查看' },
      运营管理员: { dataScope: '团队', permissions: '工作台查看、岗位查看、内容查看、内容创建、素材查看、账号查看、数据查看、复盘查看、数据导入、AI配置' },
      技术审核人: { dataScope: '团队', permissions: '工作台查看、内容查看、内容审核、素材查看' },
      管理层: { dataScope: '全部', permissions: '全部' },
    };
    setRole({ name: preset, ...presets[preset] });
  };
  const addWorkflow = () => {
    if (!workflow.name.trim()) return;
    const item: WorkflowRule = {
      id: `workflow-${Date.now()}`,
      name: workflow.name,
      platform: workflow.platform,
      contentType: workflow.contentType,
      minRiskLevel: workflow.minRiskLevel,
      steps: ['草稿', 'AI已生成', '待专业补充', '待专业审核', '待品牌合规审核', '待平台适配', '待发布', '已发布'],
      enabled: true,
    };
    update({ ...data, workflowRules: [item, ...data.workflowRules] });
    setWorkflow({ name: '', platform: '全部', contentType: '全部', minRiskLevel: '高' });
  };
  const addModelApi = () => {
    if (!modelApi.name.trim()) return;
    const item: ModelApiConfig = {
      id: `model-api-${Date.now()}`,
      provider: modelApi.provider,
      name: modelApi.name,
      baseUrl: modelApi.baseUrl,
      apiKey: modelApi.apiKey,
      model: modelApi.model,
      enabledFor: modelApi.enabledFor.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean) as ModelApiConfig['enabledFor'],
      status: modelApi.baseUrl && modelApi.apiKey && modelApi.model ? '待验证' : '未配置',
    };
    update({ ...data, modelApis: [item, ...data.modelApis] });
    setModelApi({ provider: 'OpenAI', name: '', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: '', enabledFor: '内容生成、风险识别、复盘建议' });
  };
  const addIntegrationMapping = () => {
    if (!mapping.name.trim()) return;
    const item: IntegrationMapping = {
      id: `mapping-${Date.now()}`,
      ...mapping,
      enabled: true,
    };
    update({ ...data, integrationMappings: [item, ...data.integrationMappings] });
    setMapping({ name: '', integrationType: '北森', scenario: '北森线索同步', method: 'POST', endpointPath: '', resultPath: '', fieldMapping: '{"candidateName":"name","mobile":"contact","jobCode":"jobId"}' });
  };
  const applyMappingToIntegration = (id: string) => {
    const item = data.integrationMappings.find((current) => current.id === id);
    if (!item) return;
    const nextExtra = JSON.stringify({
      method: item.method,
      endpointPath: item.endpointPath,
      resultPath: item.resultPath,
      fieldMapping: safeJsonObject(item.fieldMapping),
      fields: safeJsonObject(item.fieldMapping),
    }, null, 2);
    update({
      ...data,
      integrations: data.integrations.map((integration) => integration.type === item.integrationType ? { ...integration, extraConfig: nextExtra } : integration),
      auditLogs: [{
        id: `log-${Date.now()}`,
        actor: '当前用户',
        action: '应用集成字段映射',
        target: item.name,
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      }, ...data.auditLogs],
    });
  };
  const addPolicy = () => {
    if (!policy.title.trim()) return;
    const item: CompliancePolicy = {
      id: `policy-${Date.now()}`,
      ...policy,
      status: '生效',
      updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    update({ ...data, compliancePolicies: [item, ...data.compliancePolicies] });
    setPolicy({ title: '', scope: '隐私授权', owner: '', content: '' });
  };
  const addDeploymentTask = () => {
    if (!task.title.trim()) return;
    const item: DeploymentTask = {
      id: `deploy-${Date.now()}`,
      ...task,
      status: '未开始',
    };
    update({ ...data, deploymentTasks: [item, ...data.deploymentTasks] });
    setTask({ title: '', category: '平台接口', owner: '', dueDate: '', note: '' });
  };
  const addPluginRule = () => {
    if (!pluginRule.name.trim()) return;
    const item: PluginRule = {
      id: `plugin-rule-${Date.now()}`,
      ...pluginRule,
      enabled: true,
      updatedAt: nowText(),
    };
    update({ ...data, pluginRules: [item, ...data.pluginRules] });
    setPluginRule({ platform: '小红书', name: '', urlPattern: '', selectors: '{"title":"h1","views":".view","likes":".like"}' });
  };
  const togglePluginRule = (id: string) => {
    update({ ...data, pluginRules: data.pluginRules.map((item) => item.id === id ? { ...item, enabled: !item.enabled, updatedAt: nowText() } : item) });
  };
  const updateDeploymentStatus = (id: string, status: DeploymentTask['status']) => {
    update({ ...data, deploymentTasks: data.deploymentTasks.map((item) => item.id === id ? { ...item, status } : item) });
  };
  const updatePolicyStatus = (id: string, status: CompliancePolicy['status']) => {
    update({ ...data, compliancePolicies: data.compliancePolicies.map((item) => item.id === id ? { ...item, status, updatedAt: nowText() } : item) });
  };
  const checkSystemHealth = async () => {
    try {
      const result = await loadSystemHealth(apiToken);
      setSystemStatus(`存储 ${result.storage}，数据文件 ${Math.round(result.dataFileSize / 1024)} KB，备份 ${result.backupCount} 份，内容 ${result.counts.contents} 条，线索 ${result.counts.landingLeads} 条`);
    } catch {
      setSystemStatus('系统健康检查失败，请确认已登录本地 API');
    }
  };
  const runBackup = async () => {
    try {
      const result = await createSystemBackup(apiToken);
      setSystemStatus(`备份已生成：${result.backupFile}`);
    } catch {
      setSystemStatus('备份失败，请确认本地 API 可用且已登录');
    }
  };
  const testModelApi = async (id: string) => {
    const target = data.modelApis.find((item) => item.id === id);
    if (!target) return;
    const result = await testModelApiConfig(target, apiToken);
    update({
      ...data,
      modelApis: data.modelApis.map((item) => item.id === id ? {
        ...item,
        status: result.status,
        lastTestAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      } : item),
      notifications: [
        makeNotification('大模型 API 测试', `${target.name}：${result.message}`, '系统配置', result.ok ? '提醒' : '预警'),
        ...data.notifications,
      ],
    });
  };
  const removeModelApi = (id: string) => {
    update({ ...data, modelApis: data.modelApis.filter((item) => item.id !== id) });
  };
  const restoreBackup = async (file: File | undefined) => {
    if (!file) return;
    const restored = await readJsonFile<AppData>(file);
    update({ ...emptyData, ...restored });
  };
  const updateOperationSetting = (patch: Partial<OperationSettings>) => {
    update({ ...data, operationSettings: { ...data.operationSettings, ...patch } });
  };
  const updateWeeklyTarget = (platform: Platform, value: number) => {
    update({
      ...data,
      operationSettings: {
        ...data.operationSettings,
        weeklyPlatformTargets: { ...data.operationSettings.weeklyPlatformTargets, [platform]: value },
      },
    });
  };
  const remainingItems = [
    '生产存储：已完成本地 JSON 加固、原子写入、备份接口和健康检查，可通过上线台账规划数据库/对象存储替换',
    '北森 OpenAPI：已提供配置、测试、同步、字段映射和结果回流框架，拿到真实接口字段后可直接配置映射',
    '新媒体平台：已提供平台 API 拉取、字段映射、CSV 导入和浏览器插件采集框架',
    '浏览器插件：已创建 MV3 插件目录，默认地址可改为任意内网访问地址',
    '企业微信/飞书：已支持 Webhook 摘要发送，并纳入集成测试与同步记录',
    '公网落地页：已提供公开线索接口、埋点 SDK、隐私合规台账和上线任务管理',
  ];
  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>系统配置</h1>
          <p>角色权限、审核流程、品牌规范、风险规则、敏感词和操作日志。</p>
        </div>
        <div className="toolbar-actions">
          <button onClick={() => exportJson('招聘运营助手_数据备份.json', data)}><Database size={16} />整库备份</button>
          <label className="file-button">
            <LockKeyhole size={16} />恢复备份
            <input type="file" accept="application/json" onChange={(event) => void restoreBackup(event.target.files?.[0])} />
          </label>
          <button className="secondary" onClick={resetData}>清空本地数据</button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>角色权限矩阵</h2><Users size={18} /></div>
	        <div className="form-grid single">
	          <input value={role.name} onChange={(event) => setRole({ ...role, name: event.target.value })} placeholder="角色名称" />
          <select value={role.dataScope} onChange={(event) => setRole({ ...role, dataScope: event.target.value as PermissionRole['dataScope'] })}>
            <option>个人</option>
            <option>团队</option>
            <option>全部</option>
          </select>
	          <input value={role.permissions} onChange={(event) => setRole({ ...role, permissions: event.target.value })} placeholder="权限，用顿号分隔" />
	          <button onClick={addRole}><Plus size={16} />新增角色</button>
	        </div>
        <div className="permission-grid">
          {permissionOptions.map((permission) => (
            <label key={permission}>
              <input
                type="checkbox"
                checked={role.permissions.split(/[、,，/]/).map((item) => item.trim()).includes(permission)}
                onChange={() => toggleRolePermission(permission)}
              />
              {permission}
            </label>
          ))}
        </div>
        <div className="module-tabs">
          {(['招聘专员', '运营管理员', '技术审核人', '管理层'] as const).map((item) => <button key={item} onClick={() => applyRolePreset(item)}>{item}预设</button>)}
        </div>
        {['招聘专员', '招聘主管', '新媒体运营', '技术负责人', '管理层'].map((role) => (
          <div className="compact-row" key={role}>
            <div><strong>{role}</strong><span>岗位、内容、素材、账号、数据范围差异化控制</span></div>
            <Badge tone="info">已配置</Badge>
          </div>
        ))}
        {data.roles.map((item) => (
          <div className="compact-row" key={item.id}>
            <div><strong>{item.name}</strong><span>{item.dataScope} · {item.permissions.join('、')}</span></div>
            <div className="row-actions"><Badge tone="good">自定义</Badge><button className="ghost" onClick={() => removeRole(item.id)}>删除</button></div>
          </div>
        ))}
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>运营阈值配置</h2><Settings size={18} /></div>
        <div className="inline-form">
          <label>内容质量阻断分<input type="number" value={data.operationSettings.contentQualityBlockScore} onChange={(event) => updateOperationSetting({ contentQualityBlockScore: Number(event.target.value) })} /></label>
          <label>账号停更提醒天数<input type="number" value={data.operationSettings.accountInactiveWarningDays} onChange={(event) => updateOperationSetting({ accountInactiveWarningDays: Number(event.target.value) })} /></label>
          <label>账号停更高危天数<input type="number" value={data.operationSettings.accountInactiveDangerDays} onChange={(event) => updateOperationSetting({ accountInactiveDangerDays: Number(event.target.value) })} /></label>
          <label>同账号日发布上限<input type="number" value={data.operationSettings.dailyAccountPublishLimit} onChange={(event) => updateOperationSetting({ dailyAccountPublishLimit: Number(event.target.value) })} /></label>
          <label>数据回收延迟天数<input type="number" value={data.operationSettings.dataCollectionDelayDays} onChange={(event) => updateOperationSetting({ dataCollectionDelayDays: Number(event.target.value) })} /></label>
          <label>审核 SLA 小时<input type="number" value={data.operationSettings.reviewSlaHours} onChange={(event) => updateOperationSetting({ reviewSlaHours: Number(event.target.value) })} /></label>
        </div>
        <div className="template-grid">
          {platforms.map((platform) => (
            <label className="template-chip" key={platform}>
              {platform} 周发布目标
              <input type="number" value={data.operationSettings.weeklyPlatformTargets[platform] ?? 0} onChange={(event) => updateWeeklyTarget(platform, Number(event.target.value))} />
            </label>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>用户与团队</h2><Users size={18} /></div>
        <div className="form-grid single">
          <input value={user.name} onChange={(event) => setUser({ ...user, name: event.target.value })} placeholder="成员姓名" />
          <input value={user.team} onChange={(event) => setUser({ ...user, team: event.target.value })} placeholder="所属团队" />
          <select value={user.roleId} onChange={(event) => setUser({ ...user, roleId: event.target.value })}>
            <option value="">选择角色</option>
            {data.roles.map((roleItem) => <option key={roleItem.id} value={roleItem.id}>{roleItem.name}</option>)}
          </select>
          <button onClick={addUser}><Plus size={16} />新增用户</button>
        </div>
        {data.users.length === 0 && <EmptyState title="暂无用户" body="正式后端接入前，可先在本地维护团队成员和角色。" />}
        {data.users.map((item) => (
          <div className="compact-row" key={item.id}>
            <div><strong>{item.name}</strong><span>{item.team} · {data.roles.find((roleItem) => roleItem.id === item.roleId)?.name ?? item.roleId}</span></div>
            <select value={item.status} onChange={(event) => updateUserStatus(item.id, event.target.value as UserProfile['status'])}>
              <option>启用</option>
              <option>停用</option>
            </select>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title"><h2>高风险规则库</h2><ShieldCheck size={18} /></div>
        <div className="form-grid single">
          <input value={rule.keyword} onChange={(event) => setRule({ ...rule, keyword: event.target.value })} placeholder="敏感词 / 红线主题" />
          <input value={rule.category} onChange={(event) => setRule({ ...rule, category: event.target.value })} placeholder="分类" />
          <select value={rule.riskLevel} onChange={(event) => setRule({ ...rule, riskLevel: event.target.value as SensitiveRule['riskLevel'] })}>
            <option>低</option>
            <option>中</option>
            <option>高</option>
          </select>
          <input value={rule.suggestion} onChange={(event) => setRule({ ...rule, suggestion: event.target.value })} placeholder="替代表达建议" />
          <button onClick={addRule}><Plus size={16} />新增规则</button>
        </div>
        {['薪酬福利承诺', '业务数据与客户信息', '技术架构与算法细节', '员工照片与个人经历', '竞品与舆情表达', '校招转正承诺', '招聘歧视与虚假宣传'].map((rule) => (
          <div className="rule-row" key={rule}><AlertTriangle size={15} />{rule}</div>
        ))}
        {data.sensitiveRules.map((item) => (
          <div className="rule-row" key={item.id}><AlertTriangle size={15} />{item.keyword} · {item.category} · {item.riskLevel}风险</div>
        ))}
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>大模型 API 配置</h2><Bot size={18} /></div>
        <p className="helper">支持 OpenAI 兼容接口。API Key 仅保存在本地数据文件/缓存中，正式部署前建议迁移到服务端密钥管理。</p>
        <div className="inline-form">
          <select value={modelApi.provider} onChange={(event) => setModelApi({ ...modelApi, provider: event.target.value as ModelApiConfig['provider'] })}>
            <option>OpenAI</option>
            <option>Azure OpenAI</option>
            <option>通义千问</option>
            <option>DeepSeek</option>
            <option>智谱</option>
            <option>私有模型</option>
            <option>其他</option>
          </select>
          <input value={modelApi.name} onChange={(event) => setModelApi({ ...modelApi, name: event.target.value })} placeholder="配置名称" />
          <input value={modelApi.baseUrl} onChange={(event) => setModelApi({ ...modelApi, baseUrl: event.target.value })} placeholder="API Base URL，如 https://api.openai.com/v1" />
          <input value={modelApi.model} onChange={(event) => setModelApi({ ...modelApi, model: event.target.value })} placeholder="模型名称，如 gpt-4.1-mini" />
          <button onClick={addModelApi}><Plus size={16} />保存配置</button>
        </div>
        <div className="inline-form model-form">
          <input type="password" value={modelApi.apiKey} onChange={(event) => setModelApi({ ...modelApi, apiKey: event.target.value })} placeholder="API Key" />
          <input value={modelApi.enabledFor} onChange={(event) => setModelApi({ ...modelApi, enabledFor: event.target.value })} placeholder="用途，用顿号分隔：内容生成、风险识别、复盘建议、标题推荐" />
        </div>
        <div className="entry-grid">
          {data.modelApis.length === 0 && <EmptyState title="暂无大模型 API 配置" body="添加配置后，可用于内容生成、风险识别、复盘建议和标题推荐。" />}
          {data.modelApis.map((item) => (
            <article key={item.id}>
              <strong>{item.provider}｜{item.name}</strong>
              <span>{item.baseUrl} · {item.model}</span>
              <span>用途：{item.enabledFor.join('、')}</span>
              <span>密钥：{item.apiKey ? '已配置' : '未配置'}</span>
              <Badge tone={item.status === '已连接' ? 'good' : item.status === '连接失败' ? 'danger' : 'warn'}>{item.status}</Badge>
              {item.lastTestAt && <span>最近测试：{item.lastTestAt}</span>}
              <div className="card-actions-inline">
                <button className="ghost" onClick={() => void testModelApi(item.id)}>测试连接</button>
                <button className="ghost" onClick={() => removeModelApi(item.id)}>删除</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>审核流程配置</h2><GitBranch size={18} /></div>
        <div className="inline-form">
          <input value={workflow.name} onChange={(event) => setWorkflow({ ...workflow, name: event.target.value })} placeholder="流程名称" />
          <select value={workflow.platform} onChange={(event) => setWorkflow({ ...workflow, platform: event.target.value as WorkflowRule['platform'] })}>
            <option>全部</option>
            {platforms.map((platform) => <option key={platform}>{platform}</option>)}
          </select>
          <input value={workflow.contentType} onChange={(event) => setWorkflow({ ...workflow, contentType: event.target.value })} placeholder="内容类型或全部" />
          <select value={workflow.minRiskLevel} onChange={(event) => setWorkflow({ ...workflow, minRiskLevel: event.target.value as WorkflowRule['minRiskLevel'] })}>
            <option>低</option>
            <option>中</option>
            <option>高</option>
          </select>
          <button onClick={addWorkflow}><Plus size={16} />新增流程</button>
        </div>
        <div className="workflow">
          {['草稿', 'AI已生成', '待专业补充', '待专业审核', '待品牌合规审核', '待平台适配', '待发布', '已发布', '数据回收中', '已复盘'].map((step) => (
            <span key={step}>{step}</span>
          ))}
        </div>
        <div className="entry-grid">
          {data.workflowRules.map((item) => (
            <article key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.platform} · {item.contentType} · {item.minRiskLevel}风险起</span>
              <Badge tone={item.enabled ? 'good' : 'warn'}>{item.enabled ? '启用' : '停用'}</Badge>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>生产集成字段映射</h2><Link size={18} /></div>
        <p className="helper">用于把北森、平台 API、BI 的真实字段映射到系统标准字段。保存后可一键写入对应集成的扩展配置。</p>
        <div className="inline-form">
          <input value={mapping.name} onChange={(event) => setMapping({ ...mapping, name: event.target.value })} placeholder="映射名称" />
          <select value={mapping.integrationType} onChange={(event) => setMapping({ ...mapping, integrationType: event.target.value as IntegrationMapping['integrationType'] })}>
            <option>北森</option>
            <option>平台API</option>
            <option>企业微信</option>
            <option>飞书</option>
            <option>BI</option>
          </select>
          <select value={mapping.scenario} onChange={(event) => setMapping({ ...mapping, scenario: event.target.value as IntegrationMapping['scenario'] })}>
            <option>北森线索同步</option>
            <option>北森结果回流</option>
            <option>平台指标拉取</option>
            <option>BI同步</option>
            <option>消息发送</option>
            <option>其他</option>
          </select>
          <select value={mapping.method} onChange={(event) => setMapping({ ...mapping, method: event.target.value as IntegrationMapping['method'] })}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
          </select>
          <button onClick={addIntegrationMapping}><Plus size={16} />保存映射</button>
        </div>
        <div className="inline-form model-form">
          <input value={mapping.endpointPath} onChange={(event) => setMapping({ ...mapping, endpointPath: event.target.value })} placeholder="接口路径，如 api/v1/candidates" />
          <input value={mapping.resultPath} onChange={(event) => setMapping({ ...mapping, resultPath: event.target.value })} placeholder="结果路径，如 data.records" />
          <input value={mapping.fieldMapping} onChange={(event) => setMapping({ ...mapping, fieldMapping: event.target.value })} placeholder='字段映射 JSON，如 {"candidateName":"name"}' />
        </div>
        <div className="entry-grid">
          {data.integrationMappings.length === 0 && <EmptyState title="暂无字段映射" body="拿到北森或平台接口字段后，可先在这里维护标准映射。" />}
          {data.integrationMappings.map((item) => (
            <article key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.integrationType} · {item.scenario} · {item.method} {item.endpointPath || '/'}</span>
              <span>结果路径：{item.resultPath || '根节点'}</span>
              <Badge tone={item.enabled ? 'good' : 'warn'}>{item.enabled ? '启用' : '停用'}</Badge>
              <button className="ghost" onClick={() => applyMappingToIntegration(item.id)}>应用到同类型集成</button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>平台插件采集规则</h2><Database size={18} /></div>
        <p className="helper">用于浏览器插件或人工采集时识别平台页面字段。真实平台规则可由运营按 URL 和 CSS 选择器持续维护。</p>
        <div className="inline-form">
          <select value={pluginRule.platform} onChange={(event) => setPluginRule({ ...pluginRule, platform: event.target.value as Platform })}>
            {platforms.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={pluginRule.name} onChange={(event) => setPluginRule({ ...pluginRule, name: event.target.value })} placeholder="规则名称" />
          <input value={pluginRule.urlPattern} onChange={(event) => setPluginRule({ ...pluginRule, urlPattern: event.target.value })} placeholder="URL 匹配规则，如 xiaohongshu.com/explore/*" />
          <button onClick={addPluginRule}><Plus size={16} />保存规则</button>
        </div>
        <textarea className="small-textarea" value={pluginRule.selectors} onChange={(event) => setPluginRule({ ...pluginRule, selectors: event.target.value })} placeholder='字段选择器 JSON，如 {"title":"h1","views":".view"}' />
        <div className="entry-grid">
          {data.pluginRules.length === 0 && <EmptyState title="暂无插件采集规则" body="后续由使用人按各平台页面结构配置 URL、字段和选择器。" />}
          {data.pluginRules.map((item) => (
            <article key={item.id}>
              <strong>{item.platform}｜{item.name}</strong>
              <span>{item.urlPattern || '未配置 URL 规则'} · {item.updatedAt}</span>
              <p>{item.selectors}</p>
              <button className="ghost" onClick={() => togglePluginRule(item.id)}>{item.enabled ? '停用' : '启用'}</button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>隐私合规与上线台账</h2><ShieldCheck size={18} /></div>
        <div className="inline-form">
          <input value={policy.title} onChange={(event) => setPolicy({ ...policy, title: event.target.value })} placeholder="制度/文案名称" />
          <select value={policy.scope} onChange={(event) => setPolicy({ ...policy, scope: event.target.value as CompliancePolicy['scope'] })}>
            <option>隐私授权</option>
            <option>招聘合规</option>
            <option>内容审核</option>
            <option>数据安全</option>
            <option>公网落地页</option>
          </select>
          <input value={policy.owner} onChange={(event) => setPolicy({ ...policy, owner: event.target.value })} placeholder="负责人" />
          <button onClick={addPolicy}><Plus size={16} />保存合规项</button>
        </div>
        <textarea className="small-textarea" value={policy.content} onChange={(event) => setPolicy({ ...policy, content: event.target.value })} placeholder="隐私授权、候选人告知、内容审核口径或数据保留策略" />
        <div className="inline-form">
          <input value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} placeholder="上线任务" />
          <select value={task.category} onChange={(event) => setTask({ ...task, category: event.target.value as DeploymentTask['category'] })}>
            <option>账号体系</option>
            <option>数据库</option>
            <option>平台接口</option>
            <option>安全合规</option>
            <option>运维监控</option>
            <option>插件发布</option>
          </select>
          <input value={task.owner} onChange={(event) => setTask({ ...task, owner: event.target.value })} placeholder="负责人" />
          <input type="date" value={task.dueDate} onChange={(event) => setTask({ ...task, dueDate: event.target.value })} />
          <button onClick={addDeploymentTask}><Plus size={16} />加入台账</button>
        </div>
        <input value={task.note} onChange={(event) => setTask({ ...task, note: event.target.value })} placeholder="上线依赖、账号权限、接口文档、验收说明" />
        <div className="entry-grid">
          {data.compliancePolicies.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.scope} · {item.owner || '未分配'} · {item.updatedAt}</span>
              <p>{item.content}</p>
              <select value={item.status} onChange={(event) => updatePolicyStatus(item.id, event.target.value as CompliancePolicy['status'])}>
                <option>草稿</option>
                <option>生效</option>
                <option>待更新</option>
              </select>
            </article>
          ))}
          {data.deploymentTasks.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.category} · {item.owner || '未分配'} · {item.dueDate || '未定日期'}</span>
              <p>{item.note}</p>
              <select value={item.status} onChange={(event) => updateDeploymentStatus(item.id, event.target.value as DeploymentTask['status'])}>
                <option>未开始</option>
                <option>进行中</option>
                <option>已完成</option>
              </select>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>系统健康与备份</h2><Database size={18} /></div>
        <div className="toolbar-actions">
          <button onClick={() => void checkSystemHealth()}><RefreshCw size={16} />健康检查</button>
          <button onClick={() => void runBackup()}><Database size={16} />立即备份</button>
        </div>
        {systemStatus && <div className="platform-note"><ShieldCheck size={16} />{systemStatus}</div>}
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>操作日志</h2><ShieldCheck size={18} /></div>
        <button onClick={() => downloadText('操作审计日志.csv', toCsv(data.auditLogs.map((log) => ({ createdAt: log.createdAt, actor: log.actor, action: log.action, target: log.target }))), 'text/csv;charset=utf-8')}><FileText size={16} />导出审计日志</button>
        {data.auditLogs.length === 0 && <EmptyState title="暂无操作日志" body="录入真实数据后，系统会保留创建、导入、审核和配置动作。" />}
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>动作</th>
              <th>对象</th>
            </tr>
          </thead>
          <tbody>
            {data.auditLogs.slice(0, 12).map((log) => (
              <tr key={log.id}>
                <td>{log.createdAt}</td>
                <td>{log.actor}</td>
                <td>{log.action}</td>
                <td>{log.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>待配置资源与上线事项</h2><ClipboardList size={18} /></div>
        <div className="todo-grid">
          {remainingItems.map((item) => (
            <div className="todo-item" key={item}><CheckCircle2 size={16} />{item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function renderSection(
  section: Section,
  data: AppData,
  update: (data: AppData) => void,
  audit: (action: string, target: string, nextData?: AppData) => void,
  resetData: () => void,
  openSection: (section: Section) => void,
  apiToken?: string,
) {
  switch (section) {
    case '工作台':
      return <Dashboard data={data} audit={audit} openSection={openSection} />;
    case '招聘需求':
      return <Jobs data={data} audit={audit} />;
    case '选题库':
      return <TopicLibrary data={data} audit={audit} />;
    case '内容运营':
      return <ContentOps data={data} audit={audit} apiToken={apiToken} />;
    case '排期日历':
      return <ScheduleCalendar data={data} audit={audit} />;
    case '线索池':
      return <LeadPool data={data} audit={audit} />;
    case '素材资产':
      return <Assets data={data} audit={audit} apiToken={apiToken} />;
    case '账号与平台':
      return <Accounts data={data} audit={audit} apiToken={apiToken} />;
    case '导入中心':
      return <ImportCenter data={data} audit={audit} />;
    case '数据分析':
      return <Analytics data={data} audit={audit} />;
    case '复盘报告':
      return <Reports data={data} audit={audit} apiToken={apiToken} />;
    case 'AI工作台':
      return <AiWorkbench data={data} audit={audit} apiToken={apiToken} />;
    case '系统配置':
      return <SettingsPage data={data} update={update} resetData={resetData} apiToken={apiToken} />;
  }
}

function canAccessSection(section: Section, data: AppData, apiUser: ApiUser | null) {
  if (!apiUser || apiUser.role === '系统管理员' || apiUser.role === '管理员') return true;
  const role = data.roles.find((item) => item.name === apiUser.role || item.id === apiUser.role);
  if (!role) return section === '工作台';
  const permission = sectionPermissions[section];
  return role.permissions.includes(permission) || role.permissions.includes('全部') || role.permissions.includes(`${section}管理`);
}

export function App() {
  const [section, setSection] = useState<Section>('工作台');
  const { data, update, audit, resetData, storageMode, apiUser, apiToken, authRequired, authError, login, logout } = useAppData();
  const permittedNavItems = navItems.filter(({ key }) => canAccessSection(key, data, apiUser));
  const activeSection = canAccessSection(section, data, apiUser) ? section : permittedNavItems[0]?.key ?? '工作台';

  if (authRequired) {
    return <LoginScreen onLogin={login} error={authError} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div><Sparkles size={22} /></div>
          <span>招聘运营助手</span>
        </div>
        <nav>
          {permittedNavItems.map(({ key, icon: Icon }) => (
            <button key={key} className={activeSection === key ? 'active' : ''} onClick={() => setSection(key)}>
              <Icon size={18} />
              {key}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Badge tone="good">一期闭环版</Badge>
          <Badge tone={storageMode === '本地API' ? 'good' : 'warn'}>{storageMode}</Badge>
          {apiUser && <small>{apiUser.name} · {apiUser.role}</small>}
          {apiUser && <button className="ghost" onClick={logout}>退出登录</button>}
          <small>Web 系统 · 北森前置运营中台</small>
        </div>
      </aside>
      <main>
        {renderSection(activeSection, data, update, audit, resetData, setSection, apiToken)}
      </main>
    </div>
  );
}
