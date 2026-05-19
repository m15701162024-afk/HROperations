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
  assets: AssetItem[];
  goals: Goal[];
  reports: ReportInsight[];
  entries: RecruitmentEntry[];
  auditLogs: AuditLog[];
}
