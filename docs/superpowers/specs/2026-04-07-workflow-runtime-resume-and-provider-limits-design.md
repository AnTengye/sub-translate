# Workflow Runtime Resume And Provider Limits Design

## Goal

在现有字幕工作流基础上补齐三类能力：

- Provider Center 支持全局、Profile、Model 三层 RPM / RPD 配置，未配置时逐层回退，最终为空表示不限流。
- 翻译运行中记录限流触发事件；同一节点连续达到阈值时将节点视为处理中断，停止继续报错并允许后续恢复。
- 工作流支持暂停、导出、导入与继续执行；导出文件自包含原始字幕内容与运行现场，导入后无需重新上传字幕。

## Design Principles

- 优先扩展现有模板式工作流与批处理架构，不引入新的调度引擎。
- 运行时数据与模板定义分离：模板是长期配置，run snapshot 是一次执行现场。
- 恢复粒度固定为批次级，避免条目级回放带来的高复杂度。
- 限流配置采用显式覆盖链，语义清晰且与 UI 表达一致。
- 所有持久化格式保持 JSON，先保证可读、可测、可迁移。

## Provider Limit Model

### Layered Limit Settings

Provider Center 新增三层限额字段：

- Global
  - `globalRpmLimit`
  - `globalRpdLimit`
  - `rateLimitInterruptThreshold`
- Profile
  - `rpmLimit`
  - `rpdLimit`
- Model
  - `rpmLimit`
  - `rpdLimit`

字段语义：

- 空字符串或 `0` 视为“未配置”，继续向上回退。
- 生效优先级：Model > Profile > Global。
- Global 也未配置时，视为不限流。
- `rateLimitInterruptThreshold` 未配置时默认 `3`。

### Data Shape

后端 `providercenter.State` 新增全局 limits 字段；`Profile` 与 `Model` 增加 `RpdLimit`，`Profile` 增加 `RpmLimit` / `RpdLimit`。

前端 `ProviderCenterStateData` 同步扩展并在 API normalize 阶段保证缺省结构稳定。

### UI Behavior

配置中心新增：

- 全局限流卡片：默认 RPM、默认 RPD、限流中断阈值。
- Profile 级限流字段：显示“留空则继承全局”。
- Model 管理对话框补充 RPM / RPD 字段：显示“留空则继承 Profile / 全局”。
- 每个输入旁展示当前生效来源提示，例如：
  - `当前生效：模型覆盖`
  - `当前生效：继承 Profile`
  - `当前生效：继承全局`
  - `当前生效：不限`

## Rate Limit Interruption Handling

### Resolution Rules

翻译请求在发起前解析目标节点的有效限额：

1. 从 node target 定位到 profile 与 model。
2. 解析有效 RPM / RPD。
3. 若解析结果都为空，跳过限流等待。
4. 若配置了 RPM / RPD，则分别调用限流器。

### RPD Support

现有 `ratelimiter` 只处理 RPM，需要扩展成同时支持：

- 每分钟窗口计数
- 每日窗口计数

接口可升级为接收结构体参数，例如：

- `Wait(ctx, key, LimitWindow{RPM, RPD})`

key 仍以 `profileID:modelID` 为主，确保限制粒度绑定到实际节点目标。

### Trigger Recording

每次限流命中都记录事件到 run activity log：

- `type = rate_limit_hit`
- `stageId`
- `nodeId`
- `batchIndex`
- `window = rpm | rpd`
- `limit`
- `message`

### Interruption Rule

同一 run、同一 stage/node 连续命中限流达到阈值后：

- node runtime 状态变为 `interrupted`
- run 状态变为 `paused-interrupted`
- 写入 activity log：`node_interrupted`
- 停止后续批次调度

“连续”的定义：

- 节点成功完成一个批次后，其连续命中计数清零。
- 如果在没有成功完成任何后续批次前再次命中，则继续累加。

## Workflow Run Snapshot

### Separation From Templates

模板仍保存在 `workflow_templates.json`。

新增 `workflow_runs.json`（或等价单文件存储）保存运行态列表。首版采用单文件列表，避免额外文件管理复杂度。

### Run Snapshot Structure

每个 run 包含：

- `id`
- `sourceRunId`，仅导入后生成的新 run 使用
- `status`
- `templateSnapshot`
- `runtimeConfig`
  - `batchSize`
  - `contextLines`
  - `temperature`
- `subtitleSource`
  - `fileName`
  - `format`
  - `rawContent`
  - `entries`
- `progress`
  - `totalBatches`
  - `completedBatches`
  - `currentBatchIndex`
- `batchResults`
  - 每批最终输出
  - 候选摘要
  - judge 摘要
- `nodeRuntime`
  - `stageId`
  - `nodeId`
  - `status`
  - `consecutiveRateLimitHits`
  - `lastError`
- `activityLog`
- `createdAt`
- `updatedAt`
- `pausedAt`
- `completedAt`

### Snapshot Statuses

- `running`
- `paused`
- `paused-interrupted`
- `completed`
- `failed`
- `cancelled`

`paused` 表示用户主动暂停。
`paused-interrupted` 表示系统因限流连续命中而中断。

## Pause / Resume Semantics

### Pause

用户点击暂停后：

- 不取消已发出的单次翻译请求。
- 当前批次完成后立即持久化 snapshot。
- run 状态置为 `paused`。

这样可以保证恢复点总在批次边界，避免半批次数据不一致。

### Resume

恢复时：

- 已完成批次直接复用 `batchResults`。
- 从 `currentBatchIndex` 对应的下一个未完成批次继续。
- 如果中断发生在当前批次处理中，则该批次整体重跑。
- `paused-interrupted` 恢复前允许用户先调整 provider 配置或修改节点 target。

## Import / Export Semantics

### Export

导出的是“可恢复运行包”，而不是模板。

导出 JSON 包含：

- `version`
- `exportedAt`
- `run`

其中 `run` 为完整 run snapshot，必须自包含：

- 原始字幕文件名
- 原始字幕内容
- 已解析字幕条目
- 模板快照
- 运行参数
- 进度
- 中间结果
- 活动日志

### Import

首页提供导入入口，用户导入导出包后：

- 校验版本和基本结构
- 直接恢复字幕内容与运行态
- 无需重新上传源字幕文件
- 导入后的本地 run 生成新 `id`
- 原始 `run.id` 记录到 `sourceRunId`

## API Design

### Provider Center

- `GET /api/provider-center`
- `PUT /api/provider-center`

仅扩展返回与保存的数据结构，无需新增独立接口。

### Workflow Runs

新增接口：

- `GET /api/workflow-runs`
- `GET /api/workflow-runs/:id`
- `POST /api/workflow-runs`
- `PUT /api/workflow-runs/:id`
- `POST /api/workflow-runs/:id/resume`
- `POST /api/workflow-runs/import`
- `GET /api/workflow-runs/:id/export`

首版可在实现上做适度简化：

- `POST /api/workflow-runs` 创建新 run
- `PUT /api/workflow-runs/:id` 保存快照
- `POST /api/workflow-runs/import` 导入快照
- `GET /api/workflow-runs/:id/export` 导出快照

Resume 也可以通过读取 run 再在前端触发执行，不强制单独后端动作。

## Frontend Design

### Homepage Entry

首页上传区调整为双入口：

- 上传字幕并开始新工作流
- 导入工作流快照并继续

导入成功后直接进入工作区，并填充：

- 字幕列表
- 模板快照
- 活动日志
- 当前进度
- 已完成结果

### Workspace Controls

工作流侧栏增加：

- `暂停`
- `继续`
- `导出工作流`

当存在 `paused` 或 `paused-interrupted` run 时，工作区显示状态标识与恢复按钮。

### Activity Console

新增事件展示：

- 限流命中
- 节点中断
- 用户暂停
- 导入恢复
- 导出

## Backend Execution Changes

现有 workflow 执行路径需要扩展：

- 启动 run 时创建 snapshot
- 每完成一个批次后保存 snapshot
- 每次限流事件记录 activity
- 每个节点维护 runtime 状态
- 停止条件支持 `paused` 与 `paused-interrupted`

翻译服务在调用 provider translator 前做有效限额解析；限流器返回命中信息后由 workflow controller 决定是否累计并中断。

## Testing Strategy

### Backend

- provider center service / repository：
  - 新字段读写与默认值
  - 空值回退行为
- rate limiter：
  - RPM 窗口
  - RPD 窗口
  - 双窗口并存
- translate service：
  - model/profile/global 的回退解析
  - 不限流时跳过等待
- workflow run service：
  - 创建、保存、导入、导出
  - 批次级恢复
  - 连续限流中断

### Frontend

- provider-center-api normalize 新字段
- Provider Center 组件显示与编辑三层限额
- 首页上传区导入入口
- workflow run API
- 页面状态恢复
- 暂停/继续/导出按钮交互

## Migration Notes

- 旧 provider center 数据缺少新字段时自动补默认空值。
- 旧 workflow template 数据无需迁移。
- 没有 workflow run 文件时返回空列表。
