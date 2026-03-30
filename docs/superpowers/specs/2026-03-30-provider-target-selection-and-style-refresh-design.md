# Provider Target Selection And Style Refresh Design

## Goal

让主翻译 provider 与失败备选 provider 都能独立选择“已配置、已检测通过、且带有可用模型”的具体目标，并将翻译参数收敛为默认精简模式加浮动高级参数面板，同时系统性修复翻译工作区与 Provider Center 的样式问题。

## Current Problems

- 主翻译页当前只维护单一 `provider` family，备选 provider 只是按 family 轮换，无法精确到具体配置和模型。
- 主翻译页直接展示过多参数，展开额外配置会挤压原有布局。
- 页面交互控件与展示卡片职责混杂，样式在桌面和窄屏下都存在可读性与层级问题。

## Target Interaction

### Translation Targets

主翻译页维护两个独立执行槽位：

- `primaryTarget`
- `fallbackTarget`

每个槽位都包含：

- `family`
- `profileId`
- `modelId`

候选项只来自满足以下条件的 profile：

- `enabled === true`
- `health.status` 为通过态
- `models` 中存在 `enabled === true` 的模型

主槽位和备选槽位不能指向同一组 `profileId + modelId`。当保存后的 provider 数据导致冲突时，优先保留主槽位，备选槽位自动切换到下一个可用候选；若不存在候选，则置空并在 UI 中明确提示。

### Translation Parameters

左侧“翻译参数”默认仅展示：

- 每批次数量
- 上下文数量

其余参数归入“高级参数”浮层。浮层使用绝对定位/固定定位叠层，不占用布局高度，不允许因为展开而推动侧栏、结果面板或页面整体发生位移。

### Styling Direction

本次统一修复以下问题：

- 侧栏表单控件、按钮、选择器的尺寸、边框、焦点态和禁用态不统一
- Provider 卡片既像按钮又像信息面板，交互语义不清
- Provider Center 与主工作区存在不同层级的圆角、间距和表单风格
- 移动端与中等宽度下布局断裂、换行拥挤、信息块高度不一致

## Data Model Changes

`SubtitleTranslatorState` 增加显式目标选择：

- `primaryTarget`
- `fallbackTarget`
- `targetOptions` 或等效派生逻辑，用于从 `providerCenter` 计算可选目标
- `advancedParamsOpen`

删除或弱化当前依赖单一 family 的字段：

- `provider`
- `activeProfileId`
- `providerConfig`

如果兼容性要求仍需短期保留旧字段，则仅作为过渡派生值，不再作为真实状态源。

## Runtime Behavior

翻译启动时使用 `primaryTarget` 的：

- provider family
- profileId
- selected model
- profile connection/settings

失败重试策略：

- 常规翻译批次先按主目标执行
- 当主目标调用失败时，切换到备选目标重新派发该批次
- 若备选目标为空，则沿用现有失败处理

构建运行时配置时，模型值以槽位选中的 `modelId` 为准，而不是 family 当前默认模型。

## UI Structure

### Sidebar

- 精简参数卡片
- 浮动“高级参数”触发按钮
- 主 Provider 选择卡
- 失败备选选择卡
- 开始翻译按钮

Provider 选择卡内部使用稳定表单：

- 配置选择下拉
- 模型选择下拉
- 配置摘要信息

### Provider Center

延续现有结构，但样式同步到新的控件体系：

- 列表项间距和状态标签统一
- 输入框和按钮对齐
- 弹层、次弹层、模型管理面板的遮罩和滚动处理统一

## Testing

新增或更新测试覆盖：

- 只允许从通过检测且有模型的配置中选择主/备选目标
- 主/备选目标可分别选择不同配置和模型
- 主/备选目标不能选择相同组合
- 高级参数默认折叠，展开后以浮层形式出现
- 启动翻译时请求使用主目标的 `profileId` 与 `model`
- 主目标失败时使用备选目标发起翻译
- 样式文件包含防止 checkbox 被通用输入样式污染、浮层定位和响应式修正
