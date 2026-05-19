# 招聘运营助手 HRAssistant

招聘运营助手是一个面向招聘团队的新媒体招聘运营系统原型，覆盖 PRD 中的一期核心闭环：招聘需求、AI 内容生成、风险识别、审核流转、排期发布、平台账号、素材资产、数据看板、复盘报告和系统配置。

## 功能范围

- 工作台：内容发布、曝光互动、招聘入口点击、目标进度和风险待办
- 招聘需求：岗位、族群、目标平台、北森/官网入口
- 内容运营：AI 多平台内容生成、风险扫描、内容任务创建、审核状态推进
- 素材资产：素材库、授权记录、采集表、模板库和案例库
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

本地持久化 API：

```bash
npm run api
```

另开一个终端运行前端：

```bash
npm run dev
```

也可以使用组合命令：

```bash
npm run dev:full
```

前端会优先连接 `http://localhost:8787/api/data`。如果本地 API 没启动，会自动回退到浏览器 `localStorage`，页面左下角会显示当前存储模式。

本地 API 默认账号：

```text
账号：admin
密码：HRAssistant@2026
```

首次启动 `npm run api` 时会在 `data/hr-assistant-auth.json` 中创建本地管理员。该文件已被 `.gitignore` 排除，不会提交账号信息。

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

当前测试逻辑按 OpenAI-compatible `/models` 接口验证连通性。API Key 只保存在本地数据文件或浏览器缓存中，正式部署前建议迁移到服务端密钥管理。

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
