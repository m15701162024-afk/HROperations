export type Platform = '小红书' | '脉脉' | 'B站' | '公众号' | '抖音' | '知乎' | '技术社区';

export type AppSection =
  | '工作台'
  | '招聘需求'
  | '内容运营'
  | '线索池'
  | '账号与平台'
  | '数据分析'
  | '系统配置';

export type ContentStatus =
  | '草稿'
  | 'AI已生成'
  | '待专业补充'
  | '待专业审核'
  | '待品牌合规审核'
  | '待平台适配'
  | '待发布'
  | '已发布'
  | '数据回收中'
  | '已复盘'
  | '已归档'
  | '驳回修改';

export type RiskLevel = '低' | '中' | '高';

export type DrillDimension = 'summary' | 'platform' | 'account' | 'content' | 'job' | 'contentType' | 'funnel';

export type MetricKey =
  | 'views'
  | 'interactions'
  | 'clicks'
  | 'applications'
  | 'effectiveResumes'
  | 'interviews'
  | 'offers'
  | 'hires'
  | 'cost'
  | 'roi';

export type DrillMetaValue = string | number | boolean | undefined | null | DrillMetaValue[] | { [key: string]: DrillMetaValue };

export interface DrillQuery {
  dimension: DrillDimension;
  platform?: Platform | '全部';
  accountId?: string;
  contentId?: string;
  jobId?: string;
  contentType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sourceId?: string;
  page?: number;
  pageSize?: number;
}

export interface MetricSnapshot {
  views: number;
  interactions: number;
  clicks: number;
  applications: number;
  effectiveResumes: number;
  interviews: number;
  offers: number;
  hires: number;
  cost: number;
  roi: number;
  interactionRate: number;
  clickRate: number;
  applicationRate: number;
  effectiveRate: number;
  hireRate: number;
}

export interface DrillBreakdown {
  id: string;
  label: string;
  dimension: DrillDimension;
  snapshot: MetricSnapshot;
  meta?: Record<string, DrillMetaValue>;
}

export interface DrillDetail {
  id: string;
  title: string;
  dimension: DrillDimension;
  snapshot: MetricSnapshot;
  meta?: Record<string, DrillMetaValue>;
}

export interface DrillInsight {
  id: string;
  title: string;
  body: string;
  severity: '机会' | '风险' | '建议';
  evidence: string[];
}

export interface MetricQualityIssue {
  id: string;
  issueType: '缺少字段' | '重复数据' | '无法归因' | '日期异常' | '指标异常' | '同步失败' | '权限不足';
  severity: '低' | '中' | '高';
  targetType: 'platform' | 'account' | 'content' | 'job' | 'source' | 'sync';
  targetId: string;
  message: string;
  sourceId?: string;
  syncBatchId?: string;
  resolved: boolean;
  createdAt: string;
}

export interface DrillResult {
  query: DrillQuery;
  summary: MetricSnapshot;
  breakdowns: DrillBreakdown[];
  details: DrillDetail[];
  insights: DrillInsight[];
  qualityIssues: MetricQualityIssue[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  generatedAt: string;
}

export interface JobNeed {
  id: string;
  title: string;
  family: string;
  city: string;
  level: string;
  type: '社招' | '校招' | '实习' | '职能';
  jd: string;
  persona: string;
  sellingPoints: string[];
  targetPlatforms: Platform[];
  status: '招聘中' | '暂停' | '关闭';
  beisenUrl: string;
  websiteUrl: string;
}

export interface PlatformAccount {
  id: string;
  platform: Platform;
  name: string;
  externalId: string;
  integrationId: string;
  provider: string;
  profileUrl?: string;
  avatarUrl?: string;
  followerCount?: number;
  status: '已连接' | '连接失败' | '已停用';
  syncedAt: string;
  raw?: Record<string, unknown>;
}

export interface ContentTask {
  id: string;
  title: string;
  jobId: string;
  platform: Platform;
  accountId: string;
  type: string;
  status: ContentStatus;
  owner: string;
  reviewer: string;
  dueDate: string;
  publishedAt?: string;
  content: string;
  tags: string[];
  riskLevel: RiskLevel;
  risks: string[];
  metrics: {
    views: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    clicks: number;
  };
}

export interface ContentVersion {
  id: string;
  contentId: string;
  version: number;
  body: string;
  editor: string;
  changeNote: string;
  createdAt: string;
}

export interface ContentReviewComment {
  id: string;
  contentId: string;
  reviewer: string;
  stage: ContentStatus;
  decision: '通过' | '修改建议' | '驳回';
  comment: string;
  createdAt: string;
}

export interface AssetItem {
  id: string;
  name: string;
  category: string;
  owner: string;
  scope: string;
  platforms: Platform[];
  riskLevel: RiskLevel;
  authorization: string;
  expiresAt: string;
  usageCount: number;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: number;
  uploadedAt?: string;
}

export interface Goal {
  id: string;
  title: string;
  dimension: string;
  target: number;
  current: number;
  metric: string;
  status: '未开始' | '进行中' | '已完成' | '未达成' | '超额完成';
}

export interface ReportInsight {
  id: string;
  title: string;
  body: string;
  action: string;
  severity: '机会' | '风险' | '建议';
}

export interface RecruitmentEntry {
  id: string;
  platform: Platform;
  headline: string;
  destination: '北森岗位页' | '公司官网招聘页' | '自建落地页';
  url: string;
  trackingCode: string;
  clicks: number;
  status: '启用' | '停用';
}

export interface BeisenResult {
  id: string;
  jobId: string;
  sourcePlatform: Platform | '未知';
  sourceContentId?: string;
  candidateCode: string;
  stage: '已投递' | '有效简历' | '初筛通过' | '已约面' | '已面试' | 'Offer' | '已入职';
  importedAt: string;
}

export interface IntegrationConfig {
  id: string;
  type: '北森' | '平台API' | '企业微信' | '飞书' | 'BI';
  name: string;
  endpoint: string;
  apiKey?: string;
  extraConfig?: string;
  authMode: '未配置' | 'Token' | 'OAuth' | 'Webhook' | '文件导入';
  status: '未配置' | '待验证' | '已连接' | '连接失败';
  lastSyncAt?: string;
  lastMessage?: string;
}

export interface IntegrationSyncRun {
  id: string;
  integrationId: string;
  syncType: '北森线索同步' | '北森结果回流' | '平台指标拉取' | '平台账号同步' | 'BI同步' | '消息发送' | '其他';
  status: '成功' | '失败';
  message: string;
  recordCount: number;
  retryCount: number;
  detail?: string;
  durationMs?: number;
  requestId?: string;
  errorCode?: string;
  failedRows?: string[];
  dataQualityScore?: number;
  ranAt: string;
}

export interface ModelApiConfig {
  id: string;
  provider: 'OpenAI' | 'Azure OpenAI' | '通义千问' | 'DeepSeek' | '智谱' | '私有模型' | '其他';
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabledFor: Array<'内容生成' | '风险识别' | '复盘建议' | '标题推荐'>;
  status: '未配置' | '待验证' | '已连接' | '连接失败';
  lastTestAt?: string;
  lastMessage?: string;
}

export interface LandingPage {
  id: string;
  title: string;
  slug: string;
  pageType: '岗位集合页' | '校招专题页' | '技术开放日' | '自定义落地页';
  linkedJobIds: string[];
  destinationUrl: string;
  status: '草稿' | '已发布' | '停用';
  visits: number;
  clicks: number;
}

export interface LandingPageLead {
  id: string;
  landingPageId: string;
  name: string;
  contact: string;
  targetJobId: string;
  sourcePlatform: Platform | '未知';
  note: string;
  status: '待转入北森' | '已转入北森';
  submittedAt: string;
}

export interface PermissionRole {
  id: string;
  name: string;
  dataScope: '个人' | '团队' | '全部';
  permissions: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  roleId: string;
  team: string;
  status: '启用' | '停用';
}

export interface WorkflowRule {
  id: string;
  name: string;
  platform: Platform | '全部';
  contentType: string;
  minRiskLevel: RiskLevel;
  steps: ContentStatus[];
  enabled: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  targetSection: string;
  level: '提醒' | '预警' | '待办';
  read: boolean;
  createdAt: string;
}

export interface SensitiveRule {
  id: string;
  keyword: string;
  category: string;
  riskLevel: RiskLevel;
  suggestion: string;
  enabled: boolean;
}

export interface CostRecord {
  id: string;
  targetType: '内容' | '平台' | '岗位族群';
  targetId: string;
  laborCost: number;
  mediaCost: number;
  productionCost: number;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
}

export interface IntegrationMapping {
  id: string;
  name: string;
  integrationType: IntegrationConfig['type'];
  scenario: IntegrationSyncRun['syncType'];
  method: 'GET' | 'POST' | 'PUT';
  endpointPath: string;
  resultPath: string;
  fieldMapping: string;
  enabled: boolean;
}

export interface CompliancePolicy {
  id: string;
  title: string;
  scope: '隐私授权' | '招聘合规' | '内容审核' | '数据安全' | '公网落地页';
  owner: string;
  status: '草稿' | '生效' | '待更新';
  content: string;
  updatedAt: string;
}

export interface DeploymentTask {
  id: string;
  title: string;
  category: '账号体系' | '数据库' | '平台接口' | '安全合规' | '运维监控' | '插件发布';
  owner: string;
  status: '未开始' | '进行中' | '已完成';
  dueDate: string;
  note: string;
}

export interface ImportRun {
  id: string;
  source: '岗位' | '内容指标' | '北森结果' | '账号' | '素材';
  fileName: string;
  mapping: string;
  status: '成功' | '失败';
  recordCount: number;
  errorRows: string[];
  createdAt: string;
}

export interface ReportAction {
  id: string;
  reportId: string;
  title: string;
  owner: string;
  dueDate: string;
  status: '未开始' | '进行中' | '已完成';
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  task: '内容生成' | '风险识别' | '复盘建议' | '标题推荐';
  name: string;
  provider: string;
  prompt: string;
  enabled: boolean;
  updatedAt: string;
}

export interface ModelRunLog {
  id: string;
  modelApiId: string;
  task: PromptTemplate['task'];
  status: '成功' | '失败';
  inputSummary: string;
  outputPreview: string;
  message: string;
  ranAt: string;
}

export interface PluginRule {
  id: string;
  platform: Platform;
  name: string;
  urlPattern: string;
  selectors: string;
  enabled: boolean;
  updatedAt: string;
}

export interface TaskItem {
  id: string;
  type: '待发布' | '待审核' | '数据待回收' | '高风险待处理' | '素材授权到期' | '线索待跟进' | '审核超时' | '账号停更';
  title: string;
  body: string;
  owner: string;
  priority: '低' | '中' | '高';
  status: '待处理' | '处理中' | '已完成' | '已忽略';
  targetSection: AppSection;
  targetId: string;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
}

export interface CandidateLead {
  id: string;
  name: string;
  contact: string;
  sourcePlatform: Platform | '未知';
  sourceAccountId?: string;
  sourceContentId?: string;
  targetJobId?: string;
  owner: string;
  stage: '待联系' | '已联系' | '已转北森' | '无效' | '暂不合适';
  beisenStatus: '待转入' | '已转入' | '转入失败';
  duplicateOf?: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFollowUp {
  id: string;
  leadId: string;
  actor: string;
  method: '私信' | '电话' | '微信' | '邮件' | '评论' | '其他';
  result: '未回复' | '有意向' | '已投递' | '不合适' | '待下次跟进';
  content: string;
  nextFollowAt?: string;
  createdAt: string;
}

export interface ContentQualityScore {
  id: string;
  contentId: string;
  total: number;
  titleScore: number;
  personaScore: number;
  sellingPointScore: number;
  platformFitScore: number;
  ctaScore: number;
  complianceScore: number;
  suggestions: string[];
  createdAt: string;
  evaluator: '规则' | 'AI' | '人工';
}

export interface TopicItem {
  id: string;
  title: string;
  type: string;
  platform: Platform | '全部';
  targetJobId?: string;
  owner: string;
  status: '待认领' | '已认领' | '写作中' | '已生成内容' | '已发布' | '已复盘' | '已归档';
  inspiration: string;
  tags: string[];
  source: '人工' | 'AI' | '复盘沉淀';
  createdAt: string;
  updatedAt: string;
}

export interface AccountHealthSnapshot {
  id: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  publishCount: number;
  averageViews: number;
  averageInteractionRate: number;
  averageClickRate: number;
  highRiskRatio: number;
  inactiveDays: number;
  positioningMatchScore: number;
  level: '健康' | '需关注' | '风险';
  suggestions: string[];
  createdAt: string;
}

export interface CalendarMilestone {
  id: string;
  title: string;
  date: string;
  type: '节假日' | '校招节点' | '招聘活动' | '业务节点' | '自定义';
  note: string;
}

export interface DataExplanation {
  id: string;
  scope: '平台' | '账号' | '内容' | '岗位族群' | '全局';
  targetId: string;
  title: string;
  body: string;
  severity: '机会' | '风险' | '建议';
  evidence: string[];
  createdAt: string;
}

export interface ReviewMention {
  id: string;
  contentId: string;
  userId: string;
  commentId: string;
  read: boolean;
  createdAt: string;
}

export interface OperationSettings {
  contentQualityBlockScore: number;
  accountInactiveWarningDays: number;
  accountInactiveDangerDays: number;
  dailyAccountPublishLimit: number;
  dataCollectionDelayDays: number;
  weeklyPlatformTargets: Partial<Record<Platform, number>>;
  reviewSlaHours: number;
}

export interface AppData {
  jobs: JobNeed[];
  accounts: PlatformAccount[];
  contents: ContentTask[];
  contentVersions: ContentVersion[];
  reviewComments: ContentReviewComment[];
  assets: AssetItem[];
  goals: Goal[];
  reports: ReportInsight[];
  entries: RecruitmentEntry[];
  beisenResults: BeisenResult[];
  integrations: IntegrationConfig[];
  integrationSyncRuns: IntegrationSyncRun[];
  modelApis: ModelApiConfig[];
  landingPages: LandingPage[];
  landingLeads: LandingPageLead[];
  roles: PermissionRole[];
  users: UserProfile[];
  workflowRules: WorkflowRule[];
  sensitiveRules: SensitiveRule[];
  costs: CostRecord[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  integrationMappings: IntegrationMapping[];
  compliancePolicies: CompliancePolicy[];
  deploymentTasks: DeploymentTask[];
  importRuns: ImportRun[];
  reportActions: ReportAction[];
  promptTemplates: PromptTemplate[];
  modelRunLogs: ModelRunLog[];
  pluginRules: PluginRule[];
  tasks: TaskItem[];
  taskCompletions: string[];
  candidateLeads: CandidateLead[];
  leadFollowUps: LeadFollowUp[];
  contentQualityScores: ContentQualityScore[];
  topics: TopicItem[];
  accountHealthSnapshots: AccountHealthSnapshot[];
  calendarMilestones: CalendarMilestone[];
  dataExplanations: DataExplanation[];
  reviewMentions: ReviewMention[];
  operationSettings: OperationSettings;
}
