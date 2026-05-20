# 招聘运营助手 HRAssistant

招聘运营助手是一个面向招聘团队的新媒体招聘运营系统原型，覆盖 PRD 中的一期核心闭环：招聘需求、AI 内容生成、风险识别、审核流转、排期发布、平台账号、素材资产、数据看板、复盘报告和系统配置。

## 功能范围

- 工作台：内容发布、曝光互动、招聘入口点击、目标进度和风险待办
- 招聘需求：岗位、族群、目标平台、北森/官网入口
- 内容运营：AI 多平台内容生成、风险扫描、内容任务创建、审核状态推进
- 素材资产：素材库、授权记录、采集表、模板库和案例库
- 素材上传：本地 API 会把上传文件保存到 `data/uploads/`，素材台账记录文件名、大小、类型、上传时间和访问地址
- 账号与平台：账号定位、发布权限、授权状态、主页招聘入口
- 数据分析：平台、岗位族群、内容漏斗代理指标
- 复盘报告：周报/月报洞察、行动建议、高表现内容特征
- 系统配置：角色权限、审核流程、高风险规则库

## 开发命令

```bash
npm install
npm run dev
npm run test
npm run build
```

开发模式建议同时启动本地 API 和前端开发服务：

```bash
npm run api
npm run dev
```

开发模式下 API 使用 `5173`，Vite 前端使用 `5174` 并代理 `/api` 和 `/uploads`，避免单端口服务与开发服务器互相代理。

单端口部署模式：

```bash
npm run serve
```

`npm run serve` 会先构建前端，再启动统一服务。

前端、后端和 API 统一使用 `5173` 端口。例如内网访问 `http://10.100.60.5:5173/`，API 健康检查地址是 `http://10.100.60.5:5173/api/health`。如果统一服务没启动，页面会自动回退到浏览器 `localStorage`，页面左下角会显示当前存储模式。

部署到固定内网地址时，也可以显式指定：

```bash
HR_ASSISTANT_API_PORT=5173 npm run serve
```

若前后端分开部署，才需要显式指定 `VITE_API_BASE_URL`；当前推荐单端口部署，不再使用 8788。

台式机长期运行可安装 macOS launchd 守护服务，服务会在登录后自动启动并在异常退出后重启：

```bash
npm run service:install
```

卸载服务：

```bash
npm run service:uninstall
```

本地 API 管理员账号：

```text
账号：admin
密码：首次创建时由 HR_ASSISTANT_ADMIN_PASSWORD 环境变量指定
```

首次启动 `npm run api` 且 `data/hr-assistant-auth.json` 不存在时，请先设置初始密码：

```bash
HR_ASSISTANT_ADMIN_PASSWORD='请替换为强密码' npm run api
```

创建后会在 `data/hr-assistant-auth.json` 中保存本地管理员的加密口令。该文件已被 `.gitignore` 排除，不会提交账号信息。
素材上传文件会保存在 `data/uploads/`，该目录同样不会提交到代码仓。

## 本地服务结构

- `server/local-api.mjs`：本地 API 入口
- `server/repositories/jsonRepository.mjs`：JSON 数据仓库，后续可替换为数据库实现
- `server/services/authService.mjs`：本地认证和会话
- `server/services/integrationService.mjs`：平台/北森/企微/飞书/BI 连接测试

平台配置页中的“测试连接”会调用：

```text
POST /api/integrations/test
```

使用人后续只需要在页面里填入 API 地址或 Webhook，即可先验证连通性；正式数据同步逻辑可继续基于该连接器层扩展。

正式集成同步接口：

```text
POST /api/integrations/sync
POST /api/integrations/send
POST /api/platform-metrics/import
```

- 北森集成：在页面配置北森 OpenAPI 地址和 Token 后，可同步待转入北森的落地页线索，并写入回流归因池。
- 平台 API：配置平台指标接口后，可拉取指标；若接口返回 `records` 或 `metrics` 数组，系统会按 `contentId` 或 `title` 写回内容指标。
- 企业微信/飞书：配置 Webhook 后，可发送待办/预警摘要。
- 浏览器插件：`browser-extension/` 是 MV3 插件目录，可在浏览器开发者模式加载，用于采集当前平台页面指标。

素材上传接口：

```text
POST /api/assets/upload
GET /uploads/:fileName
```

前端会先上传文件，再把返回的文件地址写入素材记录；如果本地 API 未启动，仍可保存素材台账，但不会落盘保存附件。

## 落地页 SDK

公网落地页可引入：

```html
<script
  src="/hr-assistant-tracker.js"
  data-api-base="https://your-api.example.com"
  data-landing-page-id="landing-page-id-or-slug"
  data-source-platform="小红书"
  data-public-secret="可选签名密钥"></script>
```

SDK 会自动记录访问，并对链接点击记录点击。表单提交可调用：

```js
window.HRAssistantTracker.submitLead({
  name: '候选人姓名',
  contact: '手机号/邮箱/微信',
  targetJobId: 'job-id',
  note: '备注'
});
```

如果服务端设置了 `HR_ASSISTANT_PUBLIC_SECRET`，公网埋点和线索提交必须携带相同的 `data-public-secret`，否则会被拒绝。

## 集成字段映射

集成配置的“扩展配置 JSON”支持字段映射和增量参数，例如：

```json
{
  "fields": {
    "contentId": "note_id",
    "title": "title",
    "views": "read_count",
    "likes": "like_count",
    "comments": "comment_count",
    "saves": "collect_count",
    "shares": "share_count",
    "clicks": "apply_click_count"
  },
  "dedupeKey": "candidateCode"
}
```

同步失败会自动重试，运行记录会保留重试次数、记录数和字段映射详情。

## 大模型 API 配置

系统配置页支持维护大模型 API：

- 服务商：OpenAI、Azure OpenAI、通义千问、DeepSeek、智谱、私有模型、其他
- API Base URL
- API Key
- 模型名称
- 用途：内容生成、风险识别、复盘建议、标题推荐

“测试连接”会调用：

```text
POST /api/model-apis/test
```

当前测试逻辑按 OpenAI-compatible `/models` 接口验证连通性；DeepSeek 会直接使用 `/chat/completions` 做极小请求测试。API Key 只保存在本地数据文件或浏览器缓存中，正式部署前建议迁移到服务端密钥管理。

内容生成、风险识别和复盘建议会优先使用已配置的大模型 API：

- 内容生成调用 `POST /api/model-apis/run`，任务类型为 `内容生成`
- 风险识别调用 `POST /api/model-apis/run`，任务类型为 `风险识别`
- 复盘建议调用 `POST /api/model-apis/run`，任务类型为 `复盘建议`

如果没有可用模型配置、接口调用失败或返回格式异常，系统会自动回退到本地模板和规则逻辑，保证基础流程不被外部模型影响。

## 推送流程

如果当前仓库已配置 HRAssistant 远端：

```bash
npm run push:hrassistant
```

如果尚未配置远端：

```bash
git remote add origin <HRAssistant仓库地址>
npm run push:hrassistant
```

脚本会自动执行测试和构建，只有通过后才会推送当前分支。
