# Plan: 全面优化前后端日志系统

## 问题分析

### 问题 1: 前端实时日志信息过于简略
**当前状态**: `workflow.ts:115` 中工作流节点执行完成后只输出 `节点 ${node.label} 已执行`（如 "节点 主翻译 已执行"），没有任何上下文信息（如处理了多少条字幕、使用了什么 provider、耗时等）。

**根因**: 
- `workflow.ts` 的 `executeWorkflowTemplate()` 函数在执行节点时只在完成后记一条日志
- 没有在节点执行前记录"开始"日志
- 没有传递节点执行的元数据（条目数、provider 等）回来
- `handleStartWorkflow()` 在 `SubtitleTranslatorPage.tsx` 中也没有补充开始/结束的总结日志

### 问题 2: 展开/收起日志按钮失效
**当前状态**: `ActivityConsole.tsx` 中的 toggle 按钮在视觉上可能工作，但因为 CSS 布局问题导致看不到效果：
- `.log-panel` 设置了 `overflow: hidden`（`globals.css:766`）
- `.log-body` 在 collapsed 态用 `max-height: 132px`，expanded 态用 `max-height: min(42vh, 360px)`
- 但由于 `.log-panel` 自身没有弹性高度且父容器 `.content` 使用 `overflow-y: auto`，展开时日志面板高度可能无法撑开，导致 `overflow: hidden` 裁剪了内容

### 问题 3: Docker 容器日志不详细
**当前状态**: 后端 `server.go` 中仅用 Go `log.Printf` 输出简略的 HTTP 请求日志和翻译操作日志：
- `[HTTP] POST /api/translate/openai-compatible - 200 (1.2s)` 
- `[Translate] Starting translation - Run: xxx, Provider: openai-compatible, Entries: 20, Operation: translate`
- `[Run] Created Run: xxx, file: xxx, total entries: 100`

日志缺少：任务整体进度、当前是第几批/共几批、翻译成功/失败数等关键信息。

---

## 实施计划

### Task 1: 修复展开/收起日志按钮 (CSS)
**文件**: `frontend/src/styles/globals.css`

**变更**:
1. 将 `.log-panel` 的 `overflow: hidden` 改为 `overflow: visible`，或者更好的方案是：让 `.log-panel` 不限制高度，只让 `.log-body` 自己控制滚动
2. 确保 `.log-body.expanded` 的 `max-height` 能正确生效，增加足够的展开空间
3. 为展开/收起添加平滑过渡动画

具体修改：
- `.log-panel`: 移除 `overflow: hidden`，改为默认不限制 overflow
- `.log-body`: 保留 `max-height: 132px; overflow-y: auto`（collapsed 态）
- `.log-body.expanded`: 将 `max-height` 增大到 `min(60vh, 500px)` 并添加 `transition: max-height 0.3s ease`

### Task 2: 增强前端工作流日志详情
**文件**: `frontend/src/features/subtitle-translator/utils/workflow.ts`

在 `executeWorkflowTemplate()` 中增加更详细的日志：

**Stage 开始/结束日志**:
```
[阶段 1/2] 主翻译与补偿 — 串行容错策略
```

**节点执行前日志**:
```
  ▶ 节点「主翻译」开始执行 (待翻译 100 条)
```

**节点执行后日志（带统计）**:
```
  ✓ 节点「主翻译」完成 — 成功 95 条，失败 5 条，耗时 12.3s
```

**Fallback 场景**:
```
  ⚠ 节点「主翻译」仍有 5 条失败，继续下一节点「补偿翻译」
```

**具体变更**:
- 在每个 stage 循环开始时记录 stage 信息（阶段序号、名称、类型、策略）
- 在每个 node 执行前记录开始日志（节点名称、待处理条目数）
- 在每个 node 执行后记录完成日志（成功/失败数、耗时）
- 为 fallback 策略记录剩余失败数

**文件**: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.tsx`

在 `handleStartWorkflow()` 中增加：
- 工作流开始时的总结日志：`🚀 开始执行工作流「质量优先」— 共 100 条字幕`
- 工作流完成时的总结日志：`✅ 工作流执行完成 — 成功 98 条，失败 2 条，总耗时 45.2s`
- 工作流失败时的错误日志：`❌ 工作流执行失败: <错误信息>`

### Task 3: 增强前端 translation.ts 的日志详情
**文件**: `frontend/src/features/subtitle-translator/utils/translation.ts`

在 `runTranslation()` 中：
- 开始时增加：`🚀 开始翻译任务 — 共 ${total} 条字幕，批次大小 ${batchSize}`
- 每个批次完成后增加成功/失败统计：`📝 翻译 1–20 / 100 — 本批 20 条成功`（或 `本批 18 条成功，2 条失败`）
- 批次出错时记录更多上下文（哪些条目受影响）

在 `runRetry()` 中：
- 开始时增加：重试哪些条目
- 每个批次完成后增加统计

### Task 4: 增强后端 Docker 日志
**文件**: `backend/internal/transport/http/server.go`

增强翻译 API 的日志输出：
- 翻译请求增加 batch 序号信息：`[Translate] Batch 3/5 — Run: xxx, Provider: openai-compatible, Entries: 20`
- 翻译完成增加耗时和结果摘要：`[Translate] Batch 3/5 completed — Run: xxx, Translated: 20, Duration: 1.2s`
- Run 创建时增加更多上下文：`[Run] Created — ID: xxx, File: test.srt, Mode: translate, Entries: 100`
- Run 完成时增加摘要：`[Run] Finalized — ID: xxx, Status: completed, Summary: {translatedCount: 100}`

**文件**: `backend/internal/app/translate/service.go`

在 `Translate()` 方法中增加日志：
- 开始翻译：`[Translate] Acquiring semaphore for Run: xxx, Provider: openai-compatible`
- 获取信号量后：`[Translate] Semaphore acquired, resolving profile...`
- Provider 解析完成：`[Translate] Using provider: openai-compatible, profile: xxx`

### Task 5: ActivityConsole 组件增强
**文件**: `frontend/src/features/subtitle-translator/components/ActivityConsole.tsx`

1. 添加自动滚动到底部功能 — 新日志追加时，如果用户没有手动向上滚动，自动滚动到最新日志
2. 增加日志条数显示：`实时运行日志 (23 条)`
3. 增加 "error" tone 类型以匹配 `❌` 开头的错误日志

### Task 6: 前端 types 扩展（如需要）
**文件**: `frontend/src/features/subtitle-translator/types.ts`

`TranslationLogEntry` 可能需要增加 `level` 字段用于更精确的日志级别控制（可选，如果 message-based tone 检测已经足够则不需要）。

---

## 变更摘要

| 文件 | 变更类型 | 描述 |
|------|----------|------|
| `frontend/src/styles/globals.css` | 修复 | 修复展开/收起按钮 CSS 布局问题 |
| `frontend/src/features/.../ActivityConsole.tsx` | 增强 | 自动滚动、日志条数、错误识别 |
| `frontend/src/features/.../utils/workflow.ts` | 增强 | 工作流各阶段/节点详细日志 |
| `frontend/src/features/.../utils/translation.ts` | 增强 | 翻译批次详细统计日志 |
| `frontend/src/features/.../SubtitleTranslatorPage.tsx` | 增强 | 工作流开始/完成总结日志 |
| `backend/internal/transport/http/server.go` | 增强 | HTTP 层日志增加 batch 序号和耗时 |
| `backend/internal/app/translate/service.go` | 增强 | 翻译服务层增加执行阶段日志 |

## 实施顺序

1. **Task 1** — 先修复展开/收起按钮（立即可验证）
2. **Task 5** — 增强 ActivityConsole 组件（自动滚动等）
3. **Task 2** — 工作流日志增强（核心改进）
4. **Task 3** — translation.ts 日志增强
5. **Task 4** — 后端日志增强
6. Task 6 只在需要时实施

## 验证方法

1. 修复后点击"展开日志/收起日志"按钮，确认面板正确展开和收起
2. 运行一次翻译任务，确认前端日志面板显示详细的阶段、节点、批次信息
3. 查看 Docker 容器日志（`docker logs`），确认后端输出包含更详细的翻译进度信息
4. 运行 `npm run test` 和 `go test ./backend/...` 确保不影响已有测试
