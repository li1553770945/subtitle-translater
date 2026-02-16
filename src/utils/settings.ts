import { AppSettings, DEFAULT_SETTINGS } from '@/types/settings';

// 检查是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && window.electron;

// localStorage 后备方案（用于非 Electron 环境）
const SETTINGS_STORAGE_KEY = 'subtitle-translator-settings';

/**
 * 从本地文件或 localStorage 加载设置
 */
export async function loadSettings(): Promise<AppSettings> {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    // 优先使用 Electron 文件系统 API
    if (isElectron && window.electron?.settings) {
      const stored = await window.electron.settings.read();
      if (stored) {
        // 合并默认设置，确保新增字段有默认值
        return {
          ...DEFAULT_SETTINGS,
          ...stored,
          services: {
            deepseek: { ...DEFAULT_SETTINGS.services.deepseek, ...stored.services?.deepseek },
            openai: { ...DEFAULT_SETTINGS.services.openai, ...stored.services?.openai },
            google: { ...DEFAULT_SETTINGS.services.google, ...stored.services?.google },
          },
        };
      }
    } else {
      // 后备方案：使用 localStorage
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 合并默认设置，确保新增字段有默认值
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          services: {
            deepseek: { ...DEFAULT_SETTINGS.services.deepseek, ...parsed.services?.deepseek },
            openai: { ...DEFAULT_SETTINGS.services.openai, ...parsed.services?.openai },
            google: { ...DEFAULT_SETTINGS.services.google, ...parsed.services?.google },
          },
        };
      }
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
