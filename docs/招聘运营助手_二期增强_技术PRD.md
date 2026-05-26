# 招聘运营助手二期增强技术 PRD

## 1. 文档目标

本文档用于指导研发直接拆解和开发招聘运营助手 V2.0 增强能力。范围覆盖 P0、P1、P2 模块的数据结构、页面交互、核心逻辑、接口预留和验收标准。

## 2. 当前技术现状

### 2.1 前端

- 技术栈：React + TypeScript + Vite
- 主要文件：
  - `src/App.tsx`：主应用和业务模块
  - `src/types.ts`：业务数据类型
  - `src/data.ts`：空数据、平台配置、内容生成和风险规则
  - `src/utils.ts`：CSV、ROI、导出、解析工具
  - `src/styles.css`：全局样式

### 2.2 本地 API

- `server/local-api.mjs`：本地 API 服务
- `server/repositories/jsonRepository.mjs`：JSON 数据读写
- `server/services/integrationService.mjs`：集成测试、同步、模型调用
- `server/services/authService.mjs`：本地登录

### 2.3 数据原则

- 所有新增数据对象必须进入 `AppData`。
- 未录入真实数据时展示空状态或 0。
- 本地 JSON 与 localStorage 均需通过 `normalizeAppData` 兼容旧数据。
- 关键写操作必须进入 `auditLogs`。

## 3. 新增数据模型

## 3.1 TaskItem 今日任务

```ts
export interface TaskItem {
  id: string;
  type:
    | '待发布'
    | '待审核'
    | '数据待回收'
    | '高风险待处理'
    | '素材授权到期'
    | '线索待跟进'
    | '审核超时'
    | '账号停更';
  title: string;
  body: string;
  owner: string;
  priority: '低' | '中' | '高';
  status: '待处理' | '处理中' | '已完成' | '已忽略';
  targetSection: Section;
  targetId: string;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
}
```

### 逻辑说明

- 任务可以由系统规则实时生成，也可以落库保存用户处理状态。
- 建议先实现“派生任务 + 完成状态记录”：
  - 派生任务来自内容、素材、线索、账号等对象。
  - `taskCompletions` 保存已完成/忽略的派生任务 ID。

## 3.2 CandidateLead 线索

```ts
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
```

## 3.3 LeadFollowUp 跟进记录

```ts
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
```

## 3.4 ContentQualityScore 内容质量评分

```ts
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
```

## 3.5 TopicItem 选题

```ts
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
```

## 3.6 AccountHealthSnapshot 账号健康度

```ts
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
```

## 3.7 CalendarMilestone 招聘节点

```ts
export interface CalendarMilestone {
  id: string;
  title: string;
  date: string;
  type: '节假日' | '校招节点' | '招聘活动' | '业务节点' | '自定义';
  note: string;
}
```

## 3.8 DataExplanation 数据解释

```ts
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
```

## 3.9 AppData 扩展

```ts
export interface AppData {
  tasks: TaskItem[];
  taskCompletions: string[];
  candidateLeads: CandidateLead[];
  leadFollowUps: LeadFollowUp[];
  contentQualityScores: ContentQualityScore[];
  topics: TopicItem[];
  accountHealthSnapshots: AccountHealthSnapshot[];
  calendarMilestones: CalendarMilestone[];
  dataExplanations: DataExplanation[];
}
```

## 4. P0 技术需求

## 4.1 任务化工作台

### 4.1.1 页面

在现有工作台增加：

- 今日任务总览
- 任务筛选：类型、优先级、负责人、状态
- 任务列表
- 任务详情侧栏或下钻面板
- 批量完成/忽略

### 4.1.2 派生任务规则

```ts
function deriveTasks(data: AppData): TaskItem[] {
  // 1. 今日待发布：contents.dueDate 或 publishedAt 等于今日，状态未发布
  // 2. 待审核：status in 待专业审核/待品牌合规审核
  // 3. 数据待回收：已发布超过 N 天且 metrics 全部为 0
  // 4. 高风险：riskLevel === 高且未发布/未复盘
  // 5. 素材授权：expiresAt 距今天 <= 30
  // 6. 线索待跟进：candidateLeads.stage in 待联系/已联系 且未转北森
  // 7. 账号停更：账号最近内容发布时间超过 N 天
}
```

### 4.1.3 交互

- 点击任务：调用 `openSection(task.targetSection)` 并设置对应模块选中对象。
- 完成任务：写入 `taskCompletions` 或更新 `tasks.status`。
- 忽略任务：写入 `taskCompletions`，状态为已忽略。

### 4.1.4 验收

- 新增内容、线索、素材后，工作台任务能自动变化。
- 完成任务后不再重复出现。
- 无数据时任务为 0。

## 4.2 线索池

### 4.2.1 新增菜单

新增 Section：

```ts
| '线索池'
```

导航增加 `线索池`。

### 4.2.2 页面结构

- 顶部指标：总线索、待联系、已转北森、重复线索
- 筛选区：平台、岗位、阶段、负责人、日期
- 新增线索表单
- 线索表格
- 线索详情下钻
- 跟进记录
- 批量分配负责人
- 批量转北森

### 4.2.3 去重逻辑

```ts
function findDuplicateLead(leads: CandidateLead[], lead: CandidateLead) {
  return leads.find((item) => item.contact && item.contact === lead.contact);
}
```

### 4.2.4 转北森逻辑

- 如果有北森集成配置：
  - 调用 `runIntegrationSync(integration, '北森线索同步', payload, apiToken)`
  - 成功后更新 `beisenStatus = 已转入`
- 如果未配置：
  - 允许转入本地北森前置结果池，生成 `BeisenResult`
  - 状态标记为已转入

### 4.2.5 CSV 导入

支持字段：

```txt
name,contact,sourcePlatform,sourceAccountId,sourceContentId,targetJobId,owner,stage,note
```

### 4.2.6 验收

- 可以新增、编辑、删除线索。
- 可以新增跟进记录。
- 重复联系方式提示重复。
- 可以转北森并进入数据分析归因。

## 4.3 内容质量评分

### 4.3.1 页面位置

在内容运营的内容详情卡片中增加：

- 质量总分
- 维度分
- 修改建议
- 重新评分按钮
- 评分历史

### 4.3.2 规则评分算法

```ts
function scoreContent(content: ContentTask, job?: JobNeed): ContentQualityScore {
  // 标题吸引力：标题长度、是否包含岗位/场景/人群
  // 候选人关注点：薪酬、稳定性、挑战、氛围、成长、前景等关键词覆盖
  // 岗位卖点：job.sellingPoints 在正文中的覆盖
  // 平台适配：不同平台对应内容长度、标签、表达方式
  // CTA：是否包含投递、私信、链接、查看岗位等动作
  // 合规：riskLevel 越高扣分越多
}
```

### 4.3.3 AI 评分

- 如果存在可用模型配置，调用统一模型 API。
- 任务类型：`内容质量评分` 可作为新增 PromptTemplate task，或复用 `风险识别`。
- AI 失败时回退规则评分。

### 4.3.4 发布拦截

- 质量分低于阈值，例如 70 分，点击发布时提示。
- 高风险且合规分低于阈值，不允许直接发布。

### 4.3.5 验收

- 每条内容可以评分。
- 评分结果可保存。
- 修改正文后可重新评分。
- 发布前能读取最新评分。

## 4.4 排期日历增强

### 4.4.1 页面结构

建议从内容运营中拆出独立 `排期日历` 菜单，也可以先作为内容运营子页。

### 4.4.2 状态

```ts
const [calendarView, setCalendarView] = useState<'周' | '月'>('周');
const [calendarPlatform, setCalendarPlatform] = useState<Platform | '全部'>('全部');
const [calendarAccountId, setCalendarAccountId] = useState('全部');
const [selectedDate, setSelectedDate] = useState('');
const [selectedContentId, setSelectedContentId] = useState('');
```

### 4.4.3 冲突检测

```ts
interface CalendarConflict {
  contentId: string;
  type: '账号过载' | '频次不足' | '高风险未审' | '入口未配置' | '素材未授权';
  message: string;
  level: '提醒' | '预警' | '阻断';
}
```

规则：

- 同账号同日内容数 > 阈值：账号过载
- 平台一周发布数 < 平台目标：频次不足
- 高风险内容未完成审核：阻断
- 内容平台无启用入口：预警
- 内容关联素材未授权：阻断

### 4.4.4 交互

- 点击内容打开详情。
- 修改日期保存到 `content.dueDate`。
- 支持周/月切换。
- 支持按平台、账号、负责人筛选。
- 支持新增 `CalendarMilestone`。

### 4.4.5 验收

- 周视图和月视图均可查看真实内容。
- 内容日期修改后立即更新。
- 冲突提示准确。

## 5. P1 技术需求

## 5.1 选题库

### 页面

新增 Section：`选题库`

页面包括：

- 选题指标：待认领、写作中、已发布、已复盘
- 新增选题
- AI 生成选题
- 选题列表
- 选题详情
- 转内容任务

### 转内容任务

```ts
function convertTopicToContent(topic: TopicItem): ContentTask {
  // 使用 topic.platform、targetJobId、type 创建草稿内容
}
```

### 验收

- 选题可新增、编辑、删除。
- 选题可转内容任务。
- 内容发布后可回写选题状态。

## 5.2 账号健康度

### 计算逻辑

```ts
function calculateAccountHealth(account: PlatformAccount, contents: ContentTask[]): AccountHealthSnapshot {
  // publishCount
  // averageViews
  // averageInteractionRate
  // averageClickRate
  // highRiskRatio
  // inactiveDays
  // positioningMatchScore
  // level
}
```

### 页面位置

账号与平台新增子页：`账号健康度`

### 验收

- 每个账号可查看健康等级。
- 停更、低点击、高风险占比过高会提示。

## 5.3 自动复盘生成

### 生成入口

复盘报告页增加：

- 选择周期：周报/月报/自定义
- 选择平台：全部/单平台
- 选择岗位族群
- 一键生成报告
- 导出 Markdown/Word/CSV

### 生成逻辑

```ts
function generateReviewReport(data: AppData, params: ReportParams): ReportInsight[] {
  // 统计内容表现
  // 平台对比
  // 高低表现内容
  // 北森回流
  // ROI
  // 行动建议
}
```

### 验收

- 无真实数据时不生成假结论。
- 有数据时可生成报告和行动项。
- 报告可导出。

## 5.4 协作审核增强

### 数据扩展

```ts
export interface ReviewMention {
  id: string;
  contentId: string;
  userId: string;
  commentId: string;
  read: boolean;
  createdAt: string;
}
```

### 页面能力

- 评论框支持 `@姓名`
- 审核节点负责人
- SLA 配置
- 超时任务进入工作台
- 修改前后对比

### 验收

- 评论可保存。
- 被 @ 用户可在工作台看到任务。
- 审核超时可提醒。

## 6. P2 技术需求

## 6.1 智能数据解释

### 规则解释

先用规则生成解释：

```ts
if (views > 0 && clicks / views < 0.005) {
  // 曝光高点击低
}
if (clicks > 0 && applications / clicks < 0.05) {
  // 点击高投递低
}
```

### AI 解释

- 若配置模型，则将结构化指标传给模型生成解释。
- AI 输出必须保存 `evidence`，避免只有空泛建议。

## 6.2 平台策略建议

### 输入

- 岗位类型
- 候选人画像
- 平台历史表现
- 内容类型表现
- 账号健康度

### 输出

- 推荐平台
- 推荐内容形式
- 推荐发布频次
- 推荐账号
- 推荐标题风格

## 6.3 API 容错和数据治理

### 同步状态扩展

`IntegrationSyncRun` 增加：

```ts
durationMs?: number;
requestId?: string;
errorCode?: string;
failedRows?: string[];
dataQualityScore?: number;
```

### 能力

- 失败重试
- 失败行下载
- 字段映射模板保存
- 数据口径说明
- 同步时间展示
- 重复数据识别

## 7. 开发任务拆解

## 7.1 Sprint 1：P0 数据模型与工作台

| 任务 | 文件 | 验收 |
| --- | --- | --- |
| 扩展 types.ts | `src/types.ts` | AppData 包含新增对象 |
| 扩展 emptyData | `src/data.ts`, `server/empty-data.mjs` | 初始化无报错 |
| normalize 兼容 | `src/api.ts` | 老数据可加载 |
| 派生任务函数 | `src/utils.ts` 或 `src/data.ts` | 单测覆盖核心任务 |
| 工作台任务 UI | `src/App.tsx` | 可筛选、完成、跳转 |

## 7.2 Sprint 2：P0 线索池

| 任务 | 文件 | 验收 |
| --- | --- | --- |
| 新增 Section 和导航 | `src/App.tsx` | 菜单可进入 |
| 线索 CRUD | `src/App.tsx` | 新增、编辑、删除可用 |
| 跟进记录 | `src/App.tsx` | 可新增记录 |
| 去重提示 | `src/utils.ts` | 重复联系方式可识别 |
| 转北森 | `src/App.tsx`, `src/api.ts` | 本地/接口两种路径可用 |

## 7.3 Sprint 3：P0 质量评分与排期日历

| 任务 | 文件 | 验收 |
| --- | --- | --- |
| 评分算法 | `src/utils.ts` | 分数稳定可解释 |
| 内容详情评分 UI | `src/App.tsx` | 评分、重评、历史可看 |
| 发布拦截 | `src/App.tsx` | 低分/高风险可提醒或阻断 |
| 日历视图增强 | `src/App.tsx`, `src/styles.css` | 周/月视图可用 |
| 冲突检测 | `src/utils.ts` | 冲突提示准确 |

## 7.4 Sprint 4：P1 选题库和账号健康度

| 任务 | 文件 | 验收 |
| --- | --- | --- |
| 选题库菜单 | `src/App.tsx` | 可进入模块 |
| 选题 CRUD | `src/App.tsx` | 可新增/转内容 |
| AI 生成选题 | `src/App.tsx`, `src/api.ts` | 有模型时可调用 |
| 健康度计算 | `src/utils.ts` | 可生成等级 |
| 健康度 UI | `src/App.tsx` | 账号风险可见 |

## 7.5 Sprint 5：P1/P2 复盘、解释、治理

| 任务 | 文件 | 验收 |
| --- | --- | --- |
| 自动复盘参数 | `src/App.tsx` | 可选周期/平台 |
| 报告生成 | `src/utils.ts` | 不生成假数据 |
| 数据解释 | `src/utils.ts` | 可输出解释和证据 |
| 平台策略建议 | `src/utils.ts` | 根据岗位和历史输出建议 |
| 同步容错增强 | `server/services/integrationService.mjs` | 失败可追踪 |

## 8. 测试计划

### 8.1 单元测试

- 派生任务规则
- 线索去重
- 内容质量评分
- 日历冲突检测
- 账号健康度计算
- 数据解释规则

### 8.2 组件/交互测试

- 工作台任务完成
- 线索新增和转北森
- 内容评分和发布拦截
- 日历周/月切换
- 选题转内容
- 自动复盘生成

### 8.3 构建测试

- `npm run lint`
- `npm run test -- --run`
- `npm run build`

### 8.4 浏览器验证

- 1366px：无横向溢出
- 1440px：主要看板布局正常
- 1920px：内容不被过度拉伸
- 移动端宽度：菜单和表格可用

## 9. 风险与依赖

| 风险 | 说明 | 处理 |
| --- | --- | --- |
| 单文件 App.tsx 过大 | 后续维护困难 | 新模块开发时逐步拆分 components/pages/utils |
| 真实 API 字段不确定 | 北森和平台字段需后续确认 | 通过字段映射和导入中心兜底 |
| AI 结果不稳定 | 评分和解释可能偏泛 | 规则优先，AI 作为增强 |
| 本地 JSON 数据增长 | 长期使用可能变慢 | 后续迁移数据库 |
| 权限未服务端化 | 本地阶段权限更多是前端控制 | 部署生产前服务端校验 |

## 10. 完成定义

- P0 模块全部可进入、可录入、可编辑、可保存、可下钻。
- 所有新增数据进入真实数据结构，不使用演示数据。
- 所有关键操作写入审计日志。
- 所有新增模块空数据状态清晰。
- lint、test、build 全部通过。
- 浏览器无明显布局错乱、文字重叠和横向溢出。

