# SRT Translate

基于 `Vite + React + TypeScript + Node` 的日语字幕翻译工具，适合本机、NAS 或内网环境自用。当前版本通过本地代理服务统一转发各家翻译请求，浏览器不再直接持有第三方密钥。

## 功能

- 支持 `.srt` 字幕解析、预览和导出
- 支持点击上传和拖拽上传字幕文件
- 支持 `Claude`、`OpenAI 兼容接口`、`Qwen`、`百度大模型翻译`
- 支持批量翻译、失败重试、单条重试
- 支持本地开发和 Docker 私有部署

## 架构说明

项目现在是单服务架构：

- 前端页面负责字幕上传、配置和进度展示
- 本地 Node 服务负责：
  - 提供前端页面
  - 代理 `/api/translate/:provider`
  - 读取服务端环境变量中的密钥

这样做的直接收益是：

- 浏览器不需要再处理 CORS
- `API Key / Secret / AppID` 不再出现在前端表单里
- 百度翻译可以按最新大模型文本翻译接口接入

## 本地开发

1. 复制 `.env.example` 为 `.env`
2. 至少填写你要使用的 provider 对应服务端密钥
3. 启动开发服务：

```bash
npm install
npm run dev
```

默认地址：

```text
http://localhost:3000
```

开发模式下由同一个 Node 服务承载前端和 `/api` 代理。

## 生产运行

先构建，再启动：

```bash
npm run build
npm run start
```

## Docker 部署

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

## 环境变量

### 前端默认值

这些变量只用于提供前端默认模型或默认端点：

```env
VITE_APP_TITLE=SRT Translate
VITE_DEFAULT_PROVIDER=claude
VITE_CLAUDE_MODEL=claude-3-5-sonnet-latest
VITE_OPENAI_ENDPOINT=https://api.openai.com/v1
VITE_OPENAI_MODEL=gpt-4o-mini
VITE_QWEN_MODEL=qwen-mt-turbo
```

### 服务端密钥

这些变量由本地代理服务读取，不会再显示在前端表单里：

```env
CLAUDE_API_KEY=
OPENAI_API_KEY=
QWEN_API_KEY=
BAIDU_APP_ID=
BAIDU_API_KEY=
BAIDU_SECRET_KEY=
```

说明：

- `CLAUDE_API_KEY`：Claude 服务端密钥
- `OPENAI_API_KEY`：OpenAI / OpenAI 兼容接口服务端密钥
- `QWEN_API_KEY`：阿里云百炼服务端密钥
- `BAIDU_APP_ID`：百度翻译 APPID
- `BAIDU_API_KEY`：百度大模型文本翻译推荐鉴权方式
- `BAIDU_SECRET_KEY`：百度 `sign` 鉴权回退方式，只有在未配置 `BAIDU_API_KEY` 时才会使用

## 百度翻译接入说明

百度当前接入按“大模型文本翻译 API”处理：

- 地址：`https://fanyi-api.baidu.com/ait/api/aiTextTranslate`
- 默认鉴权：`Authorization: Bearer YOUR_API_KEY`
- 回退鉴权：`appid + q + salt + secretKey` 的 `MD5 sign`

前端只保留非敏感选项，例如：

- `modelType`：`llm` 或 `nmt`
- `reference`：翻译指令

## 测试与构建

```bash
npm test
npm run build
```

## 项目结构

```text
src/
  features/subtitle-translator/   # 页面、组件、hooks、状态管理
  lib/subtitle/                   # SRT 解析与导出
  lib/providers/                  # provider 元数据与前端代理适配
server/
  providers/                     # 服务端 provider 适配器
  translate/                     # 服务端请求验证
```
