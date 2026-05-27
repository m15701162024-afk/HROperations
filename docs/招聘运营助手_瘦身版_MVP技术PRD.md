# 招聘运营助手瘦身版 MVP 技术 PRD

## 1. 文档目标

本文档把瘦身版 PRD 拆解为可开发的 MVP 技术任务。目标不是新增更多功能，而是删除冗余入口、收敛数据模型、强化真实 API 对接，并确保现有测试和构建稳定。

## 2. 当前技术现状

### 2.1 前端

- 技术栈：React + TypeScript + Vite
- 主文件：
  - `src/App.tsx`：主页面、导航、业务模块
  - `src/types.ts`：核心业务类型
  - `src/data.ts`：空数据、种子数据、平台枚举
  - `src/utils.ts`：任务派生、CSV、健康度、报告等工具函数
  - `src/analytics.ts`：数据分析聚合和下钻

### 2.2 本地 API

- `server/local-api.mjs`：本地 API、数据读写、分析接口
- `server/services/integrationService.mjs`：外部集成测试和同步
- `server/services/authService.mjs`：本地认证
- `server/repositories/jsonRepository.mjs`：JSON 存储

### 2.3 当前已完成的前置改造

- `PlatformAccount` 已改为真实 API 同步账号模型。
- 账号页已删除手工新增、手工授权状态、发布权限、账号定位等字段。
- 平台 API 模板已新增 `平台账号同步` 场景。
- 账号 CSV 导入已关闭。

## 3. MVP 技术原则

1. 删除入口优先于新增功能。
2. 真实 API 数据优先于手工台账。
3. 高频运营路径保留一级入口，低频配置收进系统配置。
4. 不再新增演示数据和验收用页面。
5. 所有数据写入必须经过 `audit` 或本地 API 记录。
6. 构建和测试必须持续通过：`npm run build`、`npm test`。

## 4. 目标信息架构

### 4.1 一级导航

目标一级导航：

```ts
const navItems = [
  '工作台',
  '招聘需求',
  '内容运营',
  '账号与平台',
  '线索池',
  '数据分析',
  '系统配置',
];
```

### 4.2 路由/渲染调整

在 `src/App.tsx` 中调整：

- 删除 `navItems` 中的：
  - `选题库`
  - `排期日历`
  - `素材资产`
  - `导入中心`
  - `复盘报告`
  - `AI工作台`
- `renderSection` 删除或重定向对应 case。
- `operatorSections` 同步收敛。
- `sectionPermissions` 删除对应权限项或映射到合并后模块。

建议重定向策略：

| 旧模块 | 新位置 |
| --- | --- |
| 选题库 | 内容运营页签：选题 |
| 排期日历 | 内容运营页签：排期 |
| 素材资产 | 内容运营内容附件/授权字段，MVP 可先隐藏 |
| 导入中心 | 系统配置页签：异常补录 |
| 复盘报告 | 数据分析页签：复盘 |
| AI工作台 | 系统配置页签：模型配置 |

## 5. 数据模型调整

## 5.1 PlatformAccount

保留当前真实账号模型：

```ts
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
```

开发要求：

- 禁止恢复 `authStatus`、`publishingRoles`、`reviewRule`、`attribution`、`positioning`。
- 内容绑定账号时只能选择 `data.accounts` 中的真实同步账号。
- 账号状态只能由同步逻辑写入。

## 5.2 AppSection

调整 `src/types.ts`：

```ts
export type AppSection =
  | '工作台'
  | '招聘需求'
  | '内容运营'
  | '账号与平台'
  | '线索池'
  | '数据分析'
  | '系统配置';
```

迁移影响：

- 所有 `targetSection` 指向旧模块的数据，需要在 normalize 时迁移。
- 例如：
  - `选题库` -> `内容运营`
  - `排期日历` -> `内容运营`
  - `素材资产` -> `内容运营`
  - `导入中心` -> `系统配置`
  - `复盘报告` -> `数据分析`
  - `AI工作台` -> `系统配置`

## 5.3 保留但隐藏的数据对象

MVP 阶段可以保留类型和数据，但不作为一级入口：

- `TopicItem`
- `CalendarMilestone`
- `AssetItem`
- `ReportInsight`
- `ModelApiConfig`
- `ImportRun`

原因：减少一次性删除导致的大面积回归。先做 UI 和流程瘦身，后续再做数据模型物理清理。

## 6. API 集成技术需求

## 6.1 平台账号同步

现有入口：

- 前端：`syncPlatformAccounts`
- 后端：`POST /api/integrations/sync`
- syncType：`平台账号同步`

请求：

```json
{
  "integration": {
    "type": "平台API",
    "endpoint": "https://platform.example.com",
    "apiKey": "***",
    "authMode": "Token",
    "extraConfig": "{\"scenarios\":{\"平台账号同步\":{\"method\":\"GET\",\"endpointPath\":\"/accounts\",\"resultPath\":\"accounts\"}}}"
  },
  "syncType": "平台账号同步",
  "payload": {}
}
```

支持响应格式：

```json
{
  "accounts": [
    {
      "id": "acc_001",
      "name": "招聘账号",
      "platform": "小红书",
      "profileUrl": "https://...",
      "followerCount": 10000,
      "status": "active"
    }
  ]
}
```

兼容数组路径：

- `accounts`
- `items`
- `records`
- `data`
- `data.accounts`
- `data.items`

## 6.2 字段归一

前端归一函数：

- `pickAccountRecords(payload)`
- `normalizeSyncedAccounts(records, integration, fallbackPlatform)`

归一字段：

| 标准字段 | 兼容来源 |
| --- | --- |
| externalId | id/accountId/externalId/openId/uid |
| name | name/nickname/username/displayName |
| platform | platform/provider/模板平台 |
| profileUrl | profileUrl/url/homepage |
| avatarUrl | avatarUrl/avatar/image |
| followerCount | followerCount/followers/fans |
| status | status/state |

## 6.3 平台指标同步

继续使用：

- syncType：`平台指标拉取`
- 默认路径：`/metrics`
- 默认结果路径：`records`

要求：

- 指标写回 `ContentTask.metrics`。
- 未匹配内容时记录质量问题，不自动创建内容。
- 同步失败写入 `integrationSyncRuns` 和通知。

## 6.4 北森线索同步

MVP 保留：

- syncType：`北森线索同步`
- 待转入北森线索 -> 北森 API
- 成功后写入 `beisenResults`

后置：

- 北森结果自动回流
- 北森 OAuth
- 多租户字段映射管理

## 7. 页面改造任务

## 7.1 工作台

### 文件

- `src/App.tsx`：`Dashboard`
- `src/utils.ts`：`deriveTasks`

### 改造点

- 保留任务中心和核心指标。
- 删除目标表单。
- 删除与隐藏模块相关的跳转按钮。
- 新增 API 同步失败任务：
  - 来源：`integrationSyncRuns.status === '失败'`
  - targetSection：`账号与平台`

### 验收

- 工作台只出现真实数据派生任务。
- 同步失败能跳转到账号与平台。
- 不再跳转到已删除一级模块。

## 7.2 内容运营

### 文件

- `src/App.tsx`：`ContentOps`
- 可迁移：`TopicLibrary`、`ScheduleCalendar` 中必要 UI

### 改造点

新增内部页签：

```ts
type ContentOpsTab = '内容' | '选题' | '排期';
```

迁移能力：

- `TopicLibrary` 的新增选题、岗位生成选题、转内容任务 -> 内容运营/选题
- `ScheduleCalendar` 的日历视图、节点、冲突提示 -> 内容运营/排期

删除/隐藏：

- 独立选题库导航。
- 独立排期日历导航。
- 与真实发布 API 无关的复杂排期配置。

### 验收

- 用户在内容运营内完成选题、内容、排期。
- 内容绑定账号下拉只展示真实同步账号。
- 内容质量评分和风险扫描可用。

## 7.3 账号与平台

### 文件

- `src/App.tsx`：`Accounts`
- `server/services/integrationService.mjs`

### 改造点

保留页签：

```ts
type AccountPanel = '平台总览' | '账号入口' | 'API集成' | '同步日志';
```

删除页签：

- `账号健康度`：迁移到数据分析/账号分析。
- `落地页`：MVP 删除。

删除集成类型：

- `企业微信`
- `飞书`
- `BI`

MVP 仅保留：

- `北森`
- `平台API`

### 验收

- 页面无手工账号表单。
- 页面无人工授权状态。
- 平台 API 可测试连接、同步账号、拉取指标。
- 北森可同步线索。

## 7.4 线索池

### 文件

- `src/App.tsx`：`LeadPool`
- `src/utils.ts`：`findDuplicateLead`

### 改造点

- 保留线索列表、筛选、去重、跟进记录、转北森。
- 手工新增保留为“补录”，弱化入口文案。
- CSV 导入不在一级导入中心出现。

### 验收

- 线索可绑定真实账号。
- 转北森后可在数据分析漏斗中看到投递。

## 7.5 数据分析

### 文件

- `src/App.tsx`：`Analytics`、`Reports`
- `src/analytics.ts`
- `src/utils.ts`：`buildRecommendations`、`buildReportMarkdown`

### 改造点

新增或保留内部页签：

```ts
type AnalyticsView =
  | '总览'
  | '平台账号'
  | '内容岗位'
  | '漏斗归因'
  | '质量解释'
  | '复盘';
```

迁移：

- `Reports` 的报告生成、编辑、导出、行动项 -> 数据分析/复盘。

删除：

- 独立复盘报告导航。
- 数据分析中的导入配置页签，改放系统配置/异常补录。

### 验收

- 复盘报告不再作为一级入口。
- 复盘生成基于当前真实指标。
- 账号分析展示 provider、externalId、syncedAt。

## 7.6 系统配置

### 文件

- `src/App.tsx`：`SettingsPage`

### 改造点

保留页签/区域：

- 角色权限
- 用户与团队
- 本地登录账号
- 高风险规则
- API 字段映射
- 模型 API 配置
- 健康检查和备份
- 异常补录

删除/隐藏：

- MVP 验收矩阵
- 插件规则
- 部署任务
- 独立 AI 任务试跑

### 验收

- 非管理员不可见系统配置。
- 密钥不出现在普通导出中。
- 异常补录只能管理员使用。

## 8. 数据迁移和兼容

## 8.1 normalizeAppData

位置：`src/api.ts`

需要新增迁移：

```ts
const sectionMap = {
  选题库: '内容运营',
  排期日历: '内容运营',
  素材资产: '内容运营',
  导入中心: '系统配置',
  复盘报告: '数据分析',
  AI工作台: '系统配置',
};
```

迁移对象：

- `tasks[].targetSection`
- `notifications[].targetSection`
- `auditLogs[].targetSection` 如果存在

## 8.2 老账号清理

识别旧账号：

- 存在 `authStatus`
- 存在 `publishingRoles`
- 存在 `reviewRule`
- 缺少 `externalId`
- 缺少 `integrationId`

处理：

- MVP 方案：过滤掉旧账号，不自动转换。
- 原因：旧账号不是 API 同步来源，不能伪造成真实账号。

## 9. 测试计划

## 9.1 单元测试

更新：

- `src/mvp.test.ts`
- `src/mvp-lifecycle.test.ts`
- `src/mvp-workflows.test.ts`
- `src/analytics.test.ts`

新增测试：

1. 平台账号同步响应归一。
2. 旧账号不会作为真实账号展示。
3. 已删除模块不在导航中出现。
4. 内容运营包含选题/排期入口。
5. 数据分析包含复盘入口。
6. 工作台不跳转已删除模块。

## 9.2 UI 验证

使用本地浏览器验证：

- 一级导航数量 <= 7。
- 账号与平台无手工账号表单。
- API 集成有同步账号按钮。
- 内容运营内可找到选题和排期。
- 数据分析内可找到复盘。
- 系统配置内可找到异常补录。

## 9.3 回归命令

```bash
npm run build
npm test
```

## 10. 开发拆解

## 阶段 1：导航和入口瘦身

- 修改 `AppSection`
- 修改 `navItems`
- 修改 `sectionPermissions`
- 修改 `operatorSections`
- 修改 `renderSection`
- 将旧模块入口重定向或移除

交付标准：

- 一级导航只剩目标模块。
- 构建通过。

## 阶段 2：内容运营合并

- 给 `ContentOps` 增加页签
- 迁移 `TopicLibrary` 必要能力
- 迁移 `ScheduleCalendar` 必要能力
- 删除独立导航入口

交付标准：

- 选题和排期可在内容运营完成。
- 原测试更新通过。

## 阶段 3：账号与平台收敛

- 删除 `账号健康度` 页签
- 删除 `落地页` 页签
- 集成类型收敛到 `北森`、`平台API`
- 删除企业微信/飞书/BI 操作按钮
- 保留同步日志

交付标准：

- 账号只能来自 API 同步。
- 无虚拟账号入口。

## 阶段 4：数据分析合并复盘

- 将 `Reports` 能力迁入 `Analytics`
- 新增 `复盘` 页签
- 删除复盘一级入口
- 删除分析里的导入配置页签

交付标准：

- 复盘可从数据分析生成和导出。
- 一级导航无复盘报告。

## 阶段 5：系统配置收敛

- 移入异常补录能力
- 移入模型 API 配置
- 隐藏 MVP 验收矩阵、插件规则、部署任务
- 调整权限

交付标准：

- 系统配置只服务管理员低频操作。

## 11. MVP 验收清单

| 验收项 | 标准 |
| --- | --- |
| 一级导航 | 仅工作台、招聘需求、内容运营、账号与平台、线索池、数据分析、系统配置 |
| 真实账号 | 无手工新增账号、无人工授权状态、无账号 CSV 导入 |
| API 集成 | 平台 API 可测试连接、同步账号、拉取指标 |
| 内容运营 | 内容、选题、排期在同一模块完成 |
| 数据分析 | 平台、账号、内容、岗位、漏斗、复盘在同一模块完成 |
| 系统配置 | 管理员配置集中，普通运营不可见 |
| 兼容 | 老数据不报错，旧模块 targetSection 被迁移 |
| 测试 | `npm run build` 和 `npm test` 通过 |

## 12. 不做清单

- 不实现小红书/脉脉等官方 OAuth 全流程。
- 不做独立素材资产管理系统。
- 不做独立落地页建站器。
- 不做独立 AI 工作台。
- 不做企业微信/飞书通知。
- 不做 BI 集成。
- 不把旧人工账号迁移成真实账号。

