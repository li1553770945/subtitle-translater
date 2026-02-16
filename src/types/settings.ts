/**
 * 翻译服务提供商类型
 */
export type TranslationProvider = 'deepseek' | 'openai' | 'google';

/**
 * 翻译模式：单行逐句翻译 或 多行合并翻译
 */
export type TranslationMode = 'single' | 'multi';

/**
 * 翻译选项（由页面传入，不持久化）
 */
export interface TranslationOptions {
  /** 翻译模式 */
  mode: TranslationMode;
  /** 多行模式下，每次合并翻译的字幕条数（2-10） */
  multiLineBatchSize: number;
  /** 单行模式下，作为上下文的字幕条数（前后各 N 条，0-3）。上下文不翻译，仅帮助理解。 */
  contextLines: number;
}

/**
 * 各供应商可用的模型列表
 */
export const PROVIDER_MODELS: Record<TranslationProvider, string[]> = {
  deepseek: [
    'deepseek-chat',
    'deepseek-coder',
  ],
  openai: [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'gpt-4o',
    'gpt-4o-mini',
  ],
  google: [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
};

/**
 * 翻译服务配置
 */
export interface TranslationServiceConfig {
  /** 服务提供商 */
  provider: TranslationProvider;
  /** API 密钥 */
  apiKey: string;
  /** Base URL（可选，用于自定义 API 端点） */
  baseUrl?: string;
  /** 自定义翻译 Prompt，使用 {content}、{sourceLang}、{targetLang}、{context_prompt} 作为占位符 */
  prompt: string;
  /** 上下文 Prompt。启用翻译上下文时，会解析后插入主 Prompt 的 {context_prompt} 位置。使用 {context} 作为上下文占位符 */
  contextPrompt: string;
  /** 是否启用该服务 */
  enabled: boolean;
}

/**
 * 应用设置
 */
export interface AppSettings {
  /** 各翻译服务的配置 */
  services: {
    deepseek: TranslationServiceConfig;
    openai: TranslationServiceConfig;
    google: TranslationServiceConfig;
  };
}

/**
 * 默认设置
 */
/** 默认翻译 Prompt */
export const DEFAULT_PROMPT =
  '请将以下内容从 {sourceLang} 翻译成 {targetLang}，并仅显示翻译后的内容。\n\n{context_prompt}\n\n以下是待翻译的内容：\n\n{content}';

/** 默认上下文 Prompt，使用 {context} 占位符 */
export const DEFAULT_CONTEXT_PROMPT =
  '以下是上下文（仅供参考，请勿翻译）：\n\n{context}';

export const DEFAULT_SETTINGS: AppSettings = {
  services: {
    deepseek: {
      provider: 'deepseek',
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      prompt: DEFAULT_PROMPT,
      contextPrompt: DEFAULT_CONTEXT_PROMPT,
      enabled: true,
    },
    openai: {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com',
      prompt: DEFAULT_PROMPT,
      contextPrompt: DEFAULT_CONTEXT_PROMPT,
      enabled: false,
    },
    google: {
      provider: 'google',
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com',
      prompt: DEFAULT_PROMPT,
      contextPrompt: DEFAULT_CONTEXT_PROMPT,
      enabled: false,
    },
  },
};
