import { appEnv } from '../config/env';
import type { ProviderDefinition } from './types';

export const providerDefinitions: ProviderDefinition[] = [
  {
    id: 'openai-compatible',
    label: 'OpenAI Compatible',
    icon: '◈',
    color: '#74b9ff',
    desc: '适用于 OpenAI、Qwen、DeepSeek、Moonshot、OpenRouter 等兼容 /chat/completions 的服务',
    fields: [
      { key: 'model', label: '模型名称', type: 'text', placeholder: 'gpt-4o-mini' },
      {
        key: 'disableThinking',
        label: '关闭 Thinking',
        type: 'checkbox',
        description: '对已适配的推理模型显式关闭 thinking 模式',
      },
    ],
    defaults: {
      model: appEnv.openAiModel,
      disableThinking: '',
    } as Record<string, string>,
    corsNote: '请求地址与 API Key 由服务端环境变量统一提供，前端只配置模型和温度',
  },
  {
    id: 'claude-compatible',
    label: 'Claude Compatible',
    icon: '◆',
    color: '#d4a96a',
    desc: '适用于 Anthropic Claude 及兼容 /v1/messages 的服务',
    fields: [
      { key: 'model', label: '模型名称', type: 'text', placeholder: 'claude-3-5-sonnet-latest' },
    ],
    defaults: {
      model: appEnv.claudeModel,
    } as Record<string, string>,
    corsNote: '请求地址与 API Key 由服务端环境变量统一提供，前端只配置模型',
  },
  {
    id: 'baidu',
    label: '百度大模型翻译 API',
    icon: '◇',
    color: '#fd79a8',
    desc: '百度大模型文本翻译 API，默认走服务端 Bearer 鉴权',
    fields: [
      {
        key: 'modelType',
        label: '翻译模型',
        type: 'select',
        options: ['llm', 'nmt'],
      },
      { key: 'reference', label: '翻译指令', type: 'text', placeholder: '例如：保持口语自然' },
      {
        key: 'punctuationPreprocessing',
        label: '标点预处理（实验性）',
        type: 'checkbox',
        description: '减少模型按句拆分导致的错位风险',
      },
    ],
    defaults: {
      modelType: 'llm',
      punctuationPreprocessing: '',
    } as Record<string, string>,
    corsNote: '服务端负责 APPID / API Key；如未配置 API Key，可回退到 sign 鉴权',
  },
];
