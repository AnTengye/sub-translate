# Subtitle Workflow Templates Design

## Goal

把现有“单主模型 + 失败备选”字幕翻译流程升级为“模板中心的阶段式工作流”，支持：

- 常规字幕生产：主翻译失败补偿 + 校对
- 字幕效果比对：多模型并行翻译 + 评估推荐 + 成品导出
- 模板可复用、可编辑、可保存

首版明确不做任意 DAG，不做按字幕片段分流的规则引擎。

## Design Principles

- 阶段优先，不做自由连线。阶段之间串行，阶段内部允许并行节点。
- 模板中心。用户先选模板，再按本次任务微调节点目标和策略。
- 半自动评估。`judge` 节点给出评分、理由和推荐结果，最终导出前允许人工确认。
- 保持现有 Provider Center 体系。节点只引用 Provider Profile + Model，不复制 Provider 配置。
- 优先改造现有前后端交互，而不是推翻架构重写服务端。

## Workflow Model

### Template

模板由多个 stage 组成：

- `translate` stage
- `judge` stage
- `review` stage

模板保存以下信息：

- `id`
- `name`
- `description`
- `scenario`
- `stages`

### Stage

每个阶段都包含：

- `id`
- `name`
- `type`
- `execution`
- `strategy`
- `nodes`

约束如下：

- `translate` stage
  - `execution`: `serial` 或 `parallel`
  - `strategy`: `fallback` 或 `keep-all`
  - 允许 1..N 个翻译节点
- `judge` stage
  - `execution`: `serial`
  - `strategy`: `manual-review`
  - 首版仅允许 1 个评估节点
- `review` stage
  - `execution`: `serial`
  - `strategy`: `replace-current`
  - 允许 1..N 个校对节点，按顺序串行润色

### Node

节点包含：

- `id`
- `label`
- `type`
- `enabled`
- `target`
- `prompt`

其中 `target` 复用现有 Provider 选择模型：

- `family`
- `profileId`
- `modelId`

## Supported Scenarios

### Scenario A: 常规字幕翻译

```text
Translate Stage
  Node A: 主翻译
  Node B: 补偿翻译
  execution = serial
  strategy = fallback

Review Stage
  Node C: 校对
```

运行规则：

- Node A 先处理整批字幕
- A 失败的条目交给 Node B 补充
- 合并后结果交给 Node C 校对
- 输出最终字幕

### Scenario B: 字幕效果比对

```text
Translate Stage
  Node A: 候选翻译 A
  Node B: 候选翻译 B
  execution = parallel
  strategy = keep-all

Judge Stage
  Node C: 评估推荐
  strategy = manual-review
```

运行规则：

- Node A / B 并行生成完整候选
- Judge 节点对每条字幕做推荐
- 前端保留 A/B 候选、推荐结果和理由
- 用户可接受推荐或手动切换候选
- 输出评价摘要和成品字幕

## Backend Design

### New API

- `GET /api/workflow-templates`
- `PUT /api/workflow-templates`

后端负责：

- 返回模板列表
- 保存模板列表
- 为新环境提供默认模板种子

模板持久化采用 JSON 文件，默认路径为 `data/workflow_templates.json`。这比引入新的表结构更轻，足以覆盖首版模板中心能力。

### Translation Endpoint Extension

保留现有 `/api/translate/:provider`，但扩展请求能力以支持 workflow 节点：

- `operation`: `translate` | `review` | `judge`
- `draftTexts`: review 节点当前稿
- `candidateSets`: judge 节点候选结果

返回仍保持 `translations`，并新增 `metadata`：

- review: 可为空
- judge: 返回每条字幕的推荐 key、理由、分数

### Logging

翻译 run 日志扩展记录：

- 模板快照
- stage / node 执行摘要
- judge 决策结果摘要

现有 batch log 机制继续复用，不新增独立日志系统。

## Frontend Design

### Page Structure

工作区改为以下布局：

- Header
- Sidebar: workflow template editor
- Main:
  - metrics
  - workflow activity
  - result switcher / decision summary
  - subtitle preview

### Sidebar

首屏配置区替换为：

- 模板选择器
- 模板保存按钮
- stage 列表
- 每个 stage 的 execution / strategy 控件
- translate stage 节点列表
- 节点 target 选择器
- 添加 / 删除翻译节点

### Result Area

运行完成后展示：

- 最终字幕列表
- 候选路径摘要
- judge 推荐摘要
- 当前导出基于哪一路结果

当存在 judge 输出时，用户可按条目选择：

- 使用推荐候选
- 手动切换为其它候选

### State Model

前端状态新增：

- `workflowTemplates`
- `activeTemplateId`
- `workflowDraft`
- `workflowRun`
- `candidateTracks`
- `judgeDecisions`
- `selectedTrackByEntry`

旧的 `primaryTarget` / `fallbackTarget` 从页面主流程状态中移除。

## Execution Model

### Translate Stage

- `serial + fallback`
  - 节点顺序执行
  - 后续节点只处理前序失败条目
  - 输出单一路当前结果
- `parallel + keep-all`
  - 节点并行处理全部条目
  - 输出多路候选结果

### Judge Stage

- 输入：源字幕 + 多路候选
- 输出：
  - 推荐候选 key
  - 理由
  - 可选分数
- 前端据此生成默认选中路径，但不锁死

### Review Stage

- 输入：当前选中的中文字幕
- 输出：润色后的中文字幕
- 支持多个 review 节点串行覆盖

## Error Handling

- 单节点失败时，记录到 activity 和 node 状态
- `serial + fallback` 下，只把失败条目传给后续节点
- `parallel + keep-all` 下，某一路失败不阻断其它候选
- judge 节点失败时，不丢弃已有候选，前端退回人工比较模式
- review 节点失败时，保留上一阶段的当前结果

## Testing Strategy

### Backend

- workflow templates repository 读写测试
- HTTP routes for `GET/PUT /api/workflow-templates`
- translate endpoint for `review` / `judge` payloads
- judge metadata shape test

### Frontend

- workflow template loading and saving
- template editor node add/remove
- scenario A execution: serial fallback + review
- scenario B execution: parallel translate + judge recommendation + manual override
- final export based on selected output

### Full Flow

至少验证：

1. 前端读取模板
2. 用户编辑模板节点
3. 保存到后端
4. 导入字幕
5. 执行 workflow
6. 展示 judge/review 结果
7. 导出成品字幕

## Non-Goals

- 任意 DAG 连线编辑器
- 片段级条件分流
- 多模板协同运行
- 后端集中执行整个 workflow 引擎
- 首版数据库化模板管理
