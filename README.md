# SRT Translate

基于 `Vite + React + TypeScript` 的日语字幕翻译工具，适合私人部署和个人自用。支持上传字幕文件、选择翻译引擎、批量翻译、失败重试，以及导出中文字幕 `SRT`。

## 功能

- 支持 `.srt` 字幕解析和导出
- 支持 `Claude`、`OpenAI 兼容接口`、`Qwen`、`百度翻译`
- 支持批量翻译和前文上下文携带
- 支持单条重试和批量重试失败条目
- 支持本地开发和 Docker 私有部署

## 适用场景

这个项目定位是私人部署、自用工具。

- 适合：本机、NAS、内网服务器、自用 VPS
- 不适合：直接暴露公网给不受信任用户使用

原因很直接：这是纯前端项目，浏览器会直接请求第三方翻译 API。即使你把默认配置写进环境变量，最终也会被打包进前端资源，不适合公开多用户场景。

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址通常是：

```text
http://localhost:5173
```

## 测试与构建

```bash
npm run test
npm run build
```

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改：

```env
VITE_APP_TITLE=SRT Translate
VITE_DEFAULT_PROVIDER=claude
VITE_CLAUDE_MODEL=claude-3-5-sonnet-latest
VITE_OPENAI_ENDPOINT=https://api.openai.com/v1
VITE_OPENAI_MODEL=gpt-4o-mini
VITE_QWEN_MODEL=qwen-mt-turbo
```

说明：

- `VITE_APP_TITLE`：页面标题
- `VITE_DEFAULT_PROVIDER`：默认选中的翻译引擎
- `VITE_CLAUDE_MODEL`：Claude 默认模型
- `VITE_OPENAI_ENDPOINT`：OpenAI 兼容接口默认地址
- `VITE_OPENAI_MODEL`：OpenAI 兼容接口默认模型
- `VITE_QWEN_MODEL`：Qwen 默认模型

这些变量只用于提供默认值，不会替代运行时手动输入的 API Key。

## Docker 部署

构建并启动：

```bash
docker compose up --build -d
```

访问：

```text
http://localhost:8080
```

停止：

```bash
docker compose down
```

如果你需要自定义默认 provider 或模型，可以在运行 `docker compose up --build` 前设置对应环境变量，Compose 会把它们作为 build args 传给前端构建阶段。

## 项目结构

```text
src/
  features/subtitle-translator/   # 页面、组件、hooks、状态管理
  lib/subtitle/                   # SRT 解析与导出
  lib/providers/                  # provider 元数据、适配器、响应解析
  lib/config/                     # 环境变量读取
```

## Provider 说明

- `Claude`：需要填写 Anthropic API Key
- `OpenAI / 兼容接口`：适用于 OpenAI、DeepSeek、Moonshot、OpenRouter 等兼容接口
- `Qwen`：走阿里云百炼兼容接口
- `百度翻译`：需要 `APP ID` 和 `密钥`

## 如何新增一个 Provider

如果你以后要继续加新引擎，最少只需要动这几处：

1. 在 `src/lib/providers/adapters/` 下新增适配器文件
2. 在 `src/lib/providers/definitions.ts` 添加表单元数据和默认值
3. 在 `src/lib/providers/registry.ts` 注册分发逻辑

项目没有做运行时插件系统，故意保持简单，方便私人维护。
