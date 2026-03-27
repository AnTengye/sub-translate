# SRT Translate

A Japanese subtitle translation tool built with `Vite + React + TypeScript + Go`, designed for local, NAS, or intranet deployment. The repository is split into isolated `frontend/` and `backend/` directories while keeping root-level scripts and Docker entrypoints.

## Features

- Parse, preview, and export `.srt` subtitle files
- Click or drag-and-drop file upload
- Support for `OpenAI Compatible`, `Claude Compatible`, and `Baidu AI Translation`
- Batch translation with retry for failed items (individual or all)
- Local development and Docker deployment support

## Architecture

The project uses a single-service architecture:

- **Frontend**: Handles subtitle upload, configuration, and progress display
- **Go Server**:
  - Serves the frontend
  - Proxies `/api/translate/:provider` requests
  - Persists Provider Center state with `Gorm + SQLite`
  - Writes translation run logs to filesystem JSON files
  - Reads API keys from server-side environment variables

Benefits:

- No CORS issues in the browser
- `API Key / Secret / AppID` never exposed to the frontend
- Baidu translation uses the latest AI text translation API

## Quick Start

### Local Development

1. Copy `.env.example` to `.env`
2. Fill in the API keys for the providers you want to use
3. Install frontend dependencies from the repo root:

```bash
npm install
```

4. Start the Go API server in one terminal:

```bash
npm run dev:server
```

5. Start the Vite client in another terminal:

```bash
npm install
npm run dev
```

Default frontend URL: `http://localhost:5173`

Vite proxies `/api/*` to `http://localhost:3000`.

### Production

Build the frontend and start the Go server:

```bash
npm run build
npm run start
```

### Docker

```bash
docker compose up --build -d
```

Access at `http://localhost:8080`

Stop with:

```bash
docker compose down
```

## Configuration

### Frontend Defaults

These variables provide default UI values:

```env
VITE_APP_TITLE=SRT Translate
VITE_DEFAULT_PROVIDER=openai-compatible
VITE_CLAUDE_MODEL=claude-3-5-sonnet-latest
VITE_OPENAI_MODEL=gpt-4o-mini
```

### Server Provider Config

These variables are read by the server and never exposed to the frontend:

```env
# Server port (optional, default: 3000)
PORT=3000
DATABASE_PATH=data/app.db
LOG_DIR=logs/translations
TRANSLATE_MAX_CONCURRENCY=10

# Claude
CLAUDE_API_ENDPOINT=https://api.anthropic.com/v1
CLAUDE_API_KEY=your_claude_api_key

# OpenAI Compatible (OpenAI, Qwen, DeepSeek, Moonshot, OpenRouter, etc.)
OPENAI_API_ENDPOINT=https://api.openai.com/v1
OPENAI_API_KEY=your_openai_api_key

# Baidu AI Translation
BAIDU_API_ENDPOINT=https://fanyi-api.baidu.com/ait/api/aiTextTranslate
BAIDU_APP_ID=your_app_id
BAIDU_API_KEY=your_api_key
BAIDU_SECRET_KEY=your_secret_key
```

#### Provider Notes

| Provider | Endpoint | Key |
|----------|----------|-----|
| Claude | Base URL, `/messages` appended | `CLAUDE_API_KEY` |
| OpenAI Compatible | Base URL, `/chat/completions` appended | `OPENAI_API_KEY` |
| Baidu | Full API URL | `BAIDU_API_KEY` (primary) or `BAIDU_SECRET_KEY` (fallback) |

**Baidu Authentication:**
- Primary: `Authorization: Bearer YOUR_API_KEY`
- Fallback: `appid + q + salt + secretKey` MD5 signature (used when `BAIDU_API_KEY` is not set)

## Development

```bash
# Run frontend tests
npm test

# Run frontend tests in watch mode
npm run test:watch

# Run Go tests
npm run test:go

# Build for production
npm run build

# Start the Go server
npm run preview
```

## Translation Logs

Each translation task (including retries) generates a log file:

- Location: `logs/translations/YYYY-MM-DD/`
- Format: JSON
- Status: `completed`, `failed`, or `cancelled`

Log contents:

- File name, provider, batch parameters, context settings
- Original subtitle list (index, timestamp, text)
- Batch requests with full prompts and provider options
- Raw LLM responses
- Fill-in results (target index, timestamp, original, translated, status)
- Batch errors and task summary

**Security:** All API keys and auth headers are redacted from logs.

## Project Structure

```
frontend/src/                     # React app source
frontend/index.html               # Vite entry HTML
frontend/vite.config.ts           # Frontend build and dev proxy
backend/cmd/server/               # Go server entrypoint
backend/internal/app/             # Application services
backend/internal/domain/          # Domain models
backend/internal/infra/           # DB, providers, logging, static assets
backend/internal/transport/http/  # HTTP compatibility layer
```
