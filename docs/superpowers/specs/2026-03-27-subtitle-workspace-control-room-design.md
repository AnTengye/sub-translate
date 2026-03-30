# Subtitle Workspace Control Room Design

## Summary

本次重构将字幕翻译前端从当前的浅色卡片式桌面工作区，升级为以 `docs/superpowers/subtitle-translator-ui.html` 为主参考的深色控制台工作台。目标不是单纯换肤，而是同步重组信息架构、操作路径和视觉系统：左侧只保留配置，右侧统一承担执行与结果，`Provider Center` 与上传页也统一到同一套设计语言。

## Goals

- 以新设计稿为主，重构上传页、主翻译工作台和 `Provider Center`
- 收拢操作按钮，避免左右两侧同时存在主要动作区
- 保留现有翻译状态管理、Provider API、结果导出与重试能力
- 提升信息层次、状态反馈和整体产品感
- 保证桌面优先，同时兼容平板和手机

## Non-Goals

- 不改动后端翻译接口协议
- 不新增新的翻译能力或 provider 类型
- 不重写 reducer、translation controller 的核心业务流
- 不引入新的大型 UI 框架

## User Experience Direction

### Overall Tone

界面采用深色技术控制台方向，强调“工作流可控”和“状态可见”。视觉上使用深蓝黑底色、冷青绿色强调、精简描边和局部辉光，保留设计稿中的仪表盘感，但不机械照搬静态稿中的每个展示块。

### Core Interaction Principle

全局主操作只出现在右侧内容区顶部工具条。左侧为纯配置区，字幕卡片仅保留必要的单条重试按钮，不再承载全局动作。这样用户在任何阶段都能明确知道“操作去哪里做、结果去哪里看”。

## Information Architecture

### Upload Page

- 顶部保留品牌与产品定位文案
- 主体为大号上传面板，支持点击和拖拽
- 辅以能力标签与简短说明，建立与工作台一致的控制台视觉语言
- 上传成功后进入主工作台，不再出现风格突变

### Main Workspace

- 顶部状态栏
  - 品牌标识
  - 当前文件名
  - 当前 Provider/Profile 摘要
  - 总进度条与阶段状态
  - `Provider Center` 入口
- 左侧配置轨
  - 文件摘要
  - 翻译引擎选择
  - 翻译参数调节
  - 不放主操作按钮
- 右侧主工作区
  - 顶部统一工具条
  - 可折叠实时日志
  - KPI 状态卡片
  - 结果筛选条
  - 字幕列表

### Provider Center

- 作为深色控制台弹层/抽屉式管理界面
- 左侧为 provider/profile 列表与新建入口
- 右侧为当前 profile 的详细配置、模型管理、连接检测和保存
- 保存与检测动作固定在详情区单一位置

## Layout Decisions

### Desktop

- 采用 `260-320px` 左栏 + 弹性右主区的双栏布局
- 顶部全局状态栏固定在页面顶部
- 右侧内容区内部允许纵向滚动

### Tablet

- 顶部状态栏保留
- 左侧配置栏缩窄或折叠为顶部二级面板
- 工具条仍固定在结果区顶部

### Mobile

- 切换为单列
- 配置区域折叠进独立面板
- 主操作条仍作为唯一全局操作入口

## Visual System

### Tokens

- 背景层级：近黑主背景、深灰蓝次级面板、略亮的交互面板
- 语义色：
  - primary/accent: 冷青绿
  - success: 绿色
  - warning: 琥珀色
  - danger: 红色
- 边框：低透明白边框 + 强调态色边
- 阴影：弱外阴影 + 局部辉光
- 圆角：中小圆角，整体比当前更克制

### Typography

- 标题与数字使用更有技术感的展示字体
- 正文使用高可读中文无衬线
- 模型名、时间、参数值使用等宽字体

### Motion

- 进度条扫光
- 面板展开/折叠
- 按钮 hover/focus
- 列表项状态色过渡
- 支持 `prefers-reduced-motion`

## Component Changes

### `SubtitleTranslatorPage`

- 负责新骨架布局：状态栏、配置栏、主工作区
- 汇总派生状态并向子组件传递新的展示 props
- 不改变现有翻译与 provider-center 数据流

### `ProviderPanel`

- 改为纯配置组件
- 删除主操作区和日志块
- 增强 provider/profile 摘要展示

### `TranslationPanel`

- 升级为右侧主工作台容器
- 接收统一工具条、日志、指标卡片、筛选栏和列表内容

### `ResultToolbar`

- 升级为唯一全局操作条
- 合并开始、取消、下载、批量重试、重新翻译、重新上传、打开 Provider Center
- 根据 `step` 和 retry 状态切换动作集合

### `SubtitleList`

- 保留单条重试
- 调整为更高密度、更偏控制台结果卡片的视觉结构

### `ProviderCenter`

- 改造为左右结构的控制台管理界面
- 复用现有状态编辑和 API 行为
- 视图层按 profile 导航与详情面板重新分区

### New Supporting Components

- `WorkspaceHeaderBar` 或同类状态栏组件
- `ActivityConsole` 日志组件
- 可选的 `MetricStrip`/`KpiCards` 组件

## State and Data Flow

- 继续使用现有 reducer 管理文件、步骤、日志、结果列表、筛选状态
- 继续使用 `useTranslationController` 作为翻译执行入口
- 继续通过 `provider-center-api` 与服务端同步 provider 数据
- UI 重构主要发生在派生展示和组件职责重分配，不引入新的全局状态管理

## Testing Strategy

- 更新现有 `SubtitleTranslatorPage.test.tsx`，覆盖：
  - 上传后进入新工作台骨架
  - 操作按钮仅在统一工具条出现
  - 打开 `Provider Center` 的入口仍可用
- 为关键条件渲染补充组件测试：
  - `ResultToolbar` 在不同步骤下的动作显示
  - 日志面板的默认展开/收起行为
- 保留现有 provider-center API 与 reducer 测试

## Risks

- 样式改动范围大，容易影响已有测试选择器
- `Provider Center` 组件体量较大，重排时容易引入回归
- 深色主题若 token 不统一，容易出现局部旧样式残留

## Mitigations

- 先通过测试锁定新骨架与操作区约束
- 尽量复用现有业务 props 和行为，降低逻辑回归风险
- 将新样式 token 集中在 `globals.css` 或清晰的样式分区中管理

## Acceptance Criteria

- 上传页、主工作台、`Provider Center` 均切换到新的深色控制台语言
- 主操作按钮仅集中在右侧内容区顶部工具条
- 左侧仅保留配置，不再有主动作按钮和日志
- 现有上传、开始翻译、取消、重试、下载、Provider Center 保存能力均可用
- `docker compose up --build` 后可在浏览器中完成基本验收流程
