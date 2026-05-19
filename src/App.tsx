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
import { generateContent, nextStatus, platformPositioning, platforms, scanRisks, seedData } from './data';
import type { AppData, AssetItem, ContentTask, JobNeed, Platform, RecruitmentEntry } from './types';
import { buildReportMarkdown, downloadText, exportJson, parseJobCsv, toCsv } from './utils';

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

function useAppData() {
  const [data, setData] = useState<AppData>(() => {
    const stored = localStorage.getItem('hr-assistant-data');
    if (!stored) return seedData;
    const parsed = JSON.parse(stored) as Partial<AppData>;
    return {
      ...seedData,
      ...parsed,
      entries: parsed.entries ?? seedData.entries,
      auditLogs: parsed.auditLogs ?? seedData.auditLogs,
    };
  });

  const update = (next: AppData) => {
    setData(next);
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

function Progress({ current, target }: { current: number; target: number }) {
  const percent = Math.min(100, Math.round((current / target) * 100));
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
    const scanned = scanRisks(draft);
    const newTask: ContentTask = {
      id: `ct-${Date.now()}`,
      title: `${platform}｜${selectedJob.title}内容初稿`,
      jobId: selectedJob.id,
      platform,
      accountId: data.accounts.find((acc) => acc.platform === platform)?.id ?? data.accounts[0].id,
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

  const syncMetrics = () => {
    const next = {
      ...data,
      contents: data.contents.map((item) => ({
        ...item,
        status: item.status === '已发布' ? '数据回收中' : item.status,
        metrics: {
          views: item.metrics.views + Math.round(Math.random() * 900),
          likes: item.metrics.likes + Math.round(Math.random() * 80),
          comments: item.metrics.comments + Math.round(Math.random() * 12),
          saves: item.metrics.saves + Math.round(Math.random() * 45),
          shares: item.metrics.shares + Math.round(Math.random() * 20),
          clicks: item.metrics.clicks + Math.round(Math.random() * 24),
        },
      })),
    };
    audit('同步平台数据', '内容指标', next);
  };

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>内容运营</h1>
          <p>AI 多平台生成、风险识别、审核状态流转、排期发布一体管理。</p>
        </div>
        <div className="toolbar-actions">
          <button onClick={syncMetrics}><RefreshCw size={16} />模拟同步数据</button>
          <div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索内容、平台、类型" /></div>
        </div>
      </section>

      <section className="panel generator">
        <div className="panel-title">
          <h2>AI 内容生成</h2>
          <Sparkles size={18} />
        </div>
        <label>
          岗位需求
          <select value={jobId} onChange={(event) => setJobId(event.target.value)}>
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
        <button onClick={handleGenerate}><Bot size={16} />生成平台内容</button>
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
    </div>
  );
}

function Analytics({ data }: { data: AppData }) {
  const byPlatform = platforms.map((platform) => {
    const items = data.contents.filter((item) => item.platform === platform);
    return {
      platform,
      views: items.reduce((sum, item) => sum + item.metrics.views, 0),
      clicks: items.reduce((sum, item) => sum + item.metrics.clicks, 0),
      count: items.length,
    };
  }).filter((item) => item.count > 0);

  return (
    <div className="page-grid">
      <section className="toolbar">
        <div>
          <h1>数据分析</h1>
          <p>按平台、账号、岗位族群、内容类型分析曝光、互动、点击和跳转漏斗。</p>
        </div>
        <button><RefreshCw size={16} />同步/导入数据</button>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>平台效果对比</h2><BarChart3 size={18} /></div>
        <div className="bar-list">
          {byPlatform.map((item) => (
            <div key={item.platform} className="bar-row">
              <strong>{item.platform}</strong>
              <Progress current={item.views} target={Math.max(...byPlatform.map((p) => p.views), 1)} />
              <span>{item.views.toLocaleString()} 曝光 · {item.clicks} 点击</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>岗位族群效果</h2><GitBranch size={18} /></div>
        {data.jobs.map((job) => {
          const related = data.contents.filter((item) => item.jobId === job.id);
          const clicks = related.reduce((sum, item) => sum + item.metrics.clicks, 0);
          return <div className="compact-row" key={job.id}><div><strong>{job.family}</strong><span>{job.title}</span></div><Badge tone="info">{clicks} 点击</Badge></div>;
        })}
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
        <div className="report-header">
          <span>2026 年 5 月招聘新媒体运营周报</span>
          <Badge tone="good">自动生成</Badge>
        </div>
        <div className="report-grid">
          {data.reports.map((report) => (
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
          <div className="template-chip">标题含具体岗位场景<small>提升点击意愿</small></div>
          <div className="template-chip">强调真实技术挑战<small>适合脉脉/技术社区</small></div>
          <div className="template-chip">校招内容使用成长路径<small>适合小红书收藏</small></div>
          <div className="template-chip">CTA 指向主页入口<small>利于归因统计</small></div>
        </div>
      </section>
    </div>
  );
}

function SettingsPage({ data }: { data: AppData }) {
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
        {['招聘专员', '招聘主管', '新媒体运营', '技术负责人', '管理层'].map((role) => (
          <div className="compact-row" key={role}>
            <div><strong>{role}</strong><span>岗位、内容、素材、账号、数据范围差异化控制</span></div>
            <Badge tone="info">已配置</Badge>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title"><h2>高风险规则库</h2><ShieldCheck size={18} /></div>
        {['薪酬福利承诺', '业务数据与客户信息', '技术架构与算法细节', '员工照片与个人经历', '竞品与舆情表达', '校招转正承诺', '招聘歧视与虚假宣传'].map((rule) => (
          <div className="rule-row" key={rule}><AlertTriangle size={15} />{rule}</div>
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
      return <Analytics data={data} />;
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
