import type { AppData, ContentTask, JobNeed, Platform } from './types';

export const platforms: Platform[] = ['小红书', '脉脉', 'B站', '公众号', '抖音', '知乎', '技术社区'];

export const platformPositioning: Record<Platform, string> = {
  小红书: '岗位种草、职场氛围、校招内容',
  脉脉: '中高端人才、职场话题、技术/行业观点',
  B站: '技术分享、团队访谈、雇主品牌视频',
  公众号: '长文、公司介绍、招聘专题',
  抖音: '短视频曝光、办公室/员工故事',
  知乎: '专业问答、行业观点',
  技术社区: '技术文章、开源/实践分享',
};

export const statusFlow = [
  '草稿',
  'AI已生成',
  '待专业补充',
  '待专业审核',
  '待品牌合规审核',
  '待平台适配',
  '待发布',
  '已发布',
  '数据回收中',
  '已复盘',
  '已归档',
] as const;

export const riskRules = [
  '薪酬、奖金、股票、福利承诺',
  '公司战略、业务数据、客户信息',
  '技术架构、项目细节、算法模型、系统数据',
  '员工个人经历、照片、评价',
  '竞品对比、行业评论、负面舆情回应',
  '加班、管理风格、组织文化敏感表达',
  '校招承诺、转正、培养机制',
  '歧视性招聘条件、虚假宣传',
];

export const emptyData: AppData = {
  jobs: [],
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
    weeklyPlatformTargets: {
      小红书: 3,
      脉脉: 3,
      B站: 1,
      公众号: 2,
      抖音: 1,
      知乎: 2,
      技术社区: 2,
    },
  },
};

export const seedData: AppData = {
  jobs: [
    {
      id: 'job-1',
      title: '资深自动驾驶云平台开发 Java 方向',
      family: '后端',
      city: '杭州',
      level: '高级/专家',
      type: '社招',
      jd: '负责自动驾驶云平台服务架构设计、任务调度、数据链路和稳定性建设，要求具备 Java、分布式系统、云原生经验。',
      persona: '5-10 年后端工程师，关注技术挑战、业务前景、团队稳定性和成长空间。',
      sellingPoints: ['具身智能赛道', '复杂云平台工程挑战', '技术负责人直接参与', '团队氛围开放'],
      targetPlatforms: ['脉脉', '知乎', '技术社区', '公众号'],
      status: '招聘中',
      beisenUrl: 'https://example.beisen.com/jobs/java-cloud',
      websiteUrl: 'https://example.com/careers/java-cloud',
    },
    {
      id: 'job-2',
      title: '具身智能 VLA 研究实习生',
      family: '算法',
      city: '杭州',
      level: '实习/校招',
      type: '实习',
      jd: '参与 VLA 模型训练、数据构建和机器人任务泛化实验，要求机器学习、机器人或多模态方向基础扎实。',
      persona: '优秀应届生或研究型实习生，关注导师质量、成长速度、技术视野和转正机会。',
      sellingPoints: ['前沿研究方向', '真实机器人场景', '技术导师带教', '校招生友好'],
      targetPlatforms: ['小红书', 'B站', '公众号'],
      status: '招聘中',
      beisenUrl: 'https://example.beisen.com/jobs/vla-intern',
      websiteUrl: 'https://example.com/careers/vla-intern',
    },
    {
      id: 'job-3',
      title: '高级产品运营经理',
      family: '职能',
      city: '杭州',
      level: '中高级',
      type: '职能',
      jd: '负责招聘运营工具、人才增长和雇主品牌相关项目推进，具备跨部门协同和数据分析能力。',
      persona: '2-8 年运营或产品运营背景，关注平台稳定性、组织空间、管理风格和业务增长。',
      sellingPoints: ['业务增长快', '跨团队影响力', '机制建设空间', '工作节奏健康'],
      targetPlatforms: ['小红书', '脉脉', '公众号'],
      status: '招聘中',
      beisenUrl: 'https://example.beisen.com/jobs/product-ops',
      websiteUrl: 'https://example.com/careers/product-ops',
    },
  ],
  accounts: [
    {
      id: 'acc-1',
      platform: '小红书',
      name: '有鹿招聘研究所',
      type: '招聘专用账号',
      positioning: '岗位种草、杭州职场氛围、校招答疑',
      owner: '招聘专员A',
      publishingRoles: ['招聘专员', '新媒体运营'],
      reviewRule: '岗位种草内容走 HR 主管审核，高风险进入合规审核',
      attribution: '招聘团队',
      authStatus: '已授权',
      status: '启用',
    },
    {
      id: 'acc-2',
      platform: '脉脉',
      name: '技术招聘伙伴',
      type: 'HR个人IP账号',
      positioning: '中高端人才沟通、技术岗位机会、行业观点',
      owner: '招聘主管',
      publishingRoles: ['招聘主管'],
      reviewRule: '观点型内容发布前品牌合规审核',
      attribution: '中高端招聘',
      authStatus: '未授权',
      status: '启用',
    },
    {
      id: 'acc-3',
      platform: 'B站',
      name: '有鹿技术团队',
      type: '技术负责人账号',
      positioning: '技术分享、团队访谈、雇主品牌视频',
      owner: '技术负责人',
      publishingRoles: ['新媒体运营', '技术负责人'],
      reviewRule: '技术内容强制专业审核与品牌审核',
      attribution: '技术团队',
      authStatus: '授权过期',
      status: '启用',
    },
  ],
  contents: [
    {
      id: 'ct-1',
      title: '在杭州做自动驾驶云平台，工程挑战到底在哪？',
      jobId: 'job-1',
      platform: '脉脉',
      accountId: 'acc-2',
      type: '技术/行业观点',
      status: '待品牌合规审核',
      owner: '招聘主管',
      reviewer: 'HR负责人',
      dueDate: '2026-05-22',
      content: '我们正在招聘资深自动驾驶云平台开发，重点不是堆需求，而是解决任务调度、数据链路和云原生稳定性这些真实工程问题。',
      tags: ['后端', '自动驾驶', '中高端'],
      riskLevel: '高',
      risks: ['技术架构、项目细节、算法模型、系统数据'],
      metrics: { views: 8200, likes: 146, comments: 31, saves: 40, shares: 22, clicks: 96 },
    },
    {
      id: 'ct-2',
      title: '适合研究型实习生的 VLA 岗位长什么样？',
      jobId: 'job-2',
      platform: '小红书',
      accountId: 'acc-1',
      type: '校招内容',
      status: '已发布',
      owner: '招聘专员A',
      reviewer: '招聘主管',
      dueDate: '2026-05-18',
      publishedAt: '2026-05-18',
      content: '如果你想把多模态模型放到真实机器人任务里验证，这个杭州实习机会可能适合你。',
      tags: ['校招', '实习', '算法'],
      riskLevel: '中',
      risks: ['校招承诺、转正、培养机制'],
      metrics: { views: 14600, likes: 420, comments: 68, saves: 512, shares: 58, clicks: 188 },
    },
    {
      id: 'ct-3',
      title: '一条职能岗内容如何讲清业务增长和组织空间',
      jobId: 'job-3',
      platform: '公众号',
      accountId: 'acc-1',
      type: '公司/业务介绍',
      status: '待平台适配',
      owner: '招聘专员B',
      reviewer: 'HR负责人',
      dueDate: '2026-05-24',
      content: '招聘运营岗位不只是执行发布，而是把渠道、内容、数据和业务需求串成一个增长系统。',
      tags: ['职能', '运营', '雇主品牌'],
      riskLevel: '低',
      risks: [],
      metrics: { views: 3200, likes: 52, comments: 9, saves: 28, shares: 11, clicks: 34 },
    },
  ],
  contentVersions: [],
  reviewComments: [],
  assets: [
    {
      id: 'asset-1',
      name: '公司介绍与业务赛道说明',
      category: '公司/业务介绍',
      owner: 'HR负责人',
      scope: '全平台可用',
      platforms: ['小红书', '脉脉', '公众号', 'B站'],
      riskLevel: '中',
      authorization: '内部审核通过',
      expiresAt: '2026-12-31',
      usageCount: 9,
    },
    {
      id: 'asset-2',
      name: '研发团队访谈照片',
      category: '员工照片/访谈',
      owner: '新媒体运营',
      scope: '公众号、B站可用',
      platforms: ['公众号', 'B站'],
      riskLevel: '高',
      authorization: '肖像授权已签署',
      expiresAt: '2026-09-30',
      usageCount: 3,
    },
    {
      id: 'asset-3',
      name: '面试流程与 FAQ',
      category: '招聘FAQ',
      owner: '招聘专员A',
      scope: '招聘内容可用',
      platforms: ['小红书', '脉脉', '公众号'],
      riskLevel: '低',
      authorization: 'HR确认',
      expiresAt: '2027-01-31',
      usageCount: 14,
    },
  ],
  goals: [
    {
      id: 'goal-1',
      title: '小红书招聘专用账号月度种草目标',
      dimension: '平台+账号+内容类型',
      target: 12,
      current: 7,
      metric: '发布篇数',
      status: '进行中',
    },
    {
      id: 'goal-2',
      title: '算法/后端岗位族群招聘入口点击',
      dimension: '岗位族群+结果指标',
      target: 300,
      current: 284,
      metric: '入口点击',
      status: '进行中',
    },
    {
      id: 'goal-3',
      title: '本月自动复盘覆盖率',
      dimension: '工作量指标',
      target: 100,
      current: 76,
      metric: '复盘完成率',
      status: '进行中',
    },
  ],
  reports: [
    {
      id: 'rp-1',
      title: '小红书校招内容点击效率领先',
      body: 'VLA 实习内容在收藏和点击上高于平均值，说明“真实机器人场景 + 导师带教”的卖点有效。',
      action: '下周继续产出 2 条校招答疑和 1 条实习生日常图文。',
      severity: '机会',
    },
    {
      id: 'rp-2',
      title: '技术深度内容审核耗时偏长',
      body: '技术负责人参与补充后，品牌合规审核平均耗时达到 1.8 天。',
      action: '建立技术案例采集表和可公开边界字段，减少来回确认。',
      severity: '风险',
    },
    {
      id: 'rp-3',
      title: '脉脉适合承接中高端岗位观点内容',
      body: '脉脉内容评论质量高，适合发布行业观点、技术挑战和岗位机会组合内容。',
      action: '将后端、算法、云平台岗位每周固定配置 1 条脉脉观点内容。',
      severity: '建议',
    },
  ],
  entries: [
    {
      id: 'entry-1',
      platform: '小红书',
      headline: '主页置顶招聘入口',
      destination: '北森岗位页',
      url: 'https://example.beisen.com/jobs?utm_source=xiaohongshu',
      trackingCode: 'xhshu-home-202605',
      clicks: 188,
      status: '启用',
    },
    {
      id: 'entry-2',
      platform: '脉脉',
      headline: '中高端技术岗位集合入口',
      destination: '公司官网招聘页',
      url: 'https://example.com/careers?utm_source=maimai',
      trackingCode: 'maimai-tech-202605',
      clicks: 96,
      status: '启用',
    },
  ],
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
  auditLogs: [
    {
      id: 'log-1',
      actor: '系统',
      action: '初始化种子数据',
      target: '招聘运营助手',
      createdAt: '2026-05-19 11:00',
    },
  ],
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
  operationSettings: emptyData.operationSettings,
};

export function buildMvpSeedData(data: AppData = emptyData): AppData {
  const now = '2026-05-26 10:00';
  return {
    ...data,
    jobs: data.jobs.length ? data.jobs : seedData.jobs,
    accounts: data.accounts.length ? data.accounts : seedData.accounts,
    contents: data.contents.length ? data.contents : seedData.contents,
    assets: data.assets.length ? data.assets : seedData.assets,
    goals: data.goals.length ? data.goals : seedData.goals,
    reports: data.reports.length ? data.reports : seedData.reports,
    entries: data.entries.length ? data.entries : seedData.entries,
    beisenResults: data.beisenResults.length ? data.beisenResults : [
      { id: 'mvp-beisen-1', jobId: 'job-2', sourcePlatform: '小红书', sourceContentId: 'ct-2', candidateCode: 'CAND-001', stage: '有效简历', importedAt: now },
      { id: 'mvp-beisen-2', jobId: 'job-1', sourcePlatform: '脉脉', sourceContentId: 'ct-1', candidateCode: 'CAND-002', stage: '已约面', importedAt: now },
      { id: 'mvp-beisen-3', jobId: 'job-3', sourcePlatform: '公众号', sourceContentId: 'ct-3', candidateCode: 'CAND-003', stage: '已投递', importedAt: now },
    ],
    integrations: data.integrations.length ? data.integrations : [
      { id: 'mvp-integration-beisen', type: '北森', name: '北森候选人同步', endpoint: 'https://openapi.example-beisen.com', apiKey: '', authMode: 'Token', status: '待验证', extraConfig: '{"method":"POST","endpointPath":"/candidate/import"}' },
      { id: 'mvp-integration-platform', type: '平台API', name: '小红书指标拉取', endpoint: 'https://api.example-platform.com', apiKey: '', authMode: 'Token', status: '待验证', extraConfig: '{"platform":"小红书","fields":["views","likes","comments","clicks"]}' },
    ],
    integrationSyncRuns: data.integrationSyncRuns.length ? data.integrationSyncRuns : [
      { id: 'mvp-sync-1', integrationId: 'mvp-integration-platform', syncType: '平台指标拉取', status: '成功', message: '样例指标已进入内容明细', recordCount: 3, retryCount: 0, dataQualityScore: 92, ranAt: now },
    ],
    modelApis: data.modelApis.length ? data.modelApis : [
      { id: 'mvp-model-deepseek', provider: 'DeepSeek', name: 'DeepSeek 内容生成', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat', enabledFor: ['内容生成', '风险识别', '复盘建议'], status: '未配置' },
    ],
    landingPages: data.landingPages.length ? data.landingPages : [
      { id: 'mvp-landing-1', title: '杭州技术岗位集合页', slug: 'hangzhou-tech-jobs', pageType: '岗位集合页', linkedJobIds: ['job-1', 'job-2'], destinationUrl: 'https://example.com/careers', status: '已发布', visits: 620, clicks: 94 },
    ],
    landingLeads: data.landingLeads.length ? data.landingLeads : [
      { id: 'mvp-landing-lead-1', landingPageId: 'mvp-landing-1', name: '周同学', contact: 'zhou@example.com', targetJobId: 'job-2', sourcePlatform: '小红书', note: '关注 VLA 实习', status: '待转入北森', submittedAt: now },
    ],
    roles: data.roles.length ? data.roles : [
      { id: 'role-recruiter', name: '招聘专员', dataScope: '个人', permissions: ['工作台查看', '岗位查看', '内容查看', '内容创建', '素材查看', '数据查看'] },
      { id: 'role-ops', name: '招聘运营', dataScope: '团队', permissions: ['工作台查看', '岗位查看', '内容查看', '内容创建', '素材查看', '账号查看', '数据查看', '复盘查看', '数据导入', 'AI配置'] },
      { id: 'role-owner', name: '招聘负责人', dataScope: '全部', permissions: ['全部'] },
    ],
    users: data.users.length ? data.users : [
      { id: 'user-a', name: '招聘专员A', roleId: 'role-recruiter', team: '招聘团队', status: '启用' },
      { id: 'user-ops', name: '新媒体运营', roleId: 'role-ops', team: '招聘运营', status: '启用' },
    ],
    workflowRules: data.workflowRules.length ? data.workflowRules : [
      { id: 'workflow-high-risk', name: '高风险内容审核流', platform: '全部', contentType: '全部', minRiskLevel: '高', steps: ['草稿', 'AI已生成', '待专业补充', '待专业审核', '待品牌合规审核', '待平台适配', '待发布', '已发布', '数据回收中', '已复盘'], enabled: true },
    ],
    sensitiveRules: data.sensitiveRules.length ? data.sensitiveRules : [
      { id: 'rule-salary', keyword: '保证年薪', category: '薪酬承诺', riskLevel: '高', suggestion: '改为“薪酬面议，以正式 Offer 为准”', enabled: true },
      { id: 'rule-customer', keyword: '客户名称', category: '客户信息', riskLevel: '高', suggestion: '改为行业或场景描述', enabled: true },
    ],
    costs: data.costs.length ? data.costs : [
      { id: 'mvp-cost-xhs', targetType: '平台', targetId: '小红书', laborCost: 1800, mediaCost: 500, productionCost: 700 },
      { id: 'mvp-cost-maimai', targetType: '平台', targetId: '脉脉', laborCost: 1200, mediaCost: 0, productionCost: 400 },
    ],
    notifications: data.notifications.length ? data.notifications : [
      { id: 'mvp-notice-1', title: '高风险内容待审核', body: '脉脉技术观点内容需要 HR 负责人复核', targetSection: '内容运营', level: '待办', read: false, createdAt: now },
    ],
    auditLogs: data.auditLogs.length ? data.auditLogs : [
      { id: 'mvp-audit-1', actor: '系统', action: '补齐MVP样例数据', target: '全部空数据模块', createdAt: now },
    ],
    integrationMappings: data.integrationMappings.length ? data.integrationMappings : [
      { id: 'mvp-mapping-beisen', name: '北森线索字段映射', integrationType: '北森', scenario: '北森线索同步', method: 'POST', endpointPath: '/candidate/import', resultPath: 'data', fieldMapping: '{"candidateName":"name","mobile":"contact","jobCode":"jobId"}', enabled: true },
    ],
    compliancePolicies: data.compliancePolicies.length ? data.compliancePolicies : [
      { id: 'mvp-policy-privacy', title: '候选人线索隐私告知', scope: '隐私授权', owner: '招聘负责人', status: '生效', content: '收集联系方式前需告知招聘用途和数据保留边界。', updatedAt: now },
    ],
    deploymentTasks: data.deploymentTasks.length ? data.deploymentTasks : [
      { id: 'mvp-deploy-api', title: '配置北森 OpenAPI 字段', category: '平台接口', owner: '招聘运营', status: '进行中', dueDate: '2026-06-05', note: '拿到正式字段后在生产集成字段映射中维护。' },
    ],
    importRuns: data.importRuns.length ? data.importRuns : [
      { id: 'mvp-import-1', source: '内容指标', fileName: '小红书-指标样例.csv', mapping: '{"views":"曝光","clicks":"点击"}', status: '成功', recordCount: 3, errorRows: [], createdAt: now },
    ],
    reportActions: data.reportActions.length ? data.reportActions : [
      { id: 'mvp-report-action-1', reportId: 'rp-1', title: '复用 VLA 实习内容结构', owner: '招聘专员A', dueDate: '2026-05-31', status: '进行中', createdAt: now },
    ],
    promptTemplates: data.promptTemplates.length ? data.promptTemplates : [
      { id: 'mvp-prompt-content', task: '内容生成', name: '岗位种草内容框架', provider: 'DeepSeek', prompt: '基于 JD、候选人画像、岗位卖点生成平台内容。', enabled: true, updatedAt: now },
    ],
    modelRunLogs: data.modelRunLogs.length ? data.modelRunLogs : [
      { id: 'mvp-model-log-1', modelApiId: 'mvp-model-deepseek', task: '内容生成', status: '失败', inputSummary: '资深后端岗位', outputPreview: '', message: '未配置 API Key，等待使用人配置', ranAt: now },
    ],
    pluginRules: data.pluginRules.length ? data.pluginRules : [
      { id: 'mvp-plugin-xhs', platform: '小红书', name: '笔记指标采集', urlPattern: 'xiaohongshu.com/explore/*', selectors: '{"title":"h1","views":".view","likes":".like"}', enabled: true, updatedAt: now },
    ],
    candidateLeads: data.candidateLeads.length ? data.candidateLeads : [
      { id: 'mvp-lead-1', name: '李同学', contact: 'li@example.com', sourcePlatform: '小红书', sourceAccountId: 'acc-1', sourceContentId: 'ct-2', targetJobId: 'job-2', owner: '招聘专员A', stage: '已联系', beisenStatus: '待转入', note: '收藏 VLA 内容后私信咨询', createdAt: now, updatedAt: now },
      { id: 'mvp-lead-2', name: '王工', contact: 'wang@example.com', sourcePlatform: '脉脉', sourceAccountId: 'acc-2', sourceContentId: 'ct-1', targetJobId: 'job-1', owner: '招聘主管', stage: '待联系', beisenStatus: '待转入', note: '评论区表达兴趣', createdAt: now, updatedAt: now },
    ],
    leadFollowUps: data.leadFollowUps.length ? data.leadFollowUps : [
      { id: 'mvp-follow-1', leadId: 'mvp-lead-1', actor: '招聘专员A', method: '私信', result: '有意向', content: '已发送岗位链接，候选人表示本周投递。', nextFollowAt: '2026-05-28', createdAt: now },
    ],
    contentQualityScores: data.contentQualityScores.length ? data.contentQualityScores : [
      { id: 'mvp-score-1', contentId: 'ct-2', total: 86, titleScore: 16, personaScore: 15, sellingPointScore: 18, platformFitScore: 16, ctaScore: 11, complianceScore: 10, suggestions: ['保留真实场景表达', 'CTA 可更明确'], createdAt: now, evaluator: '规则' },
    ],
    topics: data.topics.length ? data.topics : [
      { id: 'mvp-topic-1', title: '研究型实习生最关心导师带教什么', type: '校招内容', platform: '小红书', targetJobId: 'job-2', owner: '招聘专员A', status: '写作中', inspiration: '围绕真实机器人场景和成长速度展开', tags: ['校招', '算法'], source: '复盘沉淀', createdAt: now, updatedAt: now },
    ],
    accountHealthSnapshots: data.accountHealthSnapshots.length ? data.accountHealthSnapshots : [
      { id: 'mvp-health-acc-1', accountId: 'acc-1', periodStart: '2026-05-01', periodEnd: '2026-05-26', publishCount: 2, averageViews: 8900, averageInteractionRate: 0.07, averageClickRate: 0.014, highRiskRatio: 0.2, inactiveDays: 8, positioningMatchScore: 78, level: '健康', suggestions: ['继续复用校招答疑内容结构'], createdAt: now },
    ],
    calendarMilestones: data.calendarMilestones.length ? data.calendarMilestones : [
      { id: 'mvp-milestone-1', title: '暑期实习投递高峰', date: '2026-06-01', type: '校招节点', note: '提前准备小红书/B站校招内容。' },
    ],
    dataExplanations: data.dataExplanations.length ? data.dataExplanations : [
      { id: 'mvp-explain-1', scope: '平台', targetId: '小红书', title: '小红书收藏高于点击', body: '候选人对内容有兴趣，但投递入口还可以更明显。', severity: '建议', evidence: ['收藏 512', '点击 188'], createdAt: now },
    ],
    reviewMentions: data.reviewMentions.length ? data.reviewMentions : [
      { id: 'mvp-mention-1', contentId: 'ct-1', userId: 'HR负责人', commentId: 'mvp-review-1', read: false, createdAt: now },
    ],
    reviewComments: data.reviewComments.length ? data.reviewComments : [
      { id: 'mvp-review-1', contentId: 'ct-1', reviewer: 'HR负责人', stage: '待品牌合规审核', decision: '修改建议', comment: '技术架构表述需要再降敏。', createdAt: now },
    ],
    contentVersions: data.contentVersions.length ? data.contentVersions : [
      { id: 'mvp-version-1', contentId: 'ct-1', version: 1, body: seedData.contents[0]?.content ?? '', editor: '招聘主管', changeNote: '创建观点内容初稿', createdAt: now },
    ],
  };
}

export function generateContent(job: JobNeed, platform: Platform) {
  const tone = {
    小红书: '真实、种草、轻量、亲和',
    脉脉: '专业、克制、观点型',
    B站: '深度、访谈、技术分享',
    公众号: '系统、正式、专题化',
    抖音: '短句、口播、场景化',
    知乎: '问答、分析、专业',
    技术社区: '工程实践、技术细节、克制',
  }[platform];

  return `【${platform}内容初稿】\\n主题：${job.title}为什么值得关注\\n语气：${tone}\\n候选人关注点：${job.persona}\\n核心卖点：${job.sellingPoints.join('、')}\\n正文：我们正在杭州寻找${job.level}人才加入${job.family}方向。这个机会更适合希望在${job.sellingPoints[0]}中解决真实问题、同时看重团队氛围和成长空间的候选人。\\nCTA：主页招聘入口已挂出，可查看岗位详情并跳转北森/官网投递。`;
}

export function scanRisks(text: string) {
  const matches = riskRules.filter((rule) => {
    const keys = rule.split('、').slice(0, 2);
    return keys.some((key) => text.includes(key.replace('等', '')));
  });
  const broad = ['薪酬', '奖金', '股票', '福利', '战略', '客户', '架构', '算法', '加班', '转正', '歧视'].filter((word) =>
    text.includes(word),
  );
  const risks = Array.from(new Set([...matches, ...broad.map((word) => `包含敏感词：${word}`)]));
  return {
    level: risks.length > 1 ? '高' : risks.length === 1 ? '中' : '低',
    risks,
  } as const;
}

export function nextStatus(status: ContentTask['status']) {
  const index = statusFlow.indexOf(status as (typeof statusFlow)[number]);
  if (index < 0 || index === statusFlow.length - 1) return status;
  return statusFlow[index + 1];
}
