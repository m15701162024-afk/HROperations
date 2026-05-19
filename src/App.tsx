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
import { useEffect, useMemo, useState } from 'react';
import { type ApiUser, loadRemoteData, loginLocalApi, normalizeAppData, runModelTask, saveRemoteData, testIntegrationConfig, testModelApiConfig, uploadAssetFile } from './api';
import { emptyData, generateContent, nextStatus, platformPositioning, platforms, scanRisks } from './data';
import type { AccountType, AppData, AssetItem, ContentReviewComment, ContentStatus, ContentTask, ContentVersion, CostRecord, IntegrationConfig, JobNeed, LandingPage, LandingPageLead, ModelApiConfig, NotificationItem, PermissionRole, Platform, PlatformAccount, RecruitmentEntry, SensitiveRule, UserProfile, WorkflowRule } from './types';
import { applyMetricsCsv, buildRecommendations, buildReportMarkdown, calculateRoi, downloadText, exportJson, parseBeisenCsv, parseJobCsv, readJsonFile, toCsv } from './utils';

type Section =
  | '工作台'
  | '招聘需求'
  | '内容运营'
  | '素材资产'
  | '账号与平台'
  | '数据分析'
  | '复盘报告'
  | '系统配置';

const navItems: { key: Section; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: '工作台', icon: Home },
  { key: '招聘需求', icon: ClipboardList },
  { key: '内容运营', icon: Megaphone },
  { key: '素材资产', icon: Database },
  { key: '账号与平台', icon: Users },
  { key: '数据分析', icon: BarChart3 },
  { key: '复盘报告', icon: BookOpen },
  { key: '系统配置', icon: Settings },
];

const contentTypes = ['岗位种草', '技术团队内容', '员工故事', '公司/业务介绍', '面试/求职干货', '短视频脚本', '图文笔记', '长文', '校招内容'];

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
    void saveRemoteData(next, apiToken).then((saved) => {
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
        <small>默认本地账号：admin / HRAssistant@2026。首次启动会自动创建本地管理员。</small>
      </form>
    </div>
  );
}

function Dashboard({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [goal, setGoal] = useState({ title: '', dimension: '平台', target: 0, current: 0, metric: '发布篇数' });
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

  return (
    <div className="page-grid">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">招聘新媒体运营中台</span>
          <h1>从 JD 到内容、审核、发布、归因和复盘的一条链路</h1>
          <p>当前版本覆盖 PRD 中的一期核心闭环：岗位需求、AI 生成、风险识别、排期发布、数据看板、素材与账号权限、复盘沉淀。</p>
        </div>
        <div className="hero-actions">
          <button><Sparkles size={16} />生成内容</button>
          <button className="secondary"><BarChart3 size={16} />查看看板</button>
        </div>
      </div>

      <div className="stats-row">
        <StatCard label="内容发布数量" value={totals.published} note="已发布/回收/复盘" icon={FileText} />
        <StatCard label="曝光/阅读/播放" value={totals.views.toLocaleString()} note="全平台合计" icon={Rocket} />
        <StatCard label="互动量" value={totals.interactions.toLocaleString()} note="赞评藏转合计" icon={PieChart} />
        <StatCard label="招聘入口点击" value={totals.clicks.toLocaleString()} note="北森/官网跳转前" icon={Link} />
      </div>

      <section className="panel wide">
        <div className="panel-title">
          <h2>通知中心</h2>
          <Bell size={18} />
        </div>
        {pendingNotices.length === 0 && <EmptyState title="暂无待办通知" body="高风险内容、素材授权到期、审核流待办会在这里汇总。" />}
        <div className="notice-list">
          {pendingNotices.map((notice) => (
            <div className="compact-row" key={notice.id}>
              <div><strong>{notice.title}</strong><span>{notice.body}</span></div>
              <Badge tone={notice.level === '预警' ? 'danger' : notice.level === '待办' ? 'warn' : 'info'}>{notice.level}</Badge>
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

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>招聘需求</h1>
          <p>手动创建、表格导入与后续北森同步的岗位需求源头。</p>
        </div>
        <button onClick={exportJobs}><FileText size={16} />导出岗位CSV</button>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>新增岗位需求</h2><Plus size={18} /></div>
        <div className="form-grid">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="岗位名称" />
          <input value={form.family} onChange={(event) => setForm({ ...form, family: event.target.value })} placeholder="岗位族群" />
          <input value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} placeholder="岗位层级" />
          <input value={form.targetPlatforms} onChange={(event) => setForm({ ...form, targetPlatforms: event.target.value })} placeholder="目标平台，用顿号分隔" />
          <textarea value={form.jd} onChange={(event) => setForm({ ...form, jd: event.target.value })} placeholder="JD / 岗位描述" />
          <textarea value={form.sellingPoints} onChange={(event) => setForm({ ...form, sellingPoints: event.target.value })} placeholder="岗位卖点，用顿号分隔" />
        </div>
        <button className="full" onClick={createJob}><Plus size={16} />保存岗位</button>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>CSV 导入</h2><Database size={18} /></div>
        <p className="helper">支持字段：title/family/city/level/type/jd/persona/sellingPoints/targetPlatforms，或中文表头。</p>
        <textarea className="small-textarea" value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="title,family,city&#10;高级前端,前端,杭州" />
        <button className="full" onClick={importJobs}><Database size={16} />解析并导入</button>
      </section>
      <section className="panel wide">
        <table>
          <thead>
            <tr>
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
                <td colSpan={7}><EmptyState title="暂无真实岗位需求" body="请通过上方表单录入，或粘贴 CSV 批量导入。" /></td>
              </tr>
            )}
            {data.jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <strong>{job.title}</strong>
                  <span>{job.persona}</span>
                </td>
                <td>{job.family}</td>
                <td>{job.level}</td>
                <td>{job.targetPlatforms.join(' / ')}</td>
                <td><Badge tone="good">{job.status}</Badge></td>
                <td><Badge tone="info">北森/官网</Badge></td>
                <td><button className="ghost" onClick={() => removeJob(job.id)}>删除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
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

function ContentOps({ data, audit, apiToken }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void; apiToken?: string }) {
  const [jobId, setJobId] = useState(data.jobs[0]?.id ?? '');
  const [platform, setPlatform] = useState<Platform>('小红书');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [revisionDrafts, setRevisionDrafts] = useState<Record<string, string>>({});

  const selectedJob = data.jobs.find((job) => job.id === jobId) ?? data.jobs[0];
  const risk = scanRisks(draft);
  const filtered = data.contents.filter((item) => item.title.includes(query) || item.platform.includes(query) || item.type.includes(query));

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
    const nextStatus: ContentStatus = decision === '驳回' ? '驳回修改' : target.status;
    audit(decision === '驳回' ? '驳回内容' : '提交审核意见', target.title, {
      ...data,
      contents: data.contents.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)),
      reviewComments: [review, ...data.reviewComments],
      notifications: [
        makeNotification('内容审核意见已记录', `${target.title}：${decision}`, '内容运营', decision === '驳回' ? '待办' : '提醒'),
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
    audit('标记内容已发布', target?.title ?? id, {
      ...data,
      contents: data.contents.map((item) => item.id === id ? { ...item, status: '已发布', publishedAt: new Date().toISOString().slice(0, 10) } : item),
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
              </div>
              <div className="card-actions">
                <Badge tone="info">{item.status}</Badge>
                <button onClick={() => advance(item.id)}><CheckCircle2 size={16} />推进状态</button>
                <button className="secondary" onClick={() => publishContent(item.id)}><Rocket size={16} />标记发布</button>
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
      </section>
      <section className="panel">
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
            <button className="ghost" onClick={() => removeAsset(asset.id)}>删除</button>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title"><h2>采集表框架</h2><FileText size={18} /></div>
        <div className="template-block">
          <h3>技术案例采集表</h3>
          <p>项目背景、技术挑战、技术栈、解决方案、团队分工、业务价值、可公开范围、禁止公开内容、适合平台、审核人。</p>
        </div>
        <div className="template-block">
          <h3>员工访谈采集表</h3>
          <p>员工角色、加入时间、成长经历、印象项目、团队氛围、管理风格、候选人建议、实名授权、照片授权、有效期。</p>
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>模板库与案例库</h2><BookOpen size={18} /></div>
        <div className="template-grid">
          {contentTypes.map((type) => <div key={type} className="template-chip">{type}<small>标题/开头/CTA/标签结构化沉淀</small></div>)}
        </div>
      </section>
    </div>
  );
}

function Accounts({ data, audit, apiToken }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void; apiToken?: string }) {
  const [entry, setEntry] = useState({ platform: '小红书' as Platform, headline: '', url: '', destination: '北森岗位页' as RecruitmentEntry['destination'] });
  const [integration, setIntegration] = useState({ type: '北森' as IntegrationConfig['type'], name: '', endpoint: '', authMode: 'Token' as IntegrationConfig['authMode'] });
  const [landing, setLanding] = useState({ title: '', slug: '', pageType: '岗位集合页' as LandingPage['pageType'], destinationUrl: '' });
  const [landingLeadDrafts, setLandingLeadDrafts] = useState<Record<string, { name: string; contact: string; targetJobId: string; sourcePlatform: Platform | '未知'; note: string }>>({});
  const [account, setAccount] = useState({
    platform: '小红书' as Platform,
    name: '',
    type: '招聘专用账号' as AccountType,
    owner: '',
    positioning: '',
  });

  const createAccount = () => {
    if (!account.name.trim()) return;
    const item: PlatformAccount = {
      id: `acc-${Date.now()}`,
      ...account,
      publishingRoles: ['招聘专员'],
      reviewRule: '默认审核流程',
      attribution: '招聘团队',
      authStatus: '未授权',
      status: '启用',
    };
    audit('新增平台账号', item.name, { ...data, accounts: [item, ...data.accounts] });
    setAccount({ platform: '小红书', name: '', type: '招聘专用账号', owner: '', positioning: '' });
  };

  const createEntry = () => {
    if (!entry.headline.trim() || !entry.url.trim()) return;
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
    const item: IntegrationConfig = {
      id: `integration-${Date.now()}`,
      ...integration,
      status: integration.endpoint ? '待验证' : '未配置',
    };
    audit('新增集成配置', item.name, { ...data, integrations: [item, ...data.integrations] });
    setIntegration({ type: '北森', name: '', endpoint: '', authMode: 'Token' });
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

  const removeAccount = (id: string) => {
    const target = data.accounts.find((item) => item.id === id);
    audit('删除平台账号', target?.name ?? id, { ...data, accounts: data.accounts.filter((item) => item.id !== id) });
  };

  const removeEntry = (id: string) => {
    const target = data.entries.find((item) => item.id === id);
    audit('删除招聘入口', target?.headline ?? id, { ...data, entries: data.entries.filter((item) => item.id !== id) });
  };

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>账号与平台</h1>
          <p>管理平台账号定位、授权状态、发布权限、主页招聘入口和数据归属。</p>
        </div>
        <button onClick={() => exportJson('平台账号与招聘入口.json', { accounts: data.accounts, entries: data.entries })}><FileText size={16} />导出配置</button>
      </section>
      <section className="panel wide">
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
          <button onClick={createAccount}><Plus size={16} />保存账号</button>
        </div>
        <input value={account.positioning} onChange={(event) => setAccount({ ...account, positioning: event.target.value })} placeholder="账号定位，例如：岗位种草、校招答疑、技术观点" />
      </section>
      <section className="panel wide">
        <table>
          <thead>
            <tr>
              <th>账号</th>
              <th>定位</th>
              <th>负责人</th>
              <th>发布权限</th>
              <th>授权</th>
              <th>归属</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.length === 0 && (
              <tr>
                <td colSpan={7}><EmptyState title="暂无真实平台账号" body="请录入实际运营账号，数据归属和发布权限会基于账号配置计算。" /></td>
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
                <td><button className="ghost" onClick={() => removeAccount(account.id)}>删除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel wide">
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
          <button onClick={createEntry}><Plus size={16} />新增入口</button>
        </div>
        <div className="entry-grid">
          {data.entries.length === 0 && <EmptyState title="暂无真实招聘入口" body="请配置平台主页中的北森或官网入口，后续点击会进入归因看板。" />}
          {data.entries.map((item) => (
            <article key={item.id}>
              <strong>{item.platform}｜{item.headline}</strong>
              <span>{item.destination} · {item.trackingCode}</span>
              <span>{item.url}</span>
              <Badge tone="info">{item.clicks} 点击</Badge>
              <button className="ghost" onClick={() => removeEntry(item.id)}>删除</button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>平台与系统集成配置</h2><RefreshCw size={18} /></div>
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
          <select value={integration.authMode} onChange={(event) => setIntegration({ ...integration, authMode: event.target.value as IntegrationConfig['authMode'] })}>
            <option>Token</option>
            <option>OAuth</option>
            <option>Webhook</option>
            <option>文件导入</option>
            <option>未配置</option>
          </select>
          <button onClick={createIntegration}><Plus size={16} />保存集成</button>
        </div>
        <div className="entry-grid">
          {data.integrations.length === 0 && <EmptyState title="暂无真实集成配置" body="配置北森、平台 API、企微/飞书或 BI 后，系统会记录连接状态。" />}
          {data.integrations.map((item) => (
            <article key={item.id}>
              <strong>{item.type}｜{item.name}</strong>
              <span>{item.authMode} · {item.endpoint || '未填写接口地址'}</span>
              <Badge tone={item.status === '已连接' ? 'good' : item.status === '连接失败' ? 'danger' : 'warn'}>{item.status}</Badge>
              <button className="ghost" onClick={() => void testIntegration(item.id)}>测试连接</button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
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
                  <p key={lead.id}>{lead.name} · {lead.contact} · {lead.sourcePlatform} · {lead.status} · {lead.submittedAt}</p>
                ))}
              </details>
            </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Analytics({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [metricsCsv, setMetricsCsv] = useState('');
  const [beisenCsv, setBeisenCsv] = useState('');
  const [cost, setCost] = useState({ targetType: '内容' as CostRecord['targetType'], targetId: '', laborCost: 0, mediaCost: 0, productionCost: 0 });
  const byPlatform = platforms.map((platform) => {
    const items = data.contents.filter((item) => item.platform === platform);
    return {
      platform,
      views: items.reduce((sum, item) => sum + item.metrics.views, 0),
      clicks: items.reduce((sum, item) => sum + item.metrics.clicks, 0),
      count: items.length,
    };
  }).filter((item) => item.count > 0);
  const maxViews = Math.max(...byPlatform.map((p) => p.views), 1);
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
          {byPlatform.length === 0 && <EmptyState title="暂无真实平台指标" body="请先发布内容并导入平台后台数据；当前平台曝光、互动和点击均按 0 展示。" />}
          {byPlatform.map((item) => (
            <div key={item.platform} className="bar-row">
              <strong>{item.platform}</strong>
              <Progress current={item.views} target={maxViews} />
              <span>{item.views.toLocaleString()} 曝光 · {item.clicks} 点击</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>岗位族群效果</h2><GitBranch size={18} /></div>
        {data.jobs.length === 0 && <EmptyState title="暂无岗位族群数据" body="录入真实岗位后，这里会按岗位族群汇总点击。" />}
        {data.jobs.map((job) => {
          const related = data.contents.filter((item) => item.jobId === job.id);
          const clicks = related.reduce((sum, item) => sum + item.metrics.clicks, 0);
          return <div className="compact-row" key={job.id}><div><strong>{job.family}</strong><span>{job.title}</span></div><Badge tone="info">{clicks} 点击</Badge></div>;
        })}
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>多触点归因</h2><Link size={18} /></div>
        {data.beisenResults.length === 0 && <EmptyState title="暂无北森回流归因" body="导入北森结果后，会按平台、内容和岗位关联投递/入职结果。" />}
        <div className="entry-grid">
          {platforms.map((platform) => {
            const count = data.beisenResults.filter((item) => item.sourcePlatform === platform).length;
            return count > 0 ? <article key={platform}><strong>{platform}</strong><span>北森回流 {count} 条</span><Badge tone="good">真实回流</Badge></article> : null;
          })}
        </div>
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

function Reports({ data, audit, apiToken }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void; apiToken?: string }) {
  const [aiRecommendations, setAiRecommendations] = useState<string[]>([]);
  const [aiStatus, setAiStatus] = useState('');
  const recommendations = aiRecommendations.length > 0 ? aiRecommendations : buildRecommendations(data);
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
    const contentCount = data.contents.length;
    const clickCount = data.contents.reduce((sum, item) => sum + item.metrics.clicks, 0);
    const report = {
      id: `rp-${Date.now()}`,
      title: `自动复盘：${contentCount} 条内容 / ${clickCount} 次点击`,
      body: reportRecommendations.join(' '),
      action: '请根据建议调整下周期内容排期，并补齐缺失的真实平台指标和北森结果。',
      severity: '建议' as const,
    };
    audit('生成复盘报告', report.title, { ...data, reports: [report, ...data.reports] });
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
        {aiStatus && <div className="platform-note"><Bot size={16} />{aiStatus}</div>}
        <div className="template-grid">
          {recommendations.map((item) => <div className="template-chip" key={item}>策略建议<small>{item}</small></div>)}
        </div>
      </section>
      <section className="panel wide">
        <div className="report-header">
          <span>2026 年 5 月招聘新媒体运营周报</span>
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
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>高表现内容特征</h2><Sparkles size={18} /></div>
        <div className="template-grid">
          {data.contents.length === 0 && <EmptyState title="暂无高表现特征" body="导入真实内容效果后，系统会提炼标题、平台、账号和岗位族群特征。" />}
          {data.contents.length > 0 && data.contents
            .slice()
            .sort((a, b) => b.metrics.clicks - a.metrics.clicks)
            .slice(0, 4)
            .map((content) => (
              <div className="template-chip" key={content.id}>{content.title}<small>{content.platform} · {content.metrics.clicks} 点击</small></div>
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
  const [modelApi, setModelApi] = useState({
    provider: 'OpenAI' as ModelApiConfig['provider'],
    name: '',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: '',
    enabledFor: '内容生成、风险识别、复盘建议',
  });
  const addRole = () => {
    if (!role.name.trim()) return;
    const item: PermissionRole = {
      id: `role-${Date.now()}`,
      name: role.name,
      dataScope: role.dataScope,
      permissions: role.permissions.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean),
    };
    const next = { ...data, roles: [item, ...data.roles] };
    localStorage.setItem('hr-assistant-data', JSON.stringify(next));
    location.reload();
  };
  const addRule = () => {
    if (!rule.keyword.trim()) return;
    const item: SensitiveRule = {
      id: `rule-${Date.now()}`,
      ...rule,
      enabled: true,
    };
    const next = { ...data, sensitiveRules: [item, ...data.sensitiveRules] };
    localStorage.setItem('hr-assistant-data', JSON.stringify(next));
    location.reload();
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
  const remainingItems = [
    '生产数据库、对象存储和正式账号体系部署',
    '北森 OpenAPI 简历投递、流程状态和候选人回流',
    '小红书、脉脉、B站、公众号、抖音、知乎、技术社区正式 API 或插件采集',
    '浏览器插件独立打包、平台页面适配和数据采集权限',
    '企业微信/飞书真实消息发送、审批提醒和群机器人权限',
    '招聘落地页公网部署、独立域名、埋点 SDK 和隐私合规配置',
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
        {['招聘专员', '招聘主管', '新媒体运营', '技术负责人', '管理层'].map((role) => (
          <div className="compact-row" key={role}>
            <div><strong>{role}</strong><span>岗位、内容、素材、账号、数据范围差异化控制</span></div>
            <Badge tone="info">已配置</Badge>
          </div>
        ))}
        {data.roles.map((item) => (
          <div className="compact-row" key={item.id}>
            <div><strong>{item.name}</strong><span>{item.dataScope} · {item.permissions.join('、')}</span></div>
            <Badge tone="good">自定义</Badge>
          </div>
        ))}
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
            <Badge tone="good">{item.status}</Badge>
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
              <span>密钥：{item.apiKey ? `已配置（${item.apiKey.slice(0, 4)}...）` : '未配置'}</span>
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
        <div className="panel-title"><h2>后续集成与生产化事项</h2><ClipboardList size={18} /></div>
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
  apiToken?: string,
) {
  switch (section) {
    case '工作台':
      return <Dashboard data={data} audit={audit} />;
    case '招聘需求':
      return <Jobs data={data} audit={audit} />;
    case '内容运营':
      return <ContentOps data={data} audit={audit} apiToken={apiToken} />;
    case '素材资产':
      return <Assets data={data} audit={audit} apiToken={apiToken} />;
    case '账号与平台':
      return <Accounts data={data} audit={audit} apiToken={apiToken} />;
    case '数据分析':
      return <Analytics data={data} audit={audit} />;
    case '复盘报告':
      return <Reports data={data} audit={audit} apiToken={apiToken} />;
    case '系统配置':
      return <SettingsPage data={data} update={update} resetData={resetData} apiToken={apiToken} />;
  }
}

export function App() {
  const [section, setSection] = useState<Section>('工作台');
  const { data, update, audit, resetData, storageMode, apiUser, apiToken, authRequired, authError, login, logout } = useAppData();

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
          {navItems.map(({ key, icon: Icon }) => (
            <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}>
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
        {renderSection(section, data, update, audit, resetData, apiToken)}
      </main>
    </div>
  );
}
