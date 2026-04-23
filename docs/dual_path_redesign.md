# 双路对比方案重设计

> 参考文献：[腾讯 LEGO Harness Engineering 实践](https://news.qq.com/rain/a/20260421A06DXU00)  
> 当前文件：`backend/internal/app/workflowtemplates/service.go` · `frontend/src/features/subtitle-translator/utils/workflow.ts`

---

## 一、文章核心机制与映射关系

文章中「多模型对抗式 CR」的本质是：

| 文章概念 | 本项目对应 |
|---|---|
| 多模型**并行独立**审查 | 两路候选并行翻译（已有） |
| **汇总**问题，交叉验证 | Judge 节点评估（已有，但是单次、无交叉） |
| **争议问题辩论**讨论 | ❌ 尚不存在 |
| 解决**确认偏差**（单模型倾向认同自己） | ❌ 当前 judge 没有隔离候选信息 |
| 解决**注意力盲区** | ❌ judge 提示词不要求覆盖所有维度 |
| 解决**知识盲区** | ❌ judge 是单模型，盲区无法互补 |

---

## 二、现有方案的根本缺陷

### 2.1 Judge 节点存在确认偏差

当前 judge 的输入是：**原文 + 候选 A + 候选 B**，由同一个 judge 模型一次性决策。

- 这与文章的批判点完全吻合：单模型 judge 有自己的「审美偏好」，会系统性地偏向某种风格
- 实践中发现：同一个模型同时扮演"翻译者"和"裁判"，极易产生确认偏差

### 2.2 `manual-review` 策略语义模糊

```
strategy: "manual-review"
```

当前这个 `strategy` 在执行层面没有对应的特殊逻辑——judge 阶段代码不分 strategy，统一走 `stage.type === 'judge'` 分支。strategy 字段目前是无意义的占位符。

### 2.3 Judge 失败时降级策略过于粗糙

```typescript
// 失败时直接降级到 candidateTracks[0]
const fallbackTexts = candidateTracks[0]?.texts ?? currentTexts;
```

整个批次失败就用候选 A 兜底，没有条目级别的置信度判断。

### 2.4 无法断点续跑 Judge 阶段

Judge 阶段没有像 translate 阶段那样的快照/恢复机制，如果 judge 中途失败，只能从头重跑整个 judge 阶段。

---

## 三、重设计目标

借鉴文章的「对抗式 CR」思路，将 judge 阶段从 **单次裁决** 升级为 **结构化对抗评审**：

```
两路候选翻译（已有）
        ↓
  [新] 独立多维评分
    ├── 评审 A：专注语义准确性 & 完整性
    └── 评审 B：专注自然流畅性 & 风格
        ↓
  [新] 交叉验证 & 置信度计算
    ├── 高置信（分数差 ≥ 阈值）→ 直接选胜者
    └── 低置信（争议条目）→ [新] 辩论轮次
        ↓
  [新] 争议辩论（可选）
    └── 第三方 judge 或同一 judge 读取争议理由后裁决
        ↓
      最终结果 + 条目级置信度标注
```

---

## 四、详细方案设计

### 4.1 模板配置层（`service.go`）

新增两种 judge 策略（`strategy` 字段升级为真正有语义的配置）：

```go
{
  ID:          "compare-and-judge",
  Name:        "双路对比（对抗式评审）",
  Description: "两路候选并行生成，双维度独立评审，争议条目进入辩论轮次。",
  Scenario:    "comparison",
  Stages: []domainworkflow.Stage{
    {
      ID: "translate", Name: "候选翻译",
      Type: "translate", Execution: "parallel", Strategy: "keep-all",
      Nodes: []domainworkflow.Node{
        {ID: "candidate-a", Label: "候选 A", Type: "translate", Enabled: true},
        {ID: "candidate-b", Label: "候选 B", Type: "translate", Enabled: true},
      },
    },
    {
      ID: "judge", Name: "对抗评审",
      Type: "judge", Execution: "parallel", Strategy: "adversarial",
      // 新增：并行两个评审维度节点
      Nodes: []domainworkflow.Node{
        {ID: "judge-accuracy",  Label: "准确性评审", Type: "judge", Enabled: true,
         Prompt: "你是翻译质量评审专家，专注于语义准确性和完整性..."},
        {ID: "judge-fluency",   Label: "流畅性评审", Type: "judge", Enabled: true,
         Prompt: "你是翻译质量评审专家，专注于译文的自然度和风格..."},
      },
    },
    {
      ID: "debate", Name: "争议仲裁（可选）",
      Type: "judge", Execution: "serial", Strategy: "tiebreak",
      Nodes: []domainworkflow.Node{
        {ID: "judge-tiebreak", Label: "仲裁节点", Type: "judge", Enabled: true},
      },
    },
  },
}
```

**新增 `domain/workflow/types.go` 字段：**

```go
type Node struct {
  // ... 已有字段
  Prompt   string         `json:"prompt"`   // 已有
  // 新增：
  JudgeDimension string  `json:"judgeDimension"` // "accuracy" | "fluency" | "tiebreak"
}

type Stage struct {
  // ... 已有字段
  // Strategy 升级语义：
  // "keep-all"    → 并行翻译保留所有结果（已有）
  // "adversarial" → 并行多维 judge，含置信度计算
  // "tiebreak"    → 争议仲裁（仅处理低置信条目）
}
```

---

### 4.2 执行层核心改动（`workflow.ts`）

#### 4.2.1 新增数据结构

```typescript
// 每个 judge 维度对每条条目的独立评分
export interface JudgeDimensionScore {
  nodeId: string;        // "judge-accuracy" | "judge-fluency"
  dimension: string;     // 人类可读维度名
  winner: string;        // "candidate-a" | "candidate-b" 候选 key
  score: number;         // 0-100 置信分
  reason: string;        // 评审理由（用于辩论轮次）
}

// 升级现有 WorkflowJudgeDecision
export interface WorkflowJudgeDecision {
  winner: string;
  reason: string;
  scores?: Record<string, number>;
  // 新增：
  confidence: number;          // 0-1，综合置信度
  dimensionScores?: JudgeDimensionScore[];  // 各维度打分详情
  isDisputed?: boolean;        // 是否进入辩论轮次
  debateReason?: string;       // 辩论结论
}
```

#### 4.2.2 新增 `adversarial` Judge 阶段

```typescript
// 对抗式 judge 阶段伪代码逻辑
if (stage.type === 'judge' && stage.strategy === 'adversarial') {

  // 1. 并行运行所有评审维度节点（类似 parallel translate 的模式）
  const dimensionResults = await Promise.all(
    nodes.map(async (node) => {
      // 每个节点独立评审，只关注自己的维度
      // 返回：每条字幕的 winner + score + reason
      return executeDimensionJudge(node, candidateTracks, entries, batches);
    })
  );

  // 2. 交叉验证：计算每条字幕的置信度
  const consolidatedDecisions = consolidateDimensionScores(dimensionResults, entries.length);
  //   - 所有维度一致 → 高置信，直接决策
  //   - 维度间存在分歧 → 低置信，标记为 isDisputed = true

  // 3. 分拣：将低置信条目收集，准备进入辩论阶段
  const disputedIndices = consolidatedDecisions
    .map((d, i) => (d.isDisputed ? i : -1))
    .filter(i => i >= 0);

  judgeDecisions = consolidatedDecisions;
  // ... 更新 currentTexts, selectedTrackByEntry
}
```

**`consolidateDimensionScores` 关键逻辑：**

```typescript
function consolidateDimensionScores(
  dimensionResults: DimensionJudgeResult[],
  count: number,
): WorkflowJudgeDecision[] {
  return Array.from({ length: count }, (_, idx) => {
    const scores = dimensionResults.map(r => r.decisions[idx]);
    const winners = scores.map(s => s?.winner).filter(Boolean);

    // 计算胜者一致性
    const winnerCounts = Object.fromEntries(
      [...new Set(winners)].map(w => [w, winners.filter(x => x === w).length])
    );
    const topWinner = Object.entries(winnerCounts).sort((a, b) => b[1] - a[1])[0];
    const agreementRatio = (topWinner?.[1] ?? 0) / dimensionResults.length;

    // 置信度 = 一致率 × 平均分
    const avgScore = scores.reduce((sum, s) => sum + (s?.score ?? 50), 0) / scores.length;
    const confidence = agreementRatio * (avgScore / 100);

    return {
      winner: topWinner?.[0] ?? candidateTracks[0]?.key ?? '',
      reason: scores.map(s => s?.reason).join(' | '),
      confidence,
      dimensionScores: scores,
      isDisputed: confidence < CONFIDENCE_THRESHOLD, // 默认 0.65
    };
  });
}
```

#### 4.2.3 新增 `tiebreak` 阶段（可选）

```typescript
if (stage.type === 'judge' && stage.strategy === 'tiebreak') {
  // 只处理上一个 judge 阶段标记为 isDisputed 的条目
  const disputedEntries = entries.filter((_, i) => judgeDecisions[i]?.isDisputed);

  if (disputedEntries.length === 0) {
    options.onLog('✅ 无争议条目，跳过仲裁阶段');
    continue;
  }

  options.onLog(`⚖️ 进入仲裁阶段，处理 ${disputedEntries.length} 条争议字幕`);

  // 对每批争议条目，携带争议理由，请求仲裁节点最终裁决
  // 仲裁 prompt 会包含：原文、候选A、候选B、各维度的评审理由
  const tiebreakDecisions = await executeTiebreak(node, disputedEntries, judgeDecisions, candidateTracks);

  // 将仲裁结果合并回 judgeDecisions
  mergeDisputedDecisions(judgeDecisions, tiebreakDecisions, disputedEntries, entries);
}
```

---

### 4.3 提示词工程（对应文章「反例免疫」和「领域知识」）

#### 评审节点 A：准确性维度

```
你是字幕翻译质量评审专家。你的职责是评估【语义准确性和完整性】。

请对以下每条原文，比较候选 A 和候选 B 的翻译，从准确性角度选出更优者：
- 是否忠实于原文语义，无遗漏、无增减
- 专有名词/角色名是否翻译准确
- 否定/条件句是否正确还原

输出格式（JSON数组，与输入条目数量严格一致）：
[{"winner": "candidate-a", "score": 85, "reason": "..."}]
```

#### 评审节点 B：流畅性维度

```
你是字幕翻译质量评审专家。你的职责是评估【自然流畅性和风格适配】。

从流畅性角度选出更优者：
- 是否符合中文表达习惯，无翻译腔
- 字幕时长限制下是否简洁
- 人物语气、场景氛围是否贴合

输出格式（JSON数组，与输入条目数量严格一致）：
[{"winner": "candidate-b", "score": 72, "reason": "..."}]
```

#### 仲裁节点

```
以下字幕存在翻译争议，各维度评审给出了不同建议。请结合全部评审意见，
给出最终裁决并说明综合权衡理由。

争议条目：{{disputedEntry}}
候选 A：{{candidateA}}
候选 B：{{candidateB}}
准确性评审意见：{{accuracyReason}}
流畅性评审意见：{{fluencyReason}}

输出：{"winner": "...", "reason": "...（综合权衡）"}
```

---

### 4.4 UI 展示层（`SubtitleTranslatorPage.tsx`）

新增「对抗评审」详情面板，展示每条字幕的：

```
条目 #42
  原文: 「ありがとう」
  候选 A: 谢谢
  候选 B: 感谢你
  ┌─────────────────────────────────┐
  │ 准确性评审 → 候选 A (85分)       │
  │ 原因: 更忠实于口语简短表达        │
  │                                 │
  │ 流畅性评审 → 候选 A (79分)       │
  │ 原因: 更符合字幕简洁风格          │
  │                                 │
  │ 综合置信度: 0.82 ✅ 无争议        │
  │ 最终选择: 候选 A                 │
  └─────────────────────────────────┘

条目 #67
  原文: 「バカ野郎」
  候选 A: 你这混蛋
  候选 B: 笨蛋！
  ┌─────────────────────────────────┐
  │ 准确性评审 → 候选 A (70分)       │
  │ 流畅性评审 → 候选 B (75分) ⚠️    │
  │ 综合置信度: 0.41 🔴 已进入仲裁   │
  │ 仲裁结论: 候选 B，场景更口语化   │
  └─────────────────────────────────┘
```

---

## 五、与现有代码的兼容性

| 改动位置 | 改动类型 | 向后兼容 |
|---|---|---|
| `workflow-types.ts` | 新增 `WorkflowJudgeDecision.confidence` 等字段 | ✅ 可选字段，不破坏旧数据 |
| `workflow.ts` | 新增 `adversarial` / `tiebreak` 分支 | ✅ 旧 `strategy` 值走旧分支 |
| `service.go` | 新增模板定义 | ✅ 旧模板不受影响 |
| `workflow-run-api.ts` | 序列化新字段 | ✅ 可选字段 |
| `SubtitleTranslatorPage.tsx` | 扩展评审详情 UI | ✅ 无候选时隐藏 |

---

## 六、实施路线（分阶段）

### Phase 1：基础重构（核心价值）
- [ ] 在 `workflow.ts` 中实现 `adversarial` strategy 的并行多维 judge
- [ ] `consolidateDimensionScores` 函数 + 置信度计算
- [ ] 更新 `WorkflowJudgeDecision` 类型，加 `confidence` / `dimensionScores`
- [ ] 在 `service.go` 注册新模板

### Phase 2：辩论机制
- [ ] 实现 `tiebreak` strategy 阶段
- [ ] 构建携带争议理由的仲裁 prompt
- [ ] 快照/续跑支持（对标 translate 阶段的 `batchIndex` 恢复机制）

### Phase 3：UI 可视化
- [ ] 条目级置信度徽章（高/中/低/争议仲裁）
- [ ] 展开查看各维度评审理由
- [ ] 统计面板：显示一致率分布、平均置信度

---

## 七、关键设计决策说明

> **为什么不直接引入三个 judge 而是两个？**
> 
> 文章是三模型各自独立（Claude/Codex/Gemini 完全不同模型），本项目的两个 judge 节点可以配置不同模型也可以配置相同模型但不同 prompt。两个维度（准确性/流畅性）已经覆盖了翻译质量的核心矛盾，三个会带来不必要的复杂度和 token 成本。

> **置信度阈值 0.65 的依据？**
> 
> 文章提到误报率 36%（9个问题里真实 P0 仅 1 个）。对于字幕翻译，保守设置阈值可以减少不必要的仲裁。0.65 意味着：两个维度一致且平均分 ≥ 65 分才直接通过，否则进入仲裁。此值应支持用户在 UI 中调整。

> **`tiebreak` 阶段设计为可选（`enabled: true/false`）？**
>
> 仲裁会显著增加 token 消耗和时间，对于质量要求不极端的场景，关闭仲裁阶段、仅保留置信度标注供人工参考是更经济的选择。这与文章「约束」层面「阻塞顺序」的思路一致。
