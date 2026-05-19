import type { AppData, BeisenResult, ContentTask, JobNeed, Platform } from './types';

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
      return Number(value ?? 0);
    };
    return {
      ...content,
      metrics: {
        views: numberOf('views', '曝光', '阅读', '播放', '曝光量'),
        likes: numberOf('likes', '点赞', '点赞量'),
        comments: numberOf('comments', '评论', '评论量'),
        saves: numberOf('saves', '收藏', '收藏量'),
        shares: numberOf('shares', '转发', '分享', '转发量'),
        clicks: numberOf('clicks', '点击', '招聘入口点击', '点击量'),
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
    return ['录入真实岗位和内容后，系统将基于曝光、互动、点击、北森回流结果生成策略建议。'];
  }
  const best = data.contents.slice().sort((a, b) => b.metrics.clicks - a.metrics.clicks)[0];
  const platformResults = data.beisenResults.reduce<Record<string, number>>((acc, result) => {
    acc[result.sourcePlatform] = (acc[result.sourcePlatform] ?? 0) + 1;
    return acc;
  }, {});
  const bestPlatform = Object.entries(platformResults).sort((a, b) => b[1] - a[1])[0]?.[0];
  return [
    best.metrics.clicks > 0 ? `优先复用「${best.title}」的选题结构，目前点击最高，为 ${best.metrics.clicks}。` : '已有内容但缺少真实点击，请先导入平台指标。',
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
  return `# 招聘新媒体运营周报\n\n## 核心指标\n\n- 内容任务：${data.contents.length}\n- 曝光/阅读/播放：${views}\n- 招聘入口点击：${clicks}\n- 平台账号：${data.accounts.length}\n- 北森回流结果：${data.beisenResults.length}\n\n## 策略建议\n\n${recommendations.map((item) => `- ${item}`).join('\n')}\n\n## 重点洞察\n\n${data.reports.map((report) => `### ${report.title}\n\n${report.body}\n\n行动计划：${report.action}`).join('\n\n')}\n`;
}
