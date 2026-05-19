export type Platform = '小红书' | '脉脉' | 'B站' | '公众号' | '抖音' | '知乎' | '技术社区';

export type AccountType = '招聘专用账号' | 'HR个人IP账号' | '技术负责人账号' | '校招账号';

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
  type: AccountType;
  positioning: string;
  owner: string;
  publishingRoles: string[];
  reviewRule: string;
  attribution: string;
  authStatus: '已授权' | '未授权' | '授权过期';
  status: '启用' | '停用';
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
  syncType: '北森线索同步' | '北森结果回流' | '平台指标拉取' | 'BI同步' | '消息发送' | '其他';
  status: '成功' | '失败';
  message: string;
  recordCount: number;
  retryCount: number;
  detail?: string;
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
}
