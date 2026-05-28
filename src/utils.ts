import { platformPositioning, platforms } from './data';
import type { AccountHealthSnapshot, AppData, BeisenResult, CandidateLead, ContentQualityScore, ContentTask, DataExplanation, IntegrationConfig, JobNeed, ModelApiConfig, Platform, TaskItem, TopicItem } from './types';

export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

export interface ExternalReadiness {
  status: '已闭环' | '待复验' | '需补配置';
  score: number;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
  nextAction: string;
}

export function evaluateIntegrationReadiness(config: IntegrationConfig): ExternalReadiness {
  const extra = safeParseJson(config.extraConfig);
  const needsSecret = config.authMode === 'Token' || config.authMode === 'OAuth';
  const checks = [
    { label: '接口地址', passed: Boolean(config.endpoint), detail: config.endpoint || '未填写接口地址或 Webhook' },
    { label: '鉴权方式', passed: config.authMode !== '未配置', detail: config.authMode },
    { label: '密钥凭证', passed: !needsSecret || Boolean(config.apiKey), detail: needsSecret ? (config.apiKey ? 'Token 已保存' : 'Token 未保存') : '当前鉴权方式不强制 Token' },
    { label: '扩展配置', passed: config.type !== '平台API' || Boolean(extra), detail: config.extraConfig ? '已保存 JSON 配置' : '未填写字段、路径或分页配置' },
    { label: '连接测试', passed: config.status === '已连接' || Boolean(config.lastSyncAt), detail: config.lastMessage || config.status },
  ];
  return summarizeExternalReadiness(checks);
}

export function evaluateModelApiReadiness(config: ModelApiConfig): ExternalReadiness {
  const checks = [
    { label: 'Base URL', passed: Boolean(config.baseUrl), detail: config.baseUrl || '未填写 Base URL' },
    { label: 'API Key', passed: Boolean(config.apiKey), detail: config.apiKey ? 'Token 已保存' : 'Token 未保存' },
    { label: '模型名称', passed: Boolean(config.model), detail: config.model || '未填写模型名称' },
    { label: '业务用途', passed: config.enabledFor.length > 0, detail: config.enabledFor.join('、') || '未选择用途' },
    { label: '连接测试', passed: config.status === '已连接' || Boolean(config.lastTestAt), detail: config.lastMessage || config.status },
  ];
  return summarizeExternalReadiness(checks);
}

function summarizeExternalReadiness(checks: ExternalReadiness['checks']): ExternalReadiness {
  const passed = checks.filter((item) => item.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  const missing = checks.filter((item) => !item.passed).map((item) => item.label);
  return {
    status: passed === checks.length ? '已闭环' : passed >= checks.length - 1 ? '待复验' : '需补配置',
    score,
    checks,
    nextAction: missing.length ? `补齐：${missing.join('、')}` : '配置、测试、异常说明和复验记录已闭环',
  };
}

function safeParseJson(raw?: string) {
  if (!raw?.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function readJsonFile<T>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as T);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

export function toCsv(rows: Record<string, string | number | boolean | undefined>[]) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | boolean | undefined) => {
    const text = String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

export function parseJobCsv(raw: string): JobNeed[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
    const platforms = (row.targetPlatforms || row.目标平台 || '小红书').split(/[、/|;]/).map((item) => item.trim()).filter(Boolean) as Platform[];
    return {
      id: `job-import-${Date.now()}-${index}`,
      title: row.title || row.岗位名称 || `导入岗位 ${index + 1}`,
      family: row.family || row.岗位族群 || '未分类',
      city: row.city || row.城市 || '杭州',
      level: row.level || row.岗位层级 || '中高级',
      type: row.type === '校招' || row.type === '实习' || row.type === '职能' ? row.type : '社招',
      jd: row.jd || row.JD || row.岗位描述 || '待补充 JD',
      persona: row.persona || row.候选人画像 || '2-10 年经验候选人',
      sellingPoints: (row.sellingPoints || row.岗位卖点 || '技术挑战、成长空间').split(/[、/|;]/).map((item) => item.trim()).filter(Boolean),
      targetPlatforms: platforms.length ? platforms : ['小红书'],
      status: '招聘中',
      beisenUrl: row.beisenUrl || row.北森链接 || '',
      websiteUrl: row.websiteUrl || row.官网链接 || '',
    };
  });
}

export function applyMetricsCsv(contents: ContentTask[], raw: string) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return contents;
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
  });
  return contents.map((content) => {
    const row = rows.find((item) => item.contentId === content.id || item.内容ID === content.id || item.title === content.title || item.标题 === content.title);
    if (!row) return content;
    const numberOf = (...keys: string[]) => {
      const value = keys.map((key) => row[key]).find((item) => item !== undefined && item !== '');
      return value === undefined ? undefined : Number(String(value).replace('%', '')) || 0;
    };
    const metric = (current: number | undefined, ...keys: string[]) => numberOf(...keys) ?? Number(current ?? 0);
    return {
      ...content,
      metrics: {
        ...content.metrics,
        impressions: metric(content.metrics.impressions, 'impressions', '曝光', '曝光数', '曝光量'),
        views: metric(content.metrics.views, 'views', '观看', '观看数', '阅读', '阅读数', '播放', '播放量'),
        coverClickRate: metric(content.metrics.coverClickRate, 'coverClickRate', '封面点击率'),
        avgWatchDuration: metric(content.metrics.avgWatchDuration, 'avgWatchDuration', '平均观看时长', '平均观看时长秒'),
        totalWatchDuration: metric(content.metrics.totalWatchDuration, 'totalWatchDuration', '观看总时长', '观看总时长秒'),
        completionRate: metric(content.metrics.completionRate, 'completionRate', '视频完播率', '完播率'),
        likes: metric(content.metrics.likes, 'likes', '点赞', '点赞数', '点赞量'),
        comments: metric(content.metrics.comments, 'comments', '评论', '评论数', '评论量'),
        saves: metric(content.metrics.saves, 'saves', '收藏', '收藏数', '收藏量'),
        shares: metric(content.metrics.shares, 'shares', '分享', '分享数', '转发', '转发量'),
        followsGained: metric(content.metrics.followsGained, 'followsGained', '涨粉', '涨粉数'),
        profileVisitors: metric(content.metrics.profileVisitors, 'profileVisitors', '主页访客', '主页访客数'),
        newFollows: metric(content.metrics.newFollows, 'newFollows', '新增关注', '新增粉丝', '新增粉丝数'),
        unfollows: metric(content.metrics.unfollows, 'unfollows', '取消关注', '流失粉丝', '流失粉丝数'),
        netFollows: metric(content.metrics.netFollows, 'netFollows', '净涨粉'),
        profileFollowRate: metric(content.metrics.profileFollowRate, 'profileFollowRate', '主页转粉率'),
        publishCount: metric(content.metrics.publishCount, 'publishCount', '发布数', '总发布'),
        videoPublishCount: metric(content.metrics.videoPublishCount, 'videoPublishCount', '发布视频'),
        imageTextPublishCount: metric(content.metrics.imageTextPublishCount, 'imageTextPublishCount', '发布图文'),
        totalFollowers: metric(content.metrics.totalFollowers, 'totalFollowers', '总粉丝数'),
        activeFollowers: metric(content.metrics.activeFollowers, 'activeFollowers', '活跃粉丝数'),
        clicks: metric(content.metrics.clicks, 'clicks', '招聘入口点击', '入口点击', '链接点击', '落地页点击', '投递入口点击'),
      },
    };
  });
}

export function parseBeisenCsv(raw: string): BeisenResult[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
    const stage = normalizeStage(row.stage || row.阶段 || row.status || row.状态);
    return {
      id: `beisen-${Date.now()}-${index}`,
      jobId: row.jobId || row.岗位ID || '',
      sourcePlatform: normalizePlatform(row.sourcePlatform || row.来源平台),
      sourceContentId: row.sourceContentId || row.内容ID || undefined,
      candidateCode: row.candidateCode || row.候选人编码 || `candidate-${Date.now()}-${index}`,
      stage,
      importedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
  });
}

export function parseLeadCsv(raw: string, existing: CandidateLead[] = []): CandidateLead[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
    const lead: CandidateLead = {
      id: `lead-${Date.now()}-${index}`,
      name: row.name || row.姓名 || row.nickname || row.昵称 || `导入线索 ${index + 1}`,
      contact: row.contact || row.联系方式 || row.mobile || row.phone || row.手机号 || '',
      sourcePlatform: normalizePlatform(row.sourcePlatform || row.来源平台),
      sourceAccountId: row.sourceAccountId || row.来源账号 || undefined,
      sourceContentId: row.sourceContentId || row.来源内容 || undefined,
      targetJobId: row.targetJobId || row.意向岗位 || undefined,
      owner: row.owner || row.跟进人 || '招聘专员',
      stage: normalizeLeadStage(row.stage || row.阶段),
      beisenStatus: '待转入',
      note: row.note || row.备注 || '',
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    const duplicated = findDuplicateLead([...existing, ...lines.slice(1, index).map((_, prevIndex) => ({
      id: `tmp-${prevIndex}`,
      contact: splitCsvLine(lines[prevIndex + 1])[headers.indexOf('contact')] ?? '',
    } as CandidateLead))], lead);
    return duplicated ? { ...lead, duplicateOf: duplicated.id } : lead;
  });
}

function normalizeLeadStage(value: string | undefined): CandidateLead['stage'] {
  const stages: CandidateLead['stage'][] = ['待联系', '已联系', '已转北森', '无效', '暂不合适'];
  return stages.find((stage) => stage === value) ?? '待联系';
}

export function findDuplicateLead(leads: CandidateLead[], lead: CandidateLead) {
  const contact = lead.contact.trim();
  if (!contact) return undefined;
  return leads.find((item) => item.id !== lead.id && item.contact.trim() === contact);
}

export function deriveTasks(data: AppData): TaskItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const completed = new Set(data.taskCompletions);
  const settings = data.operationSettings;
  const tasks: TaskItem[] = [];
  const push = (task: Omit<TaskItem, 'status' | 'createdAt'>) => {
    if (!completed.has(task.id)) {
      tasks.push({ ...task, status: '待处理', createdAt: today });
    }
  };

  data.contents.forEach((content) => {
    if ((content.dueDate === today || content.publishedAt === today) && !['已发布', '数据回收中', '已复盘', '已归档'].includes(content.status)) {
      push({ id: `task-publish-${content.id}`, type: '待发布', title: `今日待发布：${content.title}`, body: `${content.platform} 内容排期在今天`, owner: content.owner, priority: '高', targetSection: '排期日历', targetId: content.id, dueDate: content.dueDate });
    }
    if (content.status === '待专业审核' || content.status === '待品牌合规审核') {
      push({ id: `task-review-${content.id}`, type: '待审核', title: `待审核：${content.title}`, body: `${content.status}，审核人 ${content.reviewer || '未指定'}`, owner: content.reviewer || content.owner, priority: content.riskLevel === '高' ? '高' : '中', targetSection: '内容运营', targetId: content.id, dueDate: content.dueDate });
    }
    if (content.riskLevel === '高' && content.status !== '已复盘' && content.status !== '已归档') {
      push({ id: `task-risk-${content.id}`, type: '高风险待处理', title: `高风险内容：${content.title}`, body: content.risks.join('、') || '需要合规复核', owner: content.reviewer || content.owner, priority: '高', targetSection: '内容运营', targetId: content.id, dueDate: content.dueDate });
    }
    const publishedDate = content.publishedAt ? new Date(content.publishedAt) : undefined;
    const metricsEmpty = Object.values(content.metrics).every((value) => value === 0);
    if (publishedDate && metricsEmpty && Date.now() - publishedDate.getTime() > settings.dataCollectionDelayDays * 86400000) {
      push({ id: `task-metrics-${content.id}`, type: '数据待回收', title: `数据待回收：${content.title}`, body: '内容已发布超过 2 天但暂无平台指标', owner: content.owner, priority: '中', targetSection: '数据分析', targetId: content.id, dueDate: today });
    }
    if ((content.status === '待专业审核' || content.status === '待品牌合规审核') && content.dueDate < today) {
      push({ id: `task-sla-${content.id}`, type: '审核超时', title: `审核超时：${content.title}`, body: `已超过审核 SLA ${settings.reviewSlaHours} 小时，请尽快闭环`, owner: content.reviewer || content.owner, priority: '高', targetSection: '内容运营', targetId: content.id, dueDate: content.dueDate });
    }
  });

  data.assets.forEach((asset) => {
    if (asset.expiresAt && Math.ceil((new Date(asset.expiresAt).getTime() - Date.now()) / 86400000) <= 30) {
      push({ id: `task-asset-${asset.id}`, type: '素材授权到期', title: `素材授权即将到期：${asset.name}`, body: `有效期至 ${asset.expiresAt}`, owner: asset.owner, priority: '中', targetSection: '素材资产', targetId: asset.id, dueDate: asset.expiresAt });
    }
  });

  data.candidateLeads.forEach((lead) => {
    if ((lead.stage === '待联系' || lead.stage === '已联系') && lead.beisenStatus !== '已转入') {
      push({ id: `task-lead-${lead.id}`, type: '线索待跟进', title: `线索待跟进：${lead.name}`, body: `${lead.sourcePlatform} · ${lead.contact || '无联系方式'}`, owner: lead.owner, priority: lead.stage === '待联系' ? '高' : '中', targetSection: '线索池', targetId: lead.id, dueDate: today });
    }
  });

  data.accounts.filter((account) => account.status === '启用').forEach((account) => {
    const latest = data.contents
      .filter((content) => content.accountId === account.id && (content.publishedAt || content.dueDate))
      .map((content) => content.publishedAt || content.dueDate)
      .sort()
      .at(-1);
    const inactiveDays = latest ? Math.floor((Date.now() - new Date(latest).getTime()) / 86400000) : 999;
    if (inactiveDays >= settings.accountInactiveWarningDays) {
      push({ id: `task-account-${account.id}`, type: '账号停更', title: `账号停更提醒：${account.name}`, body: `${account.platform} 已 ${inactiveDays} 天无发布`, owner: account.owner, priority: inactiveDays >= settings.accountInactiveDangerDays ? '高' : '中', targetSection: '账号与平台', targetId: account.id, dueDate: today });
    }
  });

  data.reviewMentions.filter((mention) => !mention.read).forEach((mention) => {
    const content = data.contents.find((item) => item.id === mention.contentId);
    push({ id: `task-mention-${mention.id}`, type: '待审核', title: `有人 @ 你处理内容：${content?.title ?? mention.contentId}`, body: '请查看审核评论并闭环处理', owner: mention.userId, priority: '中', targetSection: '内容运营', targetId: mention.contentId, dueDate: today });
  });

  return [...data.tasks.filter((task) => task.status !== '已完成' && task.status !== '已忽略'), ...tasks]
    .filter((task, index, list) => list.findIndex((item) => item.id === task.id) === index);
}

export function scoreContentQuality(content: ContentTask, job?: JobNeed): ContentQualityScore {
  const text = `${content.title}\n${content.content}`;
  const includesAny = (words: string[]) => words.some((word) => text.includes(word));
  const titleScore = Math.min(20, 8 + (content.title.length >= 12 ? 5 : 0) + (content.title.includes('？') || content.title.includes('?') ? 3 : 0) + (job && content.title.includes(job.family) ? 4 : 0));
  const personaKeywords = ['薪酬', '稳定', '挑战', '团队', '成长', '前景', '管理', '强度'];
  const personaScore = Math.min(20, personaKeywords.filter((word) => text.includes(word)).length * 3 + (job?.persona ? 5 : 0));
  const sellingPointScore = Math.min(20, (job?.sellingPoints ?? []).filter((point) => text.includes(point)).length * 5 + (job && text.includes(job.title) ? 5 : 0));
  const platformFitScore = Math.min(15, 6 + (content.tags.length >= 2 ? 3 : 0) + (content.platform === '小红书' && includesAny(['氛围', '成长', '体验']) ? 3 : 0) + (content.platform === '脉脉' && includesAny(['行业', '技术', '中高端']) ? 3 : 0) + (content.platform === 'B站' && includesAny(['视频', '访谈', '分享']) ? 3 : 0));
  const ctaScore = includesAny(['投递', '私信', '链接', '查看岗位', '简历', '沟通']) ? 10 : 3;
  const complianceScore = content.riskLevel === '高' ? 4 : content.riskLevel === '中' ? 10 : 15;
  const total = titleScore + personaScore + sellingPointScore + platformFitScore + ctaScore + complianceScore;
  const suggestions = [
    titleScore < 14 ? '标题可以补充目标人群、具体场景或岗位亮点。' : '',
    personaScore < 14 ? '建议补充候选人关心的薪酬、稳定性、挑战、团队氛围或成长空间。' : '',
    sellingPointScore < 14 ? '建议把岗位卖点更明确地写入正文。' : '',
    platformFitScore < 10 ? `建议调整为更适合${content.platform}的表达方式。` : '',
    ctaScore < 8 ? '建议增加明确行动入口，例如投递、私信或查看岗位链接。' : '',
    complianceScore < 10 ? '高风险表达需要合规审核并替换敏感口径。' : '',
  ].filter(Boolean);
  return {
    id: `score-${Date.now()}`,
    contentId: content.id,
    total,
    titleScore,
    personaScore,
    sellingPointScore,
    platformFitScore,
    ctaScore,
    complianceScore,
    suggestions,
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    evaluator: '规则',
  };
}

export function calculateAccountHealth(accountId: string, data: AppData): AccountHealthSnapshot {
  const account = data.accounts.find((item) => item.id === accountId);
  const contents = data.contents.filter((item) => item.accountId === accountId);
  const published = contents.filter((item) => item.status === '已发布' || item.status === '数据回收中' || item.status === '已复盘');
  const views = published.reduce((sum, item) => sum + item.metrics.views, 0);
  const interactions = published.reduce((sum, item) => sum + item.metrics.likes + item.metrics.comments + item.metrics.saves + item.metrics.shares, 0);
  const clicks = published.reduce((sum, item) => sum + item.metrics.clicks, 0);
  const latest = published.map((item) => item.publishedAt || item.dueDate).sort().at(-1);
  const inactiveDays = latest ? Math.max(0, Math.floor((Date.now() - new Date(latest).getTime()) / 86400000)) : 999;
  const highRiskRatio = contents.length ? contents.filter((item) => item.riskLevel === '高').length / contents.length : 0;
  const positioningWords = (account?.positioning ?? '').split(/[、,，/]/).filter(Boolean);
  const positioningMatchScore = contents.length ? Math.round((contents.filter((content) => positioningWords.some((word) => content.title.includes(word) || content.content.includes(word))).length / contents.length) * 100) : 0;
  const level: AccountHealthSnapshot['level'] = inactiveDays >= 30 || highRiskRatio > 0.35 ? '风险' : inactiveDays >= 14 || positioningMatchScore < 30 ? '需关注' : '健康';
  const suggestions = [
    inactiveDays >= 14 ? `账号已 ${inactiveDays} 天未发布，建议补充排期。` : '',
    highRiskRatio > 0.25 ? '高风险内容占比偏高，建议加强审核规则。' : '',
    positioningMatchScore < 40 ? '内容与账号定位匹配度偏低，建议收敛选题。' : '',
    clicks === 0 && views > 0 ? '有观看但无招聘入口点击，建议强化 CTA 和招聘入口。' : '',
  ].filter(Boolean);
  return {
    id: `health-${accountId}-${Date.now()}`,
    accountId,
    periodStart: '',
    periodEnd: new Date().toISOString().slice(0, 10),
    publishCount: published.length,
    averageViews: published.length ? Math.round(views / published.length) : 0,
    averageInteractionRate: views ? Number((interactions / views).toFixed(4)) : 0,
    averageClickRate: views ? Number((clicks / views).toFixed(4)) : 0,
    highRiskRatio,
    inactiveDays,
    positioningMatchScore,
    level,
    suggestions,
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  };
}

export function detectCalendarConflicts(content: ContentTask, data: AppData) {
  const conflicts: { type: '账号过载' | '频次不足' | '高风险未审' | '入口未配置' | '素材未授权'; message: string; level: '提醒' | '预警' | '阻断' }[] = [];
  const sameDay = data.contents.filter((item) => item.id !== content.id && item.accountId === content.accountId && item.dueDate === content.dueDate);
  if (sameDay.length >= data.operationSettings.dailyAccountPublishLimit) conflicts.push({ type: '账号过载', message: `同账号同日发布内容超过 ${data.operationSettings.dailyAccountPublishLimit} 条`, level: '预警' });
  const weekCount = data.contents.filter((item) => item.platform === content.platform && sameWeek(item.dueDate, content.dueDate)).length;
  if (weekCount < (data.operationSettings.weeklyPlatformTargets[content.platform] ?? 2)) conflicts.push({ type: '频次不足', message: `${content.platform} 本周排期低于建议频次`, level: '提醒' });
  if (content.riskLevel === '高' && !['待发布', '已发布', '数据回收中', '已复盘'].includes(content.status)) conflicts.push({ type: '高风险未审', message: '高风险内容尚未完成审核', level: '阻断' });
  if (!data.entries.some((entry) => entry.platform === content.platform && entry.status === '启用')) conflicts.push({ type: '入口未配置', message: `${content.platform} 未配置启用的招聘入口`, level: '预警' });
  const riskyAsset = data.assets.find((asset) => asset.platforms.includes(content.platform) && (asset.authorization.includes('待') || asset.authorization.includes('禁止') || asset.authorization.includes('需补充')));
  if (riskyAsset && content.content.includes(riskyAsset.name)) conflicts.push({ type: '素材未授权', message: `关联素材 ${riskyAsset.name} 未完成授权`, level: '阻断' });
  return conflicts;
}

function sameWeek(a: string, b: string) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  const weekStart = (date: Date) => {
    const next = new Date(date);
    next.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return next.toISOString().slice(0, 10);
  };
  return weekStart(da) === weekStart(db);
}

export function generateTopicsFromJob(job: JobNeed): TopicItem[] {
  const templates = [
    { type: '岗位种草', title: `${job.title} 值得关注的 3 个理由` },
    { type: '技术观点', title: `${job.family}候选人最关心的技术挑战是什么` },
    { type: '面试干货', title: `准备投递 ${job.title} 前可以了解什么` },
  ];
  return templates.map((item, index) => ({
    id: `topic-${job.id}-${Date.now()}-${index}`,
    title: item.title,
    type: item.type,
    platform: job.targetPlatforms[index % job.targetPlatforms.length] ?? '全部',
    targetJobId: job.id,
    owner: '招聘运营',
    status: '待认领',
    inspiration: `${job.persona}；岗位卖点：${job.sellingPoints.join('、')}`,
    tags: [job.family, job.level, job.city],
    source: 'AI',
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  }));
}

export function buildDataExplanations(data: AppData): DataExplanation[] {
  const explanations = platforms.flatMap((platform) => {
    const contents = data.contents.filter((item) => item.platform === platform);
    const views = contents.reduce((sum, item) => sum + item.metrics.views, 0);
    const clicks = contents.reduce((sum, item) => sum + item.metrics.clicks, 0);
    const applications = data.beisenResults.filter((item) => item.sourcePlatform === platform && item.stage === '已投递').length;
    const list = [];
    if (views > 1000 && clicks / views < 0.005) {
      list.push({ scope: '平台' as const, targetId: platform, title: `${platform} 观看高但招聘入口点击低`, body: '可能是 CTA 不清晰、招聘入口不明显，或内容偏品牌曝光而非岗位转化。', severity: '风险' as const, evidence: [`观看 ${views}`, `招聘入口点击 ${clicks}`, `观看到点击 ${((clicks / views) * 100).toFixed(2)}%`] });
    }
    if (clicks > 20 && applications / clicks < 0.05) {
      list.push({ scope: '平台' as const, targetId: platform, title: `${platform} 招聘入口点击后投递转化偏低`, body: '建议检查岗位落地页、薪酬口径、JD 清晰度和北森投递路径。', severity: '建议' as const, evidence: [`招聘入口点击 ${clicks}`, `投递 ${applications}`] });
    }
    return list;
  });
  return explanations.map((item, index) => ({ ...item, id: `explain-${Date.now()}-${index}`, createdAt: new Date().toLocaleString('zh-CN', { hour12: false }) }));
}

export function buildPlatformStrategy(job: JobNeed | undefined, data: AppData) {
  if (!job) return ['请选择岗位后生成平台策略建议。'];
  const historical = platforms.map((platform) => {
    const contents = data.contents.filter((item) => item.platform === platform && item.jobId === job.id);
    return {
      platform,
      clicks: contents.reduce((sum, item) => sum + item.metrics.clicks, 0),
      views: contents.reduce((sum, item) => sum + item.metrics.views, 0),
    };
  }).sort((a, b) => b.clicks - a.clicks);
  const preferred = historical.find((item) => item.clicks > 0)?.platform ?? job.targetPlatforms[0] ?? '小红书';
  return [
    `首选平台：${preferred}，原因是${platformPositioning[preferred]}，且与该岗位候选人画像更接近。`,
    `内容形式：${job.family.includes('技术') || job.type === '社招' ? '技术观点/岗位挑战拆解' : '岗位种草/团队氛围内容'}。`,
    `发布频次：建议每周至少 2 条图文或 1 条长内容，连续 2 周观察招聘入口点击和投递。`,
    `账号建议：优先使用定位与 ${job.family} 相关、历史观看到点击率较高的账号。`,
  ];
}

function normalizePlatform(value: string | undefined): Platform | '未知' {
  const platforms: Platform[] = ['小红书', '脉脉', 'B站', '公众号', '抖音', '知乎', '技术社区'];
  return platforms.find((platform) => platform === value) ?? '未知';
}

function normalizeStage(value: string | undefined): BeisenResult['stage'] {
  const stages: BeisenResult['stage'][] = ['已投递', '有效简历', '初筛通过', '已约面', '已面试', 'Offer', '已入职'];
  return stages.find((stage) => stage === value) ?? '已投递';
}

export function buildRecommendations(data: AppData) {
  if (data.contents.length === 0) {
    return ['录入真实岗位和内容后，系统将基于曝光、观看、互动、招聘入口点击、北森回流结果生成策略建议。'];
  }
  const best = data.contents.slice().sort((a, b) => b.metrics.clicks - a.metrics.clicks)[0];
  const platformResults = data.beisenResults.reduce<Record<string, number>>((acc, result) => {
    acc[result.sourcePlatform] = (acc[result.sourcePlatform] ?? 0) + 1;
    return acc;
  }, {});
  const bestPlatform = Object.entries(platformResults).sort((a, b) => b[1] - a[1])[0]?.[0];
  return [
    best.metrics.clicks > 0 ? `优先复用「${best.title}」的选题结构，目前招聘入口点击最高，为 ${best.metrics.clicks}。` : '已有内容但缺少真实招聘入口点击，请先导入平台指标。',
    bestPlatform ? `${bestPlatform} 已产生最多北森回流结果，可优先配置对应岗位族群内容。` : '尚未导入北森结果，暂不判断真实渠道质量。',
    data.accounts.length === 0 ? '请补充真实平台账号，用于数据归属、权限和复盘。' : '账号归属已具备基础数据，可继续完善发布权限和审核规则。',
  ];
}

export function calculateRoi(data: AppData) {
  const totalCost = data.costs.reduce((sum, item) => sum + item.laborCost + item.mediaCost + item.productionCost, 0);
  const applications = data.beisenResults.filter((item) => item.stage === '已投递').length;
  const effective = data.beisenResults.filter((item) => item.stage === '有效简历' || item.stage === '初筛通过' || item.stage === '已约面' || item.stage === '已面试' || item.stage === 'Offer' || item.stage === '已入职').length;
  const hires = data.beisenResults.filter((item) => item.stage === '已入职').length;
  return {
    totalCost,
    applications,
    effective,
    hires,
    costPerApplication: applications ? Math.round(totalCost / applications) : 0,
    costPerEffective: effective ? Math.round(totalCost / effective) : 0,
    costPerHire: hires ? Math.round(totalCost / hires) : 0,
  };
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function buildReportMarkdown(data: AppData) {
  const views = data.contents.reduce((sum, item) => sum + item.metrics.views, 0);
  const clicks = data.contents.reduce((sum, item) => sum + item.metrics.clicks, 0);
  const recommendations = buildRecommendations(data);
  return `# 招聘新媒体运营周报\n\n## 核心指标\n\n- 内容任务：${data.contents.length}\n- 小红书观看数：${views}\n- 招聘入口点击：${clicks}\n- 平台账号：${data.accounts.length}\n- 北森回流结果：${data.beisenResults.length}\n\n## 策略建议\n\n${recommendations.map((item) => `- ${item}`).join('\n')}\n\n## 重点洞察\n\n${data.reports.map((report) => `### ${report.title}\n\n${report.body}\n\n行动计划：${report.action}`).join('\n\n')}\n`;
}
