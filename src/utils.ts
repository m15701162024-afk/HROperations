import type { AppData, JobNeed, Platform } from './types';

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
  return `# 招聘新媒体运营周报\n\n## 核心指标\n\n- 内容任务：${data.contents.length}\n- 曝光/阅读/播放：${views}\n- 招聘入口点击：${clicks}\n- 平台账号：${data.accounts.length}\n\n## 重点洞察\n\n${data.reports.map((report) => `### ${report.title}\n\n${report.body}\n\n行动计划：${report.action}`).join('\n\n')}\n`;
}
