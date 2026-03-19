/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;
  readonly VITE_DEFAULT_PROVIDER?: string;
  readonly VITE_CLAUDE_MODEL?: string;
  readonly VITE_OPENAI_ENDPOINT?: string;
  readonly VITE_OPENAI_MODEL?: string;
  readonly VITE_QWEN_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
