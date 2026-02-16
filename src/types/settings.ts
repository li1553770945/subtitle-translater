/**
 * 翻译服务提供商类型
 */
export type TranslationProvider = 'deepseek' | 'openai' | 'google';

/**
 * 翻译模式：单行逐句翻译 或 多行合并翻译
 */
export type TranslationMode = 'single' | 'multi';

import { SubtitleEntry } from './subtitle';

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: {
  /** 当前进度 (0-100) */
  percent: number;
  /** 已完成数量 */
  completed: number;
  /** 总数量 */
  total: number;
  /** 当前正在翻译的条目索引 */
  currentIndex?: number;
  /** 已翻译的条目数组（用于预览） */
  translatedEntries?: SubtitleEntry[];
}) => void;

/**
 * 取消信号类型（用于检测请求是否被取消）
 */
export type AbortSignal = { aborted: boolean };

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
  /** 是否启用翻译上下文（将上下文通过contextPrompt插入，用于理解语境） */
  enableContext?: boolean;
  /** 是否启用连贯优先模式（实验性功能，允许AI根据上下文修正字幕使其更连贯） */
  enableCoherence?: boolean;
  /** 并行翻译数量（2-10），单行模式下有效 */
  parallelCount?: number;
  /** 进度回调函数（可选） */
  onProgress?: ProgressCallback;
  /** 取消信号（用于检测请求是否被取消） */
  abortSignal?: AbortSignal;
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
  /** 自定义翻译 Prompt，使用 {content}、{sourceLang}、{targetLang}、{custom_prompt}、{context_prompt}、{coherence_prompt} 作为占位符 */
  prompt: string;
  /** 上下文 Prompt。启用翻译上下文时，会解析后插入主 Prompt 的 {context_prompt} 位置。使用 {context} 作为上下文占位符 */
  contextPrompt: string;
  /** 连贯性 Prompt（实验性功能）。启用连贯优先模式时，会插入主 Prompt 的 {coherence_prompt} 位置。使用 {context} 作为上下文占位符 */
  coherencePrompt?: string;
  /** 是否启用该服务 */
  enabled: boolean;
}

/**
 * 常用独立prompt项
 */
export interface CustomPromptItem {
  /** 名称（用于快速识别） */
  name: string;
  /** prompt内容 */
  content: string;
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
  /** 常用独立prompt列表（用于快速插入） */
  customPrompts?: CustomPromptItem[];
}

/**
 * 默认设置
 */
/** 默认翻译 Prompt */
export const DEFAULT_PROMPT =
  '请将以下内容从 {sourceLang} 翻译成 {targetLang}，并仅显示翻译后的内容。\n\n{custom_prompt}\n{context_prompt}\n{coherence_prompt}\n\n以下是待翻译的内容：\n\n{content}';

/** 默认上下文 Prompt，使用 {context} 占位符 */
export const DEFAULT_CONTEXT_PROMPT =
  '以下是上下文（仅供参考，请勿翻译）：\n\n{context}';

/** 默认连贯性 Prompt，使用 {context} 占位符 */
export const DEFAULT_COHERENCE_PROMPT =
  '重要提示：这些字幕来自语音识别，可能存在识别错误或不连贯的地方。请根据上下文语境，在翻译时主动修正不通顺、不符合剧情的内容，使翻译结果更加连贯和自然。如果发现明显不符合上下文的内容，可以适当调整或重写，但要保持原意。\n\n上下文：\n{context}';

export const DEFAULT_SETTINGS: AppSettings = {
  services: {
    deepseek: {
      provider: 'deepseek',
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      prompt: DEFAULT_PROMPT,
      contextPrompt: DEFAULT_CONTEXT_PROMPT,
      coherencePrompt: DEFAULT_COHERENCE_PROMPT,
      enabled: true,
    },
    openai: {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com',
      prompt: DEFAULT_PROMPT,
      contextPrompt: DEFAULT_CONTEXT_PROMPT,
      coherencePrompt: DEFAULT_COHERENCE_PROMPT,
      enabled: false,
    },
    google: {
      provider: 'google',
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com',
      prompt: DEFAULT_PROMPT,
      contextPrompt: DEFAULT_CONTEXT_PROMPT,
      coherencePrompt: DEFAULT_COHERENCE_PROMPT,
      enabled: false,
    },
  },
  customPrompts: [],
};
