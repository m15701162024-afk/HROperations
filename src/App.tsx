import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Home,
  Link,
  LockKeyhole,
  Megaphone,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type ApiUser,
  type OpsSummary,
  loadOpsSummary,
  loadRemoteData,
  loginLocalApi,
  normalizeAppData,
  runIntegrationSync,
  runModelTask,
  saveRemoteData,
  testIntegrationConfig,
  testModelApiConfig,
} from './api';
import { buildAnalyticsDrill, formatMetricRate } from './analytics';
import { emptyData, generateContent, platformPositioning, platforms, scanRisks } from './data';
import type {
  AppData,
  ContentReviewComment,
  ContentStatus,
  ContentTask,
  ContentVersion,
  IntegrationConfig,
  IntegrationSyncRun,
  JobNeed,
  ModelApiConfig,
  NotificationItem,
  Platform,
  PlatformAccount,
} from './types';
import { applyMetricsCsv, detectCalendarConflicts, downloadText, exportJson, parseJobCsv, scoreContentQuality, toCsv } from './utils';

type Section = '工作台' | '内容运营' | '数据分析' | '账号与平台';
type AuditFn = (action: string, target: string, nextData?: AppData) => void;

const navItems: { key: Section; label: string; note: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: '工作台', label: '运营首页', note: '今日任务', icon: Home },
  { key: '内容运营', label: '内容工厂', note: '生成/审核/排期', icon: Megaphone },
  { key: '数据分析', label: '渠道数据', note: '效果/归因/复盘', icon: BarChart3 },
  { key: '账号与平台', label: '连接配置', note: '账号/API/入口', icon: Link },
];

const contentTypes = ['岗位种草', '技术团队内容', '员工故事', '公司/业务介绍', '面试/求职干货', '短视频脚本', '图文笔记', '长文', '校招内容'];
const publishCheckItems = ['合规已审', '真实账号已同步', '入口已配置'];
const mvpSeedKey = 'hr-assistant-mvp-seeded-v1';
const dataModeKey = 'hr-assistant-data-mode';
const currentDataMode = 'real-v2-empty-platform-data';

function isLegacyDemoData(data: Partial<AppData>) {
  const demoJobIds = new Set(['job-1', 'job-2', 'job-3']);
  const demoContentIds = new Set(['ct-1', 'ct-2', 'ct-3']);
  return Boolean(
    data.jobs?.some((job) => demoJobIds.has(job.id))
    || data.contents?.some((content) => demoContentIds.has(content.id))
    || data.auditLogs?.some((log) => log.action === '初始化种子数据' || log.action === '补齐MVP样例数据'),
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
    const mode = localStorage.getItem(dataModeKey);
    if (mode !== currentDataMode) {
      localStorage.removeItem(mvpSeedKey);
      localStorage.setItem(dataModeKey, currentDataMode);
      localStorage.setItem('hr-assistant-data', JSON.stringify(emptyData));
      return emptyData;
    }
    const stored = localStorage.getItem('hr-assistant-data');
    if (!stored) return emptyData;
    const parsed = JSON.parse(stored) as Partial<AppData>;
    if (isLegacyDemoData(parsed)) {
      localStorage.removeItem(mvpSeedKey);
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
      const nextData = isLegacyDemoData(remote.data) ? emptyData : remote.data;
      setData(nextData);
      setApiUser(remote.user ?? null);
      setAuthRequired(false);
      setStorageMode('本地API');
      localStorage.setItem(dataModeKey, currentDataMode);
      localStorage.setItem('hr-assistant-data', JSON.stringify(nextData));
    });
    return () => {
      active = false;
    };
  }, [apiToken]);

  const update = (next: AppData) => {
    setData(next);
    localStorage.setItem(dataModeKey, currentDataMode);
    localStorage.setItem('hr-assistant-data', JSON.stringify(next));
    saveQueue.current = saveQueue.current.then(() => saveRemoteData(next, apiToken), () => saveRemoteData(next, apiToken));
    void saveQueue.current.then((saved) => {
      if (saved) setStorageMode('本地API');
    });
  };

  const audit: AuditFn = (action, target, nextData) => {
    const base = nextData ?? data;
    update({
      ...base,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actor: apiUser?.name ?? '当前用户',
          action,
          target,
          createdAt: nowText(),
        },
        ...base.auditLogs,
      ],
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

  return { data, update, audit, storageMode, apiUser, apiToken, authRequired, authError, login, logout };
}

function nowText() {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

function makeNotification(title: string, body: string, targetSection: string, level: NotificationItem['level'] = '提醒'): NotificationItem {
  return {
    id: `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    body,
    targetSection,
    level,
    read: false,
    createdAt: nowText(),
  };
}

function daysUntil(date: string) {
  if (!date) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
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

function getNextStatus(status: ContentStatus): ContentStatus {
  const flow: ContentStatus[] = ['草稿', 'AI已生成', '待专业审核', '待品牌合规审核', '待发布', '已发布', '数据回收中', '已复盘'];
  const index = flow.indexOf(status);
  return flow[Math.min(index + 1, flow.length - 1)] ?? '待专业审核';
}

function findModelApi(data: AppData, purpose: ModelApiConfig['enabledFor'][number]) {
  return data.modelApis.find((item) => item.status === '已连接' && item.enabledFor.includes(purpose));
}

function connectedAccountFor(data: AppData, platform: Platform) {
  return data.accounts.find((account) => account.platform === platform && account.status === '已连接');
}

function localOpsSummary(data: AppData): OpsSummary {
  const activeJobs = data.jobs.filter((job) => job.status === '招聘中').length;
  const inProduction = data.contents.filter((content) => !['已发布', '数据回收中', '已复盘', '已归档'].includes(content.status)).length;
  const pendingPublish = data.contents.filter((content) => content.status === '待发布').length;
  const published = data.contents.filter((content) => ['已发布', '数据回收中', '已复盘'].includes(content.status)).length;
  const pendingMetrics = data.contents.filter((content) => ['已发布', '数据回收中'].includes(content.status) && Object.values(content.metrics).every((value) => value === 0)).length;
  const totals = data.contents.reduce((acc, content) => ({
    views: acc.views + content.metrics.views,
    interactions: acc.interactions + content.metrics.likes + content.metrics.comments + content.metrics.saves + content.metrics.shares,
    clicks: acc.clicks + content.metrics.clicks,
  }), { views: 0, interactions: 0, clicks: 0 });
  return {
    activeJobs,
    inProduction,
    pendingPublish,
    published,
    pendingMetrics,
    totals,
    channels: platforms.map((platform) => {
      const contents = data.contents.filter((content) => content.platform === platform);
      const account = connectedAccountFor(data, platform);
      const views = contents.reduce((sum, content) => sum + content.metrics.views, 0);
      const clicks = contents.reduce((sum, content) => sum + content.metrics.clicks, 0);
      const target = data.operationSettings.weeklyPlatformTargets[platform] ?? 0;
      return {
        platform,
        accountConnected: Boolean(account),
        accountName: account?.name ?? '',
        contentCount: contents.length,
        target,
        views,
        clicks,
        status: !account ? '未连接' : contents.length < target ? '需补内容' : clicks === 0 && views > 0 ? '需优化入口' : '正常',
      };
    }),
    generatedAt: nowText(),
  };
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
        <label>账号<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" /></label>
        <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" /></label>
        {error && <div className="login-error">{error}</div>}
        <button className="full" type="submit" disabled={loading}>{loading ? '登录中' : '登录'}</button>
      </form>
    </div>
  );
}

function OperationsHome({ data, apiToken, openSection }: { data: AppData; apiToken?: string; openSection: (section: Section) => void }) {
  const fallback = useMemo(() => localOpsSummary(data), [data]);
  const [remoteSummary, setRemoteSummary] = useState<OpsSummary | null>(null);
  const [source, setSource] = useState<'后端摘要' | '本地聚合'>('本地聚合');

  useEffect(() => {
    let active = true;
    void loadOpsSummary(apiToken).then((summary) => {
      if (!active) return;
      setRemoteSummary(summary);
      setSource('后端摘要');
    }).catch(() => {
      if (!active) return;
      setRemoteSummary(null);
      setSource('本地聚合');
    });
    return () => {
      active = false;
    };
  }, [apiToken, data]);

  const summary = remoteSummary ?? fallback;
  const nextAdvice = [
    summary.activeJobs === 0 ? '先录入一个真实岗位简报，系统才能生成可发布内容。' : '',
    data.accounts.filter((account) => account.status === '已连接').length === 0 ? '先连接至少一个真实渠道账号，内容才允许进入发布链路。' : '',
    summary.pendingPublish > 0 ? `有 ${summary.pendingPublish} 条内容待发布，优先完成发布前检查。` : '',
    summary.pendingMetrics > 0 ? `有 ${summary.pendingMetrics} 条已发内容缺少回收数据，建议同步平台指标。` : '',
  ].filter(Boolean);
  const tasks = [
    ...data.contents.filter((content) => content.status === '待发布').map((content) => ({ id: `publish-${content.id}`, title: `待发布：${content.title}`, body: `${content.platform} · ${content.dueDate}`, priority: '高' as const, section: '内容运营' as Section })),
    ...data.contents.filter((content) => content.riskLevel === '高' && content.status !== '已发布').map((content) => ({ id: `risk-${content.id}`, title: `高风险待审核：${content.title}`, body: content.risks.join('、') || '需要合规复核', priority: '高' as const, section: '内容运营' as Section })),
    ...data.contents.filter((content) => ['已发布', '数据回收中'].includes(content.status) && Object.values(content.metrics).every((value) => value === 0)).map((content) => ({ id: `metrics-${content.id}`, title: `数据待回收：${content.title}`, body: `${content.platform} 发布后暂无指标`, priority: '中' as const, section: '数据分析' as Section })),
    ...data.accounts.filter((account) => account.status !== '已连接').map((account) => ({ id: `account-${account.id}`, title: `账号连接异常：${account.name}`, body: `${account.platform} · ${account.status}`, priority: '中' as const, section: '账号与平台' as Section })),
  ].slice(0, 6);

  return (
    <div className="page-grid ops-home">
      <section className="command-hero">
        <div>
          <span className="eyebrow">招聘内容运营指挥台</span>
          <h1>招聘渠道内容运营工作台</h1>
          <p>集中处理岗位内容生成、渠道发布排期、真实账号连接和数据复盘。</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => openSection('内容运营')}><Sparkles size={16} />开始生成内容</button>
          <button className="secondary" onClick={() => openSection('数据分析')}><BarChart3 size={16} />查看渠道效果</button>
          <button className="ghost" onClick={() => openSection('账号与平台')}><Link size={16} />连接账号/API</button>
        </div>
      </section>

      <div className="stats-row">
        <StatCard label="招聘中岗位" value={summary.activeJobs} note="内容生产输入" icon={ClipboardList} />
        <StatCard label="生产中内容" value={summary.inProduction} note={`${summary.pendingPublish} 条待发布`} icon={Megaphone} />
        <StatCard label="已发布内容" value={summary.published} note={`${summary.pendingMetrics} 条待回收数据`} icon={Rocket} />
        <StatCard label="渠道点击" value={summary.totals.clicks.toLocaleString()} note={`${summary.totals.views.toLocaleString()} 曝光 · ${summary.totals.interactions.toLocaleString()} 互动`} icon={Link} />
      </div>

      <section className="panel wide workflow-strip">
        {[
          { title: '1. 岗位简报', body: '岗位、候选人画像、卖点', target: '内容运营' as Section },
          { title: '2. 内容生成', body: '按渠道生成、查风险、改标题', target: '内容运营' as Section },
          { title: '3. 发布排期', body: '绑定真实账号、检查入口', target: '内容运营' as Section },
          { title: '4. 数据复盘', body: '同步指标、看渠道 ROI', target: '数据分析' as Section },
        ].map((step) => (
          <button className="workflow-step" key={step.title} onClick={() => openSection(step.target)}>
            <strong>{step.title}</strong>
            <span>{step.body}</span>
          </button>
        ))}
      </section>

      <section className="panel focus-panel">
        <div className="panel-title"><h2>下一步建议</h2><Bot size={18} /></div>
        <div className="platform-note"><Database size={16} />数据源：{source} · {summary.generatedAt}</div>
        {nextAdvice.length === 0 && <EmptyState title="当前闭环正常" body="继续按排期生产内容，并在发布后同步渠道指标。" />}
        {nextAdvice.map((item) => <div className="todo-item" key={item}><CheckCircle2 size={16} />{item}</div>)}
      </section>

      <section className="panel focus-panel">
        <div className="panel-title"><h2>今日待办</h2><ClipboardList size={18} /></div>
        {tasks.length === 0 && <EmptyState title="暂无紧急待办" body="当内容待发布、数据待回收、账号异常时会自动出现。" />}
        {tasks.map((task) => (
          <div className="task-row compact-task" key={task.id}>
            <div><strong>{task.title}</strong><span>{task.body}</span></div>
            <div className="row-actions">
              <Badge tone={task.priority === '高' ? 'danger' : 'warn'}>{task.priority}</Badge>
              <button className="ghost" onClick={() => openSection(task.section)}>处理</button>
            </div>
          </div>
        ))}
      </section>

      <section className="panel wide">
        <div className="panel-title"><h2>渠道状态</h2><BarChart3 size={18} /></div>
        <div className="channel-grid">
          {summary.channels.map((row) => (
            <article key={row.platform} className="channel-card">
              <div className="card-head">
                <h3>{row.platform}</h3>
                <Badge tone={row.status === '正常' ? 'good' : row.status === '未连接' ? 'danger' : 'warn'}>{row.status}</Badge>
              </div>
              <span>{row.accountName || '未连接真实账号'}</span>
              <div className="mini-metrics">
                <b>{row.contentCount}/{row.target}</b><span>本期内容</span>
                <b>{row.views.toLocaleString()}</b><span>曝光</span>
                <b>{row.clicks.toLocaleString()}</b><span>点击</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ContentFactory({ data, audit, apiToken }: { data: AppData; audit: AuditFn; apiToken?: string }) {
  const [tab, setTab] = useState<'内容' | '选题' | '排期'>('内容');
  const [brief, setBrief] = useState({
    title: '',
    family: '岗位族群',
    city: '',
    level: '',
    type: '社招' as JobNeed['type'],
    persona: '',
    sellingPoints: '',
    targetPlatforms: '小红书、脉脉',
    beisenUrl: '',
    websiteUrl: '',
  });
  const [jobId, setJobId] = useState(data.jobs[0]?.id ?? '');
  const [platform, setPlatform] = useState<Platform>('小红书');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [publishChecks, setPublishChecks] = useState<Record<string, string[]>>({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const selectedJob = data.jobs.find((job) => job.id === jobId) ?? data.jobs[0];
  const selectedAccount = connectedAccountFor(data, platform);
  const hasConnectedAccounts = data.accounts.some((account) => account.status === '已连接');
  const accountBlockReason = selectedAccount ? '' : hasConnectedAccounts ? `${platform} 暂无已连接账号，请先同步该平台账号` : '请先在账号与平台同步真实平台账号';
  const risk = scanRisks(draft);
  const filteredContents = data.contents.filter((content) => content.title.includes(query) || content.platform.includes(query) || content.type.includes(query));
  const groupedByDate = filteredContents
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .reduce<Record<string, ContentTask[]>>((acc, content) => {
      const key = content.publishedAt ?? content.dueDate;
      acc[key] = [...(acc[key] ?? []), content];
      return acc;
    }, {});

  useEffect(() => {
    if (selectedJob?.targetPlatforms?.[0]) setPlatform(selectedJob.targetPlatforms[0]);
  }, [selectedJob?.id]);

  const createBrief = () => {
    if (!brief.title.trim()) return;
    const targetPlatforms = brief.targetPlatforms.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean) as Platform[];
    const job: JobNeed = {
      id: `job-${Date.now()}`,
      title: brief.title.trim(),
      family: brief.family.trim() || '未分类',
      city: brief.city.trim() || '待确认',
      level: brief.level.trim() || '待确认',
      type: brief.type,
      jd: `${brief.title.trim()} 招聘内容简报`,
      persona: brief.persona.trim(),
      sellingPoints: brief.sellingPoints.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean),
      targetPlatforms: targetPlatforms.length > 0 ? targetPlatforms : ['小红书'],
      status: '招聘中',
      beisenUrl: brief.beisenUrl,
      websiteUrl: brief.websiteUrl,
    };
    audit('创建岗位简报', job.title, {
      ...data,
      jobs: [job, ...data.jobs],
      notifications: [makeNotification('岗位简报已创建', `${job.title} 可用于生成渠道内容`, '内容运营'), ...data.notifications],
    });
    setJobId(job.id);
    setPlatform(job.targetPlatforms[0] ?? '小红书');
    setBrief({ title: '', family: '岗位族群', city: '', level: '', type: '社招', persona: '', sellingPoints: '', targetPlatforms: '小红书、脉脉', beisenUrl: '', websiteUrl: '' });
  };

  const importBriefs = (raw: string) => {
    const jobs = parseJobCsv(raw);
    if (jobs.length === 0) return;
    audit('导入岗位简报', `${jobs.length} 条`, { ...data, jobs: [...jobs, ...data.jobs] });
  };

  const handleGenerate = async () => {
    if (!selectedJob) return;
    const model = findModelApi(data, '内容生成');
    if (model) {
      setStatus('正在调用大模型生成内容...');
      try {
        const result = await runModelTask(model, '内容生成', { job: selectedJob, platform }, apiToken);
        if (result.ok && result.text) {
          setDraft(result.text);
          setStatus(`已使用 ${model.name} 生成`);
          return;
        }
        setStatus(`模型调用失败，已回退本地模板：${result.message ?? '未知错误'}`);
      } catch {
        setStatus('模型调用失败，已回退本地模板');
      }
    } else {
      setStatus('未配置内容生成模型，使用本地模板');
    }
    setDraft(generateContent(selectedJob, platform));
  };

  const createContentTask = async () => {
    if (!selectedJob || !draft.trim()) return;
    const account = connectedAccountFor(data, platform);
    if (!account) {
      const message = `${platform} 暂无已连接真实账号，请先到账号与平台同步账号`;
      setStatus(message);
      audit('阻断内容创建', message, {
        ...data,
        notifications: [makeNotification('内容创建被阻断', message, '内容运营', '预警'), ...data.notifications],
      });
      return;
    }
    let scanned = scanRisks(draft);
    const riskModel = findModelApi(data, '风险识别');
    if (riskModel) {
      try {
        const result = await runModelTask(riskModel, '风险识别', { text: draft }, apiToken);
        if (result.ok && result.text) {
          const parsed = JSON.parse(result.text) as { level?: '低' | '中' | '高'; risks?: string[] };
          scanned = {
            level: parsed.level === '低' || parsed.level === '中' || parsed.level === '高' ? parsed.level : scanned.level,
            risks: Array.isArray(parsed.risks) ? parsed.risks : scanned.risks,
          };
        }
      } catch {
        setStatus('模型风险识别失败，已回退本地规则');
      }
    }
    const newTask: ContentTask = {
      id: `ct-${Date.now()}`,
      title: `${platform}｜${selectedJob.title}内容初稿`,
      jobId: selectedJob.id,
      platform,
      accountId: account.id,
      type: platform === 'B站' || platform === '抖音' ? '短视频脚本' : platform === '小红书' ? '岗位种草' : '技术/行业观点',
      status: 'AI已生成',
      owner: '招聘专员',
      reviewer: scanned.level === '高' ? 'HR负责人' : '招聘主管',
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
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
      createdAt: nowText(),
    };
    audit('创建内容任务', newTask.title, { ...data, contents: [newTask, ...data.contents], contentVersions: [version, ...data.contentVersions] });
    setStatus('内容任务已创建');
  };

  const updateContent = (id: string, patch: Partial<ContentTask>) => {
    const target = data.contents.find((content) => content.id === id);
    if (!target) return;
    audit('编辑内容任务', target.title, { ...data, contents: data.contents.map((content) => content.id === id ? { ...content, ...patch } : content) });
  };

  const advanceContent = (id: string) => {
    const target = data.contents.find((content) => content.id === id);
    if (!target) return;
    audit('推进内容状态', target.title, { ...data, contents: data.contents.map((content) => content.id === id ? { ...content, status: getNextStatus(content.status) } : content) });
  };

  const publishContent = (id: string) => {
    const target = data.contents.find((content) => content.id === id);
    if (!target) return;
    const account = data.accounts.find((item) => item.id === target.accountId && item.platform === target.platform && item.status === '已连接');
    if (!account) {
      audit('阻断内容发布', `${target.title}：未绑定已连接真实账号`, {
        ...data,
        notifications: [makeNotification('内容发布被阻断', `${target.title} 未绑定已连接真实平台账号`, '内容运营', '预警'), ...data.notifications],
      });
      return;
    }
    const checks = publishChecks[id] ?? [];
    if (checks.length < publishCheckItems.length) {
      audit('发布检查未通过', target.title, {
        ...data,
        notifications: [makeNotification('发布检查未完成', `${target.title} 需要完成合规、真实账号同步、入口配置检查`, '内容运营', '预警'), ...data.notifications],
      });
      return;
    }
    audit('标记内容已发布', target.title, {
      ...data,
      contents: data.contents.map((content) => content.id === id ? { ...content, status: '已发布', publishedAt: new Date().toISOString().slice(0, 10) } : content),
    });
  };

  const addReviewComment = (id: string) => {
    const target = data.contents.find((content) => content.id === id);
    const comment = reviewDrafts[id]?.trim();
    if (!target || !comment) return;
    const item: ContentReviewComment = {
      id: `rv-${Date.now()}`,
      contentId: id,
      reviewer: target.reviewer,
      stage: target.status,
      decision: '修改建议',
      comment,
      createdAt: nowText(),
    };
    audit('提交审核意见', target.title, { ...data, reviewComments: [item, ...data.reviewComments] });
    setReviewDrafts({ ...reviewDrafts, [id]: '' });
  };

  const toggleCheck = (id: string, check: string) => {
    setPublishChecks((current) => {
      const checks = current[id] ?? [];
      return { ...current, [id]: checks.includes(check) ? checks.filter((item) => item !== check) : [...checks, check] };
    });
  };

  if (tab === '选题') {
    return <TopicBoard data={data} audit={audit} setTab={setTab} />;
  }
  if (tab === '排期') {
    return <ScheduleBoard data={data} audit={audit} setTab={setTab} />;
  }

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>内容工厂</h1>
          <p>从岗位简报到渠道内容、审核、排期和发布检查，一页完成。</p>
        </div>
        <div className="toolbar-actions">
          <button onClick={() => downloadText('岗位简报模板.csv', 'title,family,city,level,type,jd,persona,sellingPoints,targetPlatforms\n', 'text/csv;charset=utf-8')}><FileText size={16} />岗位模板</button>
          <div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索内容、平台、类型" /></div>
        </div>
      </section>
      <section className="panel wide">
        <div className="module-tabs">
          {(['内容', '选题', '排期'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}
        </div>
      </section>

      <section className="panel wide quick-brief">
        <div className="panel-title"><h2>岗位内容简报</h2><ClipboardList size={18} /></div>
        <div className="brief-grid">
          <input value={brief.title} onChange={(event) => setBrief({ ...brief, title: event.target.value })} placeholder="岗位名称，例如 高级前端工程师" />
          <input value={brief.city} onChange={(event) => setBrief({ ...brief, city: event.target.value })} placeholder="城市" />
          <input value={brief.level} onChange={(event) => setBrief({ ...brief, level: event.target.value })} placeholder="级别" />
          <select value={brief.type} onChange={(event) => setBrief({ ...brief, type: event.target.value as JobNeed['type'] })}><option>社招</option><option>校招</option><option>实习</option><option>职能</option></select>
          <input value={brief.targetPlatforms} onChange={(event) => setBrief({ ...brief, targetPlatforms: event.target.value })} placeholder="目标渠道，用顿号分隔" />
          <input value={brief.sellingPoints} onChange={(event) => setBrief({ ...brief, sellingPoints: event.target.value })} placeholder="岗位卖点，用顿号分隔" />
          <input value={brief.persona} onChange={(event) => setBrief({ ...brief, persona: event.target.value })} placeholder="候选人画像/关注点" />
          <input value={brief.beisenUrl} onChange={(event) => setBrief({ ...brief, beisenUrl: event.target.value })} placeholder="北森/ATS 投递链接" />
          <button onClick={createBrief}><Plus size={16} />保存简报</button>
        </div>
        <label className="file-button">
          <Database size={16} />导入简报CSV
          <input type="file" accept=".csv,text/csv" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then(importBriefs);
          }} />
        </label>
      </section>

      <section className="panel generator">
        <div className="panel-title"><h2>AI 内容生成</h2><Sparkles size={18} /></div>
        {data.jobs.length === 0 && <EmptyState title="请先录入真实岗位简报" body="内容生成需要真实岗位、候选人画像、卖点和目标渠道。" />}
        <label>岗位需求<select value={jobId} onChange={(event) => setJobId(event.target.value)} disabled={data.jobs.length === 0}>{data.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
        <label>目标平台<select value={platform} onChange={(event) => setPlatform(event.target.value as Platform)}>{platforms.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="platform-note">{platformPositioning[platform]}</div>
        {selectedAccount ? <div className="platform-note"><Link size={16} />已绑定真实账号：{selectedAccount.name} · {selectedAccount.provider} · {selectedAccount.syncedAt}</div> : <div className="platform-note"><AlertTriangle size={16} />{accountBlockReason}</div>}
        <button onClick={() => void handleGenerate()} disabled={data.jobs.length === 0}><Bot size={16} />生成平台内容</button>
        {status && <div className="platform-note"><Bot size={16} />{status}</div>}
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="生成或编辑内容初稿" />
        <div className="risk-box"><ShieldCheck size={16} /><span>风险等级：<b>{risk.level}</b></span>{risk.risks.length > 0 && <small>{risk.risks.join('；')}</small>}</div>
        <button className="full" onClick={() => void createContentTask()} disabled={Boolean(accountBlockReason)}><Plus size={16} />保存为内容任务</button>
      </section>

      <section className="panel wide">
        <div className="panel-title"><h2>内容任务与审核流</h2><Megaphone size={18} /></div>
        {filteredContents.length === 0 && <EmptyState title="暂无真实内容任务" body="录入岗位简报并生成内容后，会在这里进行审核、排期和发布。" />}
        <div className="content-list">
          {filteredContents.map((content) => {
            const quality = scoreContentQuality(content, data.jobs.find((job) => job.id === content.jobId));
            return (
              <article className="content-card" key={content.id}>
                <div>
                  <div className="card-head"><h3>{content.title}</h3><Badge tone={content.riskLevel === '高' ? 'danger' : content.riskLevel === '中' ? 'warn' : 'good'}>{content.riskLevel}风险</Badge></div>
                  <p>{content.content}</p>
                  <div className="meta-line"><span>{content.platform}</span><span>{content.type}</span><span>负责人：{content.owner}</span><span>审核：{content.reviewer}</span><span>截止：{content.dueDate}</span></div>
                  <div className="quality-box"><div><strong>{quality.total}</strong><span>内容质量分</span></div><p>标题 {quality.titleScore}/20 · 画像 {quality.personaScore}/20 · 卖点 {quality.sellingPointScore}/20 · 平台 {quality.platformFitScore}/15 · CTA {quality.ctaScore}/10 · 合规 {quality.complianceScore}/15</p></div>
                  <div className="inline-form compact-edit">
                    <input value={content.owner} onChange={(event) => updateContent(content.id, { owner: event.target.value })} placeholder="负责人" />
                    <input value={content.reviewer} onChange={(event) => updateContent(content.id, { reviewer: event.target.value })} placeholder="审核人" />
                    <input type="date" value={content.dueDate} onChange={(event) => updateContent(content.id, { dueDate: event.target.value })} />
                  </div>
                  <details className="version-box">
                    <summary>审核意见</summary>
                    <textarea value={reviewDrafts[content.id] ?? ''} onChange={(event) => setReviewDrafts({ ...reviewDrafts, [content.id]: event.target.value })} placeholder="填写审核意见、修改建议或风险说明" />
                    <button className="secondary" onClick={() => addReviewComment(content.id)}>提交意见</button>
                  </details>
                  <details className="version-box">
                    <summary>发布前检查</summary>
                    <div className="checklist-row">
                      {publishCheckItems.map((check) => <label key={check}><input type="checkbox" checked={(publishChecks[content.id] ?? []).includes(check)} onChange={() => toggleCheck(content.id, check)} />{check}</label>)}
                    </div>
                  </details>
                </div>
                <div className="card-actions">
                  <Badge tone="info">{content.status}</Badge>
                  <button onClick={() => advanceContent(content.id)}><CheckCircle2 size={16} />推进状态</button>
                  <button className="secondary" onClick={() => publishContent(content.id)}><Rocket size={16} />标记发布</button>
                  <button className="ghost" onClick={() => updateContent(content.id, { status: '已归档' })}>归档</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-title"><h2>排期预览</h2><ClipboardList size={18} /></div>
        <div className="calendar-grid">
          {Object.keys(groupedByDate).length === 0 && <EmptyState title="暂无内容排期" body="内容任务有截止日期后，会进入排期预览。" />}
          {Object.entries(groupedByDate).map(([date, contents]) => (
            <article key={date} className="calendar-day">
              <strong>{date}</strong>
              {contents.map((content) => <div key={content.id} className="calendar-item"><span>{content.platform} · {content.type}</span><b>{content.title}</b>{daysUntil(content.dueDate) < 0 && content.status !== '已发布' && <Badge tone="danger">已逾期</Badge>}<Badge tone={content.status === '已发布' ? 'good' : content.riskLevel === '高' ? 'danger' : 'info'}>{content.status}</Badge></div>)}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function TopicBoard({ data, audit, setTab }: { data: AppData; audit: AuditFn; setTab: (tab: '内容' | '选题' | '排期') => void }) {
  const [topic, setTopic] = useState({ title: '', type: '岗位种草', platform: '全部' as Platform | '全部', targetJobId: '', owner: '招聘运营', inspiration: '', tags: '' });
  const createTopic = () => {
    if (!topic.title.trim()) return;
    audit('新增选题', topic.title, {
      ...data,
      topics: [{
        id: `topic-${Date.now()}`,
        title: topic.title,
        type: topic.type,
        platform: topic.platform,
        targetJobId: topic.targetJobId || undefined,
        owner: topic.owner,
        status: '待认领',
        inspiration: topic.inspiration,
        tags: topic.tags.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean),
        source: '人工',
        createdAt: nowText(),
        updatedAt: nowText(),
      }, ...data.topics],
    });
    setTopic({ title: '', type: '岗位种草', platform: '全部', targetJobId: '', owner: '招聘运营', inspiration: '', tags: '' });
  };
  const convertTopic = (id: string) => {
    const item = data.topics.find((current) => current.id === id);
    const job = data.jobs.find((current) => current.id === item?.targetJobId) ?? data.jobs[0];
    if (!item || !job) return;
    const targetPlatform = item.platform === '全部' ? job.targetPlatforms[0] ?? '小红书' : item.platform;
    const account = connectedAccountFor(data, targetPlatform);
    if (!account) {
      audit('阻断选题转内容', `${targetPlatform} 暂无已连接真实账号`, {
        ...data,
        notifications: [makeNotification('选题转内容被阻断', `${item.title} 需要先同步 ${targetPlatform} 真实平台账号`, '内容运营', '预警'), ...data.notifications],
      });
      return;
    }
    const risk = scanRisks(item.inspiration);
    const content: ContentTask = {
      id: `content-${Date.now()}`,
      title: `${targetPlatform}｜${item.title}`,
      jobId: job.id,
      platform: targetPlatform,
      accountId: account.id,
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
    audit('选题转内容任务', item.title, { ...data, contents: [content, ...data.contents], topics: data.topics.map((current) => current.id === id ? { ...current, status: '已生成内容', updatedAt: nowText() } : current) });
    setTab('内容');
  };
  return (
    <div className="page-grid">
      <section className="toolbar"><div><h1>内容工厂</h1><p>选题是内容前置状态，不再作为独立系统模块。</p></div><button className="secondary" onClick={() => setTab('内容')}>返回内容</button></section>
      <section className="panel wide"><div className="module-tabs">{(['内容', '选题', '排期'] as const).map((item) => <button key={item} className={item === '选题' ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div></section>
      <section className="panel wide">
        <div className="panel-title"><h2>新增选题</h2><Sparkles size={18} /></div>
        <div className="inline-form">
          <input value={topic.title} onChange={(event) => setTopic({ ...topic, title: event.target.value })} placeholder="选题标题" />
          <select value={topic.type} onChange={(event) => setTopic({ ...topic, type: event.target.value })}>{contentTypes.map((type) => <option key={type}>{type}</option>)}</select>
          <select value={topic.platform} onChange={(event) => setTopic({ ...topic, platform: event.target.value as Platform | '全部' })}><option>全部</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={topic.targetJobId} onChange={(event) => setTopic({ ...topic, targetJobId: event.target.value })}><option value="">关联岗位</option>{data.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select>
          <button onClick={createTopic}><Plus size={16} />保存选题</button>
        </div>
        <textarea className="small-textarea" value={topic.inspiration} onChange={(event) => setTopic({ ...topic, inspiration: event.target.value })} placeholder="选题灵感、候选人痛点、平台表达方向" />
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>选题列表</h2><ClipboardList size={18} /></div>
        <div className="entry-grid">
          {data.topics.length === 0 && <EmptyState title="暂无真实选题" body="新增选题后，会在这里转成内容任务。" />}
          {data.topics.map((item) => <article key={item.id}><strong>{item.title}</strong><span>{item.type} · {item.platform} · {item.owner}</span><p>{item.inspiration}</p><div className="row-actions"><Badge tone="info">{item.status}</Badge><button className="ghost" onClick={() => convertTopic(item.id)}>转内容任务</button></div></article>)}
        </div>
      </section>
    </div>
  );
}

function ScheduleBoard({ data, audit, setTab }: { data: AppData; audit: AuditFn; setTab: (tab: '内容' | '选题' | '排期') => void }) {
  const [platform, setPlatform] = useState<Platform | '全部'>('全部');
  const filtered = data.contents.filter((content) => platform === '全部' || content.platform === platform);
  const dates = [...new Set(filtered.map((content) => content.dueDate))].filter(Boolean).sort();
  const updateDate = (id: string, dueDate: string) => {
    const target = data.contents.find((content) => content.id === id);
    if (!target) return;
    audit('调整内容排期', `${target.title}：${dueDate}`, { ...data, contents: data.contents.map((content) => content.id === id ? { ...content, dueDate } : content) });
  };
  return (
    <div className="page-grid">
      <section className="toolbar"><div><h1>内容工厂</h1><p>排期是内容发布前的工作视图，不再作为独立系统模块。</p></div><button className="secondary" onClick={() => setTab('内容')}>返回内容</button></section>
      <section className="panel wide"><div className="module-tabs">{(['内容', '选题', '排期'] as const).map((item) => <button key={item} className={item === '排期' ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div></section>
      <section className="panel wide">
        <div className="inline-form"><select value={platform} onChange={(event) => setPlatform(event.target.value as Platform | '全部')}><option>全部</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="calendar-grid week-mode">
          {dates.length === 0 && <EmptyState title="暂无排期" body="内容任务有截止日期后，会进入排期日历。" />}
          {dates.map((date) => (
            <div className="calendar-day" key={date}>
              <strong>{date}</strong>
              {filtered.filter((content) => content.dueDate === date).map((content) => {
                const conflicts = detectCalendarConflicts(content, data);
                return <div className="calendar-item" key={content.id}><strong>{content.title}</strong><span>{content.platform} · {content.status}</span><input type="date" value={content.dueDate} onChange={(event) => updateDate(content.id, event.target.value)} />{conflicts.map((conflict) => <Badge key={conflict.type} tone={conflict.level === '阻断' ? 'danger' : conflict.level === '预警' ? 'warn' : 'info'}>{conflict.type}</Badge>)}</div>;
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChannelData({ data, audit, apiToken }: { data: AppData; audit: AuditFn; apiToken?: string }) {
  const [metricCsv, setMetricCsv] = useState('');
  const [drillPlatform, setDrillPlatform] = useState<Platform | '全部'>('全部');
  const [reportStatus, setReportStatus] = useState('');
  const drill = buildAnalyticsDrill(data, { dimension: 'platform', platform: drillPlatform, page: 1, pageSize: 20 });
  const importMetrics = () => {
    const contents = applyMetricsCsv(data.contents, metricCsv);
    audit('导入平台内容指标', `${contents.length} 条内容`, { ...data, contents });
    setMetricCsv('');
  };
  const generateReport = async () => {
    const scoped = drillPlatform === '全部' ? data.contents : data.contents.filter((content) => content.platform === drillPlatform);
    const views = scoped.reduce((sum, content) => sum + content.metrics.views, 0);
    const clicks = scoped.reduce((sum, content) => sum + content.metrics.clicks, 0);
    const baseReports = [
      {
        id: `report-${Date.now()}`,
        title: `${drillPlatform} 渠道复盘`,
        body: `本期 ${scoped.length} 条内容获得 ${views} 曝光和 ${clicks} 点击，点击率 ${views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0'}%。`,
        action: clicks === 0 ? '优先检查投递入口和内容 CTA。' : '保留高点击内容结构，继续扩写同类选题。',
        severity: clicks === 0 ? '风险' as const : '建议' as const,
      },
    ];
    const model = findModelApi(data, '复盘建议');
    if (model) {
      try {
        const result = await runModelTask(model, '复盘建议', { drill, platform: drillPlatform }, apiToken);
        if (result.ok && result.text) baseReports[0].body = result.text;
      } catch {
        setReportStatus('模型复盘失败，已生成本地复盘');
      }
    }
    audit('生成渠道复盘', `${drillPlatform} 渠道复盘`, { ...data, reports: [...baseReports, ...data.reports] });
    setReportStatus('复盘已生成');
  };
  return (
    <div className="page-grid">
      <section className="toolbar">
        <div><h1>渠道数据</h1><p>围绕曝光、互动、点击和投递回流判断各渠道是否值得继续投入。</p></div>
        <div className="toolbar-actions"><button onClick={() => exportJson('渠道数据.json', drill)}><FileText size={16} />导出下钻</button><button className="secondary" onClick={() => void generateReport()}><Bot size={16} />生成复盘</button></div>
      </section>
      <div className="stats-row">
        <StatCard label="曝光/阅读/播放" value={drill.summary.views.toLocaleString()} note="渠道内容合计" icon={Rocket} />
        <StatCard label="互动量" value={drill.summary.interactions.toLocaleString()} note={`互动率 ${formatMetricRate(drill.summary.interactionRate)}`} icon={BarChart3} />
        <StatCard label="入口点击" value={drill.summary.clicks.toLocaleString()} note={`点击率 ${formatMetricRate(drill.summary.clickRate)}`} icon={Link} />
        <StatCard label="有效简历" value={drill.summary.effectiveResumes.toLocaleString()} note={`有效率 ${formatMetricRate(drill.summary.effectiveRate)}`} icon={Users} />
      </div>
      <section className="panel wide">
        <div className="inline-form"><select value={drillPlatform} onChange={(event) => setDrillPlatform(event.target.value as Platform | '全部')}><option>全部</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select></div>
        <table className="analytics-table">
          <thead><tr><th>渠道</th><th>曝光</th><th>互动</th><th>点击</th><th>点击率</th></tr></thead>
          <tbody>{drill.breakdowns.map((row) => <tr key={row.id}><td>{row.label}</td><td>{row.snapshot.views}</td><td>{row.snapshot.interactions}</td><td>{row.snapshot.clicks}</td><td>{formatMetricRate(row.snapshot.clickRate)}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>平台指标补录</h2><Database size={18} /></div>
        <textarea className="small-textarea" value={metricCsv} onChange={(event) => setMetricCsv(event.target.value)} placeholder="contentId,views,likes,comments,saves,shares,clicks" />
        <button className="full" onClick={importMetrics}><Database size={16} />导入指标</button>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>复盘结论</h2><Bot size={18} /></div>
        {reportStatus && <div className="platform-note">{reportStatus}</div>}
        {data.reports.length === 0 && <EmptyState title="暂无复盘报告" body="导入真实指标后，可生成渠道复盘和行动建议。" />}
        {data.reports.map((report) => <div className="insight" key={report.id}><Badge tone={report.severity === '风险' ? 'danger' : report.severity === '机会' ? 'good' : 'info'}>{report.severity}</Badge><strong>{report.title}</strong><p>{report.body}</p><small>{report.action}</small></div>)}
      </section>
    </div>
  );
}

function pickAccountRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  if (!payload || typeof payload !== 'object') return [];
  const source = payload as Record<string, unknown>;
  const candidate = source.accounts ?? source.items ?? source.records ?? source.data;
  if (Array.isArray(candidate)) return candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  if (candidate && typeof candidate === 'object') return pickAccountRecords(candidate);
  return [];
}

function normalizeSyncedAccounts(records: Record<string, unknown>[], integration: IntegrationConfig, fallbackPlatform: Platform): PlatformAccount[] {
  const syncedAt = nowText();
  return records.map((record, index) => {
    const platformValue = String(record.platform ?? record.provider ?? fallbackPlatform);
    const platform = platforms.includes(platformValue as Platform) ? platformValue as Platform : fallbackPlatform;
    const externalId = String(record.id ?? record.accountId ?? record.externalId ?? record.openId ?? record.uid ?? `${integration.id}-${index}`);
    const name = String(record.name ?? record.nickname ?? record.username ?? record.displayName ?? externalId);
    const profileUrl = record.profileUrl ?? record.url ?? record.homepage;
    const avatarUrl = record.avatarUrl ?? record.avatar ?? record.image;
    const followerCount = Number(record.followerCount ?? record.followers ?? record.fans ?? 0);
    return {
      id: `${integration.id}:${externalId}`,
      platform,
      name,
      externalId,
      integrationId: integration.id,
      provider: integration.name,
      profileUrl: typeof profileUrl === 'string' ? profileUrl : undefined,
      avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : undefined,
      followerCount: Number.isFinite(followerCount) && followerCount > 0 ? followerCount : undefined,
      status: '已连接',
      syncedAt,
      raw: record,
    };
  });
}

function ConnectionConfig({ data, audit, apiToken }: { data: AppData; audit: AuditFn; apiToken?: string }) {
  const [integration, setIntegration] = useState({ type: '平台API' as IntegrationConfig['type'], name: '', endpoint: '', apiKey: '', authMode: 'Token' as IntegrationConfig['authMode'], extraConfig: '' });
  const [modelApi, setModelApi] = useState({ provider: 'OpenAI' as ModelApiConfig['provider'], name: '', baseUrl: '', apiKey: '', model: '', enabledFor: '内容生成、风险识别、复盘建议' });
  const [syncStatus, setSyncStatus] = useState('');
  const addIntegration = () => {
    if (!integration.name.trim()) return;
    const item: IntegrationConfig = { id: `int-${Date.now()}`, ...integration, status: '待验证' };
    audit('新增API集成', item.name, { ...data, integrations: [item, ...data.integrations] });
    setIntegration({ type: '平台API', name: '', endpoint: '', apiKey: '', authMode: 'Token', extraConfig: '' });
  };
  const testIntegration = async (id: string) => {
    const target = data.integrations.find((item) => item.id === id);
    if (!target) return;
    const result = await testIntegrationConfig(target, apiToken);
    audit('测试API集成', `${target.name}：${result.message}`, { ...data, integrations: data.integrations.map((item) => item.id === id ? { ...item, status: result.status, lastMessage: result.message } : item) });
  };
  const syncAccounts = async (id: string) => {
    const target = data.integrations.find((item) => item.id === id);
    if (!target) return;
    setSyncStatus('正在同步真实平台账号...');
    try {
      const result = await runIntegrationSync(target, '平台账号同步', {}, apiToken);
      const records = pickAccountRecords(result.data);
      const fallbackPlatform = platforms.find((item) => target.name.includes(item)) ?? '小红书';
      const accounts = normalizeSyncedAccounts(records, target, fallbackPlatform);
      const nextAccounts = [...accounts, ...data.accounts.filter((account) => account.integrationId !== target.id)];
      const run: IntegrationSyncRun = { id: `sync-${Date.now()}`, integrationId: target.id, syncType: '平台账号同步', status: result.ok ? '成功' : '失败', message: result.message, recordCount: accounts.length, retryCount: result.retryCount ?? 0, ranAt: nowText() };
      audit('同步真实平台账号', `${target.name}：${accounts.length} 个账号`, { ...data, accounts: nextAccounts, integrationSyncRuns: [run, ...data.integrationSyncRuns] });
      setSyncStatus(result.ok ? `已同步 ${accounts.length} 个真实账号` : result.message);
    } catch {
      setSyncStatus('同步失败，请检查 API 配置');
    }
  };
  const addModelApi = () => {
    if (!modelApi.name.trim()) return;
    const item: ModelApiConfig = {
      id: `model-${Date.now()}`,
      provider: modelApi.provider,
      name: modelApi.name,
      baseUrl: modelApi.baseUrl,
      apiKey: modelApi.apiKey,
      model: modelApi.model,
      enabledFor: modelApi.enabledFor.split(/[、,，/]/).map((value) => value.trim()).filter(Boolean) as ModelApiConfig['enabledFor'],
      status: '待验证',
    };
    audit('新增大模型API', item.name, { ...data, modelApis: [item, ...data.modelApis] });
    setModelApi({ provider: 'OpenAI', name: '', baseUrl: '', apiKey: '', model: '', enabledFor: '内容生成、风险识别、复盘建议' });
  };
  const testModel = async (id: string) => {
    const target = data.modelApis.find((item) => item.id === id);
    if (!target) return;
    const result = await testModelApiConfig(target, apiToken);
    audit('测试大模型API', `${target.name}：${result.message}`, { ...data, modelApis: data.modelApis.map((item) => item.id === id ? { ...item, status: result.status, lastMessage: result.message, lastTestAt: nowText() } : item) });
  };
  return (
    <div className="page-grid">
      <section className="toolbar"><div><h1>连接配置</h1><p>只保留真实平台账号、平台指标、北森回流和大模型 API 连接。</p></div><button onClick={() => exportJson('连接配置.json', { integrations: data.integrations, accounts: data.accounts, modelApis: data.modelApis })}><FileText size={16} />导出配置</button></section>
      <section className="panel wide">
        <div className="panel-title"><h2>平台/API 集成</h2><Link size={18} /></div>
        <div className="inline-form">
          <select value={integration.type} onChange={(event) => setIntegration({ ...integration, type: event.target.value as IntegrationConfig['type'] })}><option>平台API</option><option>北森</option><option>企业微信</option><option>飞书</option><option>BI</option></select>
          <input value={integration.name} onChange={(event) => setIntegration({ ...integration, name: event.target.value })} placeholder="集成名称，例如 小红书开放 API" />
          <input value={integration.endpoint} onChange={(event) => setIntegration({ ...integration, endpoint: event.target.value })} placeholder="API Endpoint" />
          <input type="password" value={integration.apiKey} onChange={(event) => setIntegration({ ...integration, apiKey: event.target.value })} placeholder="API Key / Token" />
          <button onClick={addIntegration}><Plus size={16} />保存集成</button>
        </div>
        <textarea className="small-textarea" value={integration.extraConfig} onChange={(event) => setIntegration({ ...integration, extraConfig: event.target.value })} placeholder='扩展配置 JSON，例如 {"method":"GET","resultPath":"data.accounts"}' />
        {syncStatus && <div className="platform-note"><RefreshCw size={16} />{syncStatus}</div>}
        <div className="entry-grid">
          {data.integrations.length === 0 && <EmptyState title="暂无真实 API 集成" body="配置平台 API 后，才能同步真实账号和指标。" />}
          {data.integrations.map((item) => <article key={item.id}><strong>{item.type}｜{item.name}</strong><span>{item.endpoint}</span><span>认证：{item.authMode} · 密钥：{item.apiKey ? '已配置' : '未配置'}</span><Badge tone={item.status === '已连接' ? 'good' : item.status === '连接失败' ? 'danger' : 'warn'}>{item.status}</Badge><div className="card-actions-inline"><button className="ghost" onClick={() => void testIntegration(item.id)}>测试连接</button><button className="ghost" onClick={() => void syncAccounts(item.id)}>同步账号</button></div></article>)}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>真实平台账号</h2><Users size={18} /></div>
        <div className="entry-grid">
          {data.accounts.length === 0 && <EmptyState title="暂无同步账号" body="账号只能来自平台 API 同步，不再支持人工维护虚拟账号。" />}
          {data.accounts.map((account) => <article key={account.id}><strong>{account.platform}｜{account.name}</strong><span>{account.provider} · {account.externalId}</span><span>最近同步：{account.syncedAt}</span><Badge tone={account.status === '已连接' ? 'good' : account.status === '连接失败' ? 'danger' : 'warn'}>{account.status}</Badge></article>)}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>大模型 API</h2><Bot size={18} /></div>
        <div className="inline-form">
          <select value={modelApi.provider} onChange={(event) => setModelApi({ ...modelApi, provider: event.target.value as ModelApiConfig['provider'] })}><option>OpenAI</option><option>Azure OpenAI</option><option>通义千问</option><option>DeepSeek</option><option>智谱</option><option>私有模型</option><option>其他</option></select>
          <input value={modelApi.name} onChange={(event) => setModelApi({ ...modelApi, name: event.target.value })} placeholder="配置名称" />
          <input value={modelApi.baseUrl} onChange={(event) => setModelApi({ ...modelApi, baseUrl: event.target.value })} placeholder="API Base URL" />
          <input value={modelApi.model} onChange={(event) => setModelApi({ ...modelApi, model: event.target.value })} placeholder="模型名称" />
          <button onClick={addModelApi}><Plus size={16} />保存模型</button>
        </div>
        <div className="inline-form model-form"><input type="password" value={modelApi.apiKey} onChange={(event) => setModelApi({ ...modelApi, apiKey: event.target.value })} placeholder="API Key" /><input value={modelApi.enabledFor} onChange={(event) => setModelApi({ ...modelApi, enabledFor: event.target.value })} placeholder="用途：内容生成、风险识别、复盘建议" /></div>
        <div className="entry-grid">
          {data.modelApis.length === 0 && <EmptyState title="暂无大模型 API" body="添加后用于内容生成、风险识别和复盘建议。" />}
          {data.modelApis.map((item) => <article key={item.id}><strong>{item.provider}｜{item.name}</strong><span>{item.baseUrl} · {item.model}</span><span>用途：{item.enabledFor.join('、')}</span><Badge tone={item.status === '已连接' ? 'good' : item.status === '连接失败' ? 'danger' : 'warn'}>{item.status}</Badge><button className="ghost" onClick={() => void testModel(item.id)}>测试连接</button></article>)}
        </div>
      </section>
    </div>
  );
}

function renderSection(section: Section, data: AppData, audit: AuditFn, apiToken: string | undefined, openSection: (section: Section) => void) {
  if (section === '内容运营') return <ContentFactory data={data} audit={audit} apiToken={apiToken} />;
  if (section === '数据分析') return <ChannelData data={data} audit={audit} apiToken={apiToken} />;
  if (section === '账号与平台') return <ConnectionConfig data={data} audit={audit} apiToken={apiToken} />;
  return <OperationsHome data={data} apiToken={apiToken} openSection={openSection} />;
}

export function App() {
  const [section, setSection] = useState<Section>('工作台');
  const { data, audit, storageMode, apiUser, apiToken, authRequired, authError, login, logout } = useAppData();
  const myTasks = data.contents.filter((content) => content.owner === '招聘专员' || content.reviewer === '招聘专员').length
    + data.notifications.filter((notice) => !notice.read).length;

  if (authRequired) return <LoginScreen onLogin={login} error={authError} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div><Sparkles size={22} /></div>
          <span>招聘运营助手<small>内容运营工作台</small></span>
        </div>
        <div className="sidebar-summary">
          <strong>{apiUser?.name ?? '当前用户'}</strong>
          <span>{apiUser?.role ?? '本地视图'} · {myTasks} 项内容运营待办</span>
        </div>
        <nav>
          {navItems.map(({ key, label, note, icon: Icon }) => (
            <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}>
              <Icon size={18} />
              <span>{label}<small>{note}</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Badge tone="good">核心闭环版</Badge>
          <Badge tone={storageMode === '本地API' ? 'good' : 'warn'}>{storageMode}</Badge>
          {apiUser && <small>{apiUser.name} · {apiUser.role}</small>}
          {apiUser && <button className="ghost" onClick={logout}>退出登录</button>}
          <small>只保留内容生产、渠道数据和真实账号连接。</small>
        </div>
      </aside>
      <main>{renderSection(section, data, audit, apiToken, setSection)}</main>
    </div>
  );
}
