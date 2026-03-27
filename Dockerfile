FROM node:22-alpine AS frontend-build
WORKDIR /app

ARG VITE_APP_TITLE="SRT Translate"
ARG VITE_DEFAULT_PROVIDER=openai-compatible
ARG VITE_CLAUDE_MODEL=claude-3-5-sonnet-latest
ARG VITE_OPENAI_MODEL=gpt-4o-mini

ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_DEFAULT_PROVIDER=$VITE_DEFAULT_PROVIDER
ENV VITE_CLAUDE_MODEL=$VITE_CLAUDE_MODEL
ENV VITE_OPENAI_MODEL=$VITE_OPENAI_MODEL

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci
COPY frontend ./frontend
RUN npm run -w frontend build

FROM golang:1.23-alpine AS go-build
WORKDIR /app/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/cmd ./cmd
COPY backend/internal ./internal
RUN CGO_ENABLED=0 go build -o /out/srt-translate ./cmd/server

FROM alpine:3.21
WORKDIR /app

ENV PORT=3000
ENV DIST_DIR=/app/dist
ENV DATABASE_PATH=/app/data/app.db
ENV LOG_DIR=/app/logs/translations

COPY --from=frontend-build /app/frontend/dist ./dist
COPY --from=go-build /out/srt-translate ./srt-translate

EXPOSE 3000

CMD ["./srt-translate"]
