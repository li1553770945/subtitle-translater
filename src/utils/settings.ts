import {
  AppSettings,
  ApiConfig,
  DEFAULT_SETTINGS,
  DEFAULT_PROMPT_SET,
  PromptSet,
  API_TYPE_PRESETS,
  PROVIDER_MODELS,
  TranslationProvider,
} from '@/types/settings';

// 检查是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && window.electron;

// localStorage 后备方案（用于非 Electron 环境）
const SETTINGS_STORAGE_KEY = 'subtitle-translator-settings';

/** 旧版服务配置可能包含的 prompt 字段（用于迁移） */
interface LegacyServiceConfig {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
  prompt?: string;
  contextPrompt?: string;
  coherenceModePrompt?: string;
}

function migrateFromLegacy(stored: Record<string, unknown>): AppSettings {
  const services = stored.services as Record<string, LegacyServiceConfig> | undefined;
  const storedPromptSets = stored.promptSets as PromptSet[] | undefined;
  let promptSets: PromptSet[] = Array.isArray(storedPromptSets) && storedPromptSets.length > 0 ? storedPromptSets : [];

  // 如果没有 promptSets 或为空，从旧版 services 的 prompt 迁移
  if (promptSets.length === 0) {
    const providerLabels: Record<string, string> = { deepseek: 'DeepSeek', openai: 'OpenAI', google: 'Google' };
    promptSets = [];
    if (services) {
      for (const [provider, config] of Object.entries(services)) {
        if (config?.prompt != null) {
          promptSets.push({
            id: `migrated-${provider}-${Date.now()}`,
            name: `${providerLabels[provider] || provider} 导入`,
            prompt: config.prompt,
            contextPrompt: config.contextPrompt ?? '',
            coherenceModePrompt: config.coherenceModePrompt,
          });
        }
      }
    }
    if (promptSets.length === 0) {
      promptSets = [DEFAULT_PROMPT_SET];
    }
  }

  // 若已有 apiConfigs 则直接使用，否则从旧版 services 迁移
  const storedApiConfigs = stored.apiConfigs as ApiConfig[] | undefined;
  let apiConfigs: ApiConfig[];
  if (Array.isArray(storedApiConfigs) && storedApiConfigs.length > 0) {
    apiConfigs = storedApiConfigs;
  } else {
    const providerLabels: Record<string, string> = {
      deepseek: 'DeepSeek',
      openai: 'OpenAI',
      google: 'Google',
    };
    apiConfigs = (['deepseek', 'openai', 'google'] as TranslationProvider[]).map((p) => {
      const c = services?.[p];
      const preset = API_TYPE_PRESETS[p];
      return {
        id: `api-${p}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: providerLabels[p] || p,
        type: p,
        baseUrl: c?.baseUrl ?? preset.baseUrl,
        apiKey: c?.apiKey ?? '',
        models: preset.models?.length ? [...preset.models] : [...PROVIDER_MODELS[p]],
        enabled: c?.enabled ?? (p === 'deepseek'),
      };
    });
  }

  const customPrompts = Array.isArray(stored.customPrompts) ? stored.customPrompts : [];
  const result: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    apiConfigs,
    promptSets,
    customPrompts,
  };
  return result;
}

/**
 * 从本地文件或 localStorage 加载设置
 */
export async function loadSettings(): Promise<AppSettings> {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    let stored: Record<string, unknown> | null = null;
    if (isElectron && window.electron?.settings) {
      stored = await window.electron.settings.read();
    } else {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    }
    if (stored) {
      return migrateFromLegacy(stored);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  return DEFAULT_SETTINGS;
}

/**
 * 保存设置到本地文件或 localStorage
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // 优先使用 Electron 文件系统 API
    if (isElectron && window.electron?.settings) {
      const result = await window.electron.settings.write(settings);
      if (!result.success) {
        throw new Error(result.error || '保存设置失败');
      }
    } else {
      // 后备方案：使用 localStorage
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

/**
 * 重置设置为默认值
 */
export async function resetSettings(): Promise<AppSettings> {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    // 优先使用 Electron 文件系统 API
    if (isElectron && window.electron?.settings) {
      await window.electron.settings.write(DEFAULT_SETTINGS);
    } else {
      // 后备方案：使用 localStorage
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to reset settings:', error);
  }

  return DEFAULT_SETTINGS;
}
