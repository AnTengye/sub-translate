import type { ProviderDefinition } from './types';

export const providerDefinitions: ProviderDefinition[] = [
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    icon: '◆',
    color: '#d4a96a',
    desc: '内置免费，无需 API Key，高质量翻译',
    fields: [],
    defaults: {},
  },
  {
    id: 'openai',
    label: 'OpenAI / 兼容接口',
    icon: '◈',
    color: '#74b9ff',
    desc: 'GPT-4o、DeepSeek、Moonshot 等 OpenAI 兼容接口',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
      {
        key: 'endpoint',
        label: 'API 端点',
        type: 'text',
        placeholder: 'https://api.openai.com/v1',
      },
      { key: 'model', label: '模型名称', type: 'text', placeholder: 'gpt-4o-mini' },
    ],
    defaults: {
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    },
  },
  {
    id: 'qwen',
    label: '通义千问 Qwen-MT',
    icon: '◉',
    color: '#55efc4',
    desc: '阿里云百炼，专业机器翻译模型',
    fields: [
      { key: 'apiKey', label: 'API Key (百炼)', type: 'password', placeholder: 'sk-...' },
      {
        key: 'qwenModel',
        label: '翻译模型',
        type: 'select',
        options: ['qwen-mt-turbo', 'qwen-mt-plus', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
      },
    ],
    defaults: {
      qwenModel: 'qwen-mt-turbo',
    },
    corsNote: '注意：需在浏览器端支持 CORS，建议配合代理服务',
  },
  {
    id: 'baidu',
    label: '百度翻译 API',
    icon: '◇',
    color: '#fd79a8',
    desc: '百度通用翻译 API，需要 AppID 和密钥',
    fields: [
      { key: 'appId', label: 'APP ID', type: 'text', placeholder: '百度翻译 APP ID' },
      { key: 'secretKey', label: '密钥', type: 'password', placeholder: '百度翻译密钥' },
      {
        key: 'proxyUrl',
        label: 'CORS 代理地址 (可选)',
        type: 'text',
        placeholder: 'https://corsproxy.io/?',
      },
    ],
    defaults: {},
    corsNote: '浏览器直连可能遇到 CORS 限制，建议填写代理地址',
  },
];
