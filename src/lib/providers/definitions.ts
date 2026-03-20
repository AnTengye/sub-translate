import { appEnv } from '../config/env';
import type { ProviderDefinition } from './types';

export const providerDefinitions: ProviderDefinition[] = [
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    icon: '◆',
    color: '#d4a96a',
    desc: 'Anthropic Claude 模型，密钥由本地代理服务提供',
    fields: [
      { key: 'model', label: '模型名称', type: 'text', placeholder: 'claude-3-5-sonnet-latest' },
    ],
    defaults: {
      model: appEnv.claudeModel,
    } as Record<string, string>,
    corsNote: '密钥不再在浏览器中填写，由服务端环境变量统一提供',
  },
  {
    id: 'openai',
    label: 'OpenAI / 兼容接口',
    icon: '◈',
    color: '#74b9ff',
    desc: 'GPT-4o、DeepSeek、Moonshot 等 OpenAI 兼容接口，密钥由本地代理服务提供',
    fields: [
      {
        key: 'endpoint',
        label: 'API 端点',
        type: 'text',
        placeholder: 'https://api.openai.com/v1',
      },
      { key: 'model', label: '模型名称', type: 'text', placeholder: 'gpt-4o-mini' },
    ],
    defaults: {
      endpoint: appEnv.openAiEndpoint,
      model: appEnv.openAiModel,
    } as Record<string, string>,
    corsNote: '前端仅传模型与端点配置，真正的 API Key 由服务端读取',
  },
  {
    id: 'qwen',
    label: '通义千问 Qwen-MT',
    icon: '◉',
    color: '#55efc4',
    desc: '阿里云百炼，专业机器翻译模型，密钥由本地代理服务提供',
    fields: [
      {
        key: 'qwenModel',
        label: '翻译模型',
        type: 'select',
        options: ['qwen-mt-turbo', 'qwen-mt-plus', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
      },
    ],
    defaults: {
      qwenModel: appEnv.qwenModel,
    } as Record<string, string>,
    corsNote: '浏览器不再直连百炼接口，本地代理会代持密钥并转发请求',
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
    ],
    defaults: {
      modelType: 'llm',
    } as Record<string, string>,
    corsNote: '服务端负责 APPID / API Key；如未配置 API Key，可回退到 sign 鉴权',
  },
];
