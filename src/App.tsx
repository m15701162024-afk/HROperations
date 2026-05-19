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
import { useMemo, useState } from 'react';
import { emptyData, generateContent, nextStatus, platformPositioning, platforms, scanRisks } from './data';
import type { AccountType, AppData, AssetItem, ContentTask, CostRecord, IntegrationConfig, JobNeed, LandingPage, PermissionRole, Platform, PlatformAccount, RecruitmentEntry, SensitiveRule } from './types';
import { applyMetricsCsv, buildRecommendations, buildReportMarkdown, calculateRoi, downloadText, exportJson, parseBeisenCsv, parseJobCsv, toCsv } from './utils';

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
    return {
      ...emptyData,
      ...parsed,
      entries: parsed.entries ?? [],
      beisenResults: parsed.beisenResults ?? [],
      integrations: parsed.integrations ?? [],
      landingPages: parsed.landingPages ?? [],
      roles: parsed.roles ?? [],
      sensitiveRules: parsed.sensitiveRules ?? [],
      costs: parsed.costs ?? [],
      auditLogs: parsed.auditLogs ?? [],
    };
  });

  const update = (next: AppData) => {
    setData(next);
    localStorage.setItem('hr-assistant-data-mode', 'real-v1');
    localStorage.setItem('hr-assistant-data', JSON.stringify(next));
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

  return { data, update, audit };
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

function Progress({ current, target }: { current: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="progress" aria-label={`完成度 ${percent}%`}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function Dashboard({ data }: { data: AppData }) {
  const totals = useMemo(() => {
    const published = data.contents.filter((item) => item.status === '已发布' || item.status === '数据回收中' || item.status === '已复盘').length;
    const views = data.contents.reduce((sum, item) => sum + item.metrics.views, 0);
    const interactions = data.contents.reduce((sum, item) => sum + item.metrics.likes + item.metrics.comments + item.metrics.saves + item.metrics.shares, 0);
    const clicks = data.contents.reduce((sum, item) => sum + item.metrics.clicks, 0);
    return { published, views, interactions, clicks };
  }, [data.contents]);

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
          <h2>运营目标进度</h2>
          <Target size={18} />
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
            </tr>
          </thead>
          <tbody>
            {data.jobs.length === 0 && (
              <tr>
                <td colSpan={6}><EmptyState title="暂无真实岗位需求" body="请通过上方表单录入，或粘贴 CSV 批量导入。" /></td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ContentOps({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [jobId, setJobId] = useState(data.jobs[0]?.id ?? '');
  const [platform, setPlatform] = useState<Platform>('小红书');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');

  const selectedJob = data.jobs.find((job) => job.id === jobId) ?? data.jobs[0];
  const risk = scanRisks(draft);
  const filtered = data.contents.filter((item) => item.title.includes(query) || item.platform.includes(query) || item.type.includes(query));

  const handleGenerate = () => {
    if (!selectedJob) return;
    setDraft(generateContent(selectedJob, platform));
  };

  const handleCreateTask = () => {
    if (!selectedJob || !draft.trim()) return;
    const accountId = data.accounts.find((acc) => acc.platform === platform)?.id ?? data.accounts[0]?.id ?? '';
    const scanned = scanRisks(draft);
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
    audit('创建内容任务', newTask.title, { ...data, contents: [newTask, ...data.contents] });
  };

  const advance = (id: string) => {
    const target = data.contents.find((item) => item.id === id);
    audit('推进审核状态', target?.title ?? id, {
      ...data,
      contents: data.contents.map((item) => (item.id === id ? { ...item, status: nextStatus(item.status) } : item)),
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
        <button onClick={handleGenerate} disabled={data.jobs.length === 0}><Bot size={16} />生成平台内容</button>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="生成或编辑内容初稿" />
        <div className="risk-box">
          <ShieldCheck size={16} />
          <span>风险等级：<b>{risk.level}</b></span>
          {risk.risks.length > 0 && <small>{risk.risks.join('；')}</small>}
        </div>
        <button className="full" onClick={handleCreateTask}><Plus size={16} />保存为内容任务</button>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <h2>内容任务与审核流</h2>
          <Filter size={18} />
        </div>
        <div className="content-list">
          {filtered.length === 0 && <EmptyState title="暂无真实内容任务" body="录入岗位后可生成内容任务；发布后的指标会进入看板。" />}
          {filtered.map((item) => (
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
              </div>
              <div className="card-actions">
                <Badge tone="info">{item.status}</Badge>
                <button onClick={() => advance(item.id)}><CheckCircle2 size={16} />推进状态</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Assets({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [asset, setAsset] = useState({ name: '', category: '公司/业务介绍', owner: '招聘专员', scope: '招聘内容可用' });
  const createAsset = () => {
    if (!asset.name.trim()) return;
    const item: AssetItem = {
      id: `asset-${Date.now()}`,
      ...asset,
      platforms: ['小红书', '脉脉', '公众号'],
      riskLevel: asset.category.includes('员工') || asset.category.includes('技术') ? '高' : '中',
      authorization: '待审核',
      expiresAt: '2026-12-31',
      usageCount: 0,
    };
    audit('新增素材', item.name, { ...data, assets: [item, ...data.assets] });
    setAsset({ name: '', category: '公司/业务介绍', owner: '招聘专员', scope: '招聘内容可用' });
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
          <button onClick={createAsset}><Plus size={16} />保存</button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>素材库</h2><Database size={18} /></div>
        {data.assets.length === 0 && <EmptyState title="暂无真实素材" body="请录入公司介绍、JD、图片授权、FAQ 或技术案例采集记录。" />}
        {data.assets.map((asset) => (
          <div className="asset-row" key={asset.id}>
            <strong>{asset.name}</strong>
            <span>{asset.category} · {asset.scope}</span>
            <div><Badge tone={asset.riskLevel === '高' ? 'danger' : asset.riskLevel === '中' ? 'warn' : 'good'}>{asset.riskLevel}风险</Badge><Badge>{asset.authorization}</Badge></div>
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

function Accounts({ data, audit }: { data: AppData; audit: (action: string, target: string, nextData?: AppData) => void }) {
  const [entry, setEntry] = useState({ platform: '小红书' as Platform, headline: '', url: '', destination: '北森岗位页' as RecruitmentEntry['destination'] });
  const [integration, setIntegration] = useState({ type: '北森' as IntegrationConfig['type'], name: '', endpoint: '', authMode: 'Token' as IntegrationConfig['authMode'] });
  const [landing, setLanding] = useState({ title: '', slug: '', pageType: '岗位集合页' as LandingPage['pageType'], destinationUrl: '' });
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
            </tr>
          </thead>
          <tbody>
            {data.accounts.length === 0 && (
              <tr>
                <td colSpan={6}><EmptyState title="暂无真实平台账号" body="请录入实际运营账号，数据归属和发布权限会基于账号配置计算。" /></td>
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
          {data.landingPages.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>/{item.slug || item.id} · {item.pageType} · 关联岗位 {item.linkedJobIds.length} 个</span>
              <Badge tone="info">{item.visits} 访问 / {item.clicks} 点击</Badge>
            </article>
          ))}
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

function Reports({ data }: { data: AppData }) {
  const recommendations = buildRecommendations(data);
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
  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>复盘报告</h1>
          <p>自动识别高低表现内容，生成周报/月报、行动建议和案例沉淀。</p>
        </div>
        <button onClick={() => downloadText('招聘新媒体运营周报.md', buildReportMarkdown(data), 'text/markdown;charset=utf-8')}><FileText size={16} />下载周报</button>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>AI 运营策略建议</h2><Bot size={18} /></div>
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

function SettingsPage({ data }: { data: AppData }) {
  const [role, setRole] = useState({ name: '', dataScope: '个人' as PermissionRole['dataScope'], permissions: '岗位查看、内容创建' });
  const [rule, setRule] = useState({ keyword: '', category: '合规表达', riskLevel: '高' as SensitiveRule['riskLevel'], suggestion: '' });
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
  const remainingItems = [
    '替换本地 localStorage 为后端数据库与登录态',
    '用真实北森 OpenAPI 替换 CSV 回流入口',
    '用各平台正式 API/插件替换手动导入平台指标',
    '完成浏览器插件独立打包和平台页面适配',
    '接入真实企业微信/飞书消息发送权限',
    '完善落地页公网部署、表单提交和访问埋点',
  ];
  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>系统配置</h1>
          <p>角色权限、审核流程、品牌规范、风险规则、敏感词和操作日志。</p>
        </div>
        <button><LockKeyhole size={16} />权限审计</button>
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
        <div className="panel-title"><h2>审核流程配置</h2><GitBranch size={18} /></div>
        <div className="workflow">
          {['草稿', 'AI已生成', '待专业补充', '待专业审核', '待品牌合规审核', '待平台适配', '待发布', '已发布', '数据回收中', '已复盘'].map((step) => (
            <span key={step}>{step}</span>
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
        <div className="panel-title"><h2>剩余待开发项</h2><ClipboardList size={18} /></div>
        <div className="todo-grid">
          {remainingItems.map((item) => (
            <div className="todo-item" key={item}><CheckCircle2 size={16} />{item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function renderSection(section: Section, data: AppData, update: (data: AppData) => void, audit: (action: string, target: string, nextData?: AppData) => void) {
  switch (section) {
    case '工作台':
      return <Dashboard data={data} />;
    case '招聘需求':
      return <Jobs data={data} audit={audit} />;
    case '内容运营':
      return <ContentOps data={data} audit={audit} />;
    case '素材资产':
      return <Assets data={data} audit={audit} />;
    case '账号与平台':
      return <Accounts data={data} audit={audit} />;
    case '数据分析':
      return <Analytics data={data} audit={audit} />;
    case '复盘报告':
      return <Reports data={data} />;
    case '系统配置':
      return <SettingsPage data={data} />;
  }
}

export function App() {
  const [section, setSection] = useState<Section>('工作台');
  const { data, update, audit } = useAppData();

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
          <small>Web 系统 · 北森前置运营中台</small>
        </div>
      </aside>
      <main>
        {renderSection(section, data, update, audit)}
      </main>
    </div>
  );
}
