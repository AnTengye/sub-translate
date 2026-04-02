# SubLingo UI Specification
> Version: 1.0 | Theme: Dark | Framework-agnostic

---

## 1. Design Tokens

### 1.1 Color Palette

```json
{
  "colors": {
    "bg":        "#0d0f14",
    "surface":   "#13161e",
    "surface2":  "#1a1e2a",
    "surface3":  "#212636",
    "border":    "#2a2f40",
    "border2":   "#353b50",

    "accent":    "#00e5c0",
    "accent2":   "#00b8ff",
    "accent3":   "#7c6dfa",
    "warn":      "#f5a623",
    "danger":    "#ff4d6d",

    "text":      "#e8eaf2",
    "text2":     "#8b90a7",
    "text3":     "#555d7a",

    "node": {
      "A1": "#00e5c0",
      "B":  "#7c6dfa",
      "A2": "#00b8ff"
    }
  }
}
```

### 1.2 Typography

```json
{
  "fonts": {
    "display": "JetBrains Mono",
    "body":    "Outfit"
  },
  "sizes": {
    "xs":  "9.5px",
    "sm":  "10px",
    "md":  "11.5px",
    "base":"12.5px",
    "lg":  "13px",
    "xl":  "16px",
    "stat":"26px"
  },
  "weights": {
    "regular": 400,
    "medium":  500,
    "semibold":600,
    "bold":    700
  }
}
```

### 1.3 Spacing & Radius

```json
{
  "spacing": {
    "xs": "4px",
    "sm": "8px",
    "md": "12px",
    "lg": "16px",
    "xl": "20px"
  },
  "radius": {
    "sm": "6px",
    "md": "8px",
    "lg": "10px",
    "xl": "12px"
  },
  "borderWidth": {
    "default": "1px",
    "accent":  "1.5px",
    "topBar":  "2px"
  }
}
```

---

## 2. Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER  (height: 52px, full-width)                         │
├──────────────┬──────────────────────────────────────────────┤
│              │  STATS ROW  (height: ~72px, 4-col grid)      │
│   SIDEBAR    ├──────────────────────────────────────────────┤
│  (width:     │  WORKFLOW_HEADER  (height: ~44px)            │
│   168px)     ├──────────────────────────────────────────────┤
│              │  WORKFLOW_COLS  (horizontal scroll, ~220px h) │
│  flex-col    ├──────────────────────────────────────────────┤
│  flex-shrink │  SAVE_ROW  (height: ~44px)                   │
│  = 0         ├──────────────────────────────────────────────┤
│              │  SUBTITLE_PREVIEW  (flex:1, overflow-y:auto) │
└──────────────┴──────────────────────────────────────────────┘
```

---

## 3. Components

### 3.1 HEADER

```
Layout: flex, align-center, justify-between
Height: 52px
Background: surface
Border-bottom: 1px border

Children:
  [Logo]          left
  [FileBadge]     center
  [ActionGroup]   right
```

#### 3.1.1 Logo
```json
{
  "component": "Logo",
  "layout": "flex, gap:8px, align-center",
  "children": [
    {
      "type": "IconBox",
      "size": "28x28",
      "borderRadius": "7px",
      "background": "linear-gradient(135deg, accent, accent2)",
      "content": "S",
      "fontSize": "13px",
      "fontWeight": 800
    },
    {
      "type": "Text",
      "content": "SubLingo",
      "fontSize": "16px",
      "fontWeight": 700,
      "letterSpacing": "-0.3px",
      "colorMap": { "Sub": "text", "Lingo": "accent" }
    }
  ]
}
```

#### 3.1.2 FileBadge
```json
{
  "component": "FileBadge",
  "layout": "flex, gap:12px, align-center",
  "background": "surface2",
  "border": "1px border",
  "borderRadius": "md",
  "padding": "6px 14px",
  "children": [
    { "type": "Text", "binding": "state.filename", "font": "JetBrains Mono", "fontSize": "sm", "color": "accent" },
    { "type": "Separator", "content": "·", "color": "text3" },
    { "type": "Text", "template": "字幕数量 {state.subtitleCount}", "fontSize": "sm", "color": "text2",
      "highlight": { "binding": "state.subtitleCount", "color": "text", "fontWeight": 600 } }
  ]
}
```

#### 3.1.3 ActionGroup
```json
{
  "component": "ActionGroup",
  "layout": "flex, gap:8px",
  "buttons": [
    { "label": "重新上传", "variant": "ghost" },
    { "label": "Provider 中心", "variant": "ghost" }
  ]
}
```

**GhostButton style:**
```json
{
  "background": "surface2",
  "border": "1px border",
  "borderRadius": "md",
  "padding": "6px 14px",
  "fontSize": "sm",
  "color": "text2",
  "hover": { "borderColor": "border2", "color": "text" },
  "transition": "all 0.18s"
}
```

---

### 3.2 SIDEBAR

```
Width: 168px
Background: surface
Border-right: 1px border
Padding: 16px 12px
Layout: flex-col, gap:8px
```

#### 3.2.1 SectionLabel
```json
{
  "component": "SectionLabel",
  "content": "翻译流水线",
  "fontSize": "10px",
  "textTransform": "uppercase",
  "letterSpacing": "1.2px",
  "color": "text3",
  "fontWeight": 600,
  "padding": "0 4px",
  "marginBottom": "4px"
}
```

#### 3.2.2 PipelineTrack
```
Layout: flex-col, align-center
Flex: 1

Children pattern:
  NodeCard
  Connector  ← vertical line 1.5px, height:16px
  ConnectorArrow
  NodeCard
  Connector
  ConnectorArrow
  NodeCard
  ...
  AddNodeButton
```

#### 3.2.3 NodeCard
```json
{
  "component": "NodeCard",
  "width": "100%",
  "background": "surface2",
  "border": "1.5px border",
  "borderRadius": "lg",
  "padding": "10px 12px",
  "layout": "flex, align-center, gap:10px",
  "transition": "all 0.18s",

  "states": {
    "default": { "border": "1.5px border", "background": "surface2" },
    "hover":   { "border": "1.5px border2", "background": "surface3" },
    "active-A1": { "border": "1.5px node.A1", "background": "rgba(0,229,192,0.06)" },
    "active-B":  { "border": "1.5px node.B",  "background": "rgba(124,109,250,0.06)" },
    "active-A2": { "border": "1.5px node.A2", "background": "rgba(0,184,255,0.06)" }
  },

  "children": [
    {
      "type": "NodeDot",
      "size": "26x26",
      "borderRadius": "50%",
      "layout": "flex, center",
      "fontSize": "10px",
      "fontWeight": 700,
      "fontFamily": "JetBrains Mono",
      "colorMap": {
        "A1": { "bg": "rgba(0,229,192,0.15)",   "color": "node.A1", "border": "1.5px rgba(0,229,192,0.35)" },
        "B":  { "bg": "rgba(124,109,250,0.15)",  "color": "node.B",  "border": "1.5px rgba(124,109,250,0.35)" },
        "A2": { "bg": "rgba(0,184,255,0.15)",    "color": "node.A2", "border": "1.5px rgba(0,184,255,0.35)" }
      }
    },
    {
      "type": "NodeInfo",
      "layout": "flex-col, flex:1, minWidth:0",
      "children": [
        { "type": "Text", "binding": "node.label",      "fontSize": "md",  "fontWeight": 600, "color": "text",  "truncate": true },
        { "type": "Text", "binding": "node.modelName",  "fontSize": "xs",  "color": "text3", "fontFamily": "JetBrains Mono", "truncate": true, "marginTop": "1px" }
      ]
    },
    {
      "type": "RemoveButton",
      "size": "16x16",
      "borderRadius": "sm",
      "icon": "×",
      "fontSize": "14px",
      "visibility": "hidden-until-parent-hover",
      "hover": { "background": "rgba(255,77,109,0.15)", "color": "danger" },
      "onClick": "removeNode(nodeId)"
    }
  ]
}
```

#### 3.2.4 Connector
```json
{
  "Connector": { "width": "1.5px", "height": "16px", "background": "linear-gradient(to bottom, border2, border)" },
  "ConnectorArrow": {
    "type": "css-triangle",
    "borderLeft": "4px solid transparent",
    "borderRight": "4px solid transparent",
    "borderTop": "5px solid border2",
    "marginBottom": "-2px"
  }
}
```

#### 3.2.5 AddNodeButton
```json
{
  "component": "AddNodeButton",
  "width": "100%",
  "marginTop": "4px",
  "background": "transparent",
  "border": "1.5px dashed border",
  "borderRadius": "lg",
  "padding": "8px",
  "fontSize": "sm",
  "color": "text3",
  "layout": "flex, center, gap:5px",
  "content": ["+ icon (14px)", "添加节点"],
  "hover": { "borderColor": "accent", "color": "accent", "background": "rgba(0,229,192,0.04)" },
  "onClick": "addPipelineNode()"
}
```

#### 3.2.6 StartButton
```json
{
  "component": "StartButton",
  "width": "100%",
  "background": "linear-gradient(135deg, accent, #00c8aa)",
  "border": "none",
  "borderRadius": "lg",
  "padding": "11px",
  "fontSize": "lg",
  "fontWeight": 700,
  "color": "#0a1a16",
  "content": "▶ 开始翻译",
  "boxShadow": "0 4px 20px rgba(0,229,192,0.25)",
  "hover": { "transform": "translateY(-1px)", "boxShadow": "0 6px 28px rgba(0,229,192,0.38)" },
  "active": { "transform": "translateY(0)" },
  "transition": "all 0.2s",
  "onClick": "startTranslation()"
}
```

---

### 3.3 STATS ROW

```json
{
  "component": "StatsRow",
  "layout": "grid, grid-template-columns: repeat(4, 1fr)",
  "borderBottom": "1px border",

  "cards": [
    { "id": "done",    "label": "已完成", "binding": "stats.done",    "sub": "已处理 {stats.done} 条", "color": "accent",  "bottomBorder": "2px accent at 0.3 opacity" },
    { "id": "pending", "label": "待处理", "binding": "stats.pending", "sub": "排队中",                  "color": "warn" },
    { "id": "failed",  "label": "失败",   "binding": "stats.failed",  "sub": "暂无报错",                "color": "danger" },
    { "id": "queue",   "label": "待选队列","binding": "stats.queue",  "sub": "当前权限",                "color": "accent3", "bottomBorder": "2px accent3" }
  ],

  "cardStyle": {
    "padding": "14px 20px",
    "borderRight": "1px border",
    "lastChild": { "borderRight": "none" },
    "label": { "fontSize": "10px", "textTransform": "uppercase", "letterSpacing": "1px", "color": "text3", "fontWeight": 600, "marginBottom": "4px" },
    "value": { "fontSize": "stat", "fontWeight": 700, "fontFamily": "JetBrains Mono" },
    "sub":   { "fontSize": "10px", "color": "text3", "marginTop": "2px" }
  }
}
```

---

### 3.4 WORKFLOW HEADER

```json
{
  "component": "WorkflowHeader",
  "layout": "flex, align-center, justify-between",
  "padding": "12px 20px",
  "borderBottom": "1px border",

  "left": {
    "type": "StatusTitle",
    "layout": "flex, align-center, gap:8px",
    "children": [
      {
        "type": "PulsingDot",
        "size": "6x6",
        "borderRadius": "50%",
        "background": "warn",
        "boxShadow": "0 0 8px warn",
        "animation": "pulse 1.8s ease-in-out infinite"
      },
      { "type": "Text", "content": "工作流配置", "fontSize": "lg", "fontWeight": 600, "color": "text2" }
    ]
  },

  "right": {
    "type": "TabGroup",
    "layout": "flex, gap:4px",
    "tabs": ["参数配置", "运行日志", "字幕预览"],
    "tabStyle": {
      "padding": "5px 12px",
      "borderRadius": "sm",
      "fontSize": "md",
      "color": "text3",
      "border": "1px transparent",
      "hover": { "color": "text2" },
      "active": { "background": "surface2", "borderColor": "border", "color": "text" }
    }
  }
}
```

---

### 3.5 WORKFLOW COLS

```
Layout: flex, gap:12px, overflow-x:auto
Padding: 16px 20px

Children:
  WorkflowCol × N  (one per pipeline node)
  AddMoreCol       (always last)
```

#### 3.5.1 WorkflowCol
```json
{
  "component": "WorkflowCol",
  "width": "210px",
  "flexShrink": 0,
  "background": "surface2",
  "border": "1px border",
  "borderRadius": "xl",
  "overflow": "hidden",
  "borderTop": "2px {node.color}",
  "hover": { "borderColor": "border2" },

  "header": {
    "padding": "12px 14px",
    "borderBottom": "1px border",
    "layout": "flex, align-center, gap:8px",
    "children": [
      { "type": "NodeDot", "size": "22x22", "binding": "node.id" },
      { "type": "Text", "binding": "node.label", "fontSize": "md", "fontWeight": 600, "color": "node.color", "flex": 1 },
      { "type": "ModelBadge", "binding": "node.modelName" }
    ]
  },

  "body": {
    "padding": "12px 14px",
    "layout": "flex-col, gap:10px",
    "children": "ParamRow[]"
  }
}
```

**ModelBadge:**
```json
{
  "component": "ModelBadge",
  "fontSize": "9.5px",
  "fontFamily": "JetBrains Mono",
  "padding": "2px 7px",
  "borderRadius": "4px",
  "background": "surface3",
  "color": "text3",
  "border": "1px border",
  "whiteSpace": "nowrap"
}
```

#### 3.5.2 ParamRow (Slider variant)
```json
{
  "component": "ParamRow",
  "variant": "slider",
  "layout": "flex-col, gap:4px",
  "children": [
    {
      "type": "ParamLabel",
      "layout": "flex, justify-between, align-center",
      "left":  { "binding": "param.label", "fontSize": "10px", "color": "text3", "fontWeight": 500 },
      "right": { "binding": "param.value", "fontFamily": "JetBrains Mono", "fontSize": "10.5px", "color": "text2" }
    },
    {
      "type": "RangeSlider",
      "height": "4px",
      "borderRadius": "2px",
      "trackFill": "linear-gradient(to right, {node.color} {param.percent}%, surface3 {param.percent}%)",
      "thumb": { "size": "13x13", "borderRadius": "50%", "background": "text", "border": "2px bg", "boxShadow": "0 0 0 1px border2" },
      "binding": "param.value",
      "min": "param.min",
      "max": "param.max"
    }
  ]
}
```

#### 3.5.3 ParamRow (Input variant)
```json
{
  "component": "ParamRow",
  "variant": "input",
  "layout": "flex-col, gap:4px",
  "children": [
    { "type": "ParamLabel", "binding": "param.label", "fontSize": "10px", "color": "text3" },
    {
      "type": "TextInput",
      "background": "surface3",
      "border": "1px border",
      "borderRadius": "sm",
      "padding": "6px 10px",
      "fontSize": "md",
      "color": "text",
      "width": "100%",
      "focus": { "borderColor": "border2" }
    }
  ]
}
```

#### 3.5.4 AddMoreCol
```json
{
  "component": "AddMoreCol",
  "flexShrink": 0,
  "width": "52px",
  "minHeight": "180px",
  "background": "transparent",
  "border": "1.5px dashed border",
  "borderRadius": "xl",
  "layout": "flex, center",
  "icon": { "content": "+", "fontSize": "22px", "color": "text3" },
  "hover": { "borderColor": "accent", "background": "rgba(0,229,192,0.03)", "iconColor": "accent" },
  "onClick": "addPipelineNode()"
}
```

---

### 3.6 SAVE ROW

```json
{
  "component": "SaveRow",
  "padding": "10px 20px",
  "borderTop": "1px border",
  "layout": "flex, align-center, justify-between",

  "left": {
    "type": "HintText",
    "fontSize": "10.5px",
    "color": "text3",
    "template": "流水线 {nodeCount} 个节点 · 上次保存 {lastSaved}",
    "highlights": ["nodeCount", "lastSaved"],
    "highlightColor": "text2"
  },

  "right": {
    "type": "SaveButton",
    "label": "💾 保存配置",
    "background": "surface2",
    "border": "1px border2",
    "borderRadius": "md",
    "padding": "7px 18px",
    "fontSize": "md",
    "fontWeight": 600,
    "color": "text",
    "hover": { "background": "surface3", "borderColor": "accent", "color": "accent" },
    "onClick": "saveWorkflowConfig()"
  }
}
```

---

### 3.7 SUBTITLE PREVIEW

```json
{
  "component": "SubtitlePreview",
  "flex": 1,
  "overflowY": "auto",
  "borderTop": "1px border",

  "header": {
    "position": "sticky",
    "top": 0,
    "background": "bg",
    "zIndex": 5,
    "padding": "10px 20px",
    "borderBottom": "1px border",
    "layout": "flex, align-center, justify-between",
    "left": {
      "layout": "flex, align-center, gap:8px",
      "children": [
        { "type": "Text", "content": "字幕预览", "fontSize": "md", "fontWeight": 600, "color": "text2" },
        { "type": "CountBadge", "binding": "state.subtitleCount" }
      ]
    },
    "right": {
      "type": "FilterGroup",
      "filters": [
        { "label": "全部 {total}",  "value": "all",     "default": true },
        { "label": "失败 {failed}", "value": "failed" },
        { "label": "成功 {done}",   "value": "done" }
      ]
    }
  },

  "list": {
    "padding": "10px 20px",
    "layout": "flex-col, gap:8px",
    "children": "SubtitleCard[]"
  }
}
```

**CountBadge:**
```json
{
  "component": "CountBadge",
  "background": "surface2",
  "border": "1px border",
  "borderRadius": "20px",
  "padding": "1px 8px",
  "fontSize": "10.5px",
  "fontFamily": "JetBrains Mono",
  "color": "text2"
}
```

#### 3.7.1 SubtitleCard
```json
{
  "component": "SubtitleCard",
  "background": "surface",
  "border": "1px border",
  "borderRadius": "lg",
  "overflow": "hidden",
  "hover": { "borderColor": "border2" },
  "transition": "border-color 0.15s",

  "header": {
    "padding": "7px 14px",
    "borderBottom": "1px border",
    "background": "surface2",
    "layout": "flex, align-center, justify-between",
    "children": [
      { "type": "Text", "binding": "subtitle.index", "template": "#{index}", "fontFamily": "JetBrains Mono", "fontSize": "10px", "color": "text3" },
      { "type": "Text", "binding": "subtitle.timeRange", "fontFamily": "JetBrains Mono", "fontSize": "10px", "color": "text3" },
      { "type": "StatusBadge", "binding": "subtitle.status" }
    ]
  },

  "body": {
    "layout": "grid, grid-template-columns: 1fr 1fr",
    "children": [
      {
        "id": "source",
        "borderRight": "1px border",
        "padding": "10px 14px",
        "lang": { "content": "JA 原文", "fontSize": "9.5px", "color": "text3", "fontWeight": 600, "letterSpacing": "0.8px", "textTransform": "uppercase", "marginBottom": "5px" },
        "text": { "binding": "subtitle.source", "fontSize": "base", "color": "text", "lineHeight": 1.5 }
      },
      {
        "id": "target",
        "padding": "10px 14px",
        "lang": { "content": "ZH 译文", "fontSize": "9.5px", "color": "text3", "fontWeight": 600, "letterSpacing": "0.8px", "textTransform": "uppercase", "marginBottom": "5px" },
        "text": {
          "binding": "subtitle.target",
          "fontSize": "base",
          "color": "text",
          "lineHeight": 1.5,
          "emptyState": {
            "content": "等待翻译...",
            "color": "text3",
            "fontStyle": "italic",
            "fontSize": "sm"
          },
          "skeleton": {
            "show": "when subtitle.status === 'pending'",
            "height": "10px",
            "background": "surface3",
            "borderRadius": "3px",
            "marginTop": "4px",
            "width": "70%",
            "animation": "shimmer 1.5s ease-in-out infinite"
          }
        }
      }
    ]
  }
}
```

**StatusBadge variants:**
```json
{
  "pending": { "background": "rgba(245,166,35,0.12)", "border": "1px rgba(245,166,35,0.25)", "color": "warn",   "label": "待翻译", "fontSize": "9.5px", "fontWeight": 600 },
  "success": { "background": "rgba(0,229,192,0.12)",  "border": "1px rgba(0,229,192,0.25)",  "color": "accent", "label": "已完成", "fontSize": "9.5px", "fontWeight": 600 },
  "failed":  { "background": "rgba(255,77,109,0.12)", "border": "1px rgba(255,77,109,0.25)", "color": "danger", "label": "失败",   "fontSize": "9.5px", "fontWeight": 600 }
}
```

---

## 4. State Model

```typescript
interface AppState {
  filename: string;           // e.g. "Kaori_Mori.ja-ja.srt"
  subtitleCount: number;      // total subtitle entries

  stats: {
    done:    number;
    pending: number;
    failed:  number;
    queue:   number;
  };

  pipeline: PipelineNode[];   // ordered array
  activeTab: "params" | "logs" | "preview";
  subtitleFilter: "all" | "failed" | "done";
  subtitles: Subtitle[];
}

interface PipelineNode {
  id: string;                 // "A1" | "B" | "A2" | ...
  label: string;              // display name
  modelName: string;          // e.g. "gpt-4.1"
  color: string;              // hex, from color.node map
  params: Record<string, ParamDef>;
}

interface ParamDef {
  label: string;
  type: "slider" | "input";
  value: string | number;
  min?: number;
  max?: number;
}

interface Subtitle {
  index: number;
  timeRange: string;          // "00:00:36,760 → 00:00:37,620"
  source: string;             // original text
  target: string | null;      // translated text, null if pending
  status: "pending" | "success" | "failed";
}
```

---

## 5. Default Pipeline Configuration

```json
{
  "pipeline": [
    {
      "id": "A1",
      "label": "主翻译",
      "modelName": "gpt-4.1",
      "color": "#00e5c0",
      "params": {
        "batchSize":   { "label": "每批次数量", "type": "slider", "value": 20, "min": 1, "max": 50 },
        "contextLines":{ "label": "上下文条数", "type": "slider", "value": 3,  "min": 0, "max": 10 },
        "temperature": { "label": "温度",       "type": "slider", "value": 3,  "min": 0, "max": 10 },
        "sourceLang":  { "label": "源语言",     "type": "input",  "value": "日语 (JA)" },
        "targetLang":  { "label": "目标语言",   "type": "input",  "value": "中文简体 (ZH)" }
      }
    },
    {
      "id": "B",
      "label": "润色优化",
      "modelName": "claude-s-4",
      "color": "#7c6dfa",
      "params": {
        "intensity":   { "label": "润色强度", "type": "slider", "value": 2, "min": 1, "max": 3 },
        "contextLines":{ "label": "上下文条数", "type": "slider", "value": 5, "min": 0, "max": 10 },
        "temperature": { "label": "温度",     "type": "slider", "value": 5, "min": 0, "max": 10 },
        "stylePrompt": { "label": "风格提示词","type": "input",  "value": "自然口语化，保留语气" },
        "maxChars":    { "label": "最大字符数","type": "input",  "value": "42" }
      }
    },
    {
      "id": "A2",
      "label": "质检备用",
      "modelName": "gpt-4o",
      "color": "#00b8ff",
      "params": {
        "trigger":     { "label": "触发条件", "type": "slider", "value": 1, "min": 1, "max": 3 },
        "retries":     { "label": "重试次数", "type": "slider", "value": 3, "min": 1, "max": 5 },
        "temperature": { "label": "温度",     "type": "slider", "value": 2, "min": 0, "max": 10 },
        "endpoint":    { "label": "备用端点", "type": "input",  "value": "api.openai.com" },
        "timeout":     { "label": "超时 (s)", "type": "input",  "value": "30" }
      }
    }
  ]
}
```

---

## 6. Animations

```json
{
  "animations": {
    "pulse": {
      "keyframes": { "0%,100%": { "opacity": 1 }, "50%": { "opacity": 0.4 } },
      "duration": "1.8s",
      "easing": "ease-in-out",
      "iteration": "infinite"
    },
    "shimmer": {
      "keyframes": { "0%,100%": { "opacity": 0.5 }, "50%": { "opacity": 1 } },
      "duration": "1.5s",
      "easing": "ease-in-out",
      "iteration": "infinite"
    }
  },
  "transitions": {
    "default": "all 0.18s",
    "button":  "all 0.2s"
  }
}
```

---

## 7. Interactions

```
addPipelineNode():
  1. Append new PipelineNode to state.pipeline[]
  2. Auto-assign next available node id and color
  3. Render new NodeCard in Sidebar + new WorkflowCol in WorkflowCols
  4. Scroll WorkflowCols area to reveal new column

removeNode(nodeId):
  1. Animate NodeCard: opacity→0, translateX(-10px), duration 200ms
  2. Remove from state.pipeline[]
  3. Remove corresponding WorkflowCol

saveWorkflowConfig():
  1. Serialize state.pipeline to JSON
  2. Persist (localStorage / API)
  3. Update SaveRow lastSaved hint to "刚刚"

startTranslation():
  1. Validate pipeline has ≥ 1 node
  2. Set stats.pending = subtitleCount
  3. Begin batch processing per A1 node batchSize
  4. Update SubtitleCard status and target text in real-time

filterSubtitles(filter):
  1. Set state.subtitleFilter
  2. Re-render SubtitleList with filtered Subtitle[]

switchTab(tab):
  1. Set state.activeTab
  2. Show/hide WorkflowCols vs LogPanel vs SubtitlePreview
```

---

## 8. Scrollbar Style (global)

```css
::-webkit-scrollbar       { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: border2; border-radius: 2px; }
```
