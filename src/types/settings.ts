/**
 * 翻译服务提供商类型
 */
export type TranslationProvider = 'deepseek' | 'openai' | 'google';

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
  /** 自定义翻译 Prompt，使用 {content}、{sourceLang}、{targetLang} 作为占位符 */
  prompt: string;
  /** 是否启用该服务 */
  enabled: boolean;
}

/**
 * 应用设置
 */
export interface AppSettings {
  /** 当前选择的翻译服务提供商 */
  currentProvider: TranslationProvider;
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
export const DEFAULT_SETTINGS: AppSettings = {
  currentProvider: 'deepseek',
  services: {
    deepseek: {
      provider: 'deepseek',
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      prompt: '请将以下从 {sourceLang} 翻译成 {targetLang} 的内容，保持原意和语气：\n\n{content}',
      enabled: true,
    },
    openai: {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com',
      prompt: 'Translate the following text from {sourceLang} to {targetLang}, maintaining the original meaning and tone:\n\n{content}',
      enabled: false,
    },
    google: {
      provider: 'google',
      apiKey: '',
      baseUrl: 'https://translation.googleapis.com',
      prompt: 'Translate the following text from {sourceLang} to {targetLang}:\n\n{content}',
      enabled: false,
    },
  },
};
