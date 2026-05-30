import { platforms } from './data';
import type { AppData, BeisenResult, ContentTask, DrillBreakdown, DrillDetail, DrillInsight, DrillQuery, DrillResult, MetricQualityIssue, MetricSnapshot, Platform } from './types';

const stageRank: Record<BeisenResult['stage'], number> = {
  已投递: 1,
  有效简历: 2,
  初筛通过: 3,
  已约面: 4,
  已面试: 5,
  Offer: 6,
  已入职: 7,
};

export const emptySnapshot: MetricSnapshot = {
  views: 0,
  interactions: 0,
  clicks: 0,
  applications: 0,
  effectiveResumes: 0,
  interviews: 0,
  offers: 0,
  hires: 0,
  cost: 0,
  roi: 0,
  interactionRate: 0,
  clickRate: 0,
  applicationRate: 0,
  effectiveRate: 0,
  hireRate: 0,
};

function rate(value: number, base: number) {
  return base > 0 ? Number((value / base).toFixed(4)) : 0;
}

function dateInRange(date: string | undefined, query: DrillQuery) {
  if (!date) return true;
  if (query.dateFrom && date < query.dateFrom) return false;
  if (query.dateTo && date > query.dateTo) return false;
  return true;
}

function contentMatches(content: ContentTask, query: DrillQuery) {
  return (
    (!query.platform || query.platform === '全部' || content.platform === query.platform)
    && (!query.accountId || content.accountId === query.accountId)
    && (!query.contentId || content.id === query.contentId)
    && (!query.jobId || content.jobId === query.jobId)
    && (!query.contentType || content.type === query.contentType)
    && (!query.status || content.status === query.status)
    && dateInRange(content.metrics.metricDate ?? content.publishedAt ?? content.dueDate, query)
  );
}

function contentScopeMatches(content: ContentTask, query: DrillQuery) {
  return (
    (!query.platform || query.platform === '全部' || content.platform === query.platform)
    && (!query.accountId || content.accountId === query.accountId)
    && (!query.contentId || content.id === query.contentId)
    && (!query.jobId || content.jobId === query.jobId)
    && (!query.contentType || content.type === query.contentType)
    && (!query.status || content.status === query.status)
  );
}

function bestStageResults(results: BeisenResult[]) {
  const byCandidate = new Map<string, BeisenResult>();
  results.forEach((result) => {
    const key = `${result.candidateCode || result.id}:${result.jobId || 'unknown'}`;
    const previous = byCandidate.get(key);
    if (!previous || stageRank[result.stage] > stageRank[previous.stage]) {
      byCandidate.set(key, result);
    }
  });
  return [...byCandidate.values()];
}

function resultMatches(result: BeisenResult, data: Pick<AppData, 'contents' | 'jobs'>, query: DrillQuery) {
  const relatedContent = result.sourceContentId ? data.contents.find((content) => content.id === result.sourceContentId) : undefined;
  const hasValidContent = Boolean(relatedContent);
  const hasValidJob = Boolean(result.jobId && data.jobs.some((job) => job.id === result.jobId));
  if (!hasValidContent && !hasValidJob && result.sourcePlatform === '未知') return false;
  return (
    (!query.platform || query.platform === '全部' || result.sourcePlatform === query.platform)
    && (!query.contentId || result.sourceContentId === query.contentId)
    && (!query.jobId || result.jobId === query.jobId)
    && (!query.accountId || relatedContent?.accountId === query.accountId)
    && dateInRange((result.stageChangedAt ?? result.importedAt)?.slice(0, 10), query)
  );
}

function resultInQualityScope(result: BeisenResult, data: Pick<AppData, 'contents'>, query: DrillQuery) {
  const relatedContent = result.sourceContentId ? data.contents.find((content) => content.id === result.sourceContentId) : undefined;
  return (
    (!query.platform || query.platform === '全部' || result.sourcePlatform === query.platform || relatedContent?.platform === query.platform)
    && (!query.contentId || result.sourceContentId === query.contentId)
    && (!query.jobId || result.jobId === query.jobId)
    && (!query.accountId || relatedContent?.accountId === query.accountId)
    && dateInRange((result.stageChangedAt ?? result.importedAt)?.slice(0, 10), query)
  );
}

export function summarizeMetrics(data: AppData, query: DrillQuery): MetricSnapshot {
  const scopedContents = data.contents.filter((content) => contentScopeMatches(content, query));
  const scopedContentIds = new Set(scopedContents.map((content) => content.id));
  const metricRecords = data.metricRecords.filter((record) => scopedContentIds.has(record.contentId) && dateInRange(record.metricDate, query));
  const contents = metricRecords.length > 0 ? scopedContents : data.contents.filter((content) => contentMatches(content, query));
  const results = bestStageResults(data.beisenResults.filter((result) => resultMatches(result, data, query)));
  const views = metricRecords.length > 0
    ? metricRecords.reduce((sum, record) => sum + Number(record.views || 0), 0)
    : contents.reduce((sum, content) => sum + Number(content.metrics.views || 0), 0);
  const interactions = metricRecords.length > 0 ? metricRecords.reduce((sum, record) => (
    sum + Number(record.likes || 0) + Number(record.comments || 0) + Number(record.saves || 0) + Number(record.shares || 0)
  ), 0) : contents.reduce((sum, content) => (
    sum + Number(content.metrics.likes || 0) + Number(content.metrics.comments || 0) + Number(content.metrics.saves || 0) + Number(content.metrics.shares || 0)
  ), 0);
  const scopedEntryClicks = data.entryClicks.filter((click) => (
    (!query.platform || query.platform === '全部' || click.platform === query.platform)
    && (!query.contentId || click.contentId === query.contentId)
    && (!query.jobId || click.jobId === query.jobId || (click.contentId && scopedContentIds.has(click.contentId)))
    && dateInRange(click.clickedAt.slice(0, 10), query)
    && (!click.contentId || scopedContentIds.has(click.contentId))
  ));
  const clicks = scopedEntryClicks.length > 0
    ? scopedEntryClicks.length
    : metricRecords.some((record) => record.clicks > 0)
      ? metricRecords.reduce((sum, record) => sum + Number(record.clicks || 0), 0)
      : contents.reduce((sum, content) => sum + Number(content.metrics.clicks || 0), 0);
  const applications = results.filter((result) => stageRank[result.stage] >= stageRank.已投递).length;
  const effectiveResumes = results.filter((result) => stageRank[result.stage] >= stageRank.有效简历).length;
  const interviews = results.filter((result) => stageRank[result.stage] >= stageRank.已约面).length;
  const offers = results.filter((result) => stageRank[result.stage] >= stageRank.Offer).length;
  const hires = results.filter((result) => result.stage === '已入职').length;
  const cost = data.costs
    .filter((item) => (
      item.targetId === 'all'
      || (query.platform && item.targetType === '平台' && item.targetId === query.platform)
      || (query.contentId && item.targetType === '内容' && item.targetId === query.contentId)
    ))
    .reduce((sum, item) => sum + Number(item.laborCost || 0) + Number(item.mediaCost || 0) + Number(item.productionCost || 0), 0);

  return {
    views,
    interactions,
    clicks,
    applications,
    effectiveResumes,
    interviews,
    offers,
    hires,
    cost,
    roi: cost > 0 ? Number((hires / cost).toFixed(4)) : 0,
    interactionRate: rate(interactions, views),
    clickRate: rate(clicks, views),
    applicationRate: rate(applications, clicks),
    effectiveRate: rate(effectiveResumes, applications),
    hireRate: rate(hires, applications),
  };
}

export function buildPlatformBreakdowns(data: AppData, query: DrillQuery): DrillBreakdown[] {
  return platforms.map((platform) => ({
    id: platform,
    label: platform,
    dimension: 'platform' as const,
    snapshot: summarizeMetrics(data, { ...query, platform }),
    meta: {
      accountCount: data.accounts.filter((account) => account.platform === platform).length,
      entryCount: data.entries.filter((entry) => entry.platform === platform).length,
      contentCount: data.contents.filter((content) => content.platform === platform).length,
    },
  }));
}

export function buildAccountBreakdowns(data: AppData, query: DrillQuery): DrillBreakdown[] {
  return data.accounts
    .filter((account) => !query.platform || query.platform === '全部' || account.platform === query.platform)
    .map((account) => {
      const accountContents = data.contents.filter((content) => content.accountId === account.id && dateInRange(content.publishedAt ?? content.dueDate, query));
      const latestPublish = accountContents.map((content) => content.publishedAt ?? content.dueDate).filter(Boolean).sort().at(-1);
      const inactiveDays = latestPublish ? Math.max(0, Math.floor((Date.now() - new Date(latestPublish).getTime()) / 86400000)) : undefined;
      const snapshot = summarizeMetrics(data, { ...query, accountId: account.id, platform: account.platform });
      const publishCount = accountContents.length;
      const avgViews = publishCount > 0 ? Math.round(snapshot.views / publishCount) : 0;
      const healthScore = Math.max(0, Math.min(100, 100 - (account.authStatus === '已授权' ? 0 : 30) - (inactiveDays && inactiveDays > 14 ? 20 : 0) - (snapshot.clickRate === 0 && snapshot.views > 0 ? 15 : 0)));
      return {
        id: account.id,
        label: `${account.platform}｜${account.name}`,
        dimension: 'account' as const,
        snapshot,
        meta: {
          platform: account.platform,
          owner: account.owner,
          positioning: account.positioning,
          authStatus: account.authStatus,
          status: account.status,
          publishingRoles: account.publishingRoles.join('、'),
          publishCount,
          latestPublish,
          inactiveDays,
          averageViews: avgViews,
          interactionRate: snapshot.interactionRate,
          clickRate: snapshot.clickRate,
          healthScore,
          suggestion: healthScore < 70 ? '建议检查授权状态、发布频次和招聘入口 CTA。' : '账号健康度正常，可继续复用高点击内容结构。',
        },
      };
    });
}

export function buildJobBreakdowns(data: AppData, query: DrillQuery): DrillBreakdown[] {
  return data.jobs.map((job) => {
    const jobContents = data.contents.filter((content) => content.jobId === job.id && contentMatches(content, { ...query, jobId: job.id }));
    const platformContributions = platforms
      .map((platform) => ({ platform, snapshot: summarizeMetrics(data, { ...query, jobId: job.id, platform }) }))
      .filter((item) => item.snapshot.views > 0 || item.snapshot.applications > 0)
      .map((item) => `${item.platform}:${item.snapshot.views}观看/${item.snapshot.applications}投递`);
    const stageDistribution = bestStageResults(data.beisenResults.filter((result) => result.jobId === job.id && resultMatches(result, data, query)))
      .reduce<Record<string, number>>((acc, result) => ({ ...acc, [result.stage]: (acc[result.stage] ?? 0) + 1 }), {});
    return {
      id: job.id,
      label: job.title,
      dimension: 'job' as const,
      snapshot: summarizeMetrics(data, { ...query, jobId: job.id }),
      meta: {
        family: job.family,
        city: job.city,
        level: job.level,
        status: job.status,
        platformCoverage: job.targetPlatforms.join('、'),
        contentCount: jobContents.length,
        contentTypeCoverage: [...new Set(jobContents.map((content) => content.type))].join('、'),
        platformContributions: platformContributions.join('；'),
        stageDistribution,
      },
    };
  }).filter((item) => item.snapshot.views > 0 || item.snapshot.applications > 0 || !query.platform || query.platform === '全部');
}

export function buildContentDetails(data: AppData, query: DrillQuery): DrillDetail[] {
  const rows = data.contents
    .filter((content) => contentMatches(content, query))
    .sort((a, b) => Number(b.metrics.views || 0) - Number(a.metrics.views || 0))
    .map((content) => {
      const job = data.jobs.find((item) => item.id === content.jobId);
      const account = data.accounts.find((item) => item.id === content.accountId);
      return {
        id: content.id,
        title: content.title,
        dimension: 'content' as const,
        snapshot: summarizeMetrics(data, { ...query, contentId: content.id }),
        meta: {
          platform: content.platform,
          account: account?.name ?? '未绑定账号',
          job: job?.title ?? '未关联岗位',
          contentType: content.type,
          status: content.status,
          riskLevel: content.riskLevel,
          risks: content.risks.join('、'),
          dueDate: content.dueDate,
          publishedAt: content.publishedAt,
          beisenStageDistribution: bestStageResults(data.beisenResults.filter((result) => result.sourceContentId === content.id && resultMatches(result, data, query)))
            .reduce<Record<string, number>>((acc, result) => ({ ...acc, [result.stage]: (acc[result.stage] ?? 0) + 1 }), {}),
          versionCount: data.contentVersions.filter((version) => version.contentId === content.id).length,
          reviewCommentCount: data.reviewComments.filter((comment) => comment.contentId === content.id).length,
          reviewSuggestion: content.riskLevel === '高' ? '请先完成风险修改和审核，再放大投放。' : content.metrics.clicks === 0 && content.metrics.views > 0 ? '建议优化 CTA、招聘入口和岗位落点。' : '可进入复盘沉淀有效表达。',
        },
      };
    });
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? (rows.length || 20);
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

export function buildFunnelBreakdowns(summary: MetricSnapshot): DrillBreakdown[] {
  const steps = [
    ['views', '观看', summary.views],
    ['interactions', '互动', summary.interactions],
    ['clicks', '招聘入口点击', summary.clicks],
    ['applications', '投递', summary.applications],
    ['effectiveResumes', '有效简历', summary.effectiveResumes],
    ['interviews', '面试', summary.interviews],
    ['offers', 'Offer', summary.offers],
    ['hires', '入职', summary.hires],
  ] as const;
  return steps.map(([id, label, value], index) => {
    const previousValue = index === 0 ? value : steps[index - 1][2];
    const conversionRate = index === 0 ? 1 : rate(value, previousValue);
    const isExposureToClickBreak = id === 'clicks' && previousValue >= 100 && value === 0;
    return {
      id,
      label,
      dimension: 'funnel',
      snapshot: { ...emptySnapshot, [id]: value },
      meta: {
        value,
        previousValue,
        conversionRate,
        abnormal: isExposureToClickBreak || (index > 0 && previousValue > 0 && conversionRate < 0.01),
        suggestion: isExposureToClickBreak ? 'CTA、招聘入口、内容落点可能存在问题。' : undefined,
      },
    };
  });
}

export function detectMetricQualityIssues(data: AppData, query: DrillQuery): MetricQualityIssue[] {
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const issues: MetricQualityIssue[] = [];
  const issue = (item: Omit<MetricQualityIssue, 'id' | 'resolved' | 'createdAt'>) => {
    issues.push({ ...item, id: `quality-${issues.length + 1}-${item.targetId}`, resolved: false, createdAt: now });
  };

  data.contents.filter((content) => contentMatches(content, query)).forEach((content) => {
    if (!content.jobId || !data.jobs.some((job) => job.id === content.jobId)) {
      issue({ issueType: '缺少字段', severity: '高', targetType: 'content', targetId: content.id, message: `${content.title} 未关联有效岗位，岗位下钻会缺失。` });
    }
    if (!content.accountId || !data.accounts.some((account) => account.id === content.accountId)) {
      issue({ issueType: '缺少字段', severity: '中', targetType: 'content', targetId: content.id, message: `${content.title} 未绑定有效账号，账号下钻会缺失。` });
    }
    if (content.metrics.views === 0 && (content.metrics.clicks > 0 || content.metrics.likes > 0 || content.metrics.comments > 0 || content.metrics.saves > 0 || content.metrics.shares > 0)) {
      issue({ issueType: '指标异常', severity: '中', targetType: 'content', targetId: content.id, message: `${content.title} 观看为 0 但存在互动或招聘入口点击。` });
    }
    if (content.publishedAt && content.dueDate && content.publishedAt < content.dueDate && content.status === '已发布') {
      issue({ issueType: '日期异常', severity: '中', targetType: 'content', targetId: content.id, message: `${content.title} 发布时间早于排期日期，请确认。` });
    }
  });

  data.beisenResults.filter((result) => resultInQualityScope(result, data, query)).forEach((result) => {
    const hasContent = result.sourceContentId && data.contents.some((content) => content.id === result.sourceContentId);
    const hasJob = result.jobId && data.jobs.some((job) => job.id === result.jobId);
    if (!hasContent && !hasJob && result.sourcePlatform === '未知') {
      issue({ issueType: '无法归因', severity: '高', targetType: 'source', targetId: result.id, message: `${result.candidateCode} 缺少内容、岗位和平台，无法归因。` });
    } else if (!hasContent && !hasJob) {
      issue({ issueType: '无法归因', severity: '中', targetType: 'source', targetId: result.id, message: `${result.candidateCode} 无法归因到内容或岗位，仅能按平台统计。` });
    }
  });
  const seenResults = new Set<string>();
  data.beisenResults.forEach((result) => {
    const key = `${result.candidateCode}:${result.jobId}:${result.stage}`;
    if (seenResults.has(key)) {
      issue({ issueType: '重复数据', severity: '中', targetType: 'source', targetId: result.id, message: `${result.candidateCode} 在 ${result.jobId || '未知岗位'} 的 ${result.stage} 阶段重复导入。` });
    }
    seenResults.add(key);
  });

  data.integrationSyncRuns.filter((run) => run.status === '失败').forEach((run) => {
    issue({ issueType: '同步失败', severity: '高', targetType: 'sync', targetId: run.id, syncBatchId: run.id, message: `${run.syncType} 失败：${run.message}` });
  });

  return issues;
}

export function buildMetricInsights(result: Pick<DrillResult, 'summary'>): DrillInsight[] {
  const { summary } = result;
  const insights: DrillInsight[] = [];
  const push = (title: string, body: string, severity: DrillInsight['severity'], evidence: string[]) => {
    insights.push({ id: `insight-${insights.length + 1}`, title, body, severity, evidence });
  };
  if (summary.views === 0) {
    push('暂无真实平台指标', '请先导入平台指标或配置平台 API，再进行效果判断。', '建议', ['观看 0', '招聘入口点击 0']);
  } else if (summary.clicks === 0) {
    push('有观看但无招聘入口点击', '优先检查 CTA、招聘入口、岗位链接和内容落点。', '风险', [`观看 ${summary.views}`, '招聘入口点击 0']);
  } else if (summary.applications === 0) {
    push('有招聘入口点击但无北森回流', '优先检查追踪码、北森导入、岗位入口和归因字段。', '风险', [`招聘入口点击 ${summary.clicks}`, '投递 0']);
  } else if (summary.effectiveRate < 0.2) {
    push('有效简历率偏低', '候选人画像或平台人群可能不匹配，建议复盘岗位表达。', '建议', [`有效简历率 ${(summary.effectiveRate * 100).toFixed(1)}%`]);
  } else {
    push('链路已有有效回流', '建议继续放大高点击内容和高质量岗位方向。', '机会', [`投递 ${summary.applications}`, `有效 ${summary.effectiveResumes}`]);
  }
  return insights;
}

export function buildAnalyticsDrill(data: AppData, query: DrillQuery): DrillResult {
  const summary = summarizeMetrics(data, query);
  const allDetails = data.contents.filter((content) => contentMatches(content, query));
  const breakdowns: DrillBreakdown[] = query.dimension === 'account'
    ? buildAccountBreakdowns(data, query)
    : query.dimension === 'job'
      ? buildJobBreakdowns(data, query)
      : query.dimension === 'funnel'
        ? buildFunnelBreakdowns(summary)
        : buildPlatformBreakdowns(data, query);
  const details = buildContentDetails(data, query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? (allDetails.length || 20);
  const partialResult = { summary };
  return {
    query,
    summary,
    breakdowns,
    details,
    insights: buildMetricInsights(partialResult),
    qualityIssues: detectMetricQualityIssues(data, query),
    pagination: {
      page,
      pageSize,
      total: allDetails.length,
    },
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  };
}

export function formatMetricRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function platformFromId(id: string): Platform | '全部' {
  return platforms.find((platform) => platform === id) ?? '全部';
}
