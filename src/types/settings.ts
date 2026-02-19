/**
 * 翻译服务提供商类型
 */
export type TranslationProvider = 'deepseek' | 'openai' | 'google';

/**
 * 翻译模式：单行逐句翻译 或 多行合并翻译
 */
export type TranslationMode = 'single' | 'multi';

/**
 * 处理模式：翻译模式（translate）或连贯模式（coherence）
 * - translate: 翻译模式，将源语言翻译成目标语言
 * - coherence: 连贯模式，通过剧情脑补修正字幕，使其通顺连贯（不进行翻译）
 */
export type ProcessMode = 'translate' | 'coherence';

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
  /** 处理模式：翻译模式（translate）或连贯模式（coherence） */
  processMode?: ProcessMode;
  /** 多行模式下，每次合并翻译的字幕条数（2-10） */
  multiLineBatchSize: number;
  /** 单行模式下，作为上下文的字幕条数（前后各 N 条，0-3）。上下文不翻译，仅帮助理解。 */
  contextLines: number;
  /** 是否启用翻译上下文（将上下文通过contextPrompt插入，用于理解语境） */
  enableContext?: boolean;
  /** 并行翻译数量（2-10），单行模式下有效 */
  parallelCount?: number;
  /** 进度回调函数（可选） */
  onProgress?: ProgressCallback;
  /** 取消信号（用于检测请求是否被取消） */
  abortSignal?: AbortSignal;
}

/**
 * 各供应商可用的模型列表（仅作预设，实际以各 API 配置中的 models 为准）
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

/** 按类型预设的 baseUrl 与模型列表，选择类型时自动填入 */
export const API_TYPE_PRESETS: Record<TranslationProvider, { baseUrl: string; models: string[] }> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    models: [...PROVIDER_MODELS.deepseek],
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    models: [...PROVIDER_MODELS.openai],
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: [...PROVIDER_MODELS.google],
  },
};

/**
 * 单条 API 配置：名称、类型、base_url、apikey、模型列表，可增删
 */
export interface ApiConfig {
  /** 唯一标识 */
  id: string;
  /** 显示名称（如「我的 DeepSeek」） */
  name: string;
  /** 类型：选择后自动填入默认 baseUrl 和模型列表 */
  type: TranslationProvider;
  /** Base URL */
  baseUrl: string;
  /** API Key */
  apiKey: string;
  /** 模型列表（翻译时在此列表中选模型） */
  models: string[];
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 翻译服务配置（仅包含 API 相关，Prompt 独立管理）
 * @deprecated 使用 ApiConfig 与 apiConfigs 替代
 */
export interface TranslationServiceConfig {
  /** 服务提供商 */
  provider: TranslationProvider;
  /** API 密钥 */
  apiKey: string;
  /** Base URL（可选，用于自定义 API 端点） */
  baseUrl?: string;
  /** 是否启用该服务 */
  enabled: boolean;
}

/**
 * Prompt 套装：包含翻译、上下文、连贯模式等成套的 prompt
 * 翻译时可独立选择使用哪套 prompt，与模型解耦
 */
export interface PromptSet {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 翻译主 Prompt，使用 {content}、{sourceLang}、{targetLang}、{custom_prompt}、{context_prompt} 占位符 */
  prompt: string;
  /** 上下文 Prompt，使用 {context} 占位符 */
  contextPrompt: string;
  /** 连贯模式主 Prompt（选择连贯模式时使用），使用 {content}、{custom_prompt}、{context_prompt} 占位符 */
  coherenceModePrompt?: string;
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
  /** API 配置列表（可增删，每项含名称、类型、baseUrl、apiKey、模型列表） */
  apiConfigs: ApiConfig[];
  /** Prompt 套装列表，翻译时可独立选择使用哪套 */
  promptSets: PromptSet[];
  /** 常用独立prompt列表（用于快速插入到 {custom_prompt}） */
  customPrompts?: CustomPromptItem[];
}

/**
 * 默认设置
 */
/** 默认翻译 Prompt */
export const DEFAULT_PROMPT =
  '请将以下内容从 {sourceLang} 翻译成 {targetLang}，并仅显示翻译后的内容。\n\n{custom_prompt}\n{context_prompt}\n\n以下是待翻译的内容：\n\n{content}';

/** 默认上下文 Prompt，使用 {context} 占位符 */
export const DEFAULT_CONTEXT_PROMPT =
  '以下是上下文（仅供参考，请勿翻译）：\n\n{context}';

/** 默认连贯模式主 Prompt（用于连贯模式，不进行翻译） */
export const DEFAULT_COHERENCE_MODE_PROMPT =
  '你是一个字幕修正助手。这些字幕来自语音识别软件，可能存在识别错误、不连贯或不符合逻辑的地方。\n\n{custom_prompt}\n{context_prompt}\n\n请根据上下文，只对当前这句进行修正：使语句通顺、逻辑连贯、标点正确；若原句明显有识别错误或逻辑错误，可合理推测并修正。\n\n重要约束：只输出修正后的台词本身。不要添加括号内的动作、神态、环境等描述（例如不要出现「（轻笑着）」「（抚摸对方腹部）」这类内容），不要无中生有任何原字幕中没有的信息。\n\n目标字幕：\n{content}';

/** 默认 Prompt 套装 */
export const DEFAULT_PROMPT_SET: PromptSet = {
  id: 'default',
  name: '默认',
  prompt: DEFAULT_PROMPT,
  contextPrompt: DEFAULT_CONTEXT_PROMPT,
  coherenceModePrompt: DEFAULT_COHERENCE_MODE_PROMPT,
};

function defaultApiConfig(id: string, type: TranslationProvider, name: string, enabled: boolean): ApiConfig {
  const preset = API_TYPE_PRESETS[type];
  return {
    id,
    name,
    type,
    baseUrl: preset.baseUrl,
    apiKey: '',
    models: [...preset.models],
    enabled,
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiConfigs: [
    defaultApiConfig('api-deepseek', 'deepseek', 'DeepSeek', true),
    defaultApiConfig('api-openai', 'openai', 'OpenAI', false),
    defaultApiConfig('api-google', 'google', 'Google', false),
  ],
  promptSets: [DEFAULT_PROMPT_SET],
  customPrompts: [],
};
