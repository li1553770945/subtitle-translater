import { AppSettings, DEFAULT_SETTINGS } from '@/types/settings';

const SETTINGS_STORAGE_KEY = 'subtitle-translator-settings';

/**
 * 从 localStorage 加载设置
 */
export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 合并默认设置，确保新增字段有默认值
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        services: {
          ...DEFAULT_SETTINGS.services,
          ...parsed.services,
        },
      };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  return DEFAULT_SETTINGS;
}

/**
 * 保存设置到 localStorage
 */
export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

/**
 * 重置设置为默认值
 */
export function resetSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset settings:', error);
  }

  return DEFAULT_SETTINGS;
}
